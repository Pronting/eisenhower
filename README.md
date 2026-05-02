<p align="center">
  <img src="https://img.icons8.com/fluency/96/task.png" alt="ishwe logo" width="96" />
</p>

<h1 align="center">ishwe · 智能任务管理系统</h1>

<p align="center">
  <strong>基于艾森豪威尔矩阵的 AI 驱动任务管理工具</strong>
</p>

<p align="center">
  <a href="https://github.com/Pronting/eisenhower">
    <img src="https://img.shields.io/badge/GitHub-Repository-black?logo=github" alt="GitHub" />
  </a>
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
  <img src="https://img.shields.io/badge/status-production%20ready-brightgreen" alt="Status" />
  <img src="https://img.shields.io/github/last-commit/Pronting/eisenhower" alt="Last Commit" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/FastAPI-0.104-teal?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python-3.11+-blue?logo=python" alt="Python" />
  <img src="https://img.shields.io/badge/SQLite-3-lightgrey?logo=sqlite" alt="SQLite" />
  <img src="https://img.shields.io/badge/AI-DeepSeek%20v4-6366f1" alt="DeepSeek" />
  <img src="https://img.shields.io/badge/Docker-deploy-2496ED?logo=docker" alt="Docker" />
</p>

---

## 📖 项目简介

**ishwe** 是一个基于艾森豪威尔矩阵（四象限法则）的智能任务管理系统。与传统待办工具不同，ishwe 利用 AI 自动分析任务内容，智能判断优先级并归类到四个象限：

| 象限 | 分类 | 处理策略 |
|:---:|:---|:---|
| **Q1** | 🔴 紧急且重要 | 立即执行 |
| **Q2** | 🟡 重要不紧急 | 计划安排 |
| **Q3** | 🟠 紧急不重要 | 委托他人 |
| **Q4** | ⚪ 不紧急不重要 | 考虑放弃 |

### 💡 核心价值

- **零学习成本** — 比 Notion / Excel 模板更极简的操作体验
- **AI 自动分类** — 无需手动判断优先级，AI 帮你决策
- **批量处理** — 一次输入多个待办事项，AI 自动拆分归类
- **智能推送** — 定时邮件/Webhook 推送每日任务总结

---

## ✨ 功能特性

### 🎯 任务管理
- **四象限看板** — 可视化展示任务分布，直观清晰
- **拖拽排序** — 支持拖拽任务到不同象限（基于 @dnd-kit）
- **批量创建** — 通过"小记"功能一次性输入多个待办
- **日期管理** — 灵活设置截止日期，支持快捷选择
- **任务归档** — 完成任务自动归档，保持界面清爽

### 🤖 AI 能力
- **智能分类** — 基于 DeepSeek v4，创建任务时自动识别优先级
- **笔记拆分** — 自然语言输入自动拆分为多个可执行任务
- **降级处理** — AI 不可用时自动使用规则引擎进行拆分
- **每日总结** — AI 生成当日任务概览和工作建议
- **即时建议** — 仪表盘吉祥物提供实时 AI 建议

### 📊 数据统计
- **完成率统计** — 按日期/总数维度查看任务完成情况
- **象限分布** — 分析任务在四个象限的分布比例
- **趋势图表** — Recharts 可视化历史数据趋势

### 🔔 智能推送
- **邮件推送** — 定时发送任务总结到邮箱
- **Webhook** — 支持自定义 Webhook 推送
- **AI 增强** — 推送内容包含 AI 生成的个性化建议

### 🌍 用户体验
- **国际化** — 中英双语支持（next-intl）
- **深色模式** — 支持浅色/深色主题切换
- **响应式** — 完美适配桌面端和移动端
- **动态效果** — Framer Motion 流畅动画
- **看板娘** — 可爱的 Live2D 吉祥物（oh-my-live2d）

---

## 📁 项目结构

```
ishwe/
├── frontend/                          # Next.js 前端应用
│   ├── src/
│   │   ├── app/                       # App Router 页面
│   │   │   ├── page.tsx              # Landing Page（产品介绍）
│   │   │   ├── login/                # 登录页
│   │   │   ├── register/             # 注册页
│   │   │   ├── dashboard/            # 主面板（核心功能）
│   │   │   ├── archive/              # 归档任务页
│   │   │   ├── stats/                # 统计图表页
│   │   │   └── settings/             # 用户设置页
│   │   ├── components/               # 通用 UI 组件
│   │   │   ├── Header.tsx            # 顶部导航栏
│   │   │   ├── TaskCard.tsx          # 任务卡片
│   │   │   ├── QuadrantBoard.tsx     # 四象限看板
│   │   │   └── ThemeToggle.tsx       # 主题切换
│   │   ├── lib/                      # 工具函数
│   │   │   ├── api.ts               # API 请求封装
│   │   │   └── auth.ts              # 认证工具
│   │   └── i18n/                     # 国际化配置
│   │       ├── zh.ts                # 中文翻译
│   │       └── en.ts                # 英文翻译
│   ├── public/                        # 静态资源
│   ├── tailwind.config.js            # Tailwind CSS 配置
│   └── package.json
│
├── backend/                           # FastAPI 后端服务
│   ├── app/
│   │   ├── api/                       # API 路由层
│   │   │   ├── auth.py              # 认证接口
│   │   │   ├── tasks.py             # 任务 CRUD
│   │   │   ├── agent.py             # AI 相关接口
│   │   │   ├── notes.py             # 笔记处理
│   │   │   ├── stats.py             # 统计接口
│   │   │   └── push.py              # 推送配置
│   │   ├── core/                      # 核心配置
│   │   │   ├── config.py            # 环境变量配置
│   │   │   ├── database.py          # 数据库连接
│   │   │   └── security.py          # JWT 认证
│   │   ├── models/                    # SQLAlchemy 数据模型
│   │   │   └── models.py            # User / Task / PushConfig
│   │   ├── schemas/                   # Pydantic 数据校验
│   │   ├── services/                  # 业务逻辑层
│   │   │   └── push_service.py      # 推送服务
│   │   └── agent/                     # AI Agent 模块
│   │       ├── llm.py               # LLM 初始化
│   │       ├── classify.py          # 任务分类
│   │       ├── summarize.py         # 任务总结
│   │       └── process_note.py      # 笔记拆分
│   ├── alembic/                       # 数据库迁移
│   ├── tests/                         # 单元测试
│   │   ├── test_api.py              # API 测试
│   │   ├── test_classification.py   # 分类测试
│   │   └── test_schemas.py          # Schema 测试
│   ├── requirements.txt               # Python 依赖
│   └── Dockerfile
│
├── docs/                              # 项目文档
│   └── superpowers/                   # 设计文档和计划
│
├── docker-compose.yml                 # Docker 编排配置
├── .env.example                       # 环境变量模板
└── README.md
```

---

## 🚀 快速开始

### 前置要求

| 依赖 | 版本 | 用途 |
|:---|:---:|:---|
| Python | 3.11+ | 后端运行环境 |
| Node.js | 18+ | 前端构建 |
| Git | 2.0+ | 版本控制 |

> 💡 **SQLite 模式**：默认使用 SQLite，无需安装 MySQL/Redis，开箱即用。

### 方式一：本地开发（推荐）

#### 1. 克隆仓库

```bash
git clone https://github.com/Pronting/eisenhower.git
cd eisenhower
```

#### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 必填：JWT 认证密钥（任意字符串）
JWT_SECRET=your-secret-key-here

# 可选：DeepSeek API Key（启用 AI 功能）
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxx

# 可选：数据库连接（默认使用 SQLite）
# DATABASE_URL=mysql+pymysql://user:pass@localhost/ishwe

# 可选：Redis 缓存
# REDIS_URL=redis://localhost:6379
```

#### 3. 启动后端

```bash
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 初始化数据库
alembic upgrade head

# 启动服务（开发模式）
uvicorn app.main:app --reload --port 8000
```

后端服务将运行在 `http://localhost:8000`
API 文档：`http://localhost:8000/docs`

#### 4. 启动前端

```bash
# 新终端窗口
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端应用将运行在 `http://localhost:3000`

### 方式二：Docker Compose

```bash
# 1. 克隆并配置
git clone https://github.com/Pronting/eisenhower.git
cd eisenhower
cp .env.example .env
# 编辑 .env 配置

# 2. 一键启动
docker compose up -d

# 3. 查看日志
docker compose logs -f
```

服务将在以下端口运行：
- 前端：`http://localhost:3000`
- 后端：`http://localhost:8000`

---

## 📡 API 概览

### 认证接口

| 方法 | 路径 | 说明 |
|:---|:---|:---|
| `POST` | `/api/auth/register` | 用户注册 |
| `POST` | `/api/auth/login` | 用户登录（返回 JWT） |

### 任务接口

| 方法 | 路径 | 说明 |
|:---|:---|:---|
| `GET` | `/api/tasks` | 获取任务列表（支持筛选） |
| `POST` | `/api/tasks` | 创建任务（触发 AI 分类） |
| `PUT` | `/api/tasks/:id` | 更新任务（完成自动归档） |
| `DELETE` | `/api/tasks/:id` | 删除任务 |

**查询参数：**
- `status` — 状态筛选（`pending,completed,archived`，支持逗号分隔）
- `quadrant` — 象限筛选（`q1,q2,q3,q4`）
- `due_date` — 日期筛选（`YYYY-MM-DD`）

### AI 接口

| 方法 | 路径 | 说明 |
|:---|:---|:---|
| `POST` | `/api/agent/classify` | AI 象限分类 |
| `POST` | `/api/agent/summary-v2` | AI 智能总结 |
| `POST` | `/api/agent/summary-v2/daily` | AI 当日总结 |
| `POST` | `/api/agent/summary-v2/todo` | AI 待办建议 |
| `POST` | `/api/agent/advice` | AI 即时建议 |
| `POST` | `/api/notes/process` | 笔记拆分处理 |

### 统计接口

| 方法 | 路径 | 说明 |
|:---|:---|:---|
| `GET` | `/api/stats/quadrant` | 四象限统计 |
| `GET` | `/api/stats/completion` | 完成率统计 |

### 推送接口

| 方法 | 路径 | 说明 |
|:---|:---|:---|
| `GET` | `/api/push-configs` | 获取推送配置 |
| `POST` | `/api/push-configs` | 创建推送配置 |
| `PUT` | `/api/push-configs/:id` | 更新推送配置 |
| `DELETE` | `/api/push-configs/:id` | 删除推送配置 |

**统一响应格式：**
```json
{
  "code": 200,
  "data": {},
  "message": "ok"
}
```

---

## 🛠️ 技术栈

### 前端

| 技术 | 版本 | 用途 |
|:---|:---:|:---|
| Next.js | 14 | React 框架（App Router） |
| React | 18 | UI 库 |
| TypeScript | 5.3 | 类型安全 |
| Tailwind CSS | 3.4 | 样式框架 |
| Framer Motion | 12 | 动画库 |
| Recharts | 3.8 | 图表库 |
| @dnd-kit | 6.3 | 拖拽功能 |
| next-intl | - | 国际化 |
| next-themes | - | 主题切换 |
| oh-my-live2d | 0.19 | Live2D 看板娘 |

### 后端

| 技术 | 版本 | 用途 |
|:---|:---:|:---|
| FastAPI | 0.104 | Web 框架 |
| SQLAlchemy | 2.0 | ORM |
| Alembic | - | 数据库迁移 |
| LangChain | 1.2 | AI 编排框架 |
| DeepSeek v4 | - | 大语言模型 |
| Pydantic | 2.5 | 数据校验 |
| python-jose | - | JWT 认证 |
| SQLite | 3 | 默认数据库（可选 MySQL） |

### 开发工具

| 工具 | 用途 |
|:---|:---|
| Docker | 容器化部署 |
| pytest | 后端测试 |
| ESLint | 前端代码规范 |
| Git | 版本控制 |

---

## 🧪 测试

### 后端测试

```bash
cd backend

# 运行所有测试
pytest

# 运行特定测试文件
pytest tests/test_api.py

# 运行并显示覆盖率
pytest --cov=app --cov-report=html
```

### 测试覆盖

- `test_api.py` — API 接口测试（认证、任务 CRUD、统计）
- `test_classification.py` — AI 分类逻辑测试
- `test_schemas.py` — 数据模型验证测试

---

## 🎨 界面预览

### 主要页面

1. **Landing Page** — 产品介绍页，展示功能亮点
2. **仪表盘** — 核心操作界面，四象限看板 + 快捷操作
3. **归档页** — 查看已完成的历史任务
4. **统计页** — 数据可视化图表
5. **设置页** — 推送配置、主题切换、语言设置

### 核心交互

- **拖拽任务** — 直接拖拽任务卡片到目标象限
- **小记功能** — 一次性输入多个待办，AI 自动拆分
- **日期选择** — 快捷选择今天、明天、本周等
- **主题切换** — 一键切换浅色/深色模式

---

## 📦 部署指南

### 环境变量说明

| 变量名 | 必填 | 说明 |
|:---|:---:|:---|
| `JWT_SECRET` | ✅ | JWT 认证密钥 |
| `DEEPSEEK_API_KEY` | ❌ | DeepSeek API Key（AI 功能） |
| `DATABASE_URL` | ❌ | 数据库连接（默认 SQLite） |
| `REDIS_URL` | ❌ | Redis 连接（缓存加速） |

### 生产环境部署

#### 使用 Docker（推荐）

```bash
# 1. 构建镜像
docker compose build

# 2. 启动服务
docker compose up -d

# 3. 查看状态
docker compose ps
```

#### 手动部署

```bash
# 后端
cd backend
pip install -r requirements.txt
alembic upgrade head
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker

# 前端
cd frontend
npm run build
npm start
```

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

### 提交规范

```
<type>(<scope>): <subject>

类型：
- feat:     新功能
- fix:      Bug 修复
- docs:     文档更新
- style:    代码格式（不影响功能）
- refactor: 重构
- test:     测试相关
- chore:    构建/工具相关
```

---

## 📋 路线图

### ✅ Phase 1（已完成）
- [x] 用户认证（注册/登录）
- [x] 任务 CRUD 操作
- [x] AI 自动分类
- [x] 四象限看板
- [x] Landing Page
- [x] 国际化支持

### ✅ Phase 2（已完成）
- [x] AI 笔记拆分
- [x] 任务归档功能
- [x] 完成率统计
- [x] 邮件/Webhook 推送
- [x] AI 每日总结

### 🔄 Phase 3（进行中）
- [ ] Redis 缓存优化
- [ ] Token 使用优化
- [ ] 图表增强
- [ ] 移动端 PWA

### 📅 Phase 4（计划中）
- [ ] 团队协作
- [ ] 任务依赖关系
- [ ] 高级 AI 功能
- [ ] 移动端原生应用

---

## 📄 许可证

MIT License © [Pronting](https://github.com/Pronting)

---

## 🙏 致谢

- [Next.js](https://nextjs.org/) — React 框架
- [FastAPI](https://fastapi.tiangolo.com/) — Python Web 框架
- [LangChain](https://langchain.com/) — AI 编排框架
- [DeepSeek](https://deepseek.com/) — 大语言模型
- [Tailwind CSS](https://tailwindcss.com/) — CSS 框架
- [shadcn/ui](https://ui.shadcn.com/) — UI 组件库
- [Framer Motion](https://www.framer.com/motion/) — 动画库
- [Recharts](https://recharts.org/) — 图表库
- [Icons8](https://icons8.com/) — 图标资源

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/Pronting">Pronting</a>
</p>
