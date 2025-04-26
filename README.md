# DeepSeek API on Cloudflare Workers

基于 Cloudflare Workers 实现的标准 DeepSeek API 接口，兼容 OpenAI 格式，支持流式输出。

## 特性

- 完全兼容 OpenAI API 格式
- 支持流式和非流式响应
- 实现了 `/chat/completions` 和 `/v1/chat/completions` 端点
- 支持多种 DeepSeek 模型

## 可用模型

支持以下 DeepSeek 模型名称映射到 Cloudflare AI 模型：

- `qwq` - 映射到 `@cf/qwen/qwq-32b`
- `qwen-coder` - 映射到 `@cf/qwen/qwen2.5-coder-32b-instruct`
- `deepseek-reasoner` - 映射到 `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`

也可以直接使用 Cloudflare AI 上的其他模型名称，如：

- `@cf/meta/llama-2-7b-chat-int8`
- `@cf/mistral/mistral-7b-instruct-v0.1`
- `@cf/openchat/openchat-3.5-0106`

完整模型列表参考 [Cloudflare AI 文档](https://developers.cloudflare.com/workers-ai/models/)

## API 端点

### 聊天补全 (Chat Completions)

```
POST /chat/completions
POST /v1/chat/completions
```
其中第一个是为了兼容。

请求格式：

```json
{
  "model": "deepseek-reasoner",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": true,
  "max_tokens": 512,
  "temperature": 0.7
}
```

## 开发
### 先初始化下 wrangler.jsonc，创建在根目录，
```jsonc
/**
 * For more details on how to configure Wrangler, refer to:
 * https://developers.cloudflare.com/workers/wrangler/configuration/
 */
{
	"$schema": "node_modules/wrangler/config-schema.json",
	"name": "deepseek-r1-cloudflare",
	"main": "src/index.ts",
	"compatibility_date": "2025-04-25",
	"observability": {
		"enabled": true
	},
	"ai": {
		"binding": "AI"
	},
	"vars": {
		"API_TOKEN": "your_api_key"
	}
}
```

### 运行相应命令
```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 部署到 Cloudflare
pnpm deploy
```

## 测试

使用 curl 测试 API：

### 非流式响应

```bash
curl http://localhost:8787/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-reasoner",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": false
  }'
```

### 流式响应

```bash
curl http://localhost:8787/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-reasoner",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }'
```
