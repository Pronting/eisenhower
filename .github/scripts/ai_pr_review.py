#!/usr/bin/env python3
"""AI PR Reviewer — MiniMax (primary) with DeepSeek (fallback).

Triggered by .github/workflows/ai-pr-review.yml. Posts a summary
comment + up to 20 inline review comments to a pull request.

Required env:
  GITHUB_TOKEN         PR/issue write access (provided by Actions)
  REPOSITORY           "owner/repo" format
  PR_NUMBER            integer

At least one of these must be set:
  MINIMAX_API_KEY      enables the MiniMax provider
  DEEPSEEK_API_KEY     enables the DeepSeek provider (used as fallback)

Optional env:
  PRIMARY_PROVIDER     "minimax" (default) or "deepseek"
  MINIMAX_BASE_URL     default https://api.minimaxi.com/anthropic (Anthropic protocol)
  MINIMAX_MODEL        default MiniMax-M3
  DEEPSEEK_BASE_URL    default https://api.deepseek.com/anthropic (Anthropic protocol)
  DEEPSEEK_MODEL       default deepseek-v4-pro

Exit codes:
  0  success
  1  expected failure (no API key, parse error, etc.) — error comment posted
  2  unexpected / config error — nothing posted
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

import httpx

GITHUB_API = "https://api.github.com"
DIFF_MAX_BYTES = 200_000
MAX_INLINE_COMMENTS = 20
PROMPT_FILE = Path(__file__).parent / "prompts" / "review_system.md"
USER_AGENT = "ai-pr-reviewer/1.0"
SUMMARY_MARKER = "<!-- ai-pr-reviewer:summary -->"
ANTHROPIC_VERSION = "2023-06-01"
ANTHROPIC_MAX_TOKENS = 8192

# Tool definition that forces structured JSON output. The model must call this
# tool with `input` matching the schema; we extract that input as the review.
REVIEW_TOOL = {
    "name": "submit_review",
    "description": "Submit the code review verdict and inline comments. Call this tool exactly once with the full review.",
    "input_schema": {
        "type": "object",
        "properties": {
            "summary": {
                "type": "string",
                "description": "1-3 sentence summary of the review.",
            },
            "verdict": {
                "type": "string",
                "enum": ["approve", "request_changes", "comment"],
                "description": "Overall review verdict.",
            },
            "comments": {
                "type": "array",
                "description": "Up to 20 inline comments. Empty array if LGTM.",
                "items": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "File path relative to repo root."},
                        "line": {"type": "integer", "description": "1-based line number in the NEW file."},
                        "severity": {
                            "type": "string",
                            "enum": ["nit", "warning", "blocker"],
                        },
                        "body": {"type": "string", "description": "1-3 sentence comment."},
                    },
                    "required": ["path", "line", "body"],
                },
            },
        },
        "required": ["summary", "verdict", "comments"],
    },
}


# ---------- env helpers ----------

def get_env(name: str, *, default: Optional[str] = None, required: bool = False) -> str:
    # Treat empty-string env the same as unset, so workflow vars that the
    # user hasn't configured (which GitHub passes as "") fall through to the
    # default instead of breaking URL construction.
    val = os.environ.get(name) or default
    if required and not val:
        print(f"::error::missing required env: {name}", file=sys.stderr)
        sys.exit(2)
    return val or ""


# ---------- GitHub API ----------

def gh_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": USER_AGENT,
    }


def gh_get(path: str, token: str, params: Optional[dict] = None) -> Any:
    url = f"{GITHUB_API}{path}"
    with httpx.Client(timeout=60) as client:
        r = client.get(url, headers=gh_headers(token), params=params or {})
        r.raise_for_status()
        return r.json()


def gh_post(path: str, token: str, body: dict) -> Any:
    url = f"{GITHUB_API}{path}"
    with httpx.Client(timeout=60) as client:
        r = client.post(url, headers=gh_headers(token), json=body)
        r.raise_for_status()
        return r.json()


def fetch_pr(repo: str, pr_number: int, token: str) -> dict:
    return gh_get(f"/repos/{repo}/pulls/{pr_number}", token)


def fetch_pr_diff(repo: str, pr_number: int, token: str) -> str:
    """Returns the unified diff as text."""
    headers = gh_headers(token) | {"Accept": "application/vnd.github.v3.diff"}
    with httpx.Client(timeout=60) as client:
        r = client.get(f"{GITHUB_API}/repos/{repo}/pulls/{pr_number}", headers=headers)
        r.raise_for_status()
        return r.text


def fetch_pr_files(repo: str, pr_number: int, token: str) -> list[dict]:
    files: list[dict] = []
    page = 1
    while True:
        batch = gh_get(
            f"/repos/{repo}/pulls/{pr_number}/files",
            token,
            params={"per_page": 100, "page": page},
        )
        if not batch:
            break
        files.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return files


# ---------- diff utilities ----------

@dataclass
class FilePatch:
    path: str
    new_lines: set[int] = field(default_factory=set)


def parse_file_patches(diff_text: str) -> dict[str, FilePatch]:
    """Walk a unified diff and record, per file, the set of valid new-side line numbers.

    A "new-side line" is a line that exists in the post-change file — either a
    pure addition (+) or an unchanged context line ( ). Deletions are skipped.
    """
    out: dict[str, FilePatch] = {}
    current_path: Optional[str] = None
    cur_new: Optional[int] = None

    for line in diff_text.splitlines():
        if line.startswith("diff --git "):
            current_path = None
            cur_new = None
            m = re.match(r"diff --git a/(.+?) b/(.+)", line)
            if m:
                current_path = m.group(2)
                out.setdefault(current_path, FilePatch(current_path))
            continue

        if line.startswith("@@"):
            m = re.match(r"@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@", line)
            if not m or not current_path:
                cur_new = None
                continue
            cur_new = int(m.group(1))
            continue

        # skip file headers like "--- a/path" and "+++ b/path"
        if line.startswith("---") or line.startswith("+++"):
            continue

        if not current_path or cur_new is None:
            continue

        if line.startswith("+"):
            out[current_path].new_lines.add(cur_new)
            cur_new += 1
        elif line.startswith("-"):
            # deletion: not part of new side, don't advance cur_new
            pass
        elif line.startswith(" "):
            out[current_path].new_lines.add(cur_new)
            cur_new += 1
        # else: "\ No newline at end of file" etc. — ignore

    return out


# ---------- prompt ----------

def build_messages(pr: dict, diff: str, files: list[dict], system_prompt: str) -> list[dict]:
    truncated = False
    raw = diff.encode("utf-8", errors="replace")
    if len(raw) > DIFF_MAX_BYTES:
        diff = raw[:DIFF_MAX_BYTES].decode("utf-8", errors="replace")
        truncated = True

    file_list = "\n".join(
        f"- {f['filename']} (+{f['additions']}/-{f['deletions']})" for f in files
    ) or "(no files)"

    truncate_note = "\n\n(Diff truncated at 200KB; review only what is shown.)" if truncated else ""

    user_prompt = (
        f"PR #{pr['number']}: {pr['title']}\n"
        f"Author: {pr['user']['login']}\n"
        f"Base: {pr['base']['ref']}  ←  Head: {pr['head']['ref']}\n\n"
        f"Files changed:\n{file_list}\n\n"
        f"Description:\n{pr.get('body') or '(no description)'}\n\n"
        f"Diff (unified):\n```diff\n{diff}{truncate_note}\n```\n"
    )
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


# ---------- LLM providers ----------

def parse_anthropic_response(data: dict) -> str:
    """Extract the review payload from an Anthropic /v1/messages response.

    Priority:
      1. tool_use block (input is structured JSON we asked for)
      2. text block with type == "text"
      3. any block with a "text" field
      4. concatenation of "thinking" blocks (last-resort, likely unparseable)
    """
    content = data.get("content")
    if isinstance(content, list):
        # tool_use: serialize the structured input back to JSON
        for block in content:
            if isinstance(block, dict) and block.get("type") == "tool_use":
                return json.dumps(block.get("input") or {})
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                return block.get("text", "")
        for block in content:
            if isinstance(block, dict) and isinstance(block.get("text"), str):
                return block["text"]
        thinking_parts = [
            block["thinking"]
            for block in content
            if isinstance(block, dict) and isinstance(block.get("thinking"), str)
        ]
        if thinking_parts:
            return "\n".join(thinking_parts)
    if isinstance(content, str):
        return content
    raise ValueError(
        f"could not extract text from Anthropic response: {json.dumps(data)[:300]}"
    )


def call_anthropic_compat(
    *,
    base_url: str,
    api_key: str,
    model: str,
    messages: list[dict],
    max_tokens: int = ANTHROPIC_MAX_TOKENS,
    timeout: int = 300,
    max_retries: int = 2,
) -> str:
    """Call an Anthropic-protocol endpoint (POST <base>/v1/messages).

    Anthropic uses x-api-key + anthropic-version headers (not Bearer),
    requires max_tokens, and treats the system prompt as a top-level field.
    """
    url = f"{base_url.rstrip('/')}/v1/messages"
    system_text = ""
    chat_messages: list[dict] = []
    for m in messages:
        if m.get("role") == "system":
            system_text += (m.get("content") or "") + "\n"
        else:
            chat_messages.append(m)

    body: dict[str, Any] = {
        "model": model,
        "messages": chat_messages,
        "max_tokens": max_tokens,
        "tools": [REVIEW_TOOL],
        "tool_choice": {"type": "tool", "name": "submit_review"},
    }
    if system_text.strip():
        body["system"] = system_text.strip()

    headers = {
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
    }

    last_err: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            with httpx.Client(timeout=timeout) as client:
                r = client.post(url, headers=headers, json=body)
                # 5xx and 429 are retryable
                if r.status_code >= 500 or r.status_code == 429:
                    raise httpx.HTTPStatusError(
                        f"{r.status_code}: {r.text[:200]}", request=r.request, response=r
                    )
                r.raise_for_status()
                return parse_anthropic_response(r.json())
        except Exception as e:  # broad: network, timeout, http
            last_err = e
            if attempt < max_retries:
                time.sleep(2 ** attempt)
            else:
                raise
    raise last_err  # unreachable, but mypy-friendly


# providers are registered by name → caller function
def _call_minimax(messages: list[dict]) -> str:
    api_key = get_env("MINIMAX_API_KEY", required=True)
    return call_anthropic_compat(
        base_url=get_env("MINIMAX_BASE_URL", default="https://api.minimaxi.com/anthropic"),
        api_key=api_key,
        model=get_env("MINIMAX_MODEL", default="MiniMax-M3"),
        messages=messages,
    )


def _call_deepseek(messages: list[dict]) -> str:
    api_key = get_env("DEEPSEEK_API_KEY", required=True)
    return call_anthropic_compat(
        base_url=get_env("DEEPSEEK_BASE_URL", default="https://api.deepseek.com/anthropic"),
        api_key=api_key,
        model=get_env("DEEPSEEK_MODEL", default="deepseek-v4-pro"),
        messages=messages,
    )


CALLERS: dict[str, Callable[[list[dict]], str]] = {
    "minimax": _call_minimax,
    "deepseek": _call_deepseek,
}


def call_with_fallback(messages: list[dict], primary: str) -> tuple[str, str]:
    """Returns (response_text, provider_used). Falls back to the other provider on failure."""
    order = [primary] + [p for p in ("minimax", "deepseek") if p != primary]
    last_err: Optional[Exception] = None
    for provider in order:
        api_key_env = "MINIMAX_API_KEY" if provider == "minimax" else "DEEPSEEK_API_KEY"
        if not get_env(api_key_env):
            print(f"::warning::{api_key_env} not set, skipping {provider}", file=sys.stderr)
            last_err = RuntimeError(f"{api_key_env} not set")
            continue
        try:
            return CALLERS[provider](messages), provider
        except Exception as e:
            print(f"::warning::provider {provider} failed: {e}", file=sys.stderr)
            last_err = e
            continue
    raise RuntimeError(f"all providers failed; last error: {last_err}")


# ---------- parse review ----------

def parse_review(text: str) -> dict:
    """Strictly parse the LLM JSON response. Tries direct, then first {...} block."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    raise ValueError(f"could not parse JSON from LLM response (first 200 chars): {text[:200]}")


def normalize_review(data: dict) -> dict:
    summary = (data.get("summary") or "").strip()
    verdict = data.get("verdict", "comment")
    if verdict not in {"approve", "request_changes", "comment"}:
        verdict = "comment"
    comments: list[dict] = []
    for c in (data.get("comments") or [])[:MAX_INLINE_COMMENTS]:
        path = c.get("path") or c.get("file")
        line = c.get("line")
        body = (c.get("body") or "").strip()
        severity = c.get("severity", "warning")
        if severity not in {"nit", "warning", "blocker"}:
            severity = "warning"
        if not path or not isinstance(line, int) or not body:
            continue
        comments.append({"path": path, "line": line, "body": body, "severity": severity})
    return {"summary": summary, "verdict": verdict, "comments": comments}


# ---------- post comments ----------

def post_summary_comment(
    repo: str, pr_number: int, token: str, *,
    summary: str, verdict: str, provider: str, model: str,
    ok: bool, error: str = "",
) -> None:
    icon = {"approve": "✅", "request_changes": "🛑", "comment": "💬"}.get(verdict, "💬")
    body_lines = [SUMMARY_MARKER, f"## {icon} AI PR Review ({provider}/{model})", ""]
    if ok:
        body_lines.append(summary or "(no summary)")
    else:
        body_lines.append(f"⚠️ **AI review unavailable**: {error or 'unknown error'}")
    body_lines.extend([
        "",
        f"<sub>verdict: `{verdict}` · provider: `{provider}` · model: `{model}`</sub>",
    ])
    gh_post(
        f"/repos/{repo}/issues/{pr_number}/comments",
        token,
        {"body": "\n".join(body_lines)},
    )


def post_inline_comments(
    repo: str, pr_number: int, token: str, commit_id: str,
    comments: list[dict], patches: dict[str, FilePatch],
) -> list[dict]:
    posted: list[dict] = []
    for c in comments:
        fp = patches.get(c["path"])
        if not fp or c["line"] not in fp.new_lines:
            print(
                f"::warning::skip inline comment for {c['path']}:{c['line']} "
                f"(not in diff's new side)",
                file=sys.stderr,
            )
            continue
        severity_icon = {"nit": "🔵", "warning": "🟡", "blocker": "🔴"}.get(c["severity"], "🟡")
        body = f"{severity_icon} **[{c['severity']}]** {c['body']}\n\n<sub>via AI PR Reviewer</sub>"
        try:
            gh_post(
                f"/repos/{repo}/pulls/{pr_number}/comments",
                token,
                {
                    "commit_id": commit_id,
                    "path": c["path"],
                    "line": c["line"],
                    "side": "RIGHT",
                    "body": body,
                },
            )
            posted.append(c)
        except httpx.HTTPStatusError as e:
            print(
                f"::warning::inline comment failed for {c['path']}:{c['line']}: {e}",
                file=sys.stderr,
            )
    return posted


# ---------- main ----------

def main() -> int:
    token = get_env("GITHUB_TOKEN", required=True)
    repo = get_env("REPOSITORY", required=True)
    pr_number_str = get_env("PR_NUMBER", required=True)
    try:
        pr_number = int(pr_number_str)
    except ValueError:
        print(f"::error::PR_NUMBER must be int, got {pr_number_str!r}", file=sys.stderr)
        return 2

    primary = get_env("PRIMARY_PROVIDER", default="minimax")
    if primary not in CALLERS:
        print(
            f"::error::PRIMARY_PROVIDER must be one of {list(CALLERS)}, got {primary!r}",
            file=sys.stderr,
        )
        return 2

    # check that at least one provider is configured
    if not get_env("MINIMAX_API_KEY") and not get_env("DEEPSEEK_API_KEY"):
        post_summary_comment(
            repo, pr_number, token,
            summary="", verdict="comment", provider=primary, model="-",
            ok=False, error="neither MINIMAX_API_KEY nor DEEPSEEK_API_KEY is set",
        )
        return 1

    # check skip keyword
    try:
        pr = fetch_pr(repo, pr_number, token)
    except httpx.HTTPStatusError as e:
        print(f"::error::fetch_pr failed: {e}", file=sys.stderr)
        return 2
    body = pr.get("body") or ""
    # Skip only when /ai-skip appears on its own line — substring match would
    # false-positive on documentation that mentions the keyword.
    if any(line.strip().lower() == "/ai-skip" for line in body.splitlines()):
        post_summary_comment(
            repo, pr_number, token,
            summary="", verdict="comment", provider=primary, model="-",
            ok=False, error="skipped via /ai-skip in PR body",
        )
        return 0

    diff = fetch_pr_diff(repo, pr_number, token)
    files = fetch_pr_files(repo, pr_number, token)
    patches = parse_file_patches(diff)

    system_prompt = PROMPT_FILE.read_text(encoding="utf-8")
    messages = build_messages(pr, diff, files, system_prompt)

    # call LLM with fallback
    try:
        text, used_provider = call_with_fallback(messages, primary)
    except Exception as e:
        post_summary_comment(
            repo, pr_number, token,
            summary="", verdict="comment", provider=primary, model="-",
            ok=False, error=str(e),
        )
        return 1

    used_model = (
        get_env("MINIMAX_MODEL", default="MiniMax-M3")
        if used_provider == "minimax"
        else get_env("DEEPSEEK_MODEL", default="deepseek-v4-pro")
    )

    # parse
    try:
        review = normalize_review(parse_review(text))
    except Exception as e:
        post_summary_comment(
            repo, pr_number, token,
            summary=text[:1000], verdict="comment",
            provider=used_provider, model=used_model,
            ok=False, error=f"parse failure: {e}",
        )
        return 1

    # post
    post_summary_comment(
        repo, pr_number, token,
        summary=review["summary"], verdict=review["verdict"],
        provider=used_provider, model=used_model, ok=True,
    )
    commit_id = pr["head"]["sha"]
    posted = post_inline_comments(
        repo, pr_number, token, commit_id, review["comments"], patches,
    )
    print(
        f"::notice::posted summary + {len(posted)}/{len(review['comments'])} "
        f"inline comments via {used_provider}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
