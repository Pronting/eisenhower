<p align="center">
  <img src="https://img.icons8.com/fluency/96/task.png" alt="ishwe logo" width="96" />
</p>

<h1 align="center">ishwe · 艾森豪威尔矩阵任务管理</h1>

<p align="center">
  <a href="https://github.com/Pronting/eisenhower">
    <img src="https://img.shields.io/badge/GitHub-Repository-black?logo=github" alt="GitHub" />
  </a>
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
  <img src="https://img.shields.io/badge/status-MVP%20Phase%201-orange" alt="Status" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/FastAPI-0.104-teal?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python-3.11+-blue?logo=python" alt="Python" />
  <img src="https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql" alt="MySQL" />
  <img src="https://img.shields.io/badge/Redis-cache-red?logo=redis" alt="Redis" />
  <img src="https://img.shields.io/badge/AI-DeepSeek%20v4-6366f1" alt="DeepSeek" />
  <img src="https://img.shields.io/badge/Docker-deploy-2496ED?logo=docker" alt="Docker" />
</p>

---

## 项目简介

**ishwe** 是一个基于艾森豪威尔矩阵（四象限法则）的智能任务管理系统。用户只需输入待办事项，AI 自动将其归类到四个象限（重要紧急 / 重要不紧急 / 紧急不重要 / 不紧急不重要），并提供排期建议。

> 核心价值：比 Notion / Excel 模板更极简的操作体验。

### 功能亮点

- 🧠 **AI 自动分类** — 基于 DeepSeek v4，创建任务时自动识别优先级并归入四象限
- 📊 **可视化面板** — 四象限看板 + 统计图表，直观掌握任务分布
- 🔔 **智能推送** — 邮件 / Webhook 定时推送每日总结（Phase 2）
- 🌍 **国际化** — 中英双语支持
- 🐳 **一键部署** — Docker Compose 编排，开箱即用

---

## 目录结构

```
ishwe/
├── frontend/                    # Next.js 前端
│   ├── src/
│   │   ├── app/                 # App Router 页面
│   │   │   ├── page.tsx         # Landing Page
│   │   │   ├── login/           # 登录
│   │   │   ├── register/        # 注册
│   │   │   └── dashboard/       # 主面板 (需登录)
│   │   ├── components/          # 通用 UI 组件
│   │   ├── lib/                 # 工具函数 / API 调用
│   │   └── i18n/                # 国际化配置 (next-intl)
│   ├── public/                  # 静态资源
│   └── package.json
├── backend/                     # FastAPI 后端
│   ├── app/
│   │   ├── api/                 # 路由层 (auth / tasks / agent / push / stats)
│   │   ├── core/                # 核心配置 (config / security / database)
│   │   ├── models/              # SQLAlchemy 数据模型
│   │   ├── schemas/             # Pydantic 校验
│   │   ├── services/            # 业务逻辑层
│   │   └── agent/               # LangChain AI Agent + Tools
│   ├── alembic/                 # 数据库迁移脚本
│   ├── tests/                   # 测试
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml           # 本地开发编排
└── .env.example                 # 环境变量模板
```

---

## 快速开始

### 前置要求

| 依赖 | 最低版本 |
|------|----------|
| Python | 3.11+ |
| Node.js | 18+ |
| MySQL | 8.0+ |
| Redis | 6.0+ |

### 方式一：本地开发

```bash
# 1. 克隆仓库
git clone https://github.com/Pronting/eisenhower.git
cd eisenhower

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的 DATABASE_URL / REDIS_URL / DEEPSEEK_API_KEY / JWT_SECRET

# 3. 启动后端
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# 4. 启动前端（新终端）
cd frontend
npm install
npm run dev
```

前端访问 `http://localhost:3000`，后端 API 文档访问 `http://localhost:8000/docs`。

### 方式二：Docker Compose

```bash
git clone https://github.com/Pronting/eisenhower.git
cd eisenhower
cp .env.example .env
docker compose up -d
```

---

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| GET | `/api/tasks` | 任务列表 |
| POST | `/api/tasks` | 创建任务 (触发 AI 分类) |
| PUT | `/api/tasks/:id` | 更新任务 |
| DELETE | `/api/tasks/:id` | 删除任务 |
| POST | `/api/agent/classify` | AI 象限分类 |
| POST | `/api/agent/daily-summary` | AI 当日总结 |
| POST | `/api/agent/analyze` | AI 工作量分析 |
| GET | `/api/push-configs` | 推送配置列表 |
| POST | `/api/push-configs` | 创建推送配置 |
| GET | `/api/stats/quadrant` | 四象限统计数据 |

统一响应格式：`{ "code": 200, "data": ..., "message": "ok" }`

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14, React 18, Tailwind CSS, shadcn/ui, Framer Motion, Recharts, next-intl |
| 后端 | FastAPI, LangChain, SQLAlchemy 2.0, Alembic, Celery |
| 数据库 | MySQL 8.0 |
| 缓存/队列 | Redis (缓存 + Celery 消息队列) |
| AI | DeepSeek v4 API |
| 部署 | Docker + 自建服务器 |
| 认证 | JWT (邮箱 + 密码) |

---

## 路线图

- [ ] **Phase 1 (MVP)** — Auth + Task CRUD + AI 分类 + Landing Page
- [ ] **Phase 2** — AI 增强：批量重排、长期任务拆解、定时推送、AI 每日总结
- [ ] **Phase 3** — 优化：Redis 缓存、Token 节省、图表增强、移动端适配

---

## License

MIT © [Pronting](https://github.com/Pronting)
