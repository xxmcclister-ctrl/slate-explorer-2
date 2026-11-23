import { exec } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { TerminalExecResult } from './types.ts';

const execAsync = promisify(exec);
const CWD_SENTINEL = '__SLATE_TERM_CWD__';

export function resolveBaseCwd(requestedCwd?: string): string {
  const fallback = os.homedir() || process.cwd();
  const trimmed = (requestedCwd || '').trim();
  if (!trimmed || trimmed.toLowerCase().startsWith('shell:')) {
    return fallback;
  }
  try {
    const resolved = path.resolve(trimmed);
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) return resolved;
  } catch {
    // fall back below
  }
  return fallback;
}

export function stripCwdSentinel(stdout: string, fallbackCwd: string): {
  cleanedStdout: string;
  nextCwd: string;
} {
  const idx = stdout.lastIndexOf(CWD_SENTINEL);
  if (idx === -1) {
    return { cleanedStdout: stdout, nextCwd: fallbackCwd };
  }
  const before = stdout.slice(0, idx).replace(/\r?\n$/, '');
  const after = stdout.slice(idx + CWD_SENTINEL.length).trim();
  const nextCwd = after ? after.split(/\r?\n/)[0].trim() : fallbackCwd;
  return {
    cleanedStdout: before,
    nextCwd: nextCwd || fallbackCwd,
  };
}

export async function executeTerminalCommand(
  rawCommand: string,
  requestedCwd?: string,
): Promise<TerminalExecResult> {
  const cwd = resolveBaseCwd(requestedCwd);
  const command = (rawCommand || '').trim();
  if (!command) {
    return { ok: true, stdout: '', stderr: '', exitCode: 0, cwd };
  }

  if (process.platform === 'win32') {
    const wrapped = `${command} & echo ${CWD_SENTINEL}%CD%`;
    try {
      const { stdout, stderr } = await execAsync(wrapped, {
        cwd,
        timeout: 15000,
        maxBuffer: 512 * 1024,
        shell: 'cmd.exe',
      });
      const { cleanedStdout, nextCwd } = stripCwdSentinel(stdout, cwd);
      return {
        ok: true,
        stdout: cleanedStdout,
        stderr: stderr.replace(/\r?\n$/, ''),
        exitCode: 0,
        cwd: nextCwd,
      };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string; code?: number };
      const { cleanedStdout, nextCwd } = stripCwdSentinel(String(e.stdout || ''), cwd);
      return {
        ok: false,
        stdout: cleanedStdout,
        stderr: String(e.stderr || e.message || 'Command failed').replace(/\r?\n$/, ''),
        exitCode: typeof e.code === 'number' ? e.code : 1,
        cwd: nextCwd,
      };
    }
  }

  // POSIX shell: run command, capture exit status, then emit tracked pwd even if cd ran
  const wrappedPosix = `${command}\n__ec=$?\nprintf '\\n%s%s\\n' '${CWD_SENTINEL}' "$(pwd)"\nexit $__ec`;
  try {
    const { stdout, stderr } = await execAsync(wrappedPosix, {
      cwd,
      timeout: 15000,
      maxBuffer: 512 * 1024,
      shell: '/bin/bash',
    });
    const { cleanedStdout, nextCwd } = stripCwdSentinel(stdout, cwd);
    return {
      ok: true,
      stdout: cleanedStdout,
      stderr: stderr.replace(/\r?\n$/, ''),
      exitCode: 0,
      cwd: nextCwd,
    };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string; code?: number };
    const { cleanedStdout, nextCwd } = stripCwdSentinel(String(e.stdout || ''), cwd);
    return {
      ok: false,
      stdout: cleanedStdout,
      stderr: String(e.stderr || e.message || 'Command failed').replace(/\r?\n$/, ''),
      exitCode: typeof e.code === 'number' ? e.code : 1,
      cwd: nextCwd,
    };
  }
}
