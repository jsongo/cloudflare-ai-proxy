/**
 * DeepSeek API implementation for Cloudflare Workers
 *
 * 实现标准的 DeepSeek API 接口，兼容 OpenAI 格式
 * 端点:
 * - POST /chat/completions - 聊天补全（支持流式和非流式）
 * - POST /v1/chat/completions - 聊天补全（OpenAI 兼容路径）
 */

import { ChatCompletionRequest } from "./types";

// DeepSeek 模型名称映射到 Cloudflare AI 模型名称
const MODEL_MAPPING: Record<string, string> = {
	'qwq': '@cf/qwen/qwq-32b',
	'qwen-coder': '@cf/qwen/qwen2.5-coder-32b-instruct',
	'deepseek-reasoner': '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
};
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// 处理 CORS 预检请求
		if (request.method === 'OPTIONS') {
			return handleCORS(request);
		}

		// 为所有响应添加 CORS 头
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		};

		try {
			const url = new URL(request.url);
			const path = url.pathname;

			// 聊天补全端点
			if (path === '/chat/completions' || path === '/v1/chat/completions') {
				if (request.method !== 'POST') {
					return new Response(JSON.stringify({ error: 'Method not allowed' }), {
						status: 405,
						headers: { 'content-type': 'application/json', ...corsHeaders },
					});
				}

				// 验证 API token
				if (!validateToken(request, env)) {
					return new Response(JSON.stringify({ error: 'Unauthorized', message: 'Invalid API token' }), {
						status: 401,
						headers: { 'content-type': 'application/json', ...corsHeaders },
					});
				}

				try {
					// 解析请求体
					let body: ChatCompletionRequest;
					try {
						body = await request.json<ChatCompletionRequest>();
					} catch (e) {
						return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
							status: 400,
							headers: { 'content-type': 'application/json', ...corsHeaders },
						});
					}

					// 验证消息数组
					const messages = body.messages || [];
					if (!Array.isArray(messages)) {
						return new Response(JSON.stringify({ error: 'Messages must be an array' }), {
							status: 400,
							headers: { 'content-type': 'application/json', ...corsHeaders },
						});
					}

					// 映射模型名称到 Cloudflare AI 模型名称
					const cfModel = MODEL_MAPPING[body.model] || body.model;

					const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n') + '\nassistant:'

					const aiResult = await env.AI.run(cfModel, {
						prompt,
						max_tokens: 200,
					})
					const fullResponse = aiResult.response

					if (!body.stream) {
						// 非流式响应
						// 生成唯一ID供后续流式响应使用
						const responseId = 'chatcmpl-' + Math.random().toString(36).slice(2);

						return new Response(JSON.stringify({
							id: responseId,
							object: 'chat.completion',
							created: Math.floor(Date.now() / 1000),
							model: body.model,
							choices: [{
								index: 0,
								message: {
									role: 'assistant',
									content: fullResponse,
								},
								finish_reason: 'stop',
							}],
							usage: {
								prompt_tokens: 0,
								completion_tokens: 0,
								total_tokens: 0,
							}
						}), {
							headers: { 'Content-Type': 'application/json' }
						})
					}

					// 模拟流式响应（SSE）
					const encoder = new TextEncoder()
					const streamBody = new ReadableStream({
						async start(controller) {
							const chunks = fullResponse ? chunkText(fullResponse, 20) : [''];
							const responseId = 'chatcmpl-' + Math.random().toString(36).slice(2);

							for (const chunk of chunks) {
								const json = JSON.stringify({
									id: responseId,
									object: 'chat.completion.chunk',
									choices: [{
										delta: { content: chunk },
										index: 0,
										finish_reason: null,
									}]
								});
								controller.enqueue(encoder.encode(`data: ${json}\n\n`));
								await new Promise(resolve => setTimeout(resolve, 50)); // 添加50ms延迟
							}

							// 最后一段：通知完成
							const doneMsg = JSON.stringify({
								id: responseId,
								object: 'chat.completion.chunk',
								choices: [{
									delta: {},
									index: 0,
									finish_reason: 'stop',
								}]
							});
							controller.enqueue(encoder.encode(`data: ${doneMsg}\n\n`));
							await new Promise(resolve => setTimeout(resolve, 50));
							controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
							controller.close();
						}
					})

					return new Response(streamBody, {
						headers: {
							'Content-Type': 'text/event-stream',
							'Cache-Control': 'no-cache',
							'Connection': 'keep-alive',
						}
					})
				} catch (error) {
					console.error('Error processing chat completion:', error);
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
							headers: { 'content-type': 'application/json', ...corsHeaders },
						}
					);
				}
			}

			// 返回 404 给所有其他路由
			return new Response(JSON.stringify({ error: 'Not found' }), {
				status: 404,
				headers: { 'content-type': 'application/json', ...corsHeaders },
			});
		} catch (error) {
			console.error('Error handling request:', error);
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
					headers: { 'content-type': 'application/json', ...corsHeaders },
				}
			);
		}
	},
} satisfies ExportedHandler<Env>;

// 处理 CORS 预检请求
function handleCORS(request: Request): Response {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
			'Access-Control-Max-Age': '86400',
		},
	});
}

/**
 * 验证 API token
 * 从请求头中获取 Authorization 并与环境变量中的 API_TOKEN 进行比对
 */
function validateToken(request: Request, env: Env): boolean {
	// 获取 Authorization 头
	const authHeader = request.headers.get('Authorization');

	// 检查是否存在 Authorization 头
	if (!authHeader) {
		return false;
	}

	// 检查格式是否为 "Bearer <token>"
	const match = authHeader.match(/^Bearer\s+(.+)$/);
	if (!match) {
		return false;
	}

	// 提取 token 并与环境变量中的 API_TOKEN 比对
	const token = match[1];
	return token === env.API_TOKEN;
}

// 简单分割文本为 chunk 数组
function chunkText(text: string, size: number) {
	if (!text || size <= 0) return [''];

	const chunks: string[] = [];
	for (let i = 0; i < text.length; i += size) {
		chunks.push(text.slice(i, i + size));
	}
	return chunks;
}
