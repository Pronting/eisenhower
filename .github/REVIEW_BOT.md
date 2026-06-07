# AI PR Reviewer

Open a pull request → a bot reviews it automatically and posts comments back to the PR. Primary model is **MiniMax** with **DeepSeek** as automatic fallback.

## What it does

1. Triggers on `pull_request` events: `opened`, `synchronize`, `reopened`.
2. Pulls the diff and changed-files list from the GitHub API.
3. Sends them to MiniMax (or DeepSeek if MiniMax is down) with a strict JSON schema prompt.
4. Posts a summary comment on the PR.
5. Posts up to 20 inline review comments pointing at the exact diff line.

It does **not** block merging — there is no required check. The reviewer is informational.

## Required secrets

| Name | Required | Purpose |
|---|---|---|
| `MINIMAX_API_KEY` | Recommended | Primary provider. |
| `DEEPSEEK_API_KEY` | Recommended | Fallback provider. You need at least one. |

Add them under **Settings → Secrets and variables → Actions → New repository secret** (or at the org level for shared usage).

## Optional variables

Configure under **Settings → Secrets and variables → Actions → Variables** (not secrets — variables are not encrypted but are fine for non-sensitive config like URLs and model names).

| Name | Default | Notes |
|---|---|---|
| `MINIMAX_BASE_URL` | `https://api.minimaxi.com/anthropic` | Anthropic protocol endpoint. Override if your account uses a different region. |
| `MINIMAX_MODEL` | `MiniMax-M3` | Override if you want a different MiniMax model. |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/anthropic` | Anthropic protocol endpoint. |
| `DEEPSEEK_MODEL` | `deepseek-v4-pro` | Use `deepseek-reasoner` for stronger reasoning. |

## How to skip a PR

Add a line that is exactly `/ai-skip` (alone on its own line) anywhere in the PR description body. The bot will post a "skipped" comment and exit cleanly. Inline mentions like `` `/ai-skip` `` in prose are ignored.

## How to re-trigger manually

`Actions → AI PR Review (MiniMax + DeepSeek) → Run workflow → enter PR number → Run`.

Useful after you've addressed prior feedback and want a fresh pass.

## Local testing

```bash
cd .github/scripts
pip install -r requirements.txt
python -m unittest discover -s tests -v
```

The tests cover the diff parser and the LLM-response normalizer (pure functions, no network). The workflow file also runs these on every PR.

## Tuning the prompt

Edit `.github/scripts/prompts/review_system.md` and update the schema or rules. The prompt is sent as the `system` message; keep it terse.

## Exit codes

| Code | Meaning | Action |
|---|---|---|
| 0 | Success | Summary + inline comments posted. |
| 1 | Expected failure | One summary comment posted explaining the error. |
| 2 | Config / unexpected | Nothing posted; check the Actions log. |
