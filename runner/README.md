# 衡术 Hengshu · 本地 Skill Runner

> 下载 Skill 能力包后，用**你自己的模型与算力**运行 —— 运行不经过中央服务器。

衡术的每个 Skill 都是一个可移植的能力包（manifest：Prompt 模板 + 输入/输出 schema + 推荐模型 + 路由策略）。你可以在 Skill 详情页**下载**它（YAML/JSON），然后用本地 Runner 运行。

## 为什么要本地运行

- **不把算力压力放在中央服务器**：每次运行的开销在你这边。
- **数据不出本地**：敏感输入不上传。
- **自带模型/Key**：用本地 Ollama / LM Studio / vLLM，或你自己的 OpenAI 兼容网关。

## 用法

```bash
# 1) 运行下载到本地的 Skill 文件（默认连本地 Ollama）
node runner/hengshu-run.mjs ./xhs-title-generator.yaml \
  --endpoint http://localhost:11434/v1 --model qwen2.5

# 2) 直接按 slug 从 Hub 拉取 manifest 再本地运行
node runner/hengshu-run.mjs xhs-title-generator \
  --hub http://localhost:3000 \
  --endpoint http://localhost:11434/v1 --model qwen2.5 \
  --in topic=秋季护肤 --in style=专业

# 3) 用任意 OpenAI 兼容网关（自带 Key）
node runner/hengshu-run.mjs ./xhs-title-generator.json \
  --endpoint https://your-gateway/v1 --model your-model --key sk-xxx
```

未通过 `--in` 提供的必填字段会交互询问。

## 选项

| 选项 | 说明 |
|---|---|
| `--endpoint <url>` | OpenAI 兼容 endpoint（默认 `http://localhost:11434/v1`，即 Ollama） |
| `--model <name>` | 模型名（默认取 manifest 的 `recommended_models.local[0]`） |
| `--key <key>` | API Key（本地模型一般留空） |
| `--hub <url>` | 传入 slug 时从该 Hub 拉取 manifest（默认 `http://localhost:3000`） |
| `--in <key=value>` | 预填输入字段（可重复） |
| `--raw` | 只输出模型原文 |

## 支持的模型后端

任意 **OpenAI 兼容** `/chat/completions` endpoint：Ollama、LM Studio、vLLM、llama.cpp server、LocalAI，或你自己的网关。

> 这是「云端发现 + 本地运行」的最小实现。后续可发展为可安装的 CLI（`hengshu install <slug>` / `hengshu run`）、本地运行记录、可选匿名兼容报告回流。
