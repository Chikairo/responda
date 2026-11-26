import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, Truck, X } from 'lucide-react';
import type { IncidentRecord, ResponseUnit, RouteResult } from '../types/responda';
import { formatDistanceKm, formatDurationMinutes } from '../utils/incidentLogic';

interface DispatchConfirmModalProps {
  incident: IncidentRecord;
  unit: ResponseUnit;
  route: RouteResult | null;
  operatorName: string;
  submitting: boolean;
  onConfirm: (notes: string, notifySms: boolean) => void;
  onCancel: () => void;
}

export function DispatchConfirmModal({
  incident,
  unit,
  route,
  operatorName,
  submitting,
  onConfirm,
  onCancel,
}: DispatchConfirmModalProps) {
  const [notes, setNotes] = useState('');
  const [notifySms, setNotifySms] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, submitting]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispatch-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onCancel();
        }
      }}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[var(--bg-overlay)] p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-floating)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[var(--action-blue)] dark:text-[#60A5FA]" />
            <h2
              id="dispatch-modal-title"
              className="font-display text-base font-bold text-[var(--text-primary)]"
            >
              Confirm Human-Approved Medical Dispatch
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dispatch confirmation"
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] p-3.5 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[var(--text-secondary)]">Incident</span>
              <span className="font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                {incident.id} · {incident.category} ({incident.priority})
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-[var(--text-secondary)] shrink-0">Scene Destination</span>
              <span className="text-right text-[var(--text-primary)]">
                {incident.location.correctedDescription || incident.location.description}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[var(--text-secondary)]">Selected Unit</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--status-verified-text)]">
                <Truck className="w-4 h-4" />
                {unit.callsign} ({unit.unitType})
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-[var(--text-secondary)] shrink-0">
                Registration &amp; Base
              </span>
              <span className="text-right font-mono tabular-nums text-[var(--text-primary)]">
                {unit.vehicleRegistration} · {unit.operationalBase}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 text-xs">
              <span className="text-[var(--text-secondary)] shrink-0">
                Medical Capabilities
              </span>
              <span className="text-right text-[var(--text-primary)]">
                {unit.medicalCapabilities.join(', ')}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 text-xs">
              <span className="text-[var(--text-secondary)] shrink-0">Assigned Crew</span>
              <span className="text-right text-[var(--text-primary)]">
                {unit.crewDescription}
              </span>
            </div>
            {route && route.available && !route.isSimulatedFallback && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">
                  OpenRouteService Estimate
                </span>
                <span className="font-mono tabular-nums text-[var(--action-blue)] dark:text-[#60A5FA]">
                  {formatDistanceKm(route.distanceMeters)} ·{' '}
                  {formatDurationMinutes(route.durationSeconds)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)]">
              <span className="text-[var(--text-secondary)]">Authorising Staff</span>
              <span className="text-[var(--text-primary)] font-medium">{operatorName}</span>
            </div>
          </div>

          {incident.location.verificationStatus !== 'VERIFIED' && (
            <div className="flex items-start gap-2.5 rounded-xl bg-[var(--status-urgent-bg)] border border-[var(--status-urgent-border)] p-3 text-xs text-[var(--status-urgent-text)]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Location is currently marked UNVERIFIED ({incident.location.source}). Organisation policy may require verifying location before dispatch.
              </span>
            </div>
          )}

          <div>
            <label
              htmlFor="dispatch-notes"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Dispatch Instructions / Assignment Note (Recorded in Audit Trail)
            </label>
            <textarea
              id="dispatch-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Approach via Herbert Macaulay Way; prepare ALS trauma kit."
              className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-focus)]"
            />
          </div>

          <label className="flex items-start gap-2.5 text-xs text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={notifySms}
              onChange={(e) => setNotifySms(e.target.checked)}
              className="mt-0.5 rounded border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] accent-[var(--action-blue)]"
            />
            <span>
              Record unit dispatch alert in command notification log (logs a{' '}
              <strong className="text-[var(--status-urgent-text)]">Simulated Dispatch Alert</strong> — no real external dispatch sent).
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] transition-colors whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onConfirm(notes, notifySms)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--action-emerald)] hover:bg-[var(--action-emerald-hover)] disabled:opacity-60 text-sm font-semibold text-[var(--text-on-solid)] transition-colors whitespace-nowrap shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? 'Approving Dispatch...' : 'Approve & Dispatch Unit'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
