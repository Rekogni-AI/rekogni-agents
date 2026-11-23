# Rekogni CLI

Rekogni from the terminal. Sign in once on your machine; then you, and any coding agent that can run a command
(Claude Code, Codex, Cursor, Gemini CLI…), can read your Rekogni dashboards and agent results. There is no connector
to add to each agent and no tool list loaded into its context.

It is separate from the Rekogni connector (MCP) and needs nothing from it; both talk to the same hosted server,
`https://app.rekogni.ai/api/mcp`, with the same Rekogni sign-in.

## Install and sign in

```bash
npm install -g @rekogni/cli
rekogni auth login
```

Your browser opens Rekogni: sign in and click **Allow**. The terminal then says who you are signed in as. It needs
Node.js 20 or later.

**Or run it without installing**, with npx (it downloads the CLI the first time). There is then no `rekogni` command:
start each command with `npx @rekogni/cli` instead.

```bash
npx @rekogni/cli auth login
npx @rekogni/cli --help
npx @rekogni/cli dashboard
```

## Commands

```bash
rekogni dashboard                                   # your numbers, the last 7 days
rekogni dashboard --from 2026-11-09 --to 2026-11-15
rekogni dashboard --metrics inbox                   # what is waiting on you
rekogni dashboard --metrics pr_merged,pr_open       # the pull requests behind those numbers
rekogni dashboard --workspace "Engineering Team"    # a team's numbers

rekogni agent                                       # list your agents
rekogni agent dailySummary                          # its latest results
rekogni agent weeklySummary --from 2026-11-09 --to 2026-11-15
rekogni agent dailyStandupSummary --workspace "Engineering Team"

rekogni auth status                                 # who is signed in
rekogni auth logout                                 # remove the sign-in from this machine
```

The output is the same text the Rekogni connector gives Claude or ChatGPT, so an agent reads it the same way. A
command that fails prints why and exits with 1.

Reading is all the CLI does for now; start agent runs from the web app or the connector.

## Where your sign-in is kept

In your system keychain: macOS Keychain, Windows Credential Manager, or the Secret Service on Linux. Where there is no
keychain (a server or container without one), the CLI says so and keeps it in `~/.config/rekogni/credentials.json`,
readable only by you. `rekogni auth logout` removes it from either place.

The sign-in renews itself as you use it. If it can't, the CLI says to run `rekogni auth login` again; it never opens a
browser on its own.

## Remove

1. Sign out, which removes your sign-in from the keychain (or the file): `rekogni auth logout`, or
   `npx @rekogni/cli auth logout`.
2. If you installed it with `npm install -g`, uninstall it: `npm uninstall -g @rekogni/cli`. If you only used npx,
   there is nothing installed to remove.

## Develop

For Rekogni developers; users don't need any of this.

```bash
cd cli
npm install
npm test            # signs in, refreshes and calls tools against a local stand-in for Rekogni
node bin/rekogni.js --help
```

To try the CLI against a Rekogni running on your machine instead of app.rekogni.ai, set `REKOGNI_URL`:
`REKOGNI_URL=http://localhost:3000 node bin/rekogni.js dashboard`. It keeps a separate sign-in for each URL, and
plain `http://` is accepted only for localhost.
