import React from 'react';
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
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="operator-guide-title"
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/50 dark:bg-black/75 p-4"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-[#26364B] bg-slate-50 dark:bg-[#0B1220]">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <h2
                id="operator-guide-title"
                className="font-display text-base font-bold text-slate-900 dark:text-slate-50"
              >
                Operations Staff Quick Guide
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Medical emergency dispatch workflow across 5 structured milestones
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close operator guide"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#172438]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          <section className="space-y-2.5">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              Every Screen Answers Three Questions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-300">
                  <Compass className="w-4 h-4" />
                  <span>1. What is happening?</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Command Centre KPIs, Lagos map markers, and unit badges show open medical emergencies and available fleet.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                  <UserCheck className="w-4 h-4" />
                  <span>2. What needs my attention?</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Unassessed incidents, new calls waiting for takeover, and unverified locations are highlighted first.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                  <Truck className="w-4 h-4" />
                  <span>3. What should I do next?</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Inside Incident Management, the 5-milestone bar guides you directly to the next required human decision.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-2.5">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              5 Grouped Incident Milestones
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {WORKFLOW_MILESTONES.map((item) => (
                <div
                  key={item.step}
                  className="rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 flex items-start gap-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{item.step}</div>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/35 p-3.5 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-emerald-800 dark:text-emerald-200">
                Human-Controlled Medical Safety Rule
              </div>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                AI assists with caller triage and flags incomplete information as Unassessed, but never dispatches medical units, never auto-verifies coordinates, and never chooses hospitals without human confirmation.
              </p>
            </div>
          </section>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-[#26364B] bg-slate-50 dark:bg-[#0B1220] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onStartDemoScenario();
            }}
            className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-blue-700 dark:text-blue-300"
          >
            Run 9-Stage Live Simulation
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
          >
            Got It — Return to Operations
          </button>
        </div>
      </div>
    </div>
  );
}
