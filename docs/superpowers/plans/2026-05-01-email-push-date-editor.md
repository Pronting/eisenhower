# 邮件推送修复 + 仪表盘日期编辑 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复邮件推送缺少今日任务的问题，并在仪表盘中支持点击任务标题编辑截止日期

**Architecture:** 修改 `push_service.py` 的查询逻辑以包含所有待办任务，修改 `QuadrantBoard.tsx` 的 TaskCard 组件使标题可点击打开日期选择器

**Tech Stack:** Python/FastAPI/SQLAlchemy (backend), React/TypeScript/@dnd-kit (frontend)

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `backend/app/services/push_service.py` | 修改 | 邮件推送查询逻辑 + 展示逻辑 |
| `frontend/src/components/QuadrantBoard.tsx` | 修改 | 任务标题点击打开日期选择器 |

---

## Task 1: 修复邮件推送查询逻辑

**Files:**
- Modify: `backend/app/services/push_service.py:170-186`

- [ ] **Step 1: 添加必要的 import**

在 `push_service.py` 顶部添加 `or_` 和 `and_` 导入：

```python
from sqlalchemy import or_, and_
from app.models.models import TaskStatus
```

- [ ] **Step 2: 修改 `build_push_content` 查询逻辑**

将 `build_push_content` 函数中的查询从只查今天的任务改为查所有待办任务：

```python
# 旧代码（第 175-179 行）
tasks = db.query(Task).filter(
    Task.user_id == user_id,
    Task.due_date >= today_start,
    Task.due_date < today_end,
).all()

# 新代码
tasks = db.query(Task).filter(
    Task.user_id == user_id,
    Task.status == TaskStatus.PENDING,
    or_(
        and_(Task.due_date >= today_start, Task.due_date < today_end),
        Task.due_date.is_(None),
        Task.is_long_term == 1,
    ),
).all()
```

- [ ] **Step 3: 简化统计逻辑**

由于查询已过滤为 PENDING 状态，简化 pending/completed 统计：

```python
# 旧代码（第 185-186 行）
pending = [t for t in tasks if t.status and t.status.value == "pending"]
completed = [t for t in tasks if t.status and t.status.value == "completed"]

# 新代码
pending = tasks
completed = []
```

- [ ] **Step 4: 更新统计行显示**

修改统计行文案，移除"已完成"计数（因为推送只包含待办任务）：

```python
# 旧代码（第 205-210 行）
lines.append(
    f"<p style='color:#555;font-size:14px;margin:8px 0 16px;'>"
    f"📊 今日共 <strong>{len(tasks)}</strong> 个任务 · "
    f"待完成 <strong>{len(pending)}</strong> 个 · "
    f"已完成 <strong>{len(completed)}</strong> 个"
    f"</p>"
)

# 新代码
lines.append(
    f"<p style='color:#555;font-size:14px;margin:8px 0 16px;'>"
    f"📊 待办任务 <strong>{len(tasks)}</strong> 个"
    f"</p>"
)
```

- [ ] **Step 5: 更新 `_render_quadrant_section` 状态图标**

由于所有任务都是 pending 状态，移除已完成图标的判断：

```python
# 旧代码（第 164-166 行）
for t in tasks[:limit]:
    status_icon = "✅" if (t.status and t.status.value == "completed") else "○"
    items += f"<p style='margin:2px 0 2px 16px;color:#444;'>{status_icon} {t.title}</p>"

# 新代码
for t in tasks[:limit]:
    items += f"<p style='margin:2px 0 2px 16px;color:#444;'>○ {t.title}</p>"
```

- [ ] **Step 6: 同步修改 `execute_push` 中的查询**

`execute_push` 函数中也有相同的查询逻辑（第 239-243 行），需要同步修改：

```python
# 旧代码
tasks = db.query(Task).filter(
    Task.user_id == user_id,
    Task.due_date >= today_start,
    Task.due_date < today_end,
).all()

# 新代码
tasks = db.query(Task).filter(
    Task.user_id == user_id,
    Task.status == TaskStatus.PENDING,
    or_(
        and_(Task.due_date >= today_start, Task.due_date < today_end),
        Task.due_date.is_(None),
        Task.is_long_term == 1,
    ),
).all()
```

- [ ] **Step 7: 测试验证**

```bash
cd backend
./venv/Scripts/python.exe -c "
from app.services.push_service import build_push_content
from app.core.database import SessionLocal
db = SessionLocal()
# 替换为实际 user_id
html = build_push_content(1, db)
print('Tasks included:', '待办任务' in html)
print('No completed count:', '已完成' not in html)
db.close()
"
```

---

## Task 2: 仪表盘任务标题点击编辑日期

**Files:**
- Modify: `frontend/src/components/QuadrantBoard.tsx:113-120`

- [ ] **Step 1: 修改 TaskCard 标题为可点击**

将 `<h4>` 标签添加点击事件和视觉提示：

```tsx
// 旧代码（第 113-120 行）
<h4
  className={`text-sm font-medium truncate ${
    isCompleted ? 'line-through' : ''
  }`}
  style={{ color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)' }}
>
  {task.title}
</h4>

// 新代码
<h4
  className={`text-sm font-medium truncate cursor-pointer hover:opacity-80 transition-opacity ${
    isCompleted ? 'line-through' : ''
  }`}
  style={{ color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)' }}
  onClick={(e) => { e.stopPropagation(); setShowDatePicker(!showDatePicker) }}
>
  {task.title}
</h4>
```

- [ ] **Step 2: TypeScript 类型检查**

```bash
cd frontend
npx --package=typescript tsc --noEmit -p tsconfig.json
```

Expected: 无错误输出

- [ ] **Step 3: 测试验证**

在浏览器中：
1. 打开仪表盘
2. hover 任务标题 → 应显示 cursor-pointer 和透明度变化
3. 点击任务标题 → 日期选择器应弹出
4. 选择日期 → 任务日期应更新
5. 拖拽任务 → 不应触发日期编辑

---

## 自查清单

- [x] 规格覆盖：邮件查询逻辑、展示逻辑、标题点击编辑
- [x] 无占位符：所有步骤包含完整代码
- [x] 类型一致性：`TaskStatus.PENDING` 在两个文件中一致使用
- [x] 范围聚焦：仅修改 2 个文件，无无关变更
