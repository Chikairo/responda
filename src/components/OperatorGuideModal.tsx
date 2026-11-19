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

const WORKFLOW_OVERVIEW = [
  { step: '1. New Incident', detail: 'An emergency report arrives from AI Intake or a human operator.' },
  { step: '2. Gather Information', detail: 'AI captures category, people affected, and danger clues calmly.' },
  { step: '3. Verify Location', detail: 'Operator confirms the exact Lagos street, landmark, and map pin.' },
  { step: '4. Review Incident', detail: 'Operator takes over control to check priority and missing details.' },
  { step: '5. Select Unit', detail: 'Compare available Lagos ambulances, patrol, or rescue units.' },
  { step: '6. Approve Dispatch', detail: 'A human dispatcher confirms the unit assignment—AI never dispatches alone.' },
  { step: '7. Track Response', detail: 'Follow unit acknowledgement, en-route status, and arrival on scene.' },
  { step: '8. Close Incident', detail: 'Confirm outcome with a short reason and archive the full audit log.' },
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
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 p-4"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-[#111C2E] border border-[#26364B] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#26364B] bg-[#0B1220]">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <h2
                id="operator-guide-title"
                className="font-display text-base font-bold text-slate-50"
              >
                First-Time Operator Guide
              </h2>
              <p className="text-xs text-slate-400">
                Everything you need to orient yourself quickly under pressure
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close operator guide"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#172438]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* 3 Core Questions */}
          <section className="space-y-2.5">
            <h3 className="font-display text-sm font-bold text-slate-100">
              Every Screen Answers Three Questions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl bg-[#0B1220] border border-[#26364B] p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-blue-300">
                  <Compass className="w-4 h-4" />
                  <span>1. What is happening?</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Top counts, map pins, and status badges show active incidents and available units at a glance.
                </p>
              </div>
              <div className="rounded-xl bg-[#0B1220] border border-[#26364B] p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                  <UserCheck className="w-4 h-4" />
                  <span>2. What needs my attention?</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  The Situation Briefing highlights critical calls waiting for human takeover or unverified locations.
                </p>
              </div>
              <div className="rounded-xl bg-[#0B1220] border border-[#26364B] p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-300">
                  <Truck className="w-4 h-4" />
                  <span>3. What should I do next?</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Inside any incident, the 8-step bar highlights the exact current step and offers a 1-click next action.
                </p>
              </div>
            </div>
          </section>

          {/* 8-Step Guided Operational Workflow */}
          <section className="space-y-2.5">
            <h3 className="font-display text-sm font-bold text-slate-100">
              8-Step Guided Operational Workflow
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {WORKFLOW_OVERVIEW.map((item) => (
                <div
                  key={item.step}
                  className="rounded-xl bg-[#0B1220] border border-[#26364B] p-3 flex items-start gap-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-slate-100">{item.step}</div>
                    <p className="text-slate-400 mt-0.5 leading-snug">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Human Control Safety Principle */}
          <section className="rounded-xl bg-emerald-500/10 border border-emerald-500/35 p-3.5 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-emerald-200">
                Human-Controlled Safety Rule
              </div>
              <p className="text-slate-300 leading-relaxed">
                AI assists with calm caller intake and priority suggestions, but never dispatches response units, never verifies locations automatically from GPS alone, and never closes an incident without explicit human confirmation.
              </p>
            </div>
          </section>
        </div>

        <div className="px-5 py-3.5 border-t border-[#26364B] bg-[#0B1220] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onStartDemoScenario();
            }}
            className="px-4 py-2 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-xs font-semibold text-blue-300"
          >
            Try Guided Demo Scenario
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
