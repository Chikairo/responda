import React, { useEffect } from 'react';
import {
  CheckCircle2,
  Compass,
  HelpCircle,
  ShieldCheck,
  Truck,
  UserCheck,
  X,
} from 'lucide-react';

interface OperatorGuideModalProps {
  onClose: () => void;
  onStartDemoScenario: () => void;
}

const WORKFLOW_MILESTONES = [
  {
    step: '1. Report and Intake',
    detail: 'Medical report arrives via AI intake or operator entry; review caller transcript and symptoms.',
  },
  {
    step: '2. Assessment and Verification',
    detail: 'Human Operations Staff take over, assess clinical priority (flagging Unassessed cases), and verify the Lagos location.',
  },
  {
    step: '3. Unit Dispatch',
    detail: 'Compare active ambulances and rapid medical units by medical capabilities and distance, then approve dispatch.',
  },
  {
    step: '4. Response and Transport',
    detail: 'Track unit arrival at scene, patient pickup, receiving hospital selection & confirmation, and transport arrival.',
  },
  {
    step: '5. Closure',
    detail: 'Record patient outcome summary, release unit back to Available, and archive permanently in Incident History.',
  },
];

export function OperatorGuideModal({
  onClose,
  onStartDemoScenario,
}: OperatorGuideModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="operator-guide-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-[var(--bg-overlay)] p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-floating)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-[var(--action-blue)] dark:text-[#60A5FA] shrink-0" />
            <div>
              <h2
                id="operator-guide-title"
                className="font-display text-base font-bold text-[var(--text-primary)]"
              >
                Operations Staff Quick Guide
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Medical emergency dispatch workflow across 5 structured milestones
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close operator guide"
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          <section className="space-y-2.5">
            <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
              Every Screen Answers Three Questions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-[var(--action-blue)] dark:text-[#60A5FA]">
                  <Compass className="w-4 h-4" />
                  <span>1. What is happening?</span>
                </div>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  Command Centre KPIs, Lagos map markers, and unit badges show open medical emergencies and available fleet.
                </p>
              </div>
              <div className="rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-[var(--status-urgent-text)]">
                  <UserCheck className="w-4 h-4" />
                  <span>2. What needs my attention?</span>
                </div>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  Unassessed incidents, new calls waiting for takeover, and unverified locations are highlighted first.
                </p>
              </div>
              <div className="rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-[var(--status-verified-text)]">
                  <Truck className="w-4 h-4" />
                  <span>3. What should I do next?</span>
                </div>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  Inside Incident Management, the 5-milestone bar guides you directly to the next required human decision.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-2.5">
            <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
              5 Grouped Incident Milestones
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {WORKFLOW_MILESTONES.map((item) => (
                <div
                  key={item.step}
                  className="rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] p-3 flex items-start gap-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-[var(--brand-teal)] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-[var(--text-primary)]">{item.step}</div>
                    <p className="text-[var(--text-secondary)] mt-0.5 leading-snug">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl bg-[var(--status-verified-bg)] border border-[var(--status-verified-border)] p-3.5 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[var(--status-verified-text)] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-[var(--status-verified-text)]">
                Human-Controlled Medical Safety Rule
              </div>
              <p className="text-[var(--text-primary)] leading-relaxed">
                AI assists with caller triage and flags incomplete information as Unassessed, but never dispatches medical units, never auto-verifies coordinates, and never chooses hospitals without human confirmation.
              </p>
            </div>
          </section>
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onStartDemoScenario();
            }}
            className="px-4 py-2 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--action-blue)] dark:text-[#60A5FA] whitespace-nowrap shrink-0"
          >
            Run 9-Stage Live Simulation
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[var(--action-blue)] hover:bg-[var(--action-blue-hover)] text-xs font-semibold text-[var(--text-on-solid)] whitespace-nowrap shrink-0"
          >
            Got It — Return to Operations
          </button>
        </div>
      </div>
    </div>
  );
}
