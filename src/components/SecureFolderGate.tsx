import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import type { SecureFolderStatus, SecurePinActionResult } from '../../electron/types';

interface SecureFolderGateProps {
  status: SecureFolderStatus | null;
  onSetupPin: (pin: string) => Promise<SecurePinActionResult>;
  onUnlock: (pin: string) => Promise<SecurePinActionResult>;
  onForgotPinReset: () => Promise<SecurePinActionResult>;
}

function digitsOnlyFour(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4);
}

export const SecureFolderGate: React.FC<SecureFolderGateProps> = ({
  status,
  onSetupPin,
  onUnlock,
  onForgotPinReset,
}) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmForgotOpen, setConfirmForgotOpen] = useState(false);

  const isInitialized = Boolean(status?.initialized);
  const maxAttempts = status?.maxAttempts ?? 10;
  const remainingAttempts = status?.remainingAttempts ?? maxAttempts;
  const failedAttempts = status?.failedAttempts ?? 0;

  useEffect(() => {
    setPin('');
    setConfirmPin('');
    setErrorMsg(null);
    setConfirmForgotOpen(false);
  }, [isInitialized, status?.unlocked]);

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!/^\d{4}$/.test(pin)) {
      setErrorMsg('Enter a 4-digit numeric PIN (0-9).');
      return;
    }
    if (pin !== confirmPin) {
      setErrorMsg('PINs do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await onSetupPin(pin);
      if (!res.ok) {
        setErrorMsg(res.message || 'Could not create PIN.');
      } else {
        setPin('');
        setConfirmPin('');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!/^\d{4}$/.test(pin)) {
      setErrorMsg('Enter your 4-digit PIN.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await onUnlock(pin);
      setPin('');
      if (!res.ok) {
        setErrorMsg(res.message || 'Incorrect PIN.');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotConfirm = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onForgotPinReset();
      setPin('');
      setConfirmPin('');
      setConfirmForgotOpen(false);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl space-y-5">
      <div className="flex items-start gap-3.5">
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
            isInitialized ? 'bg-amber-500/15 text-amber-500' : 'bg-blue-500/15 text-blue-500'
          }`}
        >
          {isInitialized ? <Lock className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--win-text)]">
            {isInitialized ? 'Secure Folder is Locked' : 'Set Up Secure Folder'}
          </h3>
          <p className="mt-1 text-xs text-[var(--win-text-muted)] leading-relaxed">
            {isInitialized
              ? 'Enter your 4-digit PIN to unlock and view your protected files.'
              : 'Create a 4-digit PIN to protect this folder. After 10 failed attempts or a PIN reset, the folder is automatically cleared.'}
          </p>
        </div>
      </div>

      {!isInitialized && status?.lastWipeReason === 'max-attempts' && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400"
        >
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            10 failed PIN attempts were reached. All files in Secure Folder were permanently cleared
            and the old PIN was erased. Create a new 4-digit PIN to start fresh.
          </span>
        </div>
      )}

      {!isInitialized && status?.lastWipeReason === 'forgot-pin' && (
        <div
          role="status"
          className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Secure Folder was cleared because you reset a forgotten PIN. Enter a new 4-digit PIN to
            begin using it again.
          </span>
        </div>
      )}

      {!isInitialized ? (
        <form onSubmit={handleSetupSubmit} className="space-y-3.5 text-xs">
          <div>
            <label htmlFor="secure-setup-pin" className="block text-[var(--win-text-muted)] mb-1">
              New 4-digit PIN
            </label>
            <div className="relative">
              <input
                id="secure-setup-pin"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={4}
                autoFocus
                value={pin}
                onChange={(e) => setPin(digitsOnlyFour(e.target.value))}
                placeholder="••••"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)] text-sm tracking-[0.45em] font-mono-tabular text-[var(--win-text)] focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPin((s) => !s)}
                aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[var(--win-text-muted)] hover:text-[var(--win-text)]"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="secure-confirm-pin" className="block text-[var(--win-text-muted)] mb-1">
              Confirm 4-digit PIN
            </label>
            <input
              id="secure-confirm-pin"
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(digitsOnlyFour(e.target.value))}
              placeholder="••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)] text-sm tracking-[0.45em] font-mono-tabular text-[var(--win-text)] focus:outline-none focus:border-blue-500"
            />
          </div>

          {errorMsg && (
            <p role="alert" className="text-xs text-rose-400">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || pin.length !== 4 || confirmPin.length !== 4}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-45 text-white font-semibold transition-colors"
          >
            {submitting ? 'Creating PIN...' : 'Create PIN & Open Secure Folder'}
          </button>
        </form>
      ) : confirmForgotOpen ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-3 text-xs">
          <div className="flex items-start gap-2.5 text-rose-400">
            <Trash2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Reset PIN & Permanently Clear Folder?</p>
              <p className="mt-1 text-[var(--win-text-muted)] leading-relaxed">
                If you forgot your PIN, all files and folders stored inside Secure Folder will be
                permanently deleted and you will start over with a new 4-digit PIN.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setConfirmForgotOpen(false)}
              className="px-3.5 py-2 rounded-xl bg-[var(--win-control)] hover:bg-[var(--win-hover)] text-[var(--win-text)] font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleForgotConfirm}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold"
            >
              {submitting ? 'Clearing...' : 'Clear Folder & Set New PIN'}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleUnlockSubmit} className="space-y-3.5 text-xs">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--win-text-muted)]">4-digit PIN</span>
            <span
              className={`font-mono-tabular font-medium ${
                remainingAttempts <= 3
                  ? 'text-rose-400'
                  : failedAttempts > 0
                    ? 'text-amber-400'
                    : 'text-[var(--win-text-faint)]'
              }`}
            >
              {remainingAttempts} of {maxAttempts} attempts remaining
            </span>
          </div>

          <div className="relative">
            <input
              id="secure-unlock-pin"
              aria-label="Enter 4-digit PIN"
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={4}
              autoFocus
              value={pin}
              onChange={(e) => setPin(digitsOnlyFour(e.target.value))}
              placeholder="••••"
              className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)] text-sm tracking-[0.45em] font-mono-tabular text-[var(--win-text)] focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPin((s) => !s)}
              aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[var(--win-text-muted)] hover:text-[var(--win-text)]"
            >
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {errorMsg && (
            <p role="alert" className="text-xs text-rose-400">
              {errorMsg}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => setConfirmForgotOpen(true)}
              className="text-xs text-[var(--win-text-muted)] hover:text-rose-400 transition-colors"
            >
              Forgot PIN?
            </button>
            <button
              type="submit"
              disabled={submitting || pin.length !== 4}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-45 text-white font-semibold transition-colors"
            >
              {submitting ? 'Unlocking...' : 'Unlock'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

interface ChangeSecurePinModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (currentPin: string, newPin: string) => Promise<SecurePinActionResult>;
}

export const ChangeSecurePinModal: React.FC<ChangeSecurePinModalProps> = ({
  open,
  onClose,
  onConfirm,
}) => {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setErrorMsg(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!/^\d{4}$/.test(currentPin) || !/^\d{4}$/.test(newPin)) {
      setErrorMsg('Both current and new PINs must be 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMsg('New PIN confirmation does not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await onConfirm(currentPin, newPin);
      if (res.ok || res.wiped) {
        onClose();
      } else {
        setErrorMsg(res.message || 'Could not change PIN.');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-pin-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl p-5 text-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <h2 id="change-pin-title" className="text-sm font-semibold text-[var(--win-text)]">
              Change Secure Folder PIN
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close change PIN dialog"
            className="p-1.5 rounded-xl text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="pin-current" className="block text-[var(--win-text-muted)] mb-1">
              Current 4-digit PIN
            </label>
            <input
              id="pin-current"
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoFocus
              value={currentPin}
              onChange={(e) => setCurrentPin(digitsOnlyFour(e.target.value))}
              placeholder="••••"
              className="w-full px-3 py-2 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)] font-mono-tabular tracking-[0.4em] text-[var(--win-text)]"
            />
          </div>
          <div>
            <label htmlFor="pin-new" className="block text-[var(--win-text-muted)] mb-1">
              New 4-digit PIN
            </label>
            <input
              id="pin-new"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(digitsOnlyFour(e.target.value))}
              placeholder="••••"
              className="w-full px-3 py-2 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)] font-mono-tabular tracking-[0.4em] text-[var(--win-text)]"
            />
          </div>
          <div>
            <label htmlFor="pin-confirm" className="block text-[var(--win-text-muted)] mb-1">
              Confirm New 4-digit PIN
            </label>
            <input
              id="pin-confirm"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(digitsOnlyFour(e.target.value))}
              placeholder="••••"
              className="w-full px-3 py-2 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)] font-mono-tabular tracking-[0.4em] text-[var(--win-text)]"
            />
          </div>
          {errorMsg && (
            <p role="alert" className="text-rose-400">
              {errorMsg}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[var(--win-text-muted)] hover:bg-[var(--win-hover)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              submitting || currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4
            }
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-45 text-white font-semibold"
          >
            {submitting ? 'Updating...' : 'Update PIN'}
          </button>
        </div>
      </form>
    </div>
  );
};
