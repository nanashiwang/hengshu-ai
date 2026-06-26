# 衡术 Hengshu · 本地 Skill Runner

> 下载 Skill 能力包后，用**你自己的模型与算力**运行 —— 运行不经过中央服务器。

衡术的每个 Skill 都是可移植的能力包（Spec v1：system/user 模板 + 输入/输出 schema + 推荐模型 + checksum）。在详情页**下载**后用本地 Runner 运行；也可先登录把设备绑定到你的账号。

## 命令

```bash
# 登录（设备码流程：终端显示码 → 浏览器 /device 输入码授权）
node runner/hengshu.mjs login --hub http://localhost:3000

# 查看登录归属
node runner/hengshu.mjs whoami

# 运行（默认连本地 Ollama）
node runner/hengshu.mjs run xhs-title-generator \
  --hub http://localhost:3000 \
  --endpoint http://localhost:11434/v1 --model qwen2.5 \
  --in topic=秋季护肤 --in style=专业

# 运行本地下载的 manifest 文件 / 用自有网关
node runner/hengshu.mjs run ./xhs-title-generator-1.0.0.yaml \
  --endpoint https://your-gateway/v1 --model your-model --key sk-xxx
```

登录令牌保存在 `~/.hengshu/config.json`（chmod 600）。

## 选项（run）

| 选项 | 说明 |
|---|---|
| `--endpoint <url>` | OpenAI 兼容 endpoint（默认 `http://localhost:11434/v1`，即 Ollama） |
| `--model <name>` | 模型名（默认取 manifest 的 `models.local_recommended[0]`） |
| `--key <key>` | endpoint 的 Key（本地模型一般留空） |
| `--hub <url>` | 传入 slug 时从该 Hub 拉取 manifest（默认 `~/.hengshu/config.json` 的 hub 或 `http://localhost:3000`） |
| `--in <key=value>` | 预填输入字段（可重复） |
| `--raw` | 只输出模型原文 |

## 支持的模型后端

任意 **OpenAI 兼容** `/chat/completions` endpoint：Ollama、LM Studio、vLLM、llama.cpp server、LocalAI，或你自己的网关。

> 路线：后续将加 `install / list / update / outdated / remove / doctor`（S4）与匿名兼容报告回流（S5）。
