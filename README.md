<p align="center">
  <img src="https://img.icons8.com/fluency/96/task.png" alt="ishwe logo" width="96" />
</p>

<h1 align="center">ishwe · 智能任务管理系统</h1>

<p align="center">
  <strong>基于艾森豪威尔矩阵的 AI 驱动任务管理工具</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/FastAPI-0.104-teal?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python-3.11+-blue?logo=python" alt="Python" />
  <img src="https://img.shields.io/badge/AI-DeepSeek%20v4-6366f1" alt="DeepSeek" />
  <img src="https://img.shields.io/badge/Docker-deploy-2496ED?logo=docker" alt="Docker" />
</p>

<p align="center">
  <a href="./README.en.md">English</a>
</p>

---

## 项目简介

**ishwe** 是一个基于艾森豪威尔矩阵（四象限法则）的智能任务管理系统。利用 AI 自动分析任务内容，智能判断优先级并归类到四个象限，支持批量创建、拖拽排序、定时推送、数据统计等功能。

**在线体验：** http://106.53.173.60:8080

---

## 功能特性

- **四象限看板** — 拖拽排序，可视化任务分布
- **AI 自动分类** — DeepSeek v4 驱动，创建任务时自动识别优先级
- **笔记拆分** — 自然语言输入，AI 自动拆分为多个可执行任务
- **智能推送** — 定时邮件/Webhook 推送每日任务总结
- **数据统计** — 完成率、象限分布、趋势图表
- **深色模式** — 浅色/深色主题切换
- **国际化** — 中英双语
- **看板娘** — Live2D 吉祥物实时 AI 建议

---

## 技术栈

**前端：** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Framer Motion · Recharts · @dnd-kit

**后端：** FastAPI · SQLAlchemy · LangChain · DeepSeek v4 · Pydantic · JWT

**部署：** Docker · Docker Compose · GitHub Actions CI/CD · Nginx (1Panel OpenResty)

---

## 快速开始

### 本地开发

```bash
git clone https://github.com/Pronting/eisenhower.git
cd eisenhower
cp .env.example .env   # 编辑 .env，填入 JWT_SECRET 和可选的 DEEPSEEK_API_KEY
```

**后端：**
```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**前端：**
```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3000

### Docker Compose

```bash
cp .env.example .env   # 编辑配置
docker compose up -d
```

---

## 生产部署

### 服务器要求

- Linux 服务器（推荐 Ubuntu）
- Docker + Docker Compose
- 反向代理（Nginx 或 1Panel OpenResty）

### 部署步骤

**1. 克隆代码**
```bash
git clone https://github.com/Pronting/eisenhower.git /opt/ishwe
cd /opt/ishwe
```

**2. 配置环境变量**
```bash
cp .env.example .env
vim .env
```

```env
JWT_SECRET=<用 openssl rand -hex 32 生成>
DEEPSEEK_API_KEY=<可选，DeepSeek API Key>
RESEND_API_KEY=<可选，邮件推送>
```

**3. 构建并启动**
```bash
docker compose up -d --build
```

**4. 配置反向代理**

Nginx 示例：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### CI/CD 

> 这里使用 Github Actions 进行自动部署

推送代码到 `master` 分支后，GitHub Actions 自动 SSH 到服务器执行 `git pull` + `docker compose up -d --build`。

需要在 GitHub 仓库 Settings → Secrets 中配置：

| Secret | 说明 |
|---|---|
| `SERVER_HOST` | 服务器 IP |
| `SERVER_USER` | SSH 用户名 |
| `SERVER_PASSWORD` | SSH 密码 |

---

## 环境变量

| 变量名 | 必填 | 说明 |
|---|:---:|---|
| `JWT_SECRET` | 是 | JWT 认证密钥 |
| `DEEPSEEK_API_KEY` | 否 | DeepSeek API Key（AI 功能） |
| `RESEND_API_KEY` | 否 | Resend 邮件服务 Key |
| `DATABASE_URL` | 否 | 数据库连接（默认 SQLite） |

---

## API 概览

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/auth/register` | 注册 |
| `POST` | `/api/auth/login` | 登录 |
| `GET/POST` | `/api/tasks` | 任务列表 / 创建 |
| `PUT/DELETE` | `/api/tasks/:id` | 更新 / 删除 |
| `POST` | `/api/agent/classify` | AI 分类 |
| `POST` | `/api/notes/process` | 笔记拆分 |
| `GET/POST` | `/api/push-configs` | 推送配置 |
| `GET` | `/api/stats/quadrant` | 统计数据 |

完整文档：启动后端后访问 http://localhost:8000/docs

---

## 项目结构

```
ishwe/
├── frontend/          # Next.js 前端
│   └── src/
│       ├── app/       # 页面（dashboard, archive, stats, settings）
│       ├── components/# UI 组件
│       └── i18n/      # 国际化
├── backend/           # FastAPI 后端
│   ├── app/
│   │   ├── api/       # 路由
│   │   ├── agent/     # AI 模块
│   │   ├── models/    # 数据模型
│   │   └── services/  # 业务逻辑
│   └── tests/         # 测试
├── docker-compose.yml
└── .env.example
```

---

## 许可证

MIT License
