/**
 * DeepSeek API implementation for Cloudflare Workers
 * 
 * 实现标准的 DeepSeek API 接口，兼容 OpenAI 格式
 * 端点:
 * - POST /chat/completions - 聊天补全（支持流式和非流式）
 * - POST /v1/chat/completions - 聊天补全（OpenAI 兼容路径）
 */

import { createChatCompletion } from './deepseek-api';
import { ChatCompletionRequest } from './types';

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
					const body = await request.json() as ChatCompletionRequest;
					return await createChatCompletion(body, env);
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
