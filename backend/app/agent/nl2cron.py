"""Natural-language -> cron expression translator.

Uses DeepSeek via LangChain (same pattern as process_note.py) to convert a
Chinese (or English) description of when to push into a list of valid
5-field cron expressions with a natural-language explanation of each.
"""
import json
import logging
import re
from datetime import datetime

from croniter import croniter
from langchain_core.messages import SystemMessage, HumanMessage
from app.agent.llm import get_llm

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """你是 cron 表达式翻译助手。

## 任务
用户会用自然语言描述"什么时候触发推送"。你要：
1. 理解意图（频率 + 具体时间 + 时段）
2. 输出 1-3 个候选 5 位 cron 表达式（minute hour day-of-month month day-of-week）
3. 为每个候选写一句通俗解释

## cron 五位格式
```
*    *    *    *    *
分   时   日   月   周
0-59 0-23 1-31 1-12 0-6 (0=周日)
```

## 常见映射
- "每天早上 9 点"          -> 0 9 * * *
- "工作日早上 9 点"        -> 0 9 * * 1-5
- "每周一上午 10 点"       -> 0 10 * * 1
- "每周末晚上 8 点"        -> 0 20 * * 0,6
- "每 30 分钟"             -> */30 * * * *
- "每 2 小时"              -> 0 */2 * * *
- "每月 1 号中午 12 点"    -> 0 12 1 * *
- "每个工作日下午 5 点"    -> 0 17 * * 1-5

## 输出格式（严格 JSON 数组）
```json
[
  {"cron": "0 9 * * 1-5", "human": "每个工作日上午 9 点"},
  {"cron": "0 9 * * *",   "human": "每天上午 9 点"}
]
```

只输出 JSON 数组，不要其他文字。
如果完全无法理解，输出空数组 []。
"""


def _safe_strip_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:]) if len(lines) > 1 else text
        if text.endswith("```"):
            text = text[:-3].strip()
    return text


def _fallback_cron(description: str) -> list[dict]:
    """Rule-based fallback when LLM is unavailable or returns garbage."""
    desc = description.lower()
    items: list[dict] = []
    if re.search(r"30\s*分|half\s*hour", desc):
        items.append({"cron": "*/30 * * * *", "human": "每 30 分钟一次"})
    if re.search(r"每\s*个?小时|hourly|整点", desc):
        items.append({"cron": "0 * * * *", "human": "每小时整点一次"})
    if re.search(r"早上|上午|morning", desc):
        items.append({"cron": "0 9 * * *", "human": "每天上午 9 点"})
    if re.search(r"中午|正午|noon", desc):
        items.append({"cron": "0 12 * * *", "human": "每天中午 12 点"})
    if re.search(r"晚上|下午|傍晚|evening", desc):
        items.append({"cron": "0 18 * * *", "human": "每天下午 6 点"})
    if re.search(r"工作日|weekday|平日", desc):
        items.append({"cron": "0 9 * * 1-5", "human": "每个工作日上午 9 点"})
    if re.search(r"周末|weekend", desc):
        items.append({"cron": "0 10 * * 0,6", "human": "每周六日早上 10 点"})
    if not items:
        items.append({"cron": "0 9 * * *", "human": "每天上午 9 点（默认）"})
    return items


def generate_cron_candidates(description: str) -> tuple[list[dict], str]:
    """Return (candidates, reasoning). Each candidate is {cron, human}."""
    try:
        llm = get_llm()
        resp = llm.invoke([
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=f"用户的推送时间描述：\n{description}"),
        ])
        text = _safe_strip_json(resp.content)
        candidates = json.loads(text)
        if not isinstance(candidates, list):
            raise ValueError("LLM did not return a list")
        valid: list[dict] = []
        for c in candidates:
            if not isinstance(c, dict) or "cron" not in c:
                continue
            try:
                croniter(c["cron"], datetime.now())
            except Exception:
                continue
            valid.append({
                "cron": c["cron"],
                "human": c.get("human", c["cron"]),
            })
        if valid:
            return valid, "由 AI 根据你的描述生成"
    except Exception as e:
        logger.warning(f"LLM cron generation failed: {e}")

    return _fallback_cron(description), "AI 不可用，使用规则匹配生成"


def preview_cron(cron_expr: str, n: int = 5) -> list[datetime]:
    """Return the next `n` fire times for a cron expression (UTC)."""
    base = datetime.now()
    it = croniter(cron_expr, base)
    return [it.get_next(datetime) for _ in range(n)]
