"""Task decomposition tool - break vague tasks into actionable subtasks."""
import json
from langchain_core.messages import SystemMessage, HumanMessage
from app.agent.llm import get_llm


def decompose_task(title: str, description: str = "") -> dict:
    """Break down a vague task into actionable subtasks."""
    llm = get_llm()
    if not llm:
        return _rule_decompose(title)

    system_prompt = """You are a task decomposition expert. Break down vague tasks into specific, actionable subtasks.
Return JSON:
{
  "subtasks": [
    {"title": "具体子任务", "estimated_minutes": 30, "dependencies": []}
  ],
  "estimated_total_minutes": 120,
  "advice": "执行建议"
}
Generate 3-6 subtasks. Keep titles concise and actionable."""

    try:
        resp = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Task: {title}\nDescription: {description}"),
        ])
        content = resp.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(content)
    except Exception:
        return _rule_decompose(title)


def _rule_decompose(title: str) -> dict:
    """Simple rule-based decomposition as fallback."""
    return {
        "subtasks": [
            {"title": f"调研：{title}", "estimated_minutes": 30, "dependencies": []},
            {"title": f"规划：{title}", "estimated_minutes": 20, "dependencies": ["调研：" + title]},
            {"title": f"执行：{title}", "estimated_minutes": 60, "dependencies": ["规划：" + title]},
            {"title": f"复盘：{title}", "estimated_minutes": 15, "dependencies": ["执行：" + title]},
        ],
        "estimated_total_minutes": 125,
        "advice": "建议按调研→规划→执行→复盘的顺序推进。",
    }
