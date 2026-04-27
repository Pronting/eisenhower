"""Weekly review generation tool."""
import json
from datetime import datetime, timedelta
from langchain_core.messages import SystemMessage, HumanMessage
from app.agent.llm import get_llm


def weekly_review(tasks: list[dict]) -> dict:
    """Generate a weekly review report."""
    llm = get_llm()
    stats = _compute_weekly_stats(tasks)

    if not llm:
        return _rule_weekly_review(stats)

    system_prompt = """You are a weekly review assistant. Generate a comprehensive weekly review in Chinese.
Return JSON:
{
  "summary": "本周总结",
  "achievements": "主要成就",
  "improvements": "改进空间",
  "next_week_focus": "下周重点",
  "productivity_score": 0-100
}"""

    try:
        resp = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Weekly data: {json.dumps(stats, ensure_ascii=False)}"),
        ])
        result = json.loads(resp.content.strip().removeprefix("```json").removesuffix("```").strip())
        result["stats"] = stats
        return result
    except Exception:
        return _rule_weekly_review(stats)


def _compute_weekly_stats(tasks: list[dict]) -> dict:
    week_ago = (datetime.now() - timedelta(days=7))
    completed = [t for t in tasks if t.get("status") == "completed"]
    q1 = [t for t in tasks if t.get("quadrant") == "q1"]
    return {
        "total": len(tasks),
        "completed": len(completed),
        "completion_rate": round(len(completed) / len(tasks), 2) if tasks else 0,
        "q1_count": len(q1),
        "q1_completed": len([t for t in q1 if t.get("status") == "completed"]),
    }


def _rule_weekly_review(stats: dict) -> dict:
    rate = stats["completion_rate"] * 100
    if rate >= 80:
        summary = f"本周完成率 {rate:.0f}%，表现优秀"
    elif rate >= 50:
        summary = f"本周完成率 {rate:.0f}%，有提升空间"
    else:
        summary = f"本周完成率 {rate:.0f}%，需要加强执行力"

    return {
        "summary": summary,
        "achievements": f"完成 {stats['completed']} 个任务",
        "improvements": "建议减少任务切换，专注高价值工作",
        "next_week_focus": f"重点关注 {stats['q1_count']} 个紧急重要任务",
        "productivity_score": min(100, int(rate * 1.2)),
        "stats": stats,
    }
