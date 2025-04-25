import { ChatCompletionRequest, ChatCompletionResponse, ChatCompletionChunk } from './types';

// Map DeepSeek model names to Cloudflare AI model names
const MODEL_MAPPING: Record<string, string> = {
  'deepseek-chat': '@cf/deepseek-ai/deepseek-v3',
  'deepseek-reasoner': '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  // Add more models as needed
};

export async function createChatCompletion(
  request: ChatCompletionRequest,
  env: any
): Promise<Response> {
  try {
    const { model, messages, stream = false, ...otherParams } = request;
    
    // Map the model name to Cloudflare AI model name
    const cfModel = MODEL_MAPPING[model] || model;
    
    // Log the request for debugging
    console.log('Request to Cloudflare AI:', { cfModel, stream, messages, ...otherParams });
    
    // Make sure stream is a boolean
    const isStream = stream === true || stream === 'true';
    
    // Call Cloudflare AI
    const aiResponse = await env.AI.run(cfModel, {
      stream: isStream, // Ensure we pass a boolean
      messages,
      ...otherParams,
    });

    // Log the response for debugging
    console.log('Response from Cloudflare AI:', typeof aiResponse, aiResponse);
    
    // Handle streaming and non-streaming responses differently
    if (isStream) {
      // For streaming, we need to transform the stream to match the DeepSeek API format
      const transformedStream = transformStreamToDeepSeekFormat(aiResponse, model);
      
      return new Response(transformedStream, {
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          'connection': 'keep-alive',
        },
      });
    } else {
      // For non-streaming, convert the stream to a JSON response
      // First, read the stream
      const reader = aiResponse.getReader();
      let result = '';
      
      try {
        // Read the stream chunks
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          result += new TextDecoder().decode(value);
        }
        
        console.log('Non-streaming response content:', result);
        
        // Try to extract the response content
        let content = result;
        
        // Format the response according to DeepSeek API format
        const response: ChatCompletionResponse = {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: content,
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
        };
        
        return new Response(JSON.stringify(response), {
          headers: { 'content-type': 'application/json' },
        });
      } catch (error) {
        console.error('Error reading stream:', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('Error in createChatCompletion:', error);
    return new Response(
      JSON.stringify({
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'internal_server_error',
          param: null,
          code: 'internal_server_error',
        },
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
}

// Helper function to transform Cloudflare AI stream to DeepSeek API format
export function transformStreamToDeepSeekFormat(
  stream: ReadableStream,
  model: string
): ReadableStream {
  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  
  // Create a transformer to convert Cloudflare AI stream format to DeepSeek API format
  const transformer = new TransformStream({
    async transform(chunk, controller) {
      try {
        const text = new TextDecoder().decode(chunk);
        console.log('Stream chunk:', text);
        
        // Skip empty chunks
        if (!text.trim()) return;
        
        // Handle the chunk as a whole instead of line by line
        // This helps with chunks that contain newlines in the JSON
        if (text.startsWith('data: ')) {
          const data = text.substring(6).trim();
          
          if (data === '[DONE]') {
            controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
            return;
          }
          
          try {
            // Try to parse as JSON
            // 检查数据是否为空或格式不完整
            if (!data || data === '{}' || data.includes('"usage"') && !data.includes('"response"')) {
              // 跳过空数据或不包含响应内容的数据
              console.log('Skipping empty or incomplete data:', data);
              return;
            }
            
            const parsed = JSON.parse(data);
            console.log('Parsed chunk:', parsed);
            
            // 只有当有响应内容时才发送
            if (parsed.response !== undefined) {
              // Create DeepSeek API format chunk
              const chunk: ChatCompletionChunk = {
                id,
                object: 'chat.completion.chunk',
                created,
                model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: parsed.response || '',
                    },
                    finish_reason: parsed.done ? 'stop' : null,
                  },
                ],
              };
              
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
            }
          } catch (e) {
            // If JSON parsing fails, try to extract the response value directly
            console.log('JSON parsing failed, trying direct extraction');
            
            // Try to extract the response value using regex
            const responseMatch = data.match(/"response":"([^"]*)"/); 
            if (responseMatch && responseMatch[1]) {
              const content = responseMatch[1];
              console.log('Extracted content:', content);
              
              const chunk: ChatCompletionChunk = {
                id,
                object: 'chat.completion.chunk',
                created,
                model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: content,
                    },
                    finish_reason: null,
                  },
                ],
              };
              
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
            } else if (data && data.trim() && data !== '{}') {
              // 只有当数据不为空且不是空对象时才尝试传递原始数据
              // 但不显示错误消息，只传递空内容
              const chunk: ChatCompletionChunk = {
                id,
                object: 'chat.completion.chunk',
                created,
                model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: '',
                    },
                    finish_reason: null,
                  },
                ],
              };
              
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
            }
          }
        } else {
          // For non-data chunks, pass through as is
          controller.enqueue(new TextEncoder().encode(`${text}\n`));
        }
      } catch (error) {
        console.error('Error in stream transform:', error);
      }
    },
  });
  
  return stream.pipeThrough(transformer);
}
