import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, Truck, X } from 'lucide-react';
import { IncidentRecord, ResponseUnit, RouteResult } from '../types/responda';
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispatch-modal-title"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 dark:bg-black/70 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-[#26364B]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 id="dispatch-modal-title" className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
              Confirm Human-Approved Dispatch
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dispatch confirmation"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-[#172438]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl bg-slate-50 dark:bg-[#172438] border border-slate-200 dark:border-[#26364B] p-3.5 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Incident</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {incident.id} · {incident.category} ({incident.priority})
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400 shrink-0">Destination</span>
              <span className="text-right text-slate-900 dark:text-slate-100">
                {incident.location.correctedDescription || incident.location.description}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Selected Unit</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                <Truck className="w-4 h-4" />
                {unit.callsign} ({unit.unitType})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Unit Base</span>
              <span className="text-slate-700 dark:text-slate-200">
                {unit.locationName}, {unit.area}
              </span>
            </div>
            {route && route.available && !route.isSimulatedFallback && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">OpenRouteService Estimate</span>
                <span className="font-mono text-blue-700 dark:text-blue-300">
                  {formatDistanceKm(route.distanceMeters)} · {formatDurationMinutes(route.durationSeconds)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Authorising Dispatcher</span>
              <span className="text-slate-900 dark:text-slate-100 font-medium">{operatorName}</span>
            </div>
          </div>

          {incident.location.verificationStatus !== 'VERIFIED' && (
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/35 p-3 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>
                Location is currently marked UNVERIFIED ({incident.location.source}). Verify on the Location tab if possible before or alongside dispatch.
              </span>
            </div>
          )}

          <div>
            <label
              htmlFor="dispatch-notes"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Dispatch Instructions / Assignment Note (Recorded in Audit Trail)
            </label>
            <textarea
              id="dispatch-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Approach via Herbert Macaulay Way; confirm gate access on arrival."
              className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={notifySms}
              onChange={(e) => setNotifySms(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 dark:border-[#26364B] bg-white dark:bg-[#0B1220] text-blue-600"
            />
            <span>
              Record unit dispatch alert in command notification log (logs a{' '}
              <strong className="text-amber-700 dark:text-amber-300">Simulated Dispatch Alert</strong> — no real external dispatch sent).
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-200 dark:border-[#26364B] bg-slate-50 dark:bg-[#0B1220]/50">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-[#26364B] bg-white dark:bg-transparent text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#172438] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onConfirm(notes, notifySms)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-sm font-semibold text-white transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? 'Approving Dispatch...' : 'Approve & Dispatch Unit'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
