import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { serverUrl } from '../src/config.js';
import { credentialsFile, createStore } from '../src/store.js';

const tempFile = () => join(mkdtempSync(join(tmpdir(), 'rekogni-')), 'rekogni', 'credentials.json');

const fakeKeychain = () => {
  const items = new Map();
  return {
    items,
    get: (account) => items.get(account) ?? null,
    set: (account, value) => items.set(account, value),
    delete: (account) => {
      if (!items.delete(account)) throw new Error('NoEntry');
    },
  };
};

const brokenKeychain = {
  get: () => {
    throw new Error('AccessDenied');
  },
  set: () => {
    throw new Error('AccessDenied');
  },
  delete: () => {
    throw new Error('AccessDenied');
  },
};

describe('credential store', () => {
  it('keeps sign-in data in the keychain, per server, and never on disk', () => {
    const keychain = fakeKeychain();
    const file = tempFile();
    const prod = createStore({ account: 'https://app.rekogni.ai/api/mcp', keychain, file });
    const local = createStore({ account: 'http://localhost:3000/api/mcp', keychain, file });

    prod.save({ tokens: { access_token: 'a' } });

    assert.deepEqual(prod.load(), { tokens: { access_token: 'a' } });
    assert.equal(local.load(), null);
    assert.equal(existsSync(file), false);
    prod.clear();
    assert.equal(prod.load(), null);
    assert.equal(keychain.items.size, 0);
  });

  it('without a keychain, uses a file only the user can read, and says so once', () => {
    const file = tempFile();
    const warnings = [];
    const store = createStore({ account: 'a', keychain: brokenKeychain, file, warn: (m) => warnings.push(m) });

    store.save({ tokens: { access_token: '1' } });
    store.save({ tokens: { access_token: '2' } });

    assert.deepEqual(store.load(), { tokens: { access_token: '2' } });
    if (process.platform !== 'win32') {
      // Windows has no Unix modes; the file sits in the user's own profile folder there.
      assert.equal(statSync(file).mode & 0o777, 0o600);
      assert.equal(statSync(join(file, '..')).mode & 0o777, 0o700);
    }
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /System keychain unavailable/);
    store.clear();
    assert.equal(existsSync(file), false);
  });

  it('clearing one server leaves the others in the file', () => {
    const file = tempFile();
    const a = createStore({ account: 'a', keychain: null, file, warn: () => undefined });
    const b = createStore({ account: 'b', keychain: null, file, warn: () => undefined });
    a.save({ n: 1 });
    b.save({ n: 2 });
    a.clear();
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { b: { n: 2 } });
  });

  it('a keychain that starts working again replaces the copy in the file', () => {
    const file = tempFile();
    createStore({ account: 'a', keychain: brokenKeychain, file, warn: () => undefined }).save({ n: 1 });
    const store = createStore({ account: 'a', keychain: fakeKeychain(), file });

    store.save({ n: 2 });

    assert.deepEqual(store.load(), { n: 2 });
    assert.equal(existsSync(file), false);
  });

  it('the file lives in the config folder of the platform', () => {
    assert.equal(credentialsFile({ XDG_CONFIG_HOME: '/x' }, 'linux'), join('/x', 'rekogni', 'credentials.json'));
    assert.equal(credentialsFile({ APPDATA: 'C:\\A' }, 'win32'), join('C:\\A', 'rekogni', 'credentials.json'));
  });
});

describe('server URL', () => {
  it('is production unless REKOGNI_URL says otherwise', () => {
    assert.equal(serverUrl({}).href, 'https://app.rekogni.ai/api/mcp');
    assert.equal(serverUrl({ REKOGNI_URL: 'http://localhost:3000/' }).href, 'http://localhost:3000/api/mcp');
  });

  it('never sends a token over plain http to another machine', () => {
    assert.throws(() => serverUrl({ REKOGNI_URL: 'http://app.rekogni.ai' }), /must start with https/);
    assert.throws(() => serverUrl({ REKOGNI_URL: 'not a url' }), /is not a URL/);
  });
});
