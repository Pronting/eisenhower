<p align="center">
  <img src="https://img.icons8.com/fluency/96/task.png" alt="ishwe logo" width="96" />
</p>

<h1 align="center">ishwe · Smart Task Manager</h1>

<p align="center">
  <strong>AI-powered task management based on the Eisenhower Matrix</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/FastAPI-0.104-teal?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python-3.11+-blue?logo=python" alt="Python" />
  <img src="https://img.shields.io/badge/AI-DeepSeek%20v4-6366f1" alt="DeepSeek" />
  <img src="https://img.shields.io/badge/Docker-deploy-2496ED?logo=docker" alt="Docker" />
</p>

<p align="center">
  <a href="./README.md">中文</a>
</p>

---

## About

**ishwe** is an intelligent task management system based on the Eisenhower Matrix (four-quadrant method). It uses AI to automatically analyze task content, determine priority, and organize tasks into four quadrants. Features include batch creation, drag-and-drop sorting, scheduled push notifications, and data analytics.

**Live Demo:** http://106.53.173.60:8080

---

## Features

- **Quadrant Board** — Drag-and-drop task management with visual quadrant layout
- **AI Classification** — DeepSeek v4 powered automatic priority detection
- **Note Splitting** — Natural language input auto-split into actionable tasks
- **Smart Push** — Scheduled email/webhook daily task summaries
- **Statistics** — Completion rates, quadrant distribution, trend charts
- **Dark Mode** — Light/dark theme toggle
- **i18n** — Chinese and English support
- **Live2D Mascot** — Interactive mascot with real-time AI suggestions

---

## Tech Stack

**Frontend:** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Framer Motion · Recharts · @dnd-kit

**Backend:** FastAPI · SQLAlchemy · LangChain · DeepSeek v4 · Pydantic · JWT

**Deploy:** Docker · Docker Compose · GitHub Actions CI/CD · Nginx (1Panel OpenResty)

---

## Quick Start

### Local Development

```bash
git clone https://github.com/Pronting/eisenhower.git
cd eisenhower
cp .env.example .env   # Edit .env with JWT_SECRET and optional DEEPSEEK_API_KEY
```

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Visit http://localhost:3000

### Docker Compose

```bash
cp .env.example .env   # Edit config
docker compose up -d
```

---

## Production Deployment

### Server Requirements

- Linux server (Ubuntu recommended)
- Docker + Docker Compose
- Reverse proxy (Nginx or 1Panel OpenResty)

### Deployment Steps

**1. Clone the repo**
```bash
git clone https://github.com/Pronting/eisenhower.git /opt/ishwe
cd /opt/ishwe
```

**2. Configure environment**
```bash
cp .env.example .env
vim .env
```

```env
JWT_SECRET=<generate with openssl rand -hex 32>
DEEPSEEK_API_KEY=<optional, for AI features>
RESEND_API_KEY=<optional, for email push>
```

**3. Build and start**
```bash
docker compose up -d --build
```

**4. Configure reverse proxy**

Nginx example:
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

### CI/CD Auto Deploy

Push to `master` branch triggers GitHub Actions to SSH into the server and run `git pull` + `docker compose up -d --build`.

Configure these secrets in GitHub repo Settings → Secrets:

| Secret | Description |
|---|---|
| `SERVER_HOST` | Server IP address |
| `SERVER_USER` | SSH username |
| `SERVER_PASSWORD` | SSH password |

---

## Environment Variables

| Variable | Required | Description |
|---|:---:|---|
| `JWT_SECRET` | Yes | JWT authentication secret |
| `DEEPSEEK_API_KEY` | No | DeepSeek API key (AI features) |
| `RESEND_API_KEY` | No | Resend email service key |
| `DATABASE_URL` | No | Database URL (default: SQLite) |

---

## API Overview

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register |
| `POST` | `/api/auth/login` | Login |
| `GET/POST` | `/api/tasks` | List / Create tasks |
| `PUT/DELETE` | `/api/tasks/:id` | Update / Delete task |
| `POST` | `/api/agent/classify` | AI classification |
| `POST` | `/api/notes/process` | Note splitting |
| `GET/POST` | `/api/push-configs` | Push config |
| `GET` | `/api/stats/quadrant` | Statistics |

Full docs: http://localhost:8000/docs (after starting backend)

---

## Project Structure

```
ishwe/
├── frontend/          # Next.js frontend
│   └── src/
│       ├── app/       # Pages (dashboard, archive, stats, settings)
│       ├── components/# UI components
│       └── i18n/      # Internationalization
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── api/       # Routes
│   │   ├── agent/     # AI modules
│   │   ├── models/    # Data models
│   │   └── services/  # Business logic
│   └── tests/         # Tests
├── docker-compose.yml
└── .env.example
```

---

## License

MIT License
