import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { CliError, NotSignedInError } from './errors.js';

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * OAuth for the MCP SDK, the same sign-in Claude Code uses: dynamic client registration, PKCE, and a code sent back to
 * a port on this machine. Rekogni's consent page accepts loopback callbacks. Outside `rekogni auth login` it never
 * opens a browser: a session that can't be refreshed marks `needsLogin` and stops.
 */
export class RekogniAuthProvider {
  constructor({ data = {}, redirectUrl, openBrowser, onSave }) {
    this.data = data;
    this._redirectUrl = redirectUrl;
    this._openBrowser = openBrowser; // only set for login
    this._onSave = onSave;
    this.needsLogin = false;
  }

  get redirectUrl() {
    return this._redirectUrl ?? this.data.redirectUrl;
  }

  get clientMetadata() {
    return {
      client_name: 'Rekogni CLI',
      redirect_uris: [String(this.redirectUrl)],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
  }

  state() {
    this.expectedState = randomBytes(16).toString('base64url');
    return this.expectedState;
  }

  clientInformation() {
    return this.data.clientInformation;
  }

  saveClientInformation(clientInformation) {
    this.data.clientInformation = clientInformation;
    this._onSave?.(this.data);
  }

  tokens() {
    return this.data.tokens;
  }

  saveTokens(tokens) {
    this.data.tokens = tokens;
    this._onSave?.(this.data);
  }

  redirectToAuthorization(url) {
    if (!this._openBrowser) {
      this.needsLogin = true;
      throw new NotSignedInError('Your Rekogni sign-in has expired. Run: rekogni auth login');
    }
    this._openBrowser(url);
  }

  saveCodeVerifier(codeVerifier) {
    this._codeVerifier = codeVerifier;
  }

  codeVerifier() {
    if (!this._codeVerifier) throw new CliError('Sign-in was not started');
    return this._codeVerifier;
  }

  invalidateCredentials(scope) {
    if (scope === 'all' || scope === 'client') delete this.data.clientInformation;
    if (scope === 'all' || scope === 'tokens') delete this.data.tokens;
    if (scope === 'all' || scope === 'tokens' || scope === 'client') this.needsLogin = true;
    this._onSave?.(this.data);
  }
}

const page = (title, body) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title>` +
  `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem">` +
  `<h1>${title}</h1><p>${body}</p></body>`;

/** Listens on a free port of 127.0.0.1 for the browser coming back from sign-in. */
export async function startCallbackServer() {
  let settle;
  const result = new Promise((resolve, reject) => (settle = { resolve, reject }));
  result.catch(() => undefined); // read through waitForCode
  let expectedState;

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname !== '/callback') {
      res.writeHead(404).end();
      return;
    }
    const reply = (status, title, body) => {
      res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' }).end(page(title, body));
    };
    // Only the browser this login opened knows the state, so a stray request to the port can neither finish nor
    // cancel it.
    if (!expectedState || url.searchParams.get('state') !== expectedState) {
      reply(
        400,
        'Sign-in failed',
        'This link does not belong to the sign-in in progress. Run rekogni auth login again.',
      );
      return;
    }
    const error = url.searchParams.get('error');
    if (error) {
      reply(400, 'Sign-in cancelled', 'You can close this tab.');
      settle.reject(new CliError(`Sign-in cancelled: ${url.searchParams.get('error_description') || error}`));
      return;
    }
    const code = url.searchParams.get('code');
    if (!code) {
      reply(400, 'Sign-in failed', 'Rekogni sent no code back. Run rekogni auth login again.');
      return;
    }
    reply(200, 'Signed in to Rekogni', 'You can close this tab and go back to your terminal.');
    settle.resolve(code);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  return {
    redirectUrl: `http://127.0.0.1:${server.address().port}/callback`,
    /** Set before the browser opens, so even an instant redirect back is matched. */
    expect(state) {
      expectedState = state;
    },
    async waitForCode(timeoutMs = LOGIN_TIMEOUT_MS) {
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new CliError('Sign-in timed out. Run rekogni auth login again.')), timeoutMs);
      });
      try {
        return await Promise.race([result, timeout]);
      } finally {
        clearTimeout(timer);
      }
    },
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections(); // a browser keeps its connection open, which would hold close() forever
      }),
  };
}

/** Opens a URL in the default browser; the URL is printed too, so a failure here is not fatal. */
export function openInBrowser(url) {
  const [command, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
        : ['xdg-open', [url]];
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => undefined);
    child.unref();
  } catch {
    // printed above; the user opens it
  }
}

/**
 * Signs in through the browser and returns the new sign-in data. A fresh client is registered for this login's port,
 * and nothing stored is replaced until sign-in succeeds, so a cancelled login leaves the old one working.
 */
export async function login({ server, openBrowser = openInBrowser, print, timeoutMs }) {
  const callback = await startCallbackServer();
  try {
    const provider = new RekogniAuthProvider({
      redirectUrl: callback.redirectUrl,
      openBrowser: (url) => {
        callback.expect(provider.expectedState);
        print(`Opening your browser to sign in to Rekogni. If it doesn't open, go to:\n${url}\n`);
        openBrowser(String(url));
      },
    });
    if ((await auth(provider, { serverUrl: server })) === 'REDIRECT') {
      const code = await callback.waitForCode(timeoutMs);
      await auth(provider, { serverUrl: server, authorizationCode: code });
    }
    return { ...provider.data, redirectUrl: callback.redirectUrl };
  } finally {
    await callback.close();
  }
}

/** The email in a Supabase access token, for display only (the server checks the token). */
export function tokenEmail(accessToken) {
  try {
    const claims = JSON.parse(Buffer.from(String(accessToken).split('.')[1], 'base64url').toString('utf8'));
    return typeof claims.email === 'string' ? claims.email : null;
  } catch {
    return null;
  }
}
