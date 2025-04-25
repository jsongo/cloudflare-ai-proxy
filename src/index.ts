/**
 * DeepSeek API implementation for Cloudflare Workers
 * 
 * This worker implements a standard DeepSeek API interface compatible with OpenAI format
 * Endpoints:
 * - POST /chat/completions - For chat completions (streaming and non-streaming)
 *
 * Learn more at https://api-docs.deepseek.com/
 */

import { createChatCompletion } from './deepseek-api';
import { ChatCompletionRequest } from './types';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Handle CORS preflight requests
		if (request.method === 'OPTIONS') {
			return handleCORS(request);
		}

		// Add CORS headers to all responses
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		};

		try {
			const url = new URL(request.url);
			const path = url.pathname;

			// Chat completions endpoint
			if (path === '/chat/completions' || path === '/v1/chat/completions') {
				if (request.method !== 'POST') {
					return new Response(JSON.stringify({ error: 'Method not allowed' }), {
						status: 405,
						headers: { 'content-type': 'application/json', ...corsHeaders },
					});
				}

				try {
					// Parse the request body
					const body = await request.json() as ChatCompletionRequest;
					// Log the request body for debugging
					console.log('Request body:', JSON.stringify(body, null, 2));
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

			// Demo endpoint - for testing
			if (path === '/' || path === '/demo') {
				const stream = await env.AI.run("@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", {
					stream: true,
					max_tokens: 512,
					messages: [
						{
							role: "user",
							content: "What is the origin of the phrase Hello, World"
						}
					],
				});
				return new Response(stream, {
					headers: { "content-type": "text/event-stream", ...corsHeaders },
				});
			}

			// Return 404 for all other routes
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

// Handle CORS preflight requests
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
