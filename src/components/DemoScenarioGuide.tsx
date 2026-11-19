import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Play,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';

export interface DemoStepInfo {
  step: number;
  title: string;
  detail: string;
  actionLabel: string;
}

export const DEMO_SCENARIO_STEPS: DemoStepInfo[] = [
  {
    step: 1,
    title: 'Caller Begins AI Intake (Yaba Road Accident)',
    detail:
      'Simulated caller opens Responda AI Intake reporting a road accident in Yaba where two people may be injured.',
    actionLabel: 'Start Simulated Intake Turn',
  },
  {
    step: 2,
    title: 'Caller Provides Landmark Description (Unverified)',
    detail:
      'Caller is unsure of the exact street number and describes "near UNILAG main gate / Sabo bus stop". System marks location CALLER_DESCRIPTION · UNVERIFIED.',
    actionLabel: 'Submit Landmark & Create Incident',
  },
  {
    step: 3,
    title: 'Human Operator Takes Over',
    detail:
      'Incident appears on the Command Centre. Human operator clicks Take Over — halting AI intake and transitioning status to UNDER_REVIEW.',
    actionLabel: 'Execute Human Takeover',
  },
  {
    step: 4,
    title: 'Operator Verifies Location',
    detail:
      'Operator confirms coordinates on the Yaba map pin and updates status to OPERATOR_VERIFIED → VERIFIED.',
    actionLabel: 'Verify Yaba Location',
  },
  {
    step: 5,
    title: 'Human-Approved Ambulance Dispatch',
    detail:
      'Dispatcher selects available Ambulance unit (Yaba Trauma-2) and confirms human-approved assignment.',
    actionLabel: 'Approve Ambulance Dispatch',
  },
  {
    step: 6,
    title: 'Simulated Unit Acknowledgement & En Route',
    detail:
      'Unit transitions to ACKNOWLEDGED and EN_ROUTE in simulated demo mode. All events persist in the incident timeline.',
    actionLabel: 'Simulate Ack & En Route',
  },
];

interface DemoScenarioGuideProps {
  active: boolean;
  currentStep: number;
  busy: boolean;
  demoIncidentId: string | null;
  onAdvanceStep: () => void;
  onRunAllSteps: () => void;
  onResetDemo: () => void;
  onClose: () => void;
}

export function DemoScenarioGuide({
  active,
  currentStep,
  busy,
  demoIncidentId,
  onAdvanceStep,
  onRunAllSteps,
  onResetDemo,
  onClose,
}: DemoScenarioGuideProps) {
  if (!active) return null;

  const completed = currentStep > DEMO_SCENARIO_STEPS.length;
  const info = DEMO_SCENARIO_STEPS[Math.min(currentStep - 1, DEMO_SCENARIO_STEPS.length - 1)];

  return (
    <div
      data-testid="demo-scenario-guide"
      className="rounded-xl bg-[#111C2E] border border-blue-500/40 p-4 shadow-lg"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-blue-400">
              <Sparkles className="w-3.5 h-3.5" />
              Guided Competition Demo Scenario
            </span>
            <span className="text-slate-500">·</span>
            <span className="font-mono text-amber-300">SIMULATED SCENARIO</span>
            {demoIncidentId && (
              <>
                <span className="text-slate-500">·</span>
                <span className="font-mono text-slate-200">{demoIncidentId}</span>
              </>
            )}
          </div>
          {completed ? (
            <div>
              <h3 className="font-display text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Demo Scenario Completed — Unit En Route (Simulated)
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Full workflow from AI intake → human takeover → location verification → human-approved ambulance dispatch → simulated unit en route is recorded and persisted across refresh.
              </p>
            </div>
          ) : (
            <div>
              <h3 className="font-display text-sm font-bold text-slate-50">
                Step {info.step} of {DEMO_SCENARIO_STEPS.length}: {info.title}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">{info.detail}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!completed && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onAdvanceStep}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors whitespace-nowrap"
              >
                <span>{busy ? 'Running...' : info.actionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onRunAllSteps}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>Auto-Complete</span>
              </button>
            </>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={onResetDemo}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-xs font-medium text-slate-300 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Data</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close demo guide"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#172438]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Step Progress Strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mt-3 pt-3 border-t border-[#26364B]">
        {DEMO_SCENARIO_STEPS.map((s) => {
          const done = currentStep > s.step;
          const activeStep = currentStep === s.step;
          return (
            <div
              key={s.step}
              className={`px-2 py-1 rounded text-[11px] font-medium truncate ${
                done
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : activeStep
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'bg-[#0B1220] text-slate-500 border border-[#26364B]'
              }`}
            >
              {s.step}. {s.title.split(' ')[0]} {s.title.split(' ')[1]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
