"""Smart task scheduling suggestion tool."""
import json
from datetime import datetime
from langchain_core.messages import SystemMessage, HumanMessage
from app.agent.llm import get_llm


def suggest_schedule(tasks: list[dict]) -> dict:
    """Suggest a schedule for pending tasks based on priority and time."""
    llm = get_llm()
    pending = [t for t in tasks if t.get("status") == "pending"]

    if not llm or not pending:
        return _rule_schedule(pending)

    task_list = "\n".join([
        f"- [{t['quadrant']}] {t['title']}" for t in pending[:15]
    ])

    system_prompt = f"""You are a scheduling assistant. Current time: {datetime.now().strftime('%Y-%m-%d %H:%M')}
Suggest a priority-ordered schedule for these tasks in Chinese.
Return JSON:
{{
  "priority_order": ["task1", "task2", ...],
  "time_allocation": {{"task_title": "建议时间段"}},
  "tips": "排期建议"
}}"""

    try:
        resp = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Pending tasks:\n{task_list}"),
        ])
        result = json.loads(resp.content.strip().removeprefix("```json").removesuffix("```").strip())
        return result
    except Exception:
        return _rule_schedule(pending)


def _rule_schedule(pending: list[dict]) -> dict:
    q1 = [t for t in pending if t.get("quadrant") == "q1"]
    q2 = [t for t in pending if t.get("quadrant") == "q2"]
    q3 = [t for t in pending if t.get("quadrant") == "q3"]

    priority_order = [t["title"] for t in q1 + q2 + q3]
    time_alloc = {}
    for t in q1:
        time_alloc[t["title"]] = "上午优先处理"
    for t in q2:
        time_alloc[t["title"]] = "安排到日程中"
    for t in q3:
        time_alloc[t["title"]] = "碎片时间处理"

    return {
        "priority_order": priority_order,
        "time_allocation": time_alloc,
        "tips": "先处理紧急重要的任务，预留固定时间给重要不紧急的任务。",
    }
