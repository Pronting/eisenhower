"""Workload analysis tool."""
import json
from langchain_core.messages import SystemMessage, HumanMessage
from app.agent.llm import get_llm


def analyze_workload(tasks: list[dict]) -> dict:
    """Analyze task workload distribution across quadrants."""
    llm = get_llm()
    stats = _compute_stats(tasks)

    if not llm:
        return _rule_analysis(stats)

    system_prompt = """You are a productivity analyst. Analyze the task workload distribution.
Return JSON with analysis in Chinese:
{
  "distribution": "分布分析",
  "risk": "风险评估",
  "suggestion": "调整建议",
  "balance_score": 0-100
}"""

    try:
        resp = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Workload data: {json.dumps(stats, ensure_ascii=False)}"),
        ])
        result = json.loads(resp.content.strip().removeprefix("```json").removesuffix("```").strip())
        result["stats"] = stats
        return result
    except Exception:
        return _rule_analysis(stats)


def _compute_stats(tasks: list[dict]) -> dict:
    quadrant_dist = {"q1": 0, "q2": 0, "q3": 0, "q4": 0}
    status_dist = {"pending": 0, "completed": 0, "archived": 0}
    for t in tasks:
        q = t.get("quadrant", "q4")
        s = t.get("status", "pending")
        quadrant_dist[q] = quadrant_dist.get(q, 0) + 1
        status_dist[s] = status_dist.get(s, 0) + 1
    total = len(tasks)
    return {
        "total": total,
        "quadrant_distribution": quadrant_dist,
        "status_distribution": status_dist,
        "q1_ratio": round(quadrant_dist["q1"] / total, 2) if total else 0,
        "q2_ratio": round(quadrant_dist["q2"] / total, 2) if total else 0,
        "completion_rate": round(status_dist["completed"] / total, 2) if total else 0,
    }


def _rule_analysis(stats: dict) -> dict:
    q1 = stats["quadrant_distribution"]["q1"]
    q2 = stats["quadrant_distribution"]["q2"]
    q4 = stats["quadrant_distribution"]["q4"]

    if q1 > q2:
        risk = "紧急任务过多，长期处于被动应对状态"
        suggestion = "建议每天预留时间处理重要不紧急的任务"
    elif q4 > 3:
        risk = "低价值任务偏多，需要减少时间浪费"
        suggestion = "考虑删除或合并低价值任务"
    else:
        risk = "工作量分布合理"
        suggestion = "保持当前节奏，定期复盘优化"

    return {
        "distribution": f"Q1={q1}, Q2={q2}, Q3={stats['quadrant_distribution']['q3']}, Q4={q4}",
        "risk": risk,
        "suggestion": suggestion,
        "balance_score": max(0, 100 - q1 * 10 - q4 * 5),
        "stats": stats,
    }
