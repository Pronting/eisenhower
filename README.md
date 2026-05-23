


<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Python-3.11+-blue?logo=python" alt="Python" />
</p>

<p align="center">
  <a href="./README.en.md">English</a>
</p>

---

## 项目简介

**ishwe** 是一个任务管理系统。负责将预定任务推送到指定的渠道，产品定位上类似 todo 系统，
预计支持多端适配，桌面端与移动端应用


---

## 功能特性

- **四象限看板** — 拖拽排序，可视化任务分布
- **智能自动分类** — 大模型驱动，创建任务时自动识别优先级
- **智能推送** — 定时邮件/Webhook/短信 推送每日任务总结
- **数据统计** — 完成率、象限分布、趋势图表
- **深色模式** — 浅色/深色主题切换
- **国际化** — 中英双语


### 正在实现的功能

* 随处小记(快捷键呼出)
![Snipaste_2026-05-23_14-54-47.png](docs/Snipaste_2026-05-23_14-54-47.png)

* 安卓apk - 测试阶段
* 其他feature............

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


### Docker Compose

```bash
cp .env.example .env   # 编辑配置
docker compose up -d
```

---

## 生产部署



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


## 环境变量

| 变量名 | 必填 | 说明 |
|---|:---:|---|
| `JWT_SECRET` | 是 | JWT 认证密钥 |
| `DEEPSEEK_API_KEY` | 否 | DeepSeek API Key（AI 功能） |
| `RESEND_API_KEY` | 否 | Resend 邮件服务 Key |
| `DATABASE_URL` | 否 | 数据库连接（默认 SQLite） |

---

## API 概览

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