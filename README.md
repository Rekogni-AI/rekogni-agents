# Rekogni for AI agents

Ask your AI agent about your engineering work: how many pull requests you merged this week, what is waiting on your
review, your team's standup, your 1:1 prep. Answers come from [Rekogni](https://rekogni.ai), from your own account.

There are two separate ways to connect. Use either one, or both:

| | [The connector (MCP)](#the-connector-mcp) | [The CLI](#the-cli) |
| --- | --- | --- |
| What it is | Rekogni's tools, added to each agent | A `rekogni` command, installed once on your machine |
| Works in | Claude Code, Codex, claude.ai, ChatGPT, Cursor, VS Code, Gemini CLI, Windsurf… | Any agent that can run terminal commands, and your own terminal |
| Sign in | Once in each agent | Once per machine |
| Can | Read dashboards and agent results, and start agent runs | Read dashboards and agent results |
| Remove | [Remove the connector](#remove-the-connector) | [Remove the CLI](#remove-the-cli) |

Both talk to the same hosted Rekogni server, `https://app.rekogni.ai/api/mcp`, and you sign in with your Rekogni
account in your browser; there are no keys to copy.

**The `rekogni` skill** works with either: it tells the agent which tool or command answers which question. Only its
one-line description sits in the agent's context until you ask a Rekogni question. The Claude Code and Codex plugins
include it; for other agents see [The skill](#the-skill).

## The connector (MCP)

The connector is an [MCP](https://modelcontextprotocol.io) server: you add it to each agent you use, and sign in once
in that agent.

### Pick your agent

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

### Claude Code

```text
/plugin marketplace add Rekogni-AI/rekogni-agents
/plugin install rekogni@rekogni
```

**Then sign in once:** run `/mcp`, pick **plugin:rekogni:rekogni** and **Authenticate**. Your browser opens Rekogni:
sign in and click **Allow**. Until you do, Rekogni has no tools in Claude Code, and the skill reminds you how to sign
in.

- Update: `/plugin marketplace update rekogni`, then `/plugin uninstall rekogni@rekogni` and install again.
- Remove: see [Remove the connector](#remove-the-connector).
- Connector only, without the skill: `claude mcp add --transport http rekogni https://app.rekogni.ai/api/mcp`.

### Codex

```bash
codex plugin marketplace add Rekogni-AI/rekogni-agents
codex plugin add rekogni@rekogni
```

Codex asks you to sign in when the plugin installs: sign in and click **Allow** when your browser opens. To sign in
later or again: `codex mcp login rekogni`.

- Update: `codex plugin marketplace upgrade rekogni`, then `codex plugin add rekogni@rekogni`.
- Remove: see [Remove the connector](#remove-the-connector).
- Connector only: `codex mcp add rekogni --url https://app.rekogni.ai/api/mcp`.

### claude.ai, Claude Desktop and mobile

Settings → **Connectors** → **Add custom connector** → URL `https://app.rekogni.ai/api/mcp` → **Connect**, sign in,
**Allow**. The connector then works in Claude on the web, desktop and mobile.

### ChatGPT

Settings → **Apps & Connectors** → **Advanced** → turn on **Developer mode** → **Create**. Enter the URL
`https://app.rekogni.ai/api/mcp`, choose OAuth, then sign in and click **Allow**.

### Cursor

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

### VS Code (GitHub Copilot)

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

### Gemini CLI

```bash
gemini mcp add --transport http rekogni https://app.rekogni.ai/api/mcp
```

Then run `/mcp auth rekogni` in Gemini CLI to sign in.

### Windsurf

Add Rekogni to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "rekogni": { "serverUrl": "https://app.rekogni.ai/api/mcp" }
  }
}
```

Refresh the MCP list in Cascade and sign in when asked.

### Any other agent

Most agents that support remote MCP servers with sign-in can add Rekogni with:

```bash
npx add-mcp https://app.rekogni.ai/api/mcp
```

Or add the URL `https://app.rekogni.ai/api/mcp` in your agent's MCP settings as a remote (HTTP) server.

### Remove the connector

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

### Connector troubleshooting

- **"needs authentication"**: sign in from your agent (`/mcp` in Claude Code, `codex mcp login rekogni` in Codex).
- **Two sets of Rekogni tools**: you added the connector twice (for example the plugin and a claude.ai connector).
  Turn one off.

## The CLI

The CLI is a separate npm package, `@rekogni/cli`. It needs nothing from the connector: install it, sign in once on
your machine, and use it yourself or let any agent that can run commands use it. It needs Node.js 20 or later.

### Install and sign in

Run it without installing (npx downloads it the first time):

```bash
npx @rekogni/cli auth login
```

Or install it once, to type `rekogni` instead of `npx @rekogni/cli`:

```bash
npm install -g @rekogni/cli
rekogni auth login
```

Your browser opens Rekogni: sign in and click **Allow**. The terminal then says who you are signed in as. Your
sign-in is kept in your system keychain and renews itself as you use it.

### Use it

```bash
rekogni dashboard                                  # your numbers, the last 7 days
rekogni dashboard --metrics inbox                  # what is waiting on you
rekogni dashboard --workspace "Engineering Team"   # a team's numbers
rekogni agent dailySummary                         # your latest daily summary
rekogni auth status                                # who is signed in
```

(With npx, write `npx @rekogni/cli` where these say `rekogni`.) All commands and options: `rekogni --help` and
[cli/README.md](cli/README.md). The CLI reads; start agent runs from the web app or the connector.

**With an agent:** ask it to use the Rekogni CLI ("Using the rekogni CLI, how many PRs did I merge this week?"), or add
[the skill](#the-skill) so it knows to on its own.

### Remove the CLI

1. Sign out, which removes your sign-in from the keychain:

   ```bash
   rekogni auth logout          # or: npx @rekogni/cli auth logout
   ```

2. If you installed it with `npm install -g`, uninstall it:

   ```bash
   npm uninstall -g @rekogni/cli
   ```

   If you only used npx, there is nothing installed to remove.

### CLI troubleshooting

- **"Not signed in" or "sign-in has expired"**: run `rekogni auth login` (or `npx @rekogni/cli auth login`).
- **"System keychain unavailable"**: the machine has no keychain (a server or container), so the sign-in is kept in
  `~/.config/rekogni/credentials.json`, readable only by you. `rekogni auth logout` removes it.
- **`command not found: rekogni`**: it isn't installed globally; use `npx @rekogni/cli` or `npm install -g
  @rekogni/cli`.

## The skill

The skill is a plain [Agent Skills](https://agentskills.io) file, `plugins/rekogni/skills/rekogni/SKILL.md`. The Claude
Code and Codex plugins include it. To add it to another agent:

```bash
npx skills add Rekogni-AI/rekogni-agents
```

Or copy the `plugins/rekogni/skills/rekogni` folder into your agent's skills folder (for example `.agents/skills/`
or `.claude/skills/`). It uses the connector if it is added under the name `rekogni`, and the CLI otherwise. To remove
it, delete that `rekogni` folder.

## Try it

- "How many PRs did I merge this week, and which ones?"
- "What's waiting on my review?"
- "Show Engineering Team's standup from today."
- "Prep my 1:1 for this week."
- "What's our PR cycle time this month compared to last month?"
- "Rerun my weekly summary for last week." (Connector only. Runs ask for your approval and are rate limited.)

## Troubleshooting for both

- **No access, or "You aren't a member of …"**: finish setting up Rekogni at [app.rekogni.ai](https://app.rekogni.ai),
  or ask your workspace admin to add you.
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

Copyright © Rekogni. All rights reserved. You may install and use this plugin and CLI with your Rekogni account; no
other license is granted.
