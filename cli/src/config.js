import { CliError } from './errors.js';

export const DEFAULT_URL = 'https://app.rekogni.ai';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * The Rekogni MCP endpoint the CLI talks to: production, or REKOGNI_URL (e.g. a local dev server). Plain http is
 * allowed only on this machine, so a token is never sent unencrypted over a network.
 */
export function serverUrl(env = process.env) {
  const base = (env.REKOGNI_URL || DEFAULT_URL).replace(/\/+$/, '');
  let url;
  try {
    url = new URL(`${base}/api/mcp`);
  } catch {
    throw new CliError(`REKOGNI_URL is not a URL: ${env.REKOGNI_URL}`);
  }
  const secure = url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK.has(url.hostname));
  if (!secure) throw new CliError('REKOGNI_URL must start with https:// (http:// only for localhost)');
  return url;
}
