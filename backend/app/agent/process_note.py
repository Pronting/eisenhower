"""AI-powered note-to-tasks processor using LangChain + DeepSeek.

Takes free-form note content, splits it into actionable todo items,
classifies each into the correct Eisenhower quadrant with clear reasoning,
and generates concise descriptions.
"""
import json
import logging
from langchain_core.messages import SystemMessage, HumanMessage
from app.agent.llm import get_llm

logger = logging.getLogger(__name__)

NOTE_SYSTEM_PROMPT = """You are an intelligent task extractor and Eisenhower Matrix classifier.

## Your Job
Given a user's free-form note (小记), you must:
1. Identify every actionable todo item embedded in the text
2. Assign each item a concise title (≤30 chars in Chinese)
3. Classify each item into the correct Eisenhower quadrant
4. Give each item a brief but useful description (≤100 chars)
5. Provide a clear reason for the quadrant classification

## Eisenhower Quadrant Boundaries — Precise Definitions

### Q1 (q1): 重要且紧急 — Do First
**Hard boundary**: The task is BOTH important AND urgent.
- Important = directly impacts your core goals, career, health, or key relationships
- Urgent = deadline within 24-48 hours, or delayed action causes immediate damage
- Examples: 明天截止的汇报PPT、处理线上故障、紧急客户投诉、今天到期的合同签署
- Counter-examples (NOT Q1): 下周的汇报 (not urgent enough → Q2)、帮同事取快递 (not important → Q3)

### Q2 (q2): 重要不紧急 — Schedule It
**Hard boundary**: The task is important for long-term growth BUT has no immediate deadline pressure.
- Important = skill building, strategic planning, relationship nurturing, health investment
- NOT urgent = can be scheduled days/weeks ahead without negative consequences
- Examples: 学习新编程语言、制定年度计划、锻炼身体、阅读专业书籍、整理知识库
- Counter-examples (NOT Q2): 刷抖音学英语 (not genuinely important → Q4)、回复日常消息 (not important → Q3)

### Q3 (q3): 紧急不重要 — Delegate or Minimize
**Hard boundary**: The task feels urgent (time-sensitive) but is NOT important to YOUR core goals.
- Urgent/timely = someone else's deadline, a notification, a routine that feels pressing
- NOT important = doesn't move your own key results forward
- Examples: 回复非关键的群消息、参加可选的例会、处理例行审批、帮别人查资料
- Counter-examples (NOT Q3): 客户紧急需求 (it IS important → Q1)、自我提升课程 (not urgent → Q2)

### Q4 (q4): 不紧急不重要 — Eliminate or Delay
**Hard boundary**: The task is NEITHER urgent NOR important.
- NOT important = pure entertainment, busywork, trivial chores with no growth value
- NOT urgent = no deadline, no consequence if never done
- Examples: 刷社交媒体、整理已废弃的文件、过度完美的格式调整、无目的的网购浏览
- Counter-examples (NOT Q4): 整理工作文档 (could be Q2 if it improves efficiency)、回复有时间要求的信息 (has urgency → Q3)

## Classification Decision Tree
Ask yourself in this exact order:
1. "Does this task have a hard deadline within 48 hours?" → If YES, it's Q1 or Q3. If NO, it's Q2 or Q4.
2. "Does this task directly advance the user's core goals/health/relationships/career?" → If YES, it's Q1 or Q2. If NO, it's Q3 or Q4.
3. Combine: Urgent+Important=Q1, NotUrgent+Important=Q2, Urgent+NotImportant=Q3, NotUrgent+NotImportant=Q4

## Output Format
Return ONLY valid JSON (no markdown fences, no extra text):
{
  "tasks": [
    {
      "title": "准备明天会议PPT",
      "description": "收集上周数据，制作Q1业绩汇报PPT，预计需要2小时",
      "quadrant": "q1",
      "reason": "明天截止的汇报材料，直接影响绩效评估，紧急且重要"
    }
  ]
}

## Important Rules
- If the note contains NO actionable items, return {"tasks": []}
- Merge similar/redundant items into one task
- Titles must be actionable (start with a verb when possible)
- Descriptions should add context beyond the title — what/why/how
- Do NOT invent tasks not mentioned in the note
- Each task must be a self-contained actionable unit"""


def process_note_to_tasks(content: str) -> dict:
    """Process free-form note content into structured task items with quadrant classification.

    Args:
        content: The user's raw note text (小记内容)

    Returns:
        dict: {"tasks": [{title, description, quadrant, reason}, ...]}
              Empty tasks list if no actionable items found.
    """
    llm = get_llm(temperature=0.1)
    if not llm:
        logger.warning("LLM not available for note processing")
        return {"tasks": [], "error": "AI service unavailable"}

    try:
        resp = llm.invoke([
            SystemMessage(content=NOTE_SYSTEM_PROMPT),
            HumanMessage(content=f"用户的今日小记内容：\n{content}"),
        ])
        raw = resp.content.strip()

        # Strip markdown code fences if present
        if raw.startswith("```"):
            lines = raw.split("\n")
            raw = "\n".join(lines[1:]) if len(lines) > 1 else raw
            if raw.endswith("```"):
                raw = raw[:-3].strip()

        result = json.loads(raw)
        tasks = result.get("tasks", [])

        # Validate and sanitize each task
        valid_quadrants = {"q1", "q2", "q3", "q4"}
        sanitized = []
        for t in tasks:
            quadrant = t.get("quadrant", "q4")
            if quadrant not in valid_quadrants:
                quadrant = "q4"
            sanitized.append({
                "title": str(t.get("title", "未命名任务"))[:200],
                "description": str(t.get("description", ""))[:2000],
                "quadrant": quadrant,
                "reason": str(t.get("reason", "")),
            })

        logger.info(f"Note processed: extracted {len(sanitized)} tasks from note")
        return {"tasks": sanitized}

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response as JSON: {raw[:200]}")
        return {"tasks": [], "error": f"AI response parse error: {str(e)}"}
    except Exception as e:
        logger.error(f"Note processing failed: {str(e)}")
        return {"tasks": [], "error": str(e)}
