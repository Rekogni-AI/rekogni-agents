import { readFileSync } from 'node:fs';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport, StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { RekogniAuthProvider } from './auth.js';
import { CliError, NotSignedInError } from './errors.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

// What the server said, for errors that aren't a sign-in problem: /api/mcp answers 403 with { error: "..." }.
function serverMessage(error) {
  const match = String(error?.message ?? '').match(/\{.*\}/s);
  if (match) {
    try {
      const body = JSON.parse(match[0]);
      if (typeof body.error === 'string') return body.error;
    } catch {
      // not JSON
    }
  }
  return null;
}

function explain(error, provider) {
  if (error instanceof CliError) return error;
  if (provider.needsLogin || error instanceof UnauthorizedError)
    return new NotSignedInError('Your Rekogni sign-in has expired. Run: rekogni auth login');
  if (error instanceof StreamableHTTPError) {
    const message = serverMessage(error);
    if (message) return new CliError(message);
  }
  const code = networkCode(error);
  if (code) return new CliError(`Can't reach Rekogni (${code}). Check your connection, or REKOGNI_URL.`);
  return error;
}

// fetch's "fetch failed" hides why under `cause` (an AggregateError when several addresses were tried).
function networkCode(error) {
  for (let e = error, depth = 0; e && depth < 5; e = e.cause, depth++) {
    const code = e.code ?? e.errors?.find((inner) => inner?.code)?.code;
    if (typeof code === 'string' && /^(E[A-Z]+|UND_ERR_[A-Z_]+)$/.test(code)) return code;
  }
  return null;
}

/**
 * Connects to Rekogni's MCP endpoint as the signed-in user and runs `use` with the client. An expired access token
 * is refreshed (and saved) on the way; one that can't be is a NotSignedInError.
 */
export async function withClient({ server, store }, use) {
  const data = store.load();
  if (!data?.tokens) throw new NotSignedInError();
  const provider = new RekogniAuthProvider({ data, onSave: (next) => store.save(next) });
  const client = new Client({ name: 'rekogni-cli', version: VERSION });
  try {
    await client.connect(new StreamableHTTPClientTransport(server, { authProvider: provider }));
    return await use(client);
  } catch (error) {
    throw explain(error, provider);
  } finally {
    await client.close().catch(() => undefined);
  }
}

// The SDK's message for arguments a tool's schema rejects (JSON-RPC "invalid params").
const isInvalidParams = (text) => String(text).startsWith(`MCP error ${ErrorCode.InvalidParams}:`);

/**
 * Names the arguments outside the values the tool takes (an unknown agent type or metric), read from the tool's own
 * schema rather than from the wording of the server's error, which changes between validator versions. Null when no
 * argument is outside its list, so the server's own message is shown instead.
 */
async function invalidChoices(client, name, args) {
  const { tools } = await client.listTools();
  const properties = tools.find((tool) => tool.name === name)?.inputSchema?.properties ?? {};
  const lines = [];
  for (const [key, value] of Object.entries(args)) {
    const allowed = properties[key]?.enum ?? properties[key]?.items?.enum;
    const bad = allowed && [value].flat().filter((v) => !allowed.includes(v));
    if (bad?.length) lines.push(`Invalid ${key} "${bad.join(', ')}": expected one of ${allowed.join(', ')}`);
  }
  return lines.length ? new CliError(lines.join('\n')) : null;
}

/** Calls one tool and returns its text, the way Claude would read it; a tool error is a CliError. */
export async function callTool(client, name, args) {
  let result;
  try {
    result = await client.callTool({ name, arguments: args });
  } catch (error) {
    // A server on an older MCP SDK rejects bad arguments with a JSON-RPC error rather than a tool error (below).
    if (!(error instanceof McpError && error.code === ErrorCode.InvalidParams)) throw error;
    result = { isError: true, content: [{ type: 'text', text: error.message }] };
  }
  const text = (result.content ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
  if (result.isError) {
    throw (
      (isInvalidParams(text) && (await invalidChoices(client, name, args))) || new CliError(text || `${name} failed`)
    );
  }
  return text;
}
