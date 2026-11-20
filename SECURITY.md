# Security Policy

## Reporting a vulnerability

If you find a security problem in the Rekogni plugin or the Rekogni connector, **do not open a public issue or pull
request**. Report it privately:

1. On this repository's **Security** tab, choose **Report a vulnerability** (GitHub private vulnerability reporting).
2. Or email **security@rekogni.ai** with a description, steps to reproduce and any logs or screenshots (remove
   secrets first).

We acknowledge reports within **48 hours** and aim to fix or mitigate within **7 days**, depending on severity.

## Disclosure

- Please give us reasonable time to fix the problem before disclosing it publicly.
- We credit reporters in the release notes, unless you prefer to stay anonymous.

## Scope

- This repository: the Rekogni plugin for Claude Code and Codex, the `rekogni` skill and the install docs.
- The Rekogni connector at `https://app.rekogni.ai/api/mcp` and its sign-in, reported through the same channels.

**Only install the plugin from `Rekogni-AI/rekogni-agents`.** A copy that connects anywhere other than
`app.rekogni.ai` is not ours; please report it.

## Out of scope

- Vulnerabilities in Claude Code, Codex or other agents: report them to their makers.
- Problems that need already-stolen credentials or physical access to a device.

## Secrets

This repository holds no secrets: only the connector's address, the skill and docs. Each user signs in with their own
Rekogni account, and their agent keeps that sign-in on their machine.
