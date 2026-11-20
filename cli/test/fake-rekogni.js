import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const id = () => randomBytes(12).toString('base64url');
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

/**
 * A stand-in for app.rekogni.ai: the same OAuth shape as Supabase's OAuth server (discovery, dynamic client
 * registration, PKCE, refresh tokens that rotate) and /api/mcp answering 401 without a token, as the real route does.
 * Its tools echo what they were called with.
 */
export async function startFakeRekogni({ email = 'dev@rekogni.test' } = {}) {
  const clients = new Map(); // client_id -> redirect_uris
  const codes = new Map(); // code -> { clientId, redirectUri, challenge }
  const access = new Set();
  const refresh = new Map(); // refresh token -> client_id
  const state = { calls: [], forbidden: false, registrations: 0, authorizations: 0 };
  let origin;

  const issue = (clientId) => {
    const accessToken = `${b64({ alg: 'none' })}.${b64({ email, client_id: clientId })}.${id()}`;
    const refreshToken = id();
    access.add(accessToken);
    refresh.set(refreshToken, clientId);
    return { access_token: accessToken, token_type: 'bearer', expires_in: 3600, refresh_token: refreshToken };
  };

  const mcp = () => {
    const server = new McpServer({ name: 'fake-rekogni', version: '0.0.0' });
    const echo = (name) => (args) => {
      state.calls.push({ name, args });
      if (args.workspace === 'nope') {
        return { content: [{ type: 'text', text: "You aren't a member of nope." }], isError: true };
      }
      return { content: [{ type: 'text', text: `${name} ${JSON.stringify(args)}` }] };
    };
    const period = { from: z.string().optional(), to: z.string().optional() };
    server.registerTool(
      'get_individual_dashboard',
      { inputSchema: { ...period, metrics: z.array(z.string()).optional() } },
      echo('get_individual_dashboard'),
    );
    server.registerTool(
      'get_workspace_dashboard',
      { inputSchema: { ...period, workspace: z.string().optional(), metrics: z.array(z.string()).optional() } },
      echo('get_workspace_dashboard'),
    );
    for (const scope of ['individual', 'workspace']) {
      server.registerTool(
        `get_${scope}_agent`,
        {
          description: 'Agent results. agentType values: dailySummary (Daily Summary Agent).',
          inputSchema: {
            ...period,
            agentType: z.enum(['dailySummary']),
            workspace: z.string().optional(),
            limit: z.number().optional(),
          },
        },
        echo(`get_${scope}_agent`),
      );
    }
    return server;
  };

  const json = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers }).end(JSON.stringify(body));
  };
  const form = async (req) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    return req.headers['content-type']?.includes('json')
      ? JSON.parse(body || '{}')
      : Object.fromEntries(new URLSearchParams(body));
  };

  const http = createServer(async (req, res) => {
    const url = new URL(req.url, origin);
    const issuer = `${origin}/auth/v1`;
    if (url.pathname === '/.well-known/oauth-protected-resource/api/mcp') {
      return json(res, 200, { resource: `${origin}/api/mcp`, authorization_servers: [issuer] });
    }
    if (url.pathname === '/.well-known/oauth-authorization-server/auth/v1') {
      return json(res, 200, {
        issuer,
        authorization_endpoint: `${issuer}/oauth/authorize`,
        token_endpoint: `${issuer}/oauth/token`,
        registration_endpoint: `${issuer}/oauth/clients/register`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
      });
    }
    if (url.pathname === '/auth/v1/oauth/clients/register' && req.method === 'POST') {
      const meta = await form(req);
      const clientId = id();
      clients.set(clientId, meta.redirect_uris);
      state.registrations++;
      return json(res, 201, { ...meta, client_id: clientId });
    }
    if (url.pathname === '/auth/v1/oauth/authorize') {
      const p = url.searchParams;
      const redirectUri = p.get('redirect_uri');
      if (!clients.get(p.get('client_id'))?.includes(redirectUri)) return json(res, 400, { error: 'invalid_request' });
      state.authorizations++;
      const back = new URL(redirectUri);
      back.searchParams.set('state', p.get('state'));
      if (state.deny) {
        back.searchParams.set('error', 'access_denied');
      } else {
        const code = id();
        codes.set(code, { clientId: p.get('client_id'), redirectUri, challenge: p.get('code_challenge') });
        back.searchParams.set('code', code);
      }
      res.writeHead(302, { Location: back.href }).end();
      return;
    }
    if (url.pathname === '/auth/v1/oauth/token' && req.method === 'POST') {
      const p = await form(req);
      if (p.grant_type === 'authorization_code') {
        const grant = codes.get(p.code);
        codes.delete(p.code);
        const verified =
          createHash('sha256')
            .update(p.code_verifier ?? '')
            .digest('base64url') === grant?.challenge;
        if (!grant || !verified || grant.redirectUri !== p.redirect_uri)
          return json(res, 400, { error: 'invalid_grant' });
        return json(res, 200, issue(grant.clientId));
      }
      if (p.grant_type === 'refresh_token') {
        const clientId = refresh.get(p.refresh_token);
        refresh.delete(p.refresh_token); // rotates, like Supabase
        if (!clientId) return json(res, 400, { error: 'invalid_grant' });
        return json(res, 200, issue(clientId));
      }
      return json(res, 400, { error: 'unsupported_grant_type' });
    }
    if (url.pathname === '/api/mcp') {
      const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
      if (!token || !access.has(token)) {
        return json(
          res,
          401,
          { error: 'Unauthorized' },
          {
            'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp"`,
          },
        );
      }
      if (state.forbidden) {
        return json(res, 403, {
          error: "Your Rekogni account doesn't have access yet. Finish setting it up in the Rekogni web app.",
        });
      }
      if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
      const server = mcp();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      await server.connect(transport);
      await transport.handleRequest(req, res, await form(req));
      return;
    }
    json(res, 404, { error: 'not found' });
  });

  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${http.address().port}`;

  return {
    origin,
    state,
    /** Every access token stops working, as an hour passing would do. */
    expireAccessTokens: () => access.clear(),
    /** Every refresh token stops working too, as signing out everywhere would do. */
    revokeAll: () => {
      access.clear();
      refresh.clear();
    },
    close: () =>
      new Promise((resolve) => {
        http.close(() => resolve());
        http.closeAllConnections();
      }),
  };
}

/** Plays the user's browser: follows the sign-in page's redirect back to the CLI's port, as clicking Allow does. */
export function fakeBrowser() {
  const opened = [];
  const open = (url) => {
    opened.push(url);
    (async () => {
      const page = await fetch(url, { redirect: 'manual' });
      const back = page.headers.get('location');
      if (back) await fetch(back);
    })().catch(() => undefined);
  };
  return { open, opened };
}

/** A store kept in memory, the same shape as createStore's. */
export function memoryStore(initial = null) {
  let data = initial;
  return {
    load: () => (data ? structuredClone(data) : null),
    save: (next) => {
      data = structuredClone(next);
    },
    clear: () => {
      data = null;
    },
    get data() {
      return data;
    },
  };
}
