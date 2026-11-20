---
name: rekogni
description: Use when the user asks about their own or their team's engineering work in Rekogni - pull requests merged or open, issues, cycle time, what is waiting on them, daily or weekly summaries, standups, 1:1 prep, performance or sprint notes - or asks to run, rerun or refresh a Rekogni agent.
---

# Rekogni

Rekogni reads a team's pull requests, commits, issues and goals. Its dashboards count that work, and its agents write
regular summaries from it. The `rekogni` MCP server answers for the signed-in user only: their own data and the
workspaces (teams) they belong to.

## Pick the tool

| The user wants | Tool |
| --- | --- |
| Numbers: PRs merged / open / aged, issues closed / in progress, cycle time | `get_individual_dashboard` (their own) or `get_workspace_dashboard` (a team) |
| The items behind a number ("which PRs merged?", "what's still open?") | the same dashboard tool with `metrics`, every list needed in one call |
| What is waiting on them ("my inbox", "what needs my review") | `get_individual_dashboard` with `metrics: ["inbox"]` |
| A written result: daily or weekly summary, coaching, 1:1 prep, performance, goals | `get_individual_agent` |
| A team's standup, sprint retrospective or planning, team summary, changelog | `get_workspace_agent` |
| A fresh run of an agent | `run_individual_agent` / `run_workspace_agent`, only when asked (below) |

The `agentType` values and what each agent covers are listed in each tool's description; match the request to one, and
if two could fit, ask which.

## Rules

- **Dates.** Turn "last week", "in October", "yesterday" into `from` / `to` (YYYY-MM-DD) from today's date. With no
  time frame, leave both out: dashboards default to the last 7 days, agents return their latest result.
- **Workspace.** Pass the workspace the user named. If they named none, call without it: with one workspace that one
  is used; otherwise the tool lists theirs, so ask which.
- **Read before you run.** `get_*` tools are free and instant. A run costs a model call and is rate limited, so use a
  `run_*` tool only when the user asks to run, rerun or refresh, or says yes when you offer. Confirm the agent,
  workspace and period first. A daily agent takes one day; weekly Monday to Sunday; monthly the whole month.
- **Report faithfully.** Say which agent or dashboard, workspace and dates an answer comes from, and keep names,
  numbers and links as written. A number shown as "unavailable" couldn't be loaded: never report it as zero. If an
  agent has no result for a period, say so and offer a run; don't write your own summary instead.

## Without the connector: the CLI

If there are no `rekogni` tools but you can run commands, use the Rekogni CLI. It answers with the same text:

| Tool | Command |
| --- | --- |
| `get_individual_dashboard` / `get_workspace_dashboard` | `npx -y @rekogni/cli dashboard [--workspace NAME] [--from D] [--to D] [--metrics a,b]` |
| `get_individual_agent` / `get_workspace_agent` | `npx -y @rekogni/cli agent TYPE [--workspace NAME] [--from D] [--to D]` (no `TYPE`: lists them) |

The same rules apply. The CLI does not start runs: offer the web app or the connector for that. If it says "Not signed
in" or "sign-in has expired", ask the user to run `npx @rekogni/cli auth login` themselves (it opens their browser);
don't run it for them.

## Sign-in and access

- **No `rekogni` tools available** (and no CLI to run) means the user hasn't signed in yet. Don't answer from memory
  or guess. Tell them to sign in once: in Claude Code, run `/mcp`, choose **plugin:rekogni:rekogni** (or **rekogni**), then
  **Authenticate**; in Codex, run `codex mcp login rekogni`. Their browser opens Rekogni: sign in, click **Allow**,
  then ask again.
- A tool that answers "unauthorized" or asks to sign in again: same steps.
- "You aren't a member of …" or "no access": the user can only see their own workspaces; they finish setup or ask an
  admin in the Rekogni web app. Don't retry.
- A run refused for its limit says when runs are available again: tell the user, don't retry.
