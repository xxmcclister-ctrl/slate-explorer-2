import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {
  executeTerminalCommand,
  resolveBaseCwd,
  stripCwdSentinel,
} from './terminalService';

test('resolveBaseCwd falls back cleanly for empty or virtual shell paths', () => {
  const home = os.homedir() || process.cwd();
  assert.equal(resolveBaseCwd(''), home);
  assert.equal(resolveBaseCwd('shell:RecycleBinFolder'), home);
  assert.equal(resolveBaseCwd('shell:SecureFolder'), home);
  assert.equal(resolveBaseCwd('/non-existent-folder-slate-check'), home);
  assert.equal(resolveBaseCwd(process.cwd()), path.resolve(process.cwd()));
});

test('stripCwdSentinel extracts next working directory without polluting stdout', () => {
  const res = stripCwdSentinel('hello world\n__SLATE_TERM_CWD__/tmp\n', '/app/applet');
  assert.equal(res.cleanedStdout, 'hello world');
  assert.equal(res.nextCwd, '/tmp');
});

test('executeTerminalCommand executes pwd and tracks cd into valid directories', async () => {
  const res1 = await executeTerminalCommand('pwd', '/app/applet');
  assert.equal(res1.ok, true);
  assert.equal(res1.exitCode, 0);
  assert.equal(res1.cwd, path.resolve('/app/applet'));

  const res2 = await executeTerminalCommand('cd src && pwd', '/app/applet');
  assert.equal(res2.ok, true);
  assert.equal(res2.cwd, path.resolve('/app/applet/src'));
  assert.equal(res2.stdout.trim(), path.resolve('/app/applet/src'));
});

test('executeTerminalCommand reports non-zero exit codes cleanly', async () => {
  const res = await executeTerminalCommand('ls /definitely-missing-path-xyz', '/app/applet');
  assert.equal(res.ok, false);
  assert.notEqual(res.exitCode, 0);
  assert.ok(res.stderr.length > 0);
});
