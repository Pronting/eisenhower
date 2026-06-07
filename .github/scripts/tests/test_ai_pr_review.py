"""Unit tests for pure functions in ai_pr_review.py.

Run: python -m unittest discover -s tests -v
"""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

# Make the parent module importable when running this file directly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ai_pr_review import (  # noqa: E402
    normalize_review,
    parse_file_patches,
    parse_review,
)


DIFF_FIXTURE = (
    "diff --git a/foo.py b/foo.py\n"
    "index 1234567..abcdef0 100644\n"
    "--- a/foo.py\n"
    "+++ b/foo.py\n"
    "@@ -1,3 +1,4 @@\n"
    " line1\n"
    "+added line\n"
    " line2\n"
    "-line3\n"
    "+line3_modified\n"
    " line4\n"
    "diff --git a/bar.py b/bar.py\n"
    "new file mode 100644\n"
    "index 0000000..1234567\n"
    "--- /dev/null\n"
    "+++ b/bar.py\n"
    "@@ -0,0 +1,2 @@\n"
    "+new1\n"
    "+new2\n"
)


class TestParseFilePatches(unittest.TestCase):
    def test_returns_two_files(self) -> None:
        patches = parse_file_patches(DIFF_FIXTURE)
        self.assertEqual(set(patches.keys()), {"foo.py", "bar.py"})

    def test_modified_file_new_lines(self) -> None:
        patches = parse_file_patches(DIFF_FIXTURE)
        # foo.py new side: line1(1), added(2), line2(3), line3_modified(4), line4(5)
        self.assertEqual(patches["foo.py"].new_lines, {1, 2, 3, 4, 5})

    def test_new_file_new_lines(self) -> None:
        patches = parse_file_patches(DIFF_FIXTURE)
        # bar.py new side: new1(1), new2(2)
        self.assertEqual(patches["bar.py"].new_lines, {1, 2})

    def test_empty_diff(self) -> None:
        self.assertEqual(parse_file_patches(""), {})

    def test_ignores_file_headers(self) -> None:
        # "--- a/x" and "+++ b/x" must not be treated as +/- lines
        diff = (
            "diff --git a/x.py b/x.py\n"
            "--- a/x.py\n"
            "+++ b/x.py\n"
            "@@ -0,0 +1,1 @@\n"
            "+only line\n"
        )
        patches = parse_file_patches(diff)
        self.assertEqual(patches["x.py"].new_lines, {1})

    def test_handles_crlf(self) -> None:
        diff = DIFF_FIXTURE.replace("\n", "\r\n")
        patches = parse_file_patches(diff)
        self.assertEqual(patches["foo.py"].new_lines, {1, 2, 3, 4, 5})


class TestNormalizeReview(unittest.TestCase):
    def test_drops_invalid_comments(self) -> None:
        data = {
            "summary": "ok",
            "verdict": "approve",
            "comments": [
                {"path": "x.py", "line": 1, "body": "good", "severity": "nit"},
                {"path": "x.py", "line": "abc", "body": "bad line type"},
                {"path": "", "line": 1, "body": "no path"},
                {"path": "x.py", "line": 1, "body": ""},
                {"path": "x.py", "line": 1, "body": "no severity"},
            ],
        }
        result = normalize_review(data)
        self.assertEqual(len(result["comments"]), 2)
        # 5th entry has no severity key → defaults to "warning", still valid
        self.assertEqual(result["comments"][1]["severity"], "warning")

    def test_invalid_verdict_defaults_to_comment(self) -> None:
        result = normalize_review({"summary": "x", "verdict": "wat", "comments": []})
        self.assertEqual(result["verdict"], "comment")

    def test_invalid_severity_defaults_to_warning(self) -> None:
        data = {
            "summary": "x",
            "verdict": "comment",
            "comments": [{"path": "x.py", "line": 1, "body": "y", "severity": "blah"}],
        }
        result = normalize_review(data)
        self.assertEqual(result["comments"][0]["severity"], "warning")

    def test_caps_at_max(self) -> None:
        data = {
            "summary": "x",
            "verdict": "comment",
            "comments": [
                {"path": "x.py", "line": i, "body": f"c{i}", "severity": "nit"}
                for i in range(50)
            ],
        }
        result = normalize_review(data)
        self.assertEqual(len(result["comments"]), 20)

    def test_accepts_path_alias(self) -> None:
        data = {
            "summary": "x",
            "verdict": "comment",
            "comments": [{"file": "x.py", "line": 1, "body": "y", "severity": "warning"}],
        }
        result = normalize_review(data)
        self.assertEqual(result["comments"][0]["path"], "x.py")

    def test_strips_whitespace(self) -> None:
        data = {
            "summary": "  x  ",
            "verdict": "comment",
            "comments": [{"path": "x.py", "line": 1, "body": "  y  ", "severity": "warning"}],
        }
        result = normalize_review(data)
        self.assertEqual(result["summary"], "x")
        self.assertEqual(result["comments"][0]["body"], "y")


class TestParseReview(unittest.TestCase):
    def test_direct_json(self) -> None:
        self.assertEqual(parse_review('{"a": 1}'), {"a": 1})

    def test_json_in_markdown_fence(self) -> None:
        self.assertEqual(parse_review('```json\n{"a": 2}\n```'), {"a": 2})

    def test_json_with_prefix(self) -> None:
        self.assertEqual(parse_review('here you go: {"a": 3}'), {"a": 3})

    def test_invalid_raises(self) -> None:
        with self.assertRaises(ValueError):
            parse_review("not json at all")

    def test_json_object_value(self) -> None:
        result = parse_review(json.dumps({"summary": "ok", "verdict": "approve", "comments": []}))
        self.assertEqual(result["verdict"], "approve")


if __name__ == "__main__":
    unittest.main()
