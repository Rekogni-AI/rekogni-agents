# Rekogni for AI agents

Ask your AI agent about your engineering work: how many pull requests you merged this week, what is waiting on your
review, your team's standup, your 1:1 prep. Answers come from [Rekogni](https://rekogni.ai), from your own account.

Everything here connects to one hosted server, `https://app.rekogni.ai/api/mcp` (the Rekogni connector, an
[MCP](https://modelcontextprotocol.io) server). You sign in once with your Rekogni account; there are no keys to copy.

There are three parts, and each agent takes one or more:

- **The connector** gives the agent Rekogni's tools: dashboards, agent results, and runs.
- **The `rekogni` skill** tells the agent which tool answers which question. Only its one-line description sits in the
  agent's context until you ask a Rekogni question.
- **The `rekogni` CLI** reads the same dashboards and agent results from the terminal. Sign in once per machine, and
  every agent that can run a command can use it, with no connector to add to each.

## Pick your agent

| Agent | Install | Gets |
| --- | --- | --- |
| [Claude Code](#claude-code) | Plugin, two commands | Connector and skill |
| [Codex](#codex) | Plugin, two commands | Connector and skill |
| [claude.ai, Claude Desktop, Claude mobile](#claudeai-claude-desktop-and-mobile) | Settings → Connectors | Connector |
| [ChatGPT](#chatgpt) | Settings → Apps & Connectors | Connector |
| [Cursor](#cursor) | `mcp.json` | Connector (add the skill separately) |
| [VS Code (GitHub Copilot)](#vs-code-github-copilot) | One command | Connector (add the skill separately) |
| [Gemini CLI](#gemini-cli) | One command | Connector (add the skill separately) |
| [Windsurf](#windsurf) | `mcp_config.json` | Connector |
| [Any other MCP client](#any-other-agent) | `npx add-mcp` | Connector |
| [Any agent with a terminal, or you](#the-cli) | `npx @rekogni/cli auth login` | CLI (add the skill for when to use it) |

## Claude Code

```text
/plugin marketplace add Rekogni-AI/rekogni-agents
/plugin install rekogni@rekogni
```

**Then sign in once:** run `/mcp`, pick **plugin:rekogni:rekogni** and **Authenticate**. Your browser opens Rekogni:
sign in and click **Allow**. Until you do, Rekogni has no tools in Claude Code, and the skill reminds you how to sign
in.

- Update: `/plugin marketplace update rekogni`, then `/plugin uninstall rekogni@rekogni` and install again.
- Remove: see [Uninstall](#uninstall).
- Connector only, without the skill: `claude mcp add --transport http rekogni https://app.rekogni.ai/api/mcp`.

## Codex

```bash
codex plugin marketplace add Rekogni-AI/rekogni-agents
codex plugin add rekogni@rekogni
```

Codex asks you to sign in when the plugin installs: sign in and click **Allow** when your browser opens. To sign in
later or again: `codex mcp login rekogni`.

- Update: `codex plugin marketplace upgrade rekogni`, then `codex plugin add rekogni@rekogni`.
- Remove: see [Uninstall](#uninstall).
- Connector only: `codex mcp add rekogni --url https://app.rekogni.ai/api/mcp`.

## claude.ai, Claude Desktop and mobile

Settings → **Connectors** → **Add custom connector** → URL `https://app.rekogni.ai/api/mcp` → **Connect**, sign in,
**Allow**. The connector then works in Claude on the web, desktop and mobile.

## ChatGPT

Settings → **Apps & Connectors** → **Advanced** → turn on **Developer mode** → **Create**. Enter the URL
`https://app.rekogni.ai/api/mcp`, choose OAuth, then sign in and click **Allow**.

## Cursor

Add Rekogni to `~/.cursor/mcp.json` (every project) or `.cursor/mcp.json` (one project):

```json
{
  "mcpServers": {
    "rekogni": { "url": "https://app.rekogni.ai/api/mcp" }
  }
}
```

Open **Settings → MCP**, click **Connect** next to rekogni, sign in and click **Allow**. This works in the Cursor app, older
versions included, and in Cursor on the web.

## VS Code (GitHub Copilot)

```bash
code --add-mcp '{"name":"rekogni","type":"http","url":"https://app.rekogni.ai/api/mcp"}'
```

Or add it to `.vscode/mcp.json` in a project:

```json
{
  "servers": {
    "rekogni": { "type": "http", "url": "https://app.rekogni.ai/api/mcp" }
  }
}
```

Start the server from the MCP view and sign in when VS Code asks (VS Code desktop).

## Gemini CLI

```bash
gemini mcp add --transport http rekogni https://app.rekogni.ai/api/mcp
```

Then run `/mcp auth rekogni` in Gemini CLI to sign in.

## Windsurf

Add Rekogni to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "rekogni": { "serverUrl": "https://app.rekogni.ai/api/mcp" }
  }
}
```

Refresh the MCP list in Cascade and sign in when asked.

## Any other agent

Most agents that support remote MCP servers with sign-in can add Rekogni with:

```bash
npx add-mcp https://app.rekogni.ai/api/mcp
```

Or add the URL `https://app.rekogni.ai/api/mcp` in your agent's MCP settings as a remote (HTTP) server.

## The CLI

```bash
npx @rekogni/cli auth login                 # once per machine: sign in through your browser
npx @rekogni/cli dashboard --metrics inbox  # what is waiting on you
npx @rekogni/cli agent dailySummary         # your latest daily summary
```

It reads; runs start from the web app or the connector. All commands, and where your sign-in is kept:
[cli/README.md](cli/README.md).

## The skill in other agents

The skill is a plain [Agent Skills](https://agentskills.io) file, `plugins/rekogni/skills/rekogni/SKILL.md`, so agents
that read skills can use it next to the connector:

```bash
npx skills add Rekogni-AI/rekogni-agents
```

Or copy the `plugins/rekogni/skills/rekogni` folder into your agent's skills folder (for example `.agents/skills/`
or `.claude/skills/`). The skill only needs the connector to be added under the name `rekogni`.

## Try it

- "How many PRs did I merge this week, and which ones?"
- "What's waiting on my review?"
- "Show Engineering Team's standup from today."
- "Prep my 1:1 for this week."
- "What's our PR cycle time this month compared to last month?"
- "Rerun my weekly summary for last week." (Runs ask for your approval and are rate limited.)

## Uninstall

Sign out first, so your Rekogni sign-in doesn't stay on your machine, then remove the plugin and its marketplace.

**Claude Code**: in `/mcp`, pick **plugin:rekogni:rekogni** and **Clear authentication**, then:

```text
/plugin uninstall rekogni@rekogni
/plugin marketplace remove rekogni
```

Added the connector alone instead? `claude mcp remove rekogni`.

**Codex**:

```bash
codex mcp logout rekogni
codex plugin remove rekogni@rekogni
codex plugin marketplace remove rekogni
```

Added the connector alone instead? `codex mcp remove rekogni`.

**Other agents**:

| Agent | Remove |
| --- | --- |
| claude.ai, Claude Desktop, mobile | Settings → **Connectors** → Rekogni → **Remove** |
| ChatGPT | Settings → **Apps & Connectors** → Rekogni → **Delete** |
| Cursor | Delete the `rekogni` entry from `~/.cursor/mcp.json` or `.cursor/mcp.json` |
| VS Code | Delete the `rekogni` entry from `.vscode/mcp.json`, or uninstall it from the MCP view |
| Gemini CLI | `gemini mcp remove rekogni` |
| Windsurf | Delete the `rekogni` entry from `~/.codeium/windsurf/mcp_config.json` |
| The skill, added by hand | Delete the `rekogni` folder from your agent's skills folder |
| The CLI | `npx @rekogni/cli auth logout`, then `npm uninstall -g @rekogni/cli` if you installed it |

## Troubleshooting

- **"needs authentication"**: sign in from your agent (`/mcp` in Claude Code, `codex mcp login rekogni` in Codex).
- **CLI: "Not signed in" or "sign-in has expired"**: run `npx @rekogni/cli auth login`.
- **No access, or "You aren't a member of …"**: finish setting up Rekogni at [app.rekogni.ai](https://app.rekogni.ai),
  or ask your workspace admin to add you.
- **Two sets of Rekogni tools**: you added the connector twice (for example the plugin and a claude.ai connector).
  Turn one off.
- **Numbers are all 0**: check that your workspace's repositories and issue trackers are connected in the Rekogni web
  app, under Workspace → Integrations.

## Privacy and access

- Nothing secret lives in this repository: it holds the connector's address, the skill, the CLI and these docs.
- Each person signs in with their own Rekogni account. Your agent, or the CLI (in your system keychain), keeps your
  sign-in on your machine; it never goes into a file here.
- Rekogni answers only with your own data and that of the workspaces you belong to, exactly as the web app does.
- Reading results is free. Starting an agent run asks for your approval and is limited per person.

## What's here

| Path | For |
| --- | --- |
| `plugins/rekogni/skills/rekogni/SKILL.md` | The skill |
| `plugins/rekogni/.claude-plugin/plugin.json`, `plugins/rekogni/.mcp.json` | Claude Code plugin |
| `plugins/rekogni/plugin.json`, `plugins/rekogni/mcp.json` | Codex plugin (portable agent-plugins format) |
| `.claude-plugin/marketplace.json` | Claude Code marketplace |
| `.agents/plugins/marketplace.json` | Codex marketplace |
| `cli/` | The `@rekogni/cli` package |
| `SECURITY.md`, `.github/CODEOWNERS` | How to report a security problem; who reviews changes |

## Security and license

Found a security problem? Please report it privately: see [SECURITY.md](SECURITY.md).

Copyright © Rekogni. All rights reserved. You may install and use this plugin with your Rekogni account; no other
license is granted.
