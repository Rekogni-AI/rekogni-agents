import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';
import { run, toolCall } from '../src/cli.js';
import { fakeBrowser, memoryStore, startFakeRekogni } from './fake-rekogni.js';

let rekogni;
before(async () => {
  rekogni = await startFakeRekogni();
});
after(() => rekogni.close());
beforeEach(() => {
  rekogni.state.calls.length = 0;
  rekogni.state.forbidden = false;
  rekogni.state.deny = false;
});

// Runs the CLI against the fake server; returns its exit code and what it printed.
async function cli(argv, { store = memoryStore(), browser = fakeBrowser() } = {}) {
  const out = [];
  const err = [];
  const code = await run(argv, {
    env: { REKOGNI_URL: rekogni.origin },
    store,
    openBrowser: browser.open,
    print: (text) => out.push(text),
    printError: (text) => err.push(text),
    loginTimeoutMs: 5000,
  });
  return { code, out: out.join('\n'), err: err.join('\n'), store, browser };
}

async function signedIn() {
  const store = memoryStore();
  const { code } = await cli(['auth', 'login'], { store });
  assert.equal(code, 0);
  return store;
}

describe('rekogni auth', () => {
  it('login signs in through the browser and keeps the tokens', async () => {
    const { code, out, store, browser } = await cli(['auth', 'login']);

    assert.equal(code, 0);
    assert.equal(browser.opened.length, 1);
    assert.match(browser.opened[0], /\/auth\/v1\/oauth\/authorize\?/);
    assert.match(browser.opened[0], /code_challenge_method=S256/);
    assert.match(browser.opened[0], /redirect_uri=http%3A%2F%2F127\.0\.0\.1%3A\d+%2Fcallback/);
    assert.match(out, /Signed in to http:\/\/127\.0\.0\.1:\d+ as dev@rekogni\.test\./);
    assert.ok(store.data.tokens.access_token);
    assert.ok(store.data.tokens.refresh_token);
    assert.ok(store.data.clientInformation.client_id);
  });

  it('a cancelled login says so and keeps the earlier sign-in', async () => {
    const store = await signedIn();
    const before = store.data.tokens.access_token;
    rekogni.state.deny = true;

    const { code, err } = await cli(['auth', 'login'], { store });

    assert.equal(code, 1);
    assert.match(err, /Sign-in cancelled: access_denied/);
    assert.equal(store.data.tokens.access_token, before);
  });

  it('a request to the callback port without the login state neither finishes nor cancels the login', async () => {
    const browser = fakeBrowser();
    const open = browser.open;
    browser.open = (url) => {
      const stray = (params) => {
        const callback = new URL(new URL(url).searchParams.get('redirect_uri'));
        for (const [key, value] of Object.entries(params)) callback.searchParams.set(key, value);
        return fetch(callback);
      };
      // Stray requests first, then the real browser.
      stray({ code: 'stolen', state: 'wrong' })
        .then(() => stray({ error: 'access_denied', error_description: 'spoofed' }))
        .then(() => open(url));
    };

    const { code, store } = await cli(['auth', 'login'], { browser });

    assert.equal(code, 0);
    assert.ok(store.data.tokens.access_token);
  });

  it('status shows who is signed in, and says to sign in when nobody is', async () => {
    const store = await signedIn();
    assert.match((await cli(['auth', 'status'], { store })).out, /as dev@rekogni\.test/);

    const nobody = await cli(['auth', 'status']);
    assert.equal(nobody.code, 1);
    assert.equal(nobody.err, 'Not signed in to Rekogni. Run: rekogni auth login');
  });

  it('logout removes the sign-in', async () => {
    const store = await signedIn();
    const { code } = await cli(['auth', 'logout'], { store });
    assert.equal(code, 0);
    assert.equal(store.data, null);
    assert.equal((await cli(['dashboard'], { store })).code, 1);
  });
});

describe('rekogni dashboard and agent', () => {
  it('dashboard calls your own dashboard, or a workspace one with --workspace', async () => {
    const store = await signedIn();

    const mine = await cli(
      ['dashboard', '--from', '2026-11-09', '--to', '2026-11-15', '--metrics', 'inbox, pr_merged'],
      {
        store,
      },
    );
    const team = await cli(['dashboard', '--workspace', 'Platform'], { store });

    assert.equal(mine.code, 0);
    assert.equal(team.code, 0);
    assert.deepEqual(rekogni.state.calls, [
      {
        name: 'get_individual_dashboard',
        args: { from: '2026-11-09', to: '2026-11-15', metrics: ['inbox', 'pr_merged'] },
      },
      { name: 'get_workspace_dashboard', args: { workspace: 'Platform' } },
    ]);
    assert.match(mine.out, /^get_individual_dashboard /);
  });

  it('agent reads results, and lists the agent types when none is given', async () => {
    const store = await signedIn();

    const result = await cli(['agent', 'dailySummary', '--limit', '1'], { store });
    const list = await cli(['agent'], { store });

    assert.equal(result.code, 0);
    assert.deepEqual(rekogni.state.calls, [
      { name: 'get_individual_agent', args: { agentType: 'dailySummary', limit: 1 } },
    ]);
    assert.match(list.out, /^Your agents: dailySummary\n\nRun: rekogni agent <type>$/);
  });

  it('a bad argument is named, with the values the server takes, instead of the raw validation dump', async () => {
    const store = await signedIn();
    const { code, err } = await cli(['agent', 'nope'], { store });
    assert.equal(code, 1);
    assert.equal(err, 'Invalid agentType "nope": expected one of dailySummary');
  });

  it("a tool's error is printed and exits 1", async () => {
    const store = await signedIn();
    const { code, err } = await cli(['dashboard', '--workspace', 'nope'], { store });
    assert.equal(code, 1);
    assert.equal(err, "You aren't a member of nope.");
  });

  it('an expired access token is refreshed and the new tokens are kept', async () => {
    const store = await signedIn();
    const old = store.data.tokens;
    rekogni.expireAccessTokens();

    const { code, browser } = await cli(['dashboard'], { store });

    assert.equal(code, 0);
    assert.equal(browser.opened.length, 0);
    assert.notEqual(store.data.tokens.access_token, old.access_token);
    assert.notEqual(store.data.tokens.refresh_token, old.refresh_token); // rotated, so the old one is used up
    assert.equal((await cli(['dashboard'], { store })).code, 0);
  });

  it('a sign-in that can no longer be refreshed says to log in again, without opening a browser', async () => {
    const store = await signedIn();
    rekogni.revokeAll();

    const { code, err, browser } = await cli(['dashboard'], { store });

    assert.equal(code, 1);
    assert.equal(err, 'Your Rekogni sign-in has expired. Run: rekogni auth login');
    assert.equal(browser.opened.length, 0);
  });

  it("an account without access gets the server's message", async () => {
    const store = await signedIn();
    rekogni.state.forbidden = true;
    const { code, err } = await cli(['dashboard'], { store });
    assert.equal(code, 1);
    assert.equal(err, "Your Rekogni account doesn't have access yet. Finish setting it up in the Rekogni web app.");
  });

  it('an unreachable server says so', async () => {
    // A port that was free a moment ago, so nothing answers on it.
    const probe = createServer();
    await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const { port } = probe.address();
    await new Promise((resolve) => probe.close(resolve));
    const out = [];
    const code = await run(['dashboard'], {
      env: { REKOGNI_URL: `http://127.0.0.1:${port}` },
      store: memoryStore({ tokens: { access_token: 'x', token_type: 'bearer' } }),
      print: () => undefined,
      printError: (text) => out.push(text),
    });
    assert.equal(code, 1);
    assert.match(out.join(), /Can't reach Rekogni \(ECONNREFUSED\)/);
  });
});

describe('arguments', () => {
  it('help and version need no sign-in', async () => {
    assert.match((await cli([])).out, /rekogni auth login/);
    assert.match((await cli(['--version'])).out, /^\d+\.\d+\.\d+$/);
  });

  it('rejects options and commands that do not fit', async () => {
    assert.match((await cli(['dashboard', '--limit', '2'])).err, /--limit is for rekogni agent/);
    assert.match(
      (await cli(['agent', 'dailySummary', '--metrics', 'inbox'])).err,
      /--metrics is for rekogni dashboard/,
    );
    assert.match((await cli(['agent', 'dailySummary', '--limit', 'two'])).err, /--limit must be a whole number/);
    assert.match(
      (await cli(['dashboard', '--from', '11-09'])).err,
      /--from must be a date like 2026-11-09, not "11-09"/,
    );
    assert.match((await cli(['dashboard', '--nope'])).err, /Unknown option '--nope'/);
    assert.match((await cli(['nope'])).err, /Unknown command: nope/);
    assert.match((await cli(['auth'])).err, /Usage: rekogni auth login \| status \| logout/);
  });

  it('options a command was not given are not sent', () => {
    assert.deepEqual(toolCall('dashboard', [], {}), { name: 'get_individual_dashboard', arguments: {} });
    assert.equal(toolCall('agent', [], {}), null);
  });
});
