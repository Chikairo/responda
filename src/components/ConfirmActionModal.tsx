import React, { useState } from 'react';
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

  const canSubmit = !submitting && (!requireReason || reason.trim().length > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-action-title"
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#111C2E] border border-[#26364B] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#26364B] bg-[#0B1220]">
          <div className="flex items-center gap-2.5">
            <AlertTriangle
              className={`w-5 h-5 shrink-0 ${
                tone === 'danger'
                  ? 'text-red-400'
                  : tone === 'warning'
                  ? 'text-amber-400'
                  : 'text-blue-400'
              }`}
            />
            <h2
              id="confirm-action-title"
              className="font-display text-sm font-bold text-slate-50"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel confirmation dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#172438]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">{description}</p>

          <div>
            <label
              htmlFor="confirm-action-reason"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              {reasonLabel}
            </label>
            <textarea
              id="confirm-action-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              className="w-full rounded-xl bg-[#0B1220] border border-[#26364B] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[#26364B]">
            <button
              type="button"
              disabled={submitting}
              onClick={onCancel}
              className="px-4 py-2.5 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-xs font-semibold text-slate-200"
            >
              Go Back
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => onConfirm(reason.trim())}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-colors ${
                tone === 'danger'
                  ? 'bg-red-600 hover:bg-red-500'
                  : tone === 'warning'
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-blue-600 hover:bg-blue-500'
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
