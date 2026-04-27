"""DeepSeek V4 Flash for enhanced task classification."""
import json
from langchain_core.messages import SystemMessage, HumanMessage
from app.agent.llm import get_llm
from app.services.classification import classify_task


def ai_classify(title: str, description: str = "") -> dict:
    """Classify a task into Eisenhower quadrant using AI. Falls back to rule-based."""
    llm = get_llm()
    if not llm:
        return classify_task(title, description)

    system_prompt = """You are a task priority classifier using the Eisenhower Matrix.
Analyze the task and classify it into one quadrant with a clear reason.

Rules:
- Q1 (Do First): Urgent & Important — deadlines, crises, critical issues
- Q2 (Schedule): Not Urgent & Important — growth, planning, relationships
- Q3 (Delegate): Urgent & Not Important — interruptions, meetings, minor requests
- Q4 (Eliminate): Not Urgent & Not Important — trivia, time wasters

Return ONLY valid JSON: {"quadrant": "q1|q2|q3|q4", "reason": "简短中文理由", "is_long_term": true/false}

Examples:
{"quadrant": "q1", "reason": "明天截止的老板汇报，紧急且重要", "is_long_term": false}
{"quadrant": "q2", "reason": "学习新技能重要但不紧急，适合长期规划", "is_long_term": true}
{"quadrant": "q3", "reason": "取快递虽然时间紧但不重要", "is_long_term": false}
{"quadrant": "q4", "reason": "闲聊社交既不紧急也不重要", "is_long_term": false}"""

    try:
        resp = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Task: {title}\nDescription: {description}"),
        ])
        content = resp.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        result = json.loads(content)
        result.setdefault("is_long_term", False)
        result["method"] = "deepseek-v4"
        return result
    except Exception as e:
        result = classify_task(title, description)
        result["ai_available"] = False
        return result
