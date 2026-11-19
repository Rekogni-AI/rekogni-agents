import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const SERVICE = 'rekogni-cli';

/** The OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service), or null if it can't load. */
function systemKeychain() {
  let Entry;
  try {
    ({ Entry } = createRequire(import.meta.url)('@napi-rs/keyring'));
  } catch {
    return null; // no prebuilt binary for this platform
  }
  return {
    get: (account) => new Entry(SERVICE, account).getPassword() ?? null,
    set: (account, value) => new Entry(SERVICE, account).setPassword(value),
    delete: (account) => {
      new Entry(SERVICE, account).deletePassword();
    },
  };
}

/** Where credentials go when there is no keychain: a file only this user can read. */
export function credentialsFile(env = process.env, platform = process.platform) {
  const base =
    platform === 'win32'
      ? env.APPDATA || join(homedir(), 'AppData', 'Roaming')
      : env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'rekogni', 'credentials.json');
}

function readFile(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function writeFile(file, all) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(all, null, 2), { mode: 0o600 });
  renameSync(tmp, file);
  chmodSync(file, 0o600);
}

/**
 * Sign-in data for one Rekogni server (its OAuth client and tokens), kept in the OS keychain. Where the keychain
 * can't be used (a headless Linux box, a container), it falls back to a 0600 file and says so once.
 */
export function createStore({
  account,
  keychain = systemKeychain(),
  file = credentialsFile(),
  warn = (message) => process.stderr.write(`${message}\n`),
}) {
  let warned = false;
  const fallBack = () => {
    if (!warned) warn(`System keychain unavailable; Rekogni credentials are kept in ${file} (readable only by you).`);
    warned = true;
  };
  // Runs `use` on the keychain; false when there is none or it refuses, so the caller uses the file.
  const tryKeychain = (use) => {
    if (!keychain) return false;
    try {
      use(keychain);
      return true;
    } catch {
      return false;
    }
  };
  const removeFromFile = () => {
    const all = readFile(file);
    if (!(account in all)) return;
    delete all[account];
    if (Object.keys(all).length) writeFile(file, all);
    else rmSync(file, { force: true });
  };

  return {
    load() {
      let value = null;
      if (tryKeychain((k) => (value = k.get(account))) && value) return JSON.parse(value);
      return readFile(file)[account] ?? null;
    },
    save(data) {
      if (tryKeychain((k) => k.set(account, JSON.stringify(data)))) {
        removeFromFile(); // a stale copy from an earlier fallback must not outlive this one
        return;
      }
      fallBack();
      writeFile(file, { ...readFile(file), [account]: data });
    },
    clear() {
      tryKeychain((k) => k.delete(account));
      removeFromFile();
    },
  };
}
