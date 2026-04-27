"""DeepSeek V4 Flash for enhanced task classification."""
import json
import re
from langchain_core.messages import SystemMessage, HumanMessage
from app.agent.llm import get_llm
from app.services.classification import classify_task

_RE_AI_MENTION = re.compile(
    r'\b(AI|人工智能|模型|model|系统判定|system|算法|algorithm|机器|machine)\b[:：]?\s*',
    flags=re.IGNORECASE
)


def _sanitize_reason(text: str) -> str:
    """Remove AI/tech jargon from reason so it reads like human advice."""
    text = _RE_AI_MENTION.sub('', text).strip()
    text = re.sub(r'^[-—–·,，。、]\s*', '', text)
    return text or "根据任务内容自动分类"


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
- "summary": A concise task description based on title and urgency, no more than 20 Chinese characters. Must NOT mention any technology names or model names.
- "reason": Brief Chinese explanation of the classification. Must NOT mention "AI", "model", "system", or any technology names — write as if a human assistant gave the advice.

Return ONLY valid JSON: {"quadrant": "q1|q2|q3|q4", "reason": "简短中文理由（不含AI等字眼）", "summary": "不超过20字的中文摘要", "is_long_term": true/false}

Examples:
{"quadrant": "q1", "reason": "截止日期临近，需要优先处理", "summary": "紧急汇报准备", "is_long_term": false}
{"quadrant": "q2", "reason": "有助于长期成长，适合规划时间", "summary": "学习新技能提升自我", "is_long_term": true}
{"quadrant": "q3", "reason": "虽然时间紧但影响有限", "summary": "取快递", "is_long_term": false}
{"quadrant": "q4", "reason": "对目标没有实质帮助", "summary": "闲聊社交", "is_long_term": false}"""

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
        result["reason"] = _sanitize_reason(result.get("reason", ""))
        result.setdefault("summary", title.strip()[:20])
        result["method"] = "deepseek-v4"
        return result
    except Exception as e:
        result = classify_task(title, description)
        result["ai_available"] = False
        return result
