# 🤖 MrHu Backend

一个为户晨风先生量身定制的 AI 对话智能体后端服务。该项目结合了风格化微调的大语言模型与联网搜索能力，能够以高度拟真、犀利且富有个人特色的口语化风格进行对话，并智能判断是否需要获取实时网络信息来增强回答质量。

---

## ✨ 核心特性

-   **🧠 风格化对话**：基于 **MrHu 模型**（Qwen2.5-7B-Instruct LoRA 微调版），深度学习户晨风先生的语言风格，回复犀利、幽默、接地气，极具个人特色。
-   **🔍 智能联网决策**：搭载 **Qwen2.5-1.5B-Instruct** 作为轻量级“检查器”，能够精准判断用户问题是否需要联网搜索，并自动生成最优搜索关键词。
-   **📚 多源信息整合**：集成 **Tavily Search API**，实时获取高价值网络信息，并自动提炼摘要，为主模型提供事实支撑。
-   **🌊 流式响应支持**：提供标准的 `POST /chat_stream` 接口，使用 Server-Sent Events (SSE) 实现流式输出，显著提升前端交互体验。
-   **💾 会话记忆管理**：基于 `session_id` 管理多轮对话历史，支持上下文记忆与对话历史裁剪，模拟真实连麦互动感。
-   **⚡ 高性能架构**：模型加载支持 `device_map="auto"`，可灵活利用多 GPU 或 CPU 推理，默认采用 `float16` 精度以平衡速度与效果。

---

## 🗂️ 项目结构

```
├── app.py                 # FastAPI 主应用，包含所有路由和核心逻辑
├── config.yaml            # 配置文件，存放 API Key 和模型路径
├── requirements.txt       # 项目依赖
└── README.md              # 项目说明文档
```

---

## 🚀 快速开始

### 环境要求

-   Python 3.10+
-   CUDA 环境（推荐，用于 GPU 加速）
-   足够的 GPU 显存（建议 16GB+，用于同时加载两个模型）

### 1. 克隆项目与下载模型

```bash
# 克隆你的项目仓库
git clone <your-repo-url>
cd mrhu_backend

# 根据以下链接手动下载模型到本地目录
# - MrHu 风格化模型 (约15GB): https://www.modelscope.cn/models/HenryChen66/MrHu
# - Qwen2.5-1.5B-Instruct 检查器模型 (约3GB): 可在 ModelScope 或 HuggingFace 搜索下载
```

### 2. 安装依赖

```bash
conda create -n hcf python=3.10
conda activate hcf
pip install -r requirements.txt
```


### 3. 配置 `config.yaml`

在项目根目录创建 `config.yaml` 文件，并填入以下内容：

```yaml
# 替换为你自己的 Tavily Search API Key
# 免费申请地址: https://tavily.com/
TAVILY_API_KEY: "tvly-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 替换为你下载的 MrHu 模型所在路径
MODEL_PATH: "/path/to/your/local/MrHu/model"

# 替换为你下载的 Qwen2.5-1.5B-Instruct 模型所在路径
CHECKER_PATH: "/path/to/your/local/Qwen2.5-1.5B-Instruct/model"
```

### 4. 启动服务

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

---

## 📖 API 接口文档

### 基础信息

-   **Base URL**: `http://localhost:8000`
-   **Content-Type**: `application/json`
-   **流式接口**: `text/event-stream` (SSE)

---

### 1. 创建新会话

创建一个新的对话会话，并返回唯一 `session_id`。

-   **Endpoint**: `POST /new_session`
-   **Request Body**: 无


---

### 2. 清空会话历史

清空指定会话的对话历史记录。

-   **Endpoint**: `POST /clear_session`

**请求体**:

```json
{
  "session_id": "your-session-id"
}
```

---

### 3. 非流式对话

发送消息并一次性获取完整回答和参考资料。

-   **Endpoint**: `POST /chat`

**请求体**:

```json
{
  "message": "老户，你怎么看最近很火的那个‘百元挑战’？",
  "session_id": "your-session-id" // 可选，不提供则自动创建新会话
}
```

---

### 4. 流式对话 (推荐)

发送消息并通过 Server-Sent Events 实时接收回答。此接口会依次返回不同的事件。

-   **Endpoint**: `POST /chat_stream`
-   **Request Body**: 与 `/chat` 相同

**SSE 事件类型**:

| 事件名 | 说明 | 示例数据结构 |
| :--- | :--- | :--- |
| `session` | 返回当前会话ID | `{"event": "session", "session_id": "..."}` |
| `status` | 过程状态信息，如“正在搜索...” | `{"event": "status", "message": "正在搜索资料..."}` |
| `references` | 返回搜索到的参考资料列表 | `{"event": "references", "references": [...]}` |
| `text` | 流式生成的文本片段 | `{"event": "text", "text": "这"}` |
| `done` | 回答完成，包含完整回答 | `{"event": "done", "answer": "完整回答..."}` |
| `error` | 发生错误时 | `{"event": "error", "error": "错误信息"}` |
