import { ChatCompletionRequest, ChatCompletionResponse, ChatCompletionChunk } from './types';

// DeepSeek 模型名称映射到 Cloudflare AI 模型名称
const MODEL_MAPPING: Record<string, string> = {
  'deepseek-chat': '@cf/deepseek-ai/deepseek-v3',
  'deepseek-reasoner': '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
};

/**
 * 创建聊天补全响应
 * 支持流式和非流式响应
 */
export async function createChatCompletion(
  request: ChatCompletionRequest,
  env: any
): Promise<Response> {
  try {
    const { model, messages, stream = false, ...otherParams } = request;
    
    // 映射模型名称到 Cloudflare AI 模型名称
    const cfModel = MODEL_MAPPING[model] || model;
    
    // 确保 stream 是布尔值
    const isStream = stream === true || stream === 'true';
    
    // 调用 Cloudflare AI
    const aiResponse = await env.AI.run(cfModel, {
      stream: isStream,
      messages,
      ...otherParams,
    });
    
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
      // 对于非流式响应，处理响应内容
      let result = '';
      
      try {
        // 检查 aiResponse 是否为 ReadableStream
        if (aiResponse && typeof aiResponse.getReader === 'function') {
          // 如果是流，读取流内容
          const reader = aiResponse.getReader();
          
          // 读取流块
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            result += new TextDecoder().decode(value);
          }
        } else if (typeof aiResponse === 'string') {
          // 如果是字符串，直接使用
          result = aiResponse;
        } else if (aiResponse && typeof aiResponse === 'object') {
          // 如果是对象，尝试提取响应
          if ('response' in aiResponse) {
            result = aiResponse.response || '';
          } else if ('text' in aiResponse) {
            result = aiResponse.text || '';
          } else {
            // 如果无法提取，转为 JSON 字符串
            result = JSON.stringify(aiResponse);
          }
        } else {
          // 如果都不是，使用空字符串
          result = '';
        }
        
        // 格式化响应为 DeepSeek API 格式
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
                content: result,
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

/**
 * 将 Cloudflare AI 流转换为 DeepSeek API 格式
 */
export function transformStreamToDeepSeekFormat(
  stream: ReadableStream,
  model: string
): ReadableStream {
  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  
  // 创建转换器将 Cloudflare AI 流格式转换为 DeepSeek API 格式
  const transformer = new TransformStream({
    async transform(chunk, controller) {
      try {
        const text = new TextDecoder().decode(chunk);
        
        // 跳过空块
        if (!text.trim()) return;
        
        // 整体处理块而不是按行处理
        if (text.startsWith('data: ')) {
          const data = text.substring(6).trim();
          
          if (data === '[DONE]') {
            controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
            return;
          }
          
          try {
            // 跳过空数据或不完整数据
            if (!data || data === '{}' || (data.includes('"usage"') && !data.includes('"response"'))) {
              return;
            }
            
            const parsed = JSON.parse(data);
            
            // 只有当有响应内容时才发送
            if (parsed.response !== undefined) {
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
            // JSON 解析失败时尝试直接提取响应值
            const responseMatch = data.match(/"response":"([^"]*)"/); 
            if (responseMatch && responseMatch[1]) {
              const content = responseMatch[1];
              
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
              // 对于无法解析的非空数据，发送空内容
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
          // 对于非 data 块，原样传递
          controller.enqueue(new TextEncoder().encode(`${text}\n`));
        }
      } catch (error) {
        // 错误处理
      }
    },
  });
  
  return stream.pipeThrough(transformer);
}
