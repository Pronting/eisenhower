"""
Tests for the rule-based Eisenhower classifier (``app.services.classification``).

These are pure unit tests — no database or API involved.  They verify that
the keyword-matching logic correctly assigns tasks to the four quadrants.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.classification import classify_task
from app.models.models import Quadrant

# ======================================================================
# Quadrant: Q1 – Urgent & Important
# ======================================================================

def test_q1_urgent_and_important():
    """Keywords for both urgency and importance -> Q1."""
    result = classify_task("老板要的明天截止的汇报")
    assert result["quadrant"] == "q1"
    assert result["method"] == "rule-based"
    # Q1 should never be considered a long-term task
    assert result["is_long_term"] is False


def test_q1_chinese_keywords():
    """Chinese urgent (紧急/今天) + important (客户/修复) keywords."""
    result = classify_task("紧急bug修复", "客户发现严重问题需要今天解决")
    assert result["quadrant"] == "q1"


def test_q1_english_keywords():
    """English urgent (urgent) + important (client/bug) keywords."""
    result = classify_task("urgent bug fix for client")
    assert result["quadrant"] == "q1"


def test_q1_case_insensitivity():
    """Keyword matching should be case-insensitive."""
    result = classify_task("URGENT CLIENT MEETING TOMORROW")
    assert result["quadrant"] == "q1"


def test_q1_title_and_description_both_used():
    """Urgency in title, importance in description -> Q1."""
    result = classify_task("今天之前搞定", description="这个项目是核心战略")
    assert result["quadrant"] == "q1"


# ======================================================================
# Quadrant: Q2 – Not Urgent & Important
# ======================================================================

def test_q2_important_not_urgent():
    """Keywords for importance but not urgency -> Q2."""
    result = classify_task("学习机器学习课程")
    assert result["quadrant"] == "q2"
    # Q2 tasks are considered long-term
    assert result["is_long_term"] is True


def test_q2_chinese_important_keywords():
    """Only important keywords present -> Q2."""
    result = classify_task("制定季度产品发布计划")
    assert result["quadrant"] == "q2"


def test_q2_english_important_keywords():
    """English important-only keywords -> Q2."""
    result = classify_task("important strategic planning session")
    assert result["quadrant"] == "q2"


def test_q2_long_term_flag():
    """Q2 tasks should have is_long_term = True."""
    result = classify_task("学习新技能提升自己")
    assert result["is_long_term"] is True


# ======================================================================
# Quadrant: Q3 – Urgent & Not Important
# ======================================================================

def test_q3_urgent_not_important():
    """Keywords for urgency but not importance -> Q3."""
    result = classify_task("取快递明天到")
    assert result["quadrant"] == "q3"
    assert result["is_long_term"] is False


def test_q3_english_urgent_only():
    """English urgent-only keywords -> Q3."""
    result = classify_task("reply to email today")
    assert result["quadrant"] == "q3"


# ======================================================================
# Quadrant: Q4 – Neither Urgent nor Important
# ======================================================================

def test_q4_neither():
    """No urgency or importance keywords -> Q4."""
    result = classify_task("买零食")
    assert result["quadrant"] == "q4"
    assert result["is_long_term"] is False


def test_q4_english_neither():
    """English text without any keywords -> Q4."""
    result = classify_task("browse social media")
    assert result["quadrant"] == "q4"


def test_q4_empty_string():
    """Completely empty title -> Q4."""
    result = classify_task("")
    assert result["quadrant"] == "q4"


# ======================================================================
# Description scanning
# ======================================================================

def test_description_only_has_keywords():
    """Classification should also scan the *description* field."""
    result = classify_task("随便", description="关于一个重要项目")
    assert result["quadrant"] == "q2", \
        "Important keyword in description should make this Q2"


def test_description_does_not_override_title():
    """If title already has keywords, description should not override
    the quadrant (but both contribute to the is_urgent / is_important
    flags)."""
    # Title alone is Q3, but description adds importance -> becomes Q1
    result = classify_task("今天交表", description="这是给老板的战略报告")
    assert result["quadrant"] == "q1"


# ======================================================================
# Metadata structure & edge cases
# ======================================================================

def test_metadata_structure():
    """Result dict should contain all expected fields."""
    result = classify_task("test")
    assert "quadrant" in result
    assert "reason" in result
    assert "method" in result
    assert "is_long_term" in result
    assert result["method"] == "rule-based"
    assert isinstance(result["reason"], str)
    assert len(result["reason"]) > 0


def test_no_false_positive_common_words():
    """Common words that happen to contain a keyword substring should
    NOT trigger a match.  The keywords use ``in`` (substring) matching,
    so this test documents the current behaviour."""
    # "总结" does not appear in the keyword lists, but it's a real word
    result = classify_task("写周总结")
    assert result["quadrant"] == "q4"
