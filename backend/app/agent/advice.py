"""
Quick AI advice generator for the dashboard mascot.
Uses DeepSeek V4 Flash for speed — targets <2s response.
"""
import json
import logging
from langchain_core.messages import SystemMessage, HumanMessage
from app.agent.llm import get_llm

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是艾森豪威尔矩阵的看板娘助手。用户任务分四个象限：
Q1 重要紧急（立即执行）| Q2 重要不紧急（计划安排）| Q3 紧急不重要（委派）| Q4 不紧急不重要（消除）

分析待办任务，给出一条精炼的行动建议。要求：
- 语气活泼鼓励，带一个相关 emoji
- 不超过 40 个中文字
- 优先关注 Q1 任务，其次 Q2
- 如果无待办，就夸用户并鼓励保持

返回 JSON：{"advice": "你的建议", "focus_quadrant": "q1|q2|q3|q4", "urgency": "high|medium|low"}"""


def generate_advice(tasks: list[dict]) -> dict:
    """Generate a quick action advice based on pending task priorities. Fast path <2s."""
    pending = [t for t in tasks if t.get("status") == "pending"]
    if not pending:
        return {
            "advice": "太棒了，所有任务都完成啦！给自己一点奖励吧 🎉",
            "focus_quadrant": None,
            "urgency": "low",
        }

    llm = get_llm(temperature=0.3, max_tokens=80)
    if not llm:
        return _rule_advice(pending)

    # Build compact task summary
    by_q = {"q1": [], "q2": [], "q3": [], "q4": []}
    for t in pending:
        q = t.get("quadrant", "q4")
        if q in by_q:
            by_q[q].append(t.get("title", ""))

    lines = []
    for q in ["q1", "q2", "q3", "q4"]:
        if by_q[q]:
            lines.append(f"{q}: " + ", ".join(by_q[q][:5]))
    task_text = "\n".join(lines)

    try:
        resp = llm.invoke([
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=f"待办：\n{task_text}"),
        ])
        content = resp.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        result = json.loads(content)
        result["method"] = "deepseek-v4-flash"
        return result
    except Exception as e:
        logger.warning(f"Advice AI failed: {e}")
        return _rule_advice(pending)


def _rule_advice(pending: list[dict]) -> dict:
    """Fallback rule-based advice."""
    q1 = [t for t in pending if t.get("quadrant") == "q1"]
    q2 = [t for t in pending if t.get("quadrant") == "q2"]

    if q1:
        return {
            "advice": f"还有 {len(q1)} 个紧急任务等你处理，先搞定「{q1[0].get('title', '这个')}」吧 ⚡",
            "focus_quadrant": "q1",
            "urgency": "high",
        }
    elif q2:
        return {
            "advice": f"趁现在没有紧急事务，规划一下「{q2[0].get('title', '重要任务')}」吧 📋",
            "focus_quadrant": "q2",
            "urgency": "medium",
        }
    else:
        return {
            "advice": f"还有 {len(pending)} 个待办，按优先级一个一个来 💪",
            "focus_quadrant": "q3",
            "urgency": "low",
        }
