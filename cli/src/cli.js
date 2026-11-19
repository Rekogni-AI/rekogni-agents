import { parseArgs } from 'node:util';
import { login, tokenEmail } from './auth.js';
import { VERSION, callTool, withClient } from './client.js';
import { serverUrl } from './config.js';
import { CliError } from './errors.js';
import { createStore } from './store.js';

export const HELP = `Rekogni from the terminal. Sign in once; then you, or any coding agent, can read Rekogni.

Usage:
  rekogni auth login            Sign in through your browser
  rekogni auth status           Show who is signed in
  rekogni auth logout           Remove the sign-in from this machine
  rekogni dashboard [options]   Numbers from your dashboard: PRs, issues, cycle time
  rekogni agent [type] [options]
                                Latest results of a Rekogni agent (no type: list them)

Options:
  --workspace <name>   A workspace's (team's) dashboard or agents instead of your own
  --from <YYYY-MM-DD>  Start of the period
  --to <YYYY-MM-DD>    End of the period
  --metrics <a,b>      dashboard: list the items behind these numbers (e.g. inbox,pr_merged)
  --limit <n>          agent: how many results, newest first (default 3)
  -h, --help           This help
  -v, --version        The CLI version

With no dates, a dashboard covers the last 7 days and an agent shows its latest results.
REKOGNI_URL points the CLI at another Rekogni (default https://app.rekogni.ai).
`;

const OPTIONS = {
  workspace: { type: 'string' },
  from: { type: 'string' },
  to: { type: 'string' },
  metrics: { type: 'string' },
  limit: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
};

// Only the options a tool takes; the server validates their values and says what is wrong.
const defined = (args) => Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined));

// A real calendar day (2026-02-31 is not), checked here so a typo gets a plain message rather than the server's.
function date(option, value) {
  if (value === undefined) return undefined;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`);
  if (!day || Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== value) {
    throw new CliError(`--${option} must be a date like 2026-11-09, not "${value}"`);
  }
  return value;
}

function limit(value) {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n)) throw new CliError(`--limit must be a whole number, not "${value}"`);
  return n;
}

/** The MCP tool and arguments a data command calls: your own, or a workspace's with --workspace. */
export function toolCall(command, positionals, values) {
  const { workspace } = values;
  const from = date('from', values.from);
  const to = date('to', values.to);
  const scope = workspace === undefined ? 'individual' : 'workspace';
  if (command === 'dashboard') {
    if (positionals.length) throw new CliError(`Unexpected argument: ${positionals[0]}`);
    if (values.limit !== undefined) throw new CliError('--limit is for rekogni agent');
    const metrics = values.metrics
      ?.split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    return { name: `get_${scope}_dashboard`, arguments: defined({ workspace, from, to, metrics }) };
  }
  if (command === 'agent') {
    if (positionals.length > 1) throw new CliError(`Unexpected argument: ${positionals[1]}`);
    if (values.metrics !== undefined) throw new CliError('--metrics is for rekogni dashboard');
    const [agentType] = positionals;
    if (!agentType) return null; // list the agents instead
    return {
      name: `get_${scope}_agent`,
      arguments: defined({ agentType, workspace, from, to, limit: limit(values.limit) }),
    };
  }
  throw new CliError(`Unknown command: ${command}. Run rekogni --help`);
}

// The agent types the tool takes, from its input schema.
async function listAgents(client, scope) {
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === `get_${scope}_agent`);
  const types = tool?.inputSchema?.properties?.agentType?.enum ?? [];
  const which = scope === 'workspace' ? 'Workspace agents' : 'Your agents';
  const usage = scope === 'workspace' ? 'rekogni agent <type> --workspace <name>' : 'rekogni agent <type>';
  return `${which}: ${types.join(', ')}\n\nRun: ${usage}`;
}

async function authCommand(sub, ctx) {
  const { server, store, print } = ctx;
  if (sub === 'login') {
    const data = await login({ server, print, openBrowser: ctx.openBrowser, timeoutMs: ctx.loginTimeoutMs });
    store.save(data);
    const email = tokenEmail(data.tokens?.access_token);
    print(`Signed in to ${server.origin}${email ? ` as ${email}` : ''}.`);
    return;
  }
  if (sub === 'logout') {
    store.clear();
    print(`Signed out of ${server.origin} on this machine.`);
    return;
  }
  if (sub === 'status') {
    await withClient(ctx, async () => undefined); // refreshes an expired token, or says to sign in
    const email = tokenEmail(store.load()?.tokens?.access_token);
    print(`Signed in to ${server.origin}${email ? ` as ${email}` : ''}.`);
    return;
  }
  throw new CliError('Usage: rekogni auth login | status | logout');
}

/** Runs the CLI and returns its exit code. Everything it touches comes from `deps`, so tests can replace it. */
export async function run(argv, deps = {}) {
  const print = deps.print ?? ((text) => process.stdout.write(`${text}\n`));
  const printError = deps.printError ?? ((text) => process.stderr.write(`${text}\n`));
  try {
    let parsed;
    try {
      parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
    } catch (error) {
      throw new CliError(`${error.message}. Run rekogni --help`);
    }
    const { values, positionals } = parsed;
    const [command, ...rest] = positionals;
    if (values.version) {
      print(VERSION);
      return 0;
    }
    if (values.help || !command || command === 'help') {
      print(HELP);
      return 0;
    }

    const server = serverUrl(deps.env);
    const store = deps.store ?? createStore({ account: server.href });
    const ctx = { server, store, print, openBrowser: deps.openBrowser, loginTimeoutMs: deps.loginTimeoutMs };

    if (command === 'auth') {
      if (rest.length !== 1) throw new CliError('Usage: rekogni auth login | status | logout');
      await authCommand(rest[0], ctx);
      return 0;
    }
    const call = toolCall(command, rest, values);
    const output = await withClient(ctx, (client) =>
      call
        ? callTool(client, call.name, call.arguments)
        : listAgents(client, values.workspace === undefined ? 'individual' : 'workspace'),
    );
    print(output);
    return 0;
  } catch (error) {
    if (error instanceof CliError) {
      printError(error.message);
      return 1;
    }
    printError(`rekogni: ${error?.message ?? error}`);
    return 1;
  }
}
