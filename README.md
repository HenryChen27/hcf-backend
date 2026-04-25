# 🤖 HCF - 户晨风 AI 对话系统

一个为户晨风先生量身定制的全栈 AI 对话系统。包含风格化微调的大语言模型后端与现代 React 前端，支持智能联网搜索，实现高度拟真、犀利且富有个人特色的对话体验。

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)


## ✨ 核心特性

- **🧠 风格化对话**：基于 MrHu 模型（Qwen2.5-7B-Instruct LoRA 微调版），深度学习户晨风先生近三年直播文稿，捕捉独特用词习惯与语气
- **🔍 智能联网决策**：搭载 Qwen2.5-1.5B-Instruct 轻量检查器，精准判断是否需要联网搜索并生成最优关键词
- **📚 多源信息整合**：集成 Tavily Search API，实时获取网络信息并自动提炼摘要，增强回答质量
- **🌊 流式响应**：Server-Sent Events 实现实时流式输出，打字机效果般自然
- **💾 会话管理**：基于 session_id 管理多轮对话，支持上下文记忆
- **🎨 现代前端**：React + Vite + TypeScript + Tailwind CSS，响应式设计


## 🗂️ 项目结构

```
hcf/
├── backend/                    # FastAPI 后端服务
│   ├── app.py                  # 主应用（路由、模型加载、搜索逻辑）
│   ├── config.yaml.example     # 配置文件模板
│   ├── requirements.txt        # Python 依赖
│   └── README.md               # 后端详细文档
├── frontend/                   # React + Vite 前端
│   ├── src/                    # 前端源码
│   ├── public/                 # 静态资源
│   ├── package.json            # 前端依赖
│   ├── vite.config.js          # Vite 构建配置
│   └── README.md               # 前端详细文档
├── .gitignore
└── README.md                   # 本文件
```


## 🚀 一键部署

### 环境要求

| 组件 | 版本要求 |
|------|----------|
| Python | 3.10+ |
| Node.js | 18+ |
| CUDA | 推荐（GPU 加速） |
| 显存 | 16GB+（同时加载两个模型） |

### 1. 克隆仓库

```bash
git clone https://github.com/HenryChen27/hcf.git
cd hcf
```

### 2. 部署后端

```bash
# 进入后端目录
cd backend

# 安装依赖
pip install -r requirements.txt

# 配置密钥（首次运行需要）
cp config.yaml.example config.yaml
# 编辑 config.yaml，填入你的 API Key 和模型路径

# 启动服务
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 部署前端

```bash
# 打开新终端，进入前端目录
cd ../frontend

# 安装依赖
npm install

# 配置 API 地址（首次运行需要）
cp .env.example .env
# 编辑 .env，确认 VITE_API_BASE_URL=http://localhost:8000

# 启动开发服务器
npm run dev
```


## 📖 详细文档

- [后端 README](backend/README.md) — API 接口、模型配置、测试方法
- [前端 README](frontend/README.md) — 组件说明、环境变量、构建部署


## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript + Vite |
| UI 样式 | Tailwind CSS |
| 后端框架 | FastAPI |
| AI 模型 | Qwen2.5-7B-Instruct (LoRA) + Qwen2.5-1.5B-Instruct |
| 模型推理 | Transformers + PyTorch |
| 网络搜索 | Tavily Search API |
| 实时通信 | Server-Sent Events (SSE) |


## 🤖 模型说明

### MrHu 风格化模型

- **基座模型**：Qwen2.5-7B-Instruct
- **微调方式**：LoRA (Low-Rank Adaptation)
- **训练数据**：户晨风先生 2023 年初至 2025 年底公开直播文字稿
- **核心能力**：捕捉独特的用词习惯、语气、观点和互动方式
- **下载地址**：[ModelScope - MrHu](https://www.modelscope.cn/models/HenryChen66/MrHu)

### 检查器模型

- **模型**：Qwen2.5-1.5B-Instruct
- **功能**：轻量级搜索决策，判断用户问题是否需要联网搜索
- **优势**：极低延迟，节省 Tavily API 调用成本


## ❓ FAQ

**Q: 显存不足怎么办？**
- 使用量化版模型（AWQ/GPTQ），或将 `torch_dtype` 改为 `float32` 并使用 `device_map="cpu"`

**Q: 如何申请 Tavily API Key？**
- 访问 [tavily.com](https://tavily.com/) 免费注册，新用户有免费额度

**Q: 前端连不上后端？**
- 检查 `frontend/.env` 中的 `VITE_API_BASE_URL` 是否指向正确的后端地址
- 检查后端是否已启动：`curl http://localhost:8000`

**Q: 如何更换户晨风的风格？**
- 修改 `backend/app.py` 中的 `system_prompt`，调整角色设定


## 📄 许可证

本项目仅供学习和研究使用。模型 MrHu 的权属归原作者及团队所有。使用本项目时请遵守相关法律法规及模型使用协议，不得用于非法或侵权用途。


## 🌟 致谢

- 感谢原始数据整理者 [Olcmyk](https://github.com/Olcmyk/HuChenFeng) 的工作。
- Qwen 团队提供优秀的基础模型
- 所有贡献者和使用者
- 户晨风先生独特的表达风格与思想


---

**如果觉得项目不错，请点个 Star ⭐️**
