import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  SECURE_FOLDER_VIRTUAL_ROOT,
  SECURE_MAX_ATTEMPTS,
  VaultLockedError,
  createSecureFolderManager,
  isValidFourDigitPin,
} from './secureFolderService.ts';

function makeTempMetaDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'slate-secure-test-'));
}

test('4-digit PIN validation enforces exactly four numeric digits', () => {
  assert.equal(isValidFourDigitPin('0429'), true);
  assert.equal(isValidFourDigitPin('9999'), true);
  assert.equal(isValidFourDigitPin('123'), false);
  assert.equal(isValidFourDigitPin('12345'), false);
  assert.equal(isValidFourDigitPin('12ab'), false);
  assert.equal(isValidFourDigitPin(''), false);
});

test('Secure Folder setup, salted hash storage, lock/unlock, and changePin work securely', async () => {
  const metaDir = makeTempMetaDir();
  try {
    const manager = createSecureFolderManager(metaDir);
    const initial = manager.getStatus();
    assert.equal(initial.initialized, false);
    assert.equal(initial.unlocked, false);
    assert.equal(initial.remainingAttempts, SECURE_MAX_ATTEMPTS);

    // Locked vault blocks disk and virtual path access
    assert.throws(
      () => manager.resolveSecureVirtualToDisk(SECURE_FOLDER_VIRTUAL_ROOT),
      (err) => err instanceof VaultLockedError,
    );

    const setupRes = await manager.setupPin('2468');
    assert.equal(setupRes.ok, true);
    assert.ok(setupRes.token);
    assert.equal(setupRes.status.initialized, true);
    assert.equal(setupRes.status.unlocked, true);

    // Raw PIN is never stored in plain text in auth file
    const authRaw = fs.readFileSync(manager.authFilePath, 'utf8');
    assert.equal(authRaw.includes('2468'), false);
    assert.ok(JSON.parse(authRaw).pinHash);

    // Inside AsyncLocalStorage token context, paths resolve cleanly and escape is blocked
    const diskDir = manager.runWithToken(setupRes.token, () =>
      manager.resolveSecureVirtualToDisk(`${SECURE_FOLDER_VIRTUAL_ROOT}/Taxes`),
    );
    assert.equal(diskDir, path.join(manager.vaultDir, 'Taxes'));
    assert.throws(
      () =>
        manager.runWithToken(setupRes.token, () =>
          manager.resolveSecureVirtualToDisk(`${SECURE_FOLDER_VIRTUAL_ROOT}/../../etc/passwd`),
        ),
      /escapes Secure Folder/,
    );

    // Lock revokes all tokens
    const lockedStatus = manager.lock();
    assert.equal(lockedStatus.unlocked, false);
    assert.throws(
      () =>
        manager.runWithToken(setupRes.token, () =>
          manager.resolveSecureVirtualToDisk(SECURE_FOLDER_VIRTUAL_ROOT),
        ),
      (err) => err instanceof VaultLockedError,
    );

    // Unlock and change PIN
    const unlocked = await manager.unlock('2468');
    assert.equal(unlocked.ok, true);
    assert.ok(unlocked.token);

    const changed = await manager.changePin('2468', '1357', unlocked.token);
    assert.equal(changed.ok, true);
    manager.lock();

    const oldFail = await manager.unlock('2468');
    assert.equal(oldFail.ok, false);
    const newOk = await manager.unlock('1357');
    assert.equal(newOk.ok, true);
  } finally {
    fs.rmSync(metaDir, { recursive: true, force: true });
  }
});

test('10 consecutive failed PIN attempts wipe vault contents and reset PIN', async () => {
  const metaDir = makeTempMetaDir();
  try {
    const manager = createSecureFolderManager(metaDir);
    const setupRes = await manager.setupPin('1234');
    assert.equal(setupRes.ok, true);

    // Populate real files & nested directories inside the vault
    fs.mkdirSync(path.join(manager.vaultDir, 'SecretDocs'), { recursive: true });
    fs.writeFileSync(path.join(manager.vaultDir, 'SecretDocs', 'keys.txt'), 'sensitive', 'utf8');
    fs.writeFileSync(path.join(manager.vaultDir, 'root-note.txt'), 'private', 'utf8');

    manager.lock();
    assert.equal(manager.getStatus().itemCount, 2);

    // 9 wrong attempts decrement counter without wiping
    for (let i = 1; i <= 9; i++) {
      const attempt = await manager.unlock('0000');
      assert.equal(attempt.ok, false);
      assert.equal(attempt.wiped, false);
      assert.equal(attempt.status.failedAttempts, i);
      assert.equal(attempt.status.remainingAttempts, 10 - i);
      assert.equal(fs.existsSync(path.join(manager.vaultDir, 'root-note.txt')), true);
    }

    // 10th wrong attempt permanently clears folder and resets PIN
    const tenth = await manager.unlock('9999');
    assert.equal(tenth.ok, false);
    assert.equal(tenth.wiped, true);
    assert.equal(tenth.status.initialized, false);
    assert.equal(tenth.status.unlocked, false);
    assert.equal(tenth.status.failedAttempts, 0);
    assert.equal(tenth.status.lastWipeReason, 'max-attempts');
    assert.equal(tenth.status.itemCount, 0);
    assert.deepEqual(fs.readdirSync(manager.vaultDir), []);

    // User can now start fresh with a new 4-digit PIN
    const freshSetup = await manager.setupPin('7777');
    assert.equal(freshSetup.ok, true);
    assert.equal(freshSetup.status.unlocked, true);
    assert.equal(freshSetup.status.lastWipeReason, null);
  } finally {
    fs.rmSync(metaDir, { recursive: true, force: true });
  }
});

test('Forgot PIN wipes vault contents and requires creating a new PIN', async () => {
  const metaDir = makeTempMetaDir();
  try {
    const manager = createSecureFolderManager(metaDir);
    await manager.setupPin('5555');
    fs.mkdirSync(path.join(manager.vaultDir, 'Sub'), { recursive: true });
    fs.writeFileSync(path.join(manager.vaultDir, 'Sub', 'passport.txt'), 'secret', 'utf8');

    manager.lock();
    const resetRes = await manager.resetForgotPin();
    assert.equal(resetRes.ok, true);
    assert.equal(resetRes.wiped, true);
    assert.equal(resetRes.status.initialized, false);
    assert.equal(resetRes.status.unlocked, false);
    assert.equal(resetRes.status.lastWipeReason, 'forgot-pin');
    assert.equal(resetRes.status.itemCount, 0);
    assert.deepEqual(fs.readdirSync(manager.vaultDir), []);
  } finally {
    fs.rmSync(metaDir, { recursive: true, force: true });
  }
});
