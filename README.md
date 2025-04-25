# DeepSeek API on Cloudflare Workers

基于 Cloudflare Workers 实现的标准 DeepSeek API 接口，兼容 OpenAI 格式，支持流式输出。

## 特性

- 完全兼容 OpenAI API 格式
- 支持流式和非流式响应
- 实现了 `/chat/completions` 和 `/v1/chat/completions` 端点
- 支持多种 DeepSeek 模型

## 可用模型

- `deepseek-chat` - DeepSeek V3 模型
- `deepseek-reasoner` - DeepSeek R1 模型 (Qwen-32B)

## API 端点

### 聊天补全 (Chat Completions)

```
POST /chat/completions
POST /v1/chat/completions
```

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
