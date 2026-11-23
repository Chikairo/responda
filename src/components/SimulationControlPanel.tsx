import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  LogOut,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  SimulationRuntimeState,
  SimulationScenarioId,
} from '../types/responda';
import {
  SIMULATION_SCENARIOS,
  SIMULATION_STAGES,
} from '../utils/simulationEngine';

interface SimulationControlPanelProps {
  simState: SimulationRuntimeState;
  immersiveOpen?: boolean;
  busy?: boolean;
  onPauseResume: () => void;
  onNextStep: () => void;
  onRestart: () => void;
  onExitWorkspace?: () => void;
  onReturnToWorkspace?: () => void;
  onEnd: () => void;
  onToggleAudio: () => void;
}

/**
 * Maps internal 10-step engine state into clear 9-stage judge presentation labels.
 */
export function getPresentationStageMeta(stage: SimulationRuntimeState['stage']): {
  stepNumber: number;
  totalSteps: number;
  title: string;
  explanation: string;
} {
  switch (stage) {
    case 1:
      return {
        stepNumber: 1,
        totalSteps: 9,
        title: 'Incoming Emergency Call',
        explanation: 'A simulated Lagos emergency call is ringing into Responda alongside live location intelligence.',
      };
    case 2:
    case 3:
      return {
        stepNumber: 2,
        totalSteps: 9,
        title: 'AI Conversation & Voice Intake',
        explanation: 'Responda AI asks adaptive triage questions, speaks responses, and structures caller details live.',
      };
    case 4:
      return {
        stepNumber: 3,
        totalSteps: 9,
        title: 'Location Resolution',
        explanation: 'Matching caller landmarks and Lagos coordinates while awaiting human operator verification.',
      };
    case 5:
      return {
        stepNumber: 4,
        totalSteps: 9,
        title: 'Human Operator Takeover',
        explanation: 'Structured incident created. Transferring workflow responsibility from AI intake to a human operator.',
      };
    case 6:
      return {
        stepNumber: 5,
        totalSteps: 9,
        title: 'Incident Review',
        explanation: 'Operator verifies location, hazards, priority, and transcript before selecting a response unit.',
      };
    case 7:
      return {
        stepNumber: 6,
        totalSteps: 9,
        title: 'Response Unit Selection',
        explanation: 'Comparing available Lagos units by proximity and capability for the verified scene.',
      };
    case 8:
      return {
        stepNumber: 7,
        totalSteps: 9,
        title: 'Dispatch Approval',
        explanation: 'Dedicated human authorization gate — explicit confirmation required before dispatch.',
      };
    case 9:
      return {
        stepNumber: 8,
        totalSteps: 9,
        title: 'Live Response Tracking',
        explanation: 'Tracking the approved unit advancing along the Lagos route from Assigned to On Scene.',
      };
    case 10:
      return {
        stepNumber: 9,
        totalSteps: 9,
        title: 'Arrival & Incident Closure',
        explanation: 'Unit has arrived On Scene. Operator reviews final summary and closes the incident.',
      };
  }
}

const PRESENTATION_STAGE_PIPS = [
  { step: 1, label: '1. Call' },
  { step: 2, label: '2. AI Intake' },
  { step: 3, label: '3. Location' },
  { step: 4, label: '4. Takeover' },
  { step: 5, label: '5. Review' },
  { step: 6, label: '6. Unit' },
  { step: 7, label: '7. Dispatch' },
  { step: 8, label: '8. Tracking' },
  { step: 9, label: '9. Closure' },
];

export function SimulationControlPanel({
  simState,
  immersiveOpen = true,
  busy = false,
  onPauseResume,
  onNextStep,
  onRestart,
  onExitWorkspace,
  onReturnToWorkspace,
  onEnd,
  onToggleAudio,
}: SimulationControlPanelProps) {
  if (!simState.active) return null;

  const scenario = SIMULATION_SCENARIOS[simState.scenarioId];
  const stageMeta =
    SIMULATION_STAGES.find((s) => s.stage === simState.stage) ||
    SIMULATION_STAGES[0];
  const presentation = getPresentationStageMeta(simState.stage);
  const progressPct = simState.completed
    ? 100
    : Math.round((presentation.stepNumber / presentation.totalSteps) * 100);

  // Compact resume bar when user exited the immersive simulation view to inspect regular views
  if (!immersiveOpen) {
    return (
      <div
        data-testid="simulation-minimized-bar"
        className="rounded-xl bg-white dark:bg-[#111C2E] border border-blue-200 dark:border-blue-500/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-red-600 dark:text-red-400">
            DEMO SIMULATION ACTIVE
          </span>
          <span className="text-slate-400" aria-hidden="true">·</span>
          <span className="font-mono text-slate-700 dark:text-slate-200 tabular-nums">
            Stage {presentation.stepNumber}/{presentation.totalSteps}: {presentation.title}
          </span>
          <span className="text-slate-400" aria-hidden="true">·</span>
          <span className="font-mono text-slate-500 dark:text-slate-400">
            {simState.incidentId || scenario.incidentId}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onReturnToWorkspace && (
            <button
              type="button"
              onClick={onReturnToWorkspace}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Return to Simulation Workspace</span>
            </button>
          )}
          <button
            type="button"
            onClick={onEnd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-500/15 dark:hover:bg-red-500/25 border border-red-200 dark:border-red-500/35 text-xs font-semibold text-red-700 dark:text-red-300 whitespace-nowrap shrink-0 transition-colors"
          >
            <Square className="w-3.5 h-3.5" />
            <span>End Simulation</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="simulation-control-panel"
      className="shrink-0 space-y-2"
    >
      {/* Persistent Safety Notice & Controls Header */}
      <div
        role="status"
        className="rounded-lg bg-red-600 text-white px-3.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold"
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            DEMO SIMULATION — NO REAL EMERGENCY SERVICES CONNECTED.
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] opacity-95 shrink-0">
          <span>{scenario.label}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{simState.incidentId || scenario.incidentId}</span>
        </div>
      </div>

      {/* Compact Stage Header & Toolbar */}
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] px-4 py-3 space-y-2.5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono font-semibold text-blue-700 dark:text-blue-400 tabular-nums">
                Stage {presentation.stepNumber} of {presentation.totalSteps}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {simState.completed
                  ? 'Completed'
                  : simState.paused
                  ? 'Paused'
                  : 'Running Automatically'}
              </span>
              {simState.audioPlaying && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-medium">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Speaking ({simState.speakingSpeaker || 'AUDIO'})</span>
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h1 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50">
                {simState.completed
                  ? 'Simulation Completed — Incident Closed'
                  : `${presentation.stepNumber}. ${presentation.title}`}
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-2xl">
                {presentation.explanation}
              </p>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Next action:{' '}
              </span>
              {simState.statusMessage || stageMeta.nextExpectedAction}
            </p>
          </div>

          {/* Demonstration Toolbar Controls */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {!simState.completed && (
              <>
                <button
                  type="button"
                  onClick={onPauseResume}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap shrink-0 transition-colors"
                >
                  {simState.paused ? (
                    <>
                      <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Resume</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Pause</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={onNextStep}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onToggleAudio}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap shrink-0 transition-colors"
            >
              {simState.audioEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Audio On</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Audio Off</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={onRestart}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap shrink-0 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restart</span>
            </button>

            {onExitWorkspace && (
              <button
                type="button"
                onClick={onExitWorkspace}
                data-testid="exit-simulation-button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap shrink-0 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Exit Simulation</span>
              </button>
            )}

            <button
              type="button"
              onClick={onEnd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-500/15 dark:hover:bg-red-500/25 border border-red-200 dark:border-red-500/35 text-xs font-semibold text-red-700 dark:text-red-300 whitespace-nowrap shrink-0 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              <span>End Simulation</span>
            </button>
          </div>
        </div>

        {/* Clean 9-Stage Progress Strip */}
        <div className="space-y-1.5 pt-1.5 border-t border-slate-200 dark:border-[#26364B]">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <div className="hidden md:grid md:grid-cols-9 gap-1.5 flex-1 mr-4">
              {PRESENTATION_STAGE_PIPS.map((item) => {
                const done =
                  presentation.stepNumber > item.step || simState.completed;
                const current =
                  presentation.stepNumber === item.step && !simState.completed;
                return (
                  <div
                    key={item.step}
                    className={`px-2 py-1 rounded text-[11px] font-medium truncate border flex items-center gap-1 ${
                      done
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/35 dark:text-emerald-300'
                        : current
                        ? 'bg-blue-600 border-blue-600 text-white font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-[#0B1220] dark:border-[#26364B] dark:text-slate-400'
                    }`}
                  >
                    {done && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{item.label}</span>
                  </div>
                );
              })}
            </div>
            <span className="md:hidden font-medium text-slate-700 dark:text-slate-200">
              {presentation.stepNumber}. {presentation.title}
            </span>
            <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200 shrink-0">
              {progressPct}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#0B1220] overflow-hidden md:hidden">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {!simState.speechSupported && (
          <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-1">
            Browser speech synthesis unavailable — live text transcript, speaker labels, and animated call indicators remain active.
          </div>
        )}
      </div>
    </div>
  );
}

interface SimulationLaunchTriggerProps {
  selectedScenario: SimulationScenarioId;
  onSelectScenario: (id: SimulationScenarioId) => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  onRunSimulation: () => void;
  disabled?: boolean;
}

export function SimulationLaunchBar({
  selectedScenario,
  onSelectScenario,
  audioEnabled,
  onToggleAudio,
  onRunSimulation,
  disabled = false,
}: SimulationLaunchTriggerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Select simulation scenario"
        value={selectedScenario}
        onChange={(e) => onSelectScenario(e.target.value as SimulationScenarioId)}
        className="rounded-lg bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
      >
        {Object.values(SIMULATION_SCENARIOS).map((sc) => (
          <option key={sc.id} value={sc.id}>
            {sc.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onToggleAudio}
        title="Toggle generated voice audio during simulation"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0"
      >
        {audioEnabled ? (
          <>
            <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Audio On</span>
          </>
        ) : (
          <>
            <VolumeX className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Audio Off</span>
          </>
        )}
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={onRunSimulation}
        data-testid="run-simulation-button"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white transition-colors whitespace-nowrap shrink-0 shadow-sm"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>RUN SIMULATION</span>
      </button>
    </div>
  );
}
