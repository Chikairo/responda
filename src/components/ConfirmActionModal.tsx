import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface ConfirmActionModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  defaultReason?: string;
  requireReason?: boolean;
  tone?: 'danger' | 'warning' | 'primary';
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

export function ConfirmActionModal({
  title,
  description,
  confirmLabel,
  reasonLabel = 'Reason for action (recorded in audit trail)',
  reasonPlaceholder = 'Enter a short summary of why this action is being confirmed...',
  defaultReason = '',
  requireReason = true,
  tone = 'warning',
  submitting = false,
  onCancel,
  onConfirm,
}: ConfirmActionModalProps) {
  const [reason, setReason] = useState(defaultReason);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, submitting]);

  const canSubmit = !submitting && (!requireReason || reason.trim().length > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-action-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onCancel();
        }
      }}
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-[var(--bg-overlay)] p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-floating)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
          <div className="flex items-center gap-2.5">
            <AlertTriangle
              className={`w-5 h-5 shrink-0 ${
                tone === 'danger'
                  ? 'text-[var(--status-critical-text)]'
                  : tone === 'warning'
                  ? 'text-[var(--status-urgent-text)]'
                  : 'text-[var(--action-blue)] dark:text-[#60A5FA]'
              }`}
            />
            <h2
              id="confirm-action-title"
              className="font-display text-sm font-bold text-[var(--text-primary)]"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel confirmation dialog"
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{description}</p>

          <div>
            <label
              htmlFor="confirm-action-reason"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
            >
              {reasonLabel}
            </label>
            <textarea
              id="confirm-action-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              className="w-full rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-focus)]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              disabled={submitting}
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-[var(--bg-surface-elevated)] hover:border-[var(--border-strong)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap shrink-0"
            >
              Go Back
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => onConfirm(reason.trim())}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-[var(--text-on-solid)] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 ${
                tone === 'danger'
                  ? 'bg-[var(--status-critical-accent)] hover:opacity-90'
                  : tone === 'warning'
                  ? 'bg-[#D97706] hover:bg-[#B45309]'
                  : 'bg-[var(--action-blue)] hover:bg-[var(--action-blue-hover)]'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Saving...' : confirmLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
