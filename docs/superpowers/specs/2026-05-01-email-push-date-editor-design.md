# 设计文档：邮件推送修复 + 仪表盘日期编辑

**日期**: 2026-05-01
**状态**: 已批准
**范围**: 邮件推送内容修复 + 仪表盘任务标题点击编辑截止日期

---

## 1. 问题描述

### 1.1 邮件推送缺少今日任务
- **现状**: `build_push_content` 只查询 `due_date` 在今天的任务
- **影响**: 无截止日期的任务和长期任务不会出现在推送邮件中
- **根因**: 查询条件 `Task.due_date >= today_start AND Task.due_date < today_end` 排除了 `due_date IS NULL` 和 `is_long_term = 1` 的任务

### 1.2 无法通过任务标题编辑截止日期
- **现状**: 任务卡片已有日期 badge 可点击编辑，但用户期望点击标题也能编辑
- **影响**: 用户体验不直观，需要找到小的日期 badge 才能编辑

---

## 2. 设计方案

### 2.1 邮件推送重构

**目标**: 推送所有待办任务（今天到期 + 无截止日期 + 长期任务）

**修改文件**: `backend/app/services/push_service.py`

**查询逻辑变更**:
```python
# 旧逻辑
tasks = db.query(Task).filter(
    Task.user_id == user_id,
    Task.due_date >= today_start,
    Task.due_date < today_end,
).all()

# 新逻辑
from sqlalchemy import or_, and_
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

**展示逻辑**:
- 按象限分组显示所有待办任务
- 每个象限显示任务数量和前 5 个任务标题
- 保留 AI 摘要和鼓励语
- 无任务时显示"今日暂无待办任务"

**统计行变更**:
```python
# 旧逻辑
pending = [t for t in tasks if t.status and t.status.value == "pending"]
completed = [t for t in tasks if t.status and t.status.value == "completed"]

# 新逻辑（所有任务都是 pending，因为查询已过滤）
pending = tasks
completed = []  # 推送只显示待办，不显示已完成
```

### 2.2 仪表盘任务标题点击编辑日期

**目标**: 点击任务标题弹出日期选择器

**修改文件**: `frontend/src/components/QuadrantBoard.tsx`

**交互设计**:
- 点击任务标题切换 `showDatePicker` 状态（复用现有日期选择器）
- 标题 hover 时显示 `cursor-pointer` 和 `hover:opacity-80` 效果
- 日期选择器位置：任务卡片下方，与现有日期 badge 共用同一个弹窗
- 点击标题和点击日期 badge 都能打开同一个日期选择器

**代码变更**:
```tsx
// TaskCard 中的标题改为可点击
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

---

## 3. 数据流

### 3.1 邮件推送流程
```
用户触发推送 → push_service.execute_push()
  → build_push_content() 查询所有待办任务
  → 按象限分组渲染 HTML
  → send_email() 发送
```

### 3.2 日期编辑流程
```
用户点击任务标题 → TaskCard.setShowDatePicker(true)
  → 显示日期选择器弹窗
  → 用户选择日期 → onDateChange(task.id, newDate)
  → Dashboard.handleDateChange() → PUT /tasks/:id
  → 更新任务列表
```

---

## 4. 错误处理

### 4.1 邮件推送
- 查询无任务时：显示"今日暂无待办任务"
- AI 摘要生成失败：静默跳过，不影响推送
- 邮件发送失败：记录 PushLog，返回错误信息

### 4.2 日期编辑
- API 调用失败：显示错误提示，回滚本地状态
- 日期格式无效：前端 input[type=date] 原生校验

---

## 5. 测试计划

### 5.1 邮件推送
- 创建无截止日期任务 → 触发推送 → 验证邮件包含该任务
- 创建长期任务 → 触发推送 → 验证邮件包含该任务
- 创建今天到期任务 → 触发推送 → 验证邮件包含该任务
- 创建已完成任务 → 触发推送 → 验证邮件不包含该任务

### 5.2 日期编辑
- 点击任务标题 → 验证日期选择器弹出
- 选择日期 → 验证任务日期更新
- 点击日期 badge → 验证同一个选择器弹出
- 拖拽任务 → 验证不触发日期编辑

---

## 6. 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/app/services/push_service.py` | 编辑 | 修改查询条件和展示逻辑 |
| `frontend/src/components/QuadrantBoard.tsx` | 编辑 | 标题点击打开日期选择器 |
