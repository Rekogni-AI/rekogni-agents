# Rekogni for AI coding agents

Ask your coding agent about your engineering work: how many pull requests you merged this week, what is waiting on
your review, your team's standup, your 1:1 prep. Answers come from [Rekogni](https://rekogni.ai), from your own
account.

This repository is the Rekogni plugin for **Claude Code** and **Codex**. It adds two things:

- **The Rekogni connector** (our hosted MCP server). You sign in once with your Rekogni account.
- **A short `rekogni` skill** that tells the agent which Rekogni tool answers what. Only its one-line description sits
  in the agent's context; the rest loads when you ask a Rekogni question.

## Install

### Claude Code

```text
/plugin marketplace add Rekogni-AI/rekogni-agents
/plugin install rekogni@rekogni
```

On Claude Code 2.1.275 or later this is one step: `/plugin install rekogni --marketplace Rekogni-AI/rekogni-agents`.

Then ask a Rekogni question (or run `/mcp`, pick **rekogni**, **Authenticate**). Your browser opens Rekogni: sign in
and click **Allow**.

### Codex

```bash
codex plugin marketplace add Rekogni-AI/rekogni-agents
codex plugin add rekogni@rekogni
```

Start Codex and ask a Rekogni question; sign in and click **Allow** when your browser opens. To sign in again later:
`codex mcp login rekogni`.

### Without the plugin

The connector alone, in one command (no skill):

```bash
claude mcp add --transport http rekogni https://app.rekogni.ai/api/mcp     # Claude Code, then /mcp to sign in
codex mcp add rekogni --url https://app.rekogni.ai/api/mcp                  # Codex, then: codex mcp login rekogni
npx add-mcp https://app.rekogni.ai/api/mcp                                  # Cursor, VS Code and others
```

## Try it

- "How many PRs did I merge this week, and which ones?"
- "What's waiting on my review?"
- "Show Engineering Team's standup from today."
- "Prep my 1:1 for this week."
- "What's our PR cycle time this month compared to last month?"
- "Rerun my weekly summary for last week." (Runs ask for your approval and are rate limited.)

## Privacy and access

- Nothing secret lives in this repository: it holds the connector's address, the skill and these docs.
- Each person signs in with their own Rekogni account. Your agent keeps your sign-in on your machine; it never goes
  into a file here.
- Rekogni answers only with your own data and that of the workspaces you belong to, exactly as the web app does.
- Reading results is free; starting an agent run asks for your approval and is limited per person.

## What's here

| Path | For |
| --- | --- |
| `plugins/rekogni/skills/rekogni/SKILL.md` | The skill both agents load |
| `plugins/rekogni/.claude-plugin/plugin.json`, `plugins/rekogni/.mcp.json` | Claude Code plugin |
| `plugins/rekogni/plugin.json`, `plugins/rekogni/mcp.json` | Codex plugin (portable agent-plugins format) |
| `.claude-plugin/marketplace.json` | Claude Code marketplace |
| `.agents/plugins/marketplace.json` | Codex marketplace |
