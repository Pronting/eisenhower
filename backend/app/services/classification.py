"""
Rule-based Eisenhower quadrant classifier.
As fallback when DeepSeek API is not configured.
"""
import re
from app.models.models import Quadrant

# Keywords suggesting urgency (time-sensitive)
URGENT_KEYWORDS = [
    "今天", "明天", "截止", "deadline", "紧急", "立即", "马上", "尽快",
    "urgent", "asap", "today", "tomorrow", "due", "overdue",
    "今晚", "今晚之前", "今天之内", "不能再拖",
]

# Keywords suggesting importance (high impact)
IMPORTANT_KEYWORDS = [
    "老板", "客户", "重要", "战略", "核心", "关键", "必须",
    "boss", "client", "important", "critical", "key", "must",
    "项目", "汇报", "审批", "决策", "合同", "签约",
    "面试", "招聘", "绩效", "预算", "收入",
    # Extended
    "学习", "learn", "study", "培训", "training", "课程", "course", "技能", "skill", "成长", "发展",
    "健康", "身体", "锻炼", "医疗", "体检",
    "理财", "投资", "保险", "税务",
    "计划", "规划", "方案", "策略",
    "产品", "发布", "上线", "迭代",
    "bug", "故障", "修复", "优化",
]


def classify_task(title: str, description: str = "") -> dict:
    """Classify a task into Eisenhower quadrant using keyword rules."""
    text = f"{title} {description}".lower()

    is_urgent = any(kw.lower() in text for kw in URGENT_KEYWORDS)
    is_important = any(kw.lower() in text for kw in IMPORTANT_KEYWORDS)

    if is_urgent and is_important:
        quadrant = Quadrant.Q1  # Do First
        reason = "紧急且重要 — 需要立即处理"
    elif is_important and not is_urgent:
        quadrant = Quadrant.Q2  # Schedule
        reason = "重要但不紧急 — 安排到日程中"
    elif is_urgent and not is_important:
        quadrant = Quadrant.Q3  # Delegate
        reason = "紧急但不重要 — 考虑委托他人"
    else:
        quadrant = Quadrant.Q4  # Eliminate
        reason = "既不紧急也不重要 — 考虑删除"

    return {
        "quadrant": quadrant.value,
        "reason": reason,
        "method": "rule-based",
        "is_long_term": not is_urgent and is_important,
    }
