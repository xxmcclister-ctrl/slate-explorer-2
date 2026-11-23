import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SecureFolderStatus, SecurePinActionResult } from './types.ts';

export const SECURE_FOLDER_VIRTUAL_ROOT = 'shell:SecureFolder';
export const SECURE_MAX_ATTEMPTS = 10;

interface StoredSecureAuthState {
  salt: string | null;
  pinHash: string | null;
  failedAttempts: number;
  lastWipeReason: 'max-attempts' | 'forgot-pin' | null;
  updatedAt: number;
}

export class VaultLockedError extends Error {
  code = 'VAULT_LOCKED';
  constructor(message = 'Secure Folder is locked. Enter your 4-digit PIN to open.') {
    super(message);
    this.name = 'VaultLockedError';
  }
}

export function isValidFourDigitPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

export function isSecureVirtualPath(rawPath: string): boolean {
  if (!rawPath) return false;
  const trimmed = rawPath.trim();
  const lower = trimmed.toLowerCase();
  return (
    lower === 'shell:securefolder' ||
    lower.startsWith('shell:securefolder/') ||
    lower.startsWith('shell:securefolder\\')
  );
}

export function createSecureFolderManager(baseMetaDir?: string) {
  const metaDir = path.resolve(baseMetaDir || path.join(os.homedir(), '.slate-explorer'));
  const vaultDir = path.join(metaDir, 'secure-vault');
  const authFilePath = path.join(metaDir, 'secure-vault-auth.json');

  const activeTokens = new Set<string>();
  const tokenStorage = new AsyncLocalStorage<string | undefined>();

  function ensureMetaAndVaultDirs(): void {
    fs.mkdirSync(metaDir, { recursive: true, mode: 0o700 });
    fs.mkdirSync(vaultDir, { recursive: true, mode: 0o700 });
  }

  function loadAuthState(): StoredSecureAuthState {
    try {
      if (!fs.existsSync(authFilePath)) {
        return {
          salt: null,
          pinHash: null,
          failedAttempts: 0,
          lastWipeReason: null,
          updatedAt: Date.now(),
        };
      }
      const raw = fs.readFileSync(authFilePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoredSecureAuthState>;
      return {
        salt: typeof parsed.salt === 'string' ? parsed.salt : null,
        pinHash: typeof parsed.pinHash === 'string' ? parsed.pinHash : null,
        failedAttempts:
          typeof parsed.failedAttempts === 'number' && parsed.failedAttempts >= 0
            ? Math.min(SECURE_MAX_ATTEMPTS, Math.floor(parsed.failedAttempts))
            : 0,
        lastWipeReason:
          parsed.lastWipeReason === 'max-attempts' || parsed.lastWipeReason === 'forgot-pin'
            ? parsed.lastWipeReason
            : null,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
      };
    } catch {
      return {
        salt: null,
        pinHash: null,
        failedAttempts: 0,
        lastWipeReason: null,
        updatedAt: Date.now(),
      };
    }
  }

  function saveAuthState(state: StoredSecureAuthState): void {
    ensureMetaAndVaultDirs();
    fs.writeFileSync(authFilePath, JSON.stringify(state, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
  }

  async function wipeVaultContents(): Promise<void> {
    ensureMetaAndVaultDirs();
    try {
      const entries = await fs.promises.readdir(vaultDir);
      await Promise.all(
        entries.map((entry) =>
          fs.promises.rm(path.join(vaultDir, entry), { recursive: true, force: true }),
        ),
      );
    } catch {
      // Ensure clean empty vault folder even if readdir failed
      await fs.promises.rm(vaultDir, { recursive: true, force: true }).catch(() => {});
      await fs.promises.mkdir(vaultDir, { recursive: true, mode: 0o700 });
    }
  }

  function hashPin(pin: string, saltHex: string): string {
    return crypto.scryptSync(pin, saltHex, 64).toString('hex');
  }

  function verifyPinAgainstState(pin: string, state: StoredSecureAuthState): boolean {
    if (!state.salt || !state.pinHash) return false;
    const expected = Buffer.from(state.pinHash, 'hex');
    const actual = crypto.scryptSync(pin, state.salt, 64);
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  }

  function countVaultItems(): number {
    try {
      if (!fs.existsSync(vaultDir)) return 0;
      return fs.readdirSync(vaultDir).length;
    } catch {
      return 0;
    }
  }

  function verifyToken(token?: string): boolean {
    const candidate = token ?? tokenStorage.getStore();
    return Boolean(candidate && activeTokens.has(candidate));
  }

  function getStatus(token?: string): SecureFolderStatus {
    const state = loadAuthState();
    const initialized = Boolean(state.pinHash && state.salt);
    const unlocked = initialized && verifyToken(token);
    return {
      initialized,
      unlocked,
      failedAttempts: state.failedAttempts,
      maxAttempts: SECURE_MAX_ATTEMPTS,
      remainingAttempts: Math.max(0, SECURE_MAX_ATTEMPTS - state.failedAttempts),
      lastWipeReason: state.lastWipeReason,
      itemCount: countVaultItems(),
    };
  }

  async function setupPin(pin: string): Promise<SecurePinActionResult> {
    if (!isValidFourDigitPin(pin)) {
      return {
        ok: false,
        message: 'PIN must be exactly 4 digits (0-9).',
        status: getStatus(),
      };
    }

    const current = loadAuthState();
    if (current.pinHash && current.salt) {
      return {
        ok: false,
        message: 'A PIN is already configured. Unlock or reset the Secure Folder first.',
        status: getStatus(),
      };
    }

    ensureMetaAndVaultDirs();
    const salt = crypto.randomBytes(16).toString('hex');
    const pinHash = hashPin(pin, salt);
    saveAuthState({
      salt,
      pinHash,
      failedAttempts: 0,
      lastWipeReason: null,
      updatedAt: Date.now(),
    });

    const token = crypto.randomBytes(32).toString('hex');
    activeTokens.add(token);

    return {
      ok: true,
      token,
      message: 'Secure Folder PIN created and unlocked.',
      status: getStatus(token),
    };
  }

  async function unlock(pin: string): Promise<SecurePinActionResult> {
    const state = loadAuthState();
    if (!state.pinHash || !state.salt) {
      return {
        ok: false,
        message: 'No PIN is set yet. Create a new 4-digit PIN to open Secure Folder.',
        status: getStatus(),
      };
    }

    if (!isValidFourDigitPin(pin)) {
      return {
        ok: false,
        message: 'Enter a valid 4-digit PIN (0-9).',
        status: getStatus(),
      };
    }

    if (verifyPinAgainstState(pin, state)) {
      saveAuthState({
        ...state,
        failedAttempts: 0,
        lastWipeReason: null,
        updatedAt: Date.now(),
      });
      const token = crypto.randomBytes(32).toString('hex');
      activeTokens.add(token);
      return {
        ok: true,
        token,
        message: 'Secure Folder unlocked.',
        status: getStatus(token),
      };
    }

    const nextAttempts = state.failedAttempts + 1;
    if (nextAttempts >= SECURE_MAX_ATTEMPTS) {
      await wipeVaultContents();
      activeTokens.clear();
      saveAuthState({
        salt: null,
        pinHash: null,
        failedAttempts: 0,
        lastWipeReason: 'max-attempts',
        updatedAt: Date.now(),
      });
      return {
        ok: false,
        wiped: true,
        message:
          '10 failed PIN attempts reached. Secure Folder contents were permanently cleared. Set a new 4-digit PIN to start fresh.',
        status: getStatus(),
      };
    }

    saveAuthState({
      ...state,
      failedAttempts: nextAttempts,
      updatedAt: Date.now(),
    });
    const remaining = SECURE_MAX_ATTEMPTS - nextAttempts;
    return {
      ok: false,
      wiped: false,
      message: `Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before folder is cleared.`,
      status: getStatus(),
    };
  }

  function lock(): SecureFolderStatus {
    activeTokens.clear();
    return getStatus();
  }

  async function changePin(
    currentPin: string,
    newPin: string,
    token?: string,
  ): Promise<SecurePinActionResult> {
    if (!verifyToken(token)) {
      return {
        ok: false,
        message: 'Unlock Secure Folder before changing its PIN.',
        status: getStatus(token),
      };
    }
    if (!isValidFourDigitPin(currentPin) || !isValidFourDigitPin(newPin)) {
      return {
        ok: false,
        message: 'Both current and new PINs must be exactly 4 digits.',
        status: getStatus(token),
      };
    }
    const state = loadAuthState();
    if (!verifyPinAgainstState(currentPin, state)) {
      const nextAttempts = state.failedAttempts + 1;
      if (nextAttempts >= SECURE_MAX_ATTEMPTS) {
        await wipeVaultContents();
        activeTokens.clear();
        saveAuthState({
          salt: null,
          pinHash: null,
          failedAttempts: 0,
          lastWipeReason: 'max-attempts',
          updatedAt: Date.now(),
        });
        return {
          ok: false,
          wiped: true,
          message:
            '10 failed PIN attempts reached. Secure Folder contents were cleared. Set a new 4-digit PIN.',
          status: getStatus(),
        };
      }
      saveAuthState({
        ...state,
        failedAttempts: nextAttempts,
        updatedAt: Date.now(),
      });
      const remaining = SECURE_MAX_ATTEMPTS - nextAttempts;
      return {
        ok: false,
        message: `Current PIN is incorrect. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
        status: getStatus(token),
      };
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const pinHash = hashPin(newPin, salt);
    saveAuthState({
      salt,
      pinHash,
      failedAttempts: 0,
      lastWipeReason: null,
      updatedAt: Date.now(),
    });
    return {
      ok: true,
      token: token ?? tokenStorage.getStore(),
      message: 'Secure Folder PIN updated.',
      status: getStatus(token),
    };
  }

  async function resetForgotPin(): Promise<SecurePinActionResult> {
    await wipeVaultContents();
    activeTokens.clear();
    saveAuthState({
      salt: null,
      pinHash: null,
      failedAttempts: 0,
      lastWipeReason: 'forgot-pin',
      updatedAt: Date.now(),
    });
    return {
      ok: true,
      wiped: true,
      message: 'Secure Folder has been cleared. Create a new 4-digit PIN to start fresh.',
      status: getStatus(),
    };
  }

  function isInsideVaultDiskPath(resolvedPath: string): boolean {
    const normalized = path.resolve(resolvedPath);
    if (process.platform === 'win32') {
      const a = normalized.toLowerCase();
      const b = vaultDir.toLowerCase();
      return a === b || a.startsWith(b + path.sep);
    }
    return normalized === vaultDir || normalized.startsWith(vaultDir + path.sep);
  }

  function isProtectedAuthPath(resolvedPath: string): boolean {
    const normalized = path.resolve(resolvedPath);
    if (process.platform === 'win32') {
      return normalized.toLowerCase() === authFilePath.toLowerCase();
    }
    return normalized === authFilePath;
  }

  function resolveSecureVirtualToDisk(rawPath: string, token?: string): string {
    if (!verifyToken(token)) {
      throw new VaultLockedError();
    }
    ensureMetaAndVaultDirs();
    const trimmed = rawPath.trim();
    const afterPrefix = trimmed.slice(SECURE_FOLDER_VIRTUAL_ROOT.length).replace(/^[\\/]+/, '');
    if (!afterPrefix) {
      return vaultDir;
    }
    const cleanRel = afterPrefix.replace(/\\/g, '/');
    const resolved = path.resolve(vaultDir, cleanRel);
    if (!isInsideVaultDiskPath(resolved)) {
      throw new Error('Access denied: path escapes Secure Folder.');
    }
    return resolved;
  }

  function assertDiskPathAllowed(resolvedDiskPath: string, token?: string): void {
    if (isProtectedAuthPath(resolvedDiskPath)) {
      throw new Error('Access denied: Secure Folder credential store is protected.');
    }
    if (isInsideVaultDiskPath(resolvedDiskPath) && !verifyToken(token)) {
      throw new VaultLockedError();
    }
  }

  function toVirtualPathIfInsideVault(diskPath: string): string {
    const resolved = path.resolve(diskPath);
    if (!isInsideVaultDiskPath(resolved)) {
      return diskPath;
    }
    const rel = path.relative(vaultDir, resolved);
    if (!rel) return SECURE_FOLDER_VIRTUAL_ROOT;
    const posixRel = rel.split(path.sep).join('/');
    return `${SECURE_FOLDER_VIRTUAL_ROOT}/${posixRel}`;
  }

  function runWithToken<T>(token: string | undefined, fn: () => T): T {
    return tokenStorage.run(token, fn);
  }

  function getContextToken(): string | undefined {
    return tokenStorage.getStore();
  }

  return {
    metaDir,
    vaultDir,
    authFilePath,
    getStatus,
    verifyToken,
    setupPin,
    unlock,
    lock,
    changePin,
    resetForgotPin,
    isInsideVaultDiskPath,
    isProtectedAuthPath,
    resolveSecureVirtualToDisk,
    assertDiskPathAllowed,
    toVirtualPathIfInsideVault,
    runWithToken,
    getContextToken,
  };
}

export const secureFolderManager = createSecureFolderManager();
