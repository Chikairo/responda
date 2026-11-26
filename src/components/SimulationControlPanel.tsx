import React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  SimulationRuntimeState,
  SimulationScenarioId,
} from '../types/responda';
import {
  SIMULATION_SCENARIOS,
  SIMULATION_STAGES,
} from '../utils/simulationEngine';
import { SelectMenu } from './SelectMenu';

interface SimulationControlPanelProps {
  simState: SimulationRuntimeState;
  busy?: boolean;
  onPauseResume: () => void;
  onPrevStep?: () => void;
  onNextStep: () => void;
  onRestart: () => void;
  onEnd: () => void;
  onToggleAudio: () => void;
}

const PRESENTATION_STAGE_PIPS = [
  { step: 1, label: '1. Call' },
  { step: 2, label: '2. Intake' },
  { step: 3, label: '3. Location' },
  { step: 4, label: '4. Created' },
  { step: 5, label: '5. Takeover' },
  { step: 6, label: '6. Unit' },
  { step: 7, label: '7. Dispatch' },
  { step: 8, label: '8. Transport' },
  { step: 9, label: '9. Closure' },
];

export function SimulationControlPanel({
  simState,
  busy = false,
  onPauseResume,
  onPrevStep,
  onNextStep,
  onRestart,
  onEnd,
  onToggleAudio,
}: SimulationControlPanelProps) {
  if (!simState.active) return null;

  const scenario = SIMULATION_SCENARIOS[simState.scenarioId];
  const stageMeta =
    SIMULATION_STAGES.find((s) => s.stage === simState.stage) ||
    SIMULATION_STAGES[0];
  const progressPct = simState.completed
    ? 100
    : Math.round((simState.stage / 9) * 100);

  return (
    <div
      data-testid="simulation-control-panel"
      className="shrink-0 space-y-2 mb-4"
    >
      <div
        role="status"
        className="rounded-lg bg-[var(--status-critical-accent)] text-[var(--text-on-solid)] px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold"
      >
        <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 sm:mt-0" />
          <span className="leading-snug md:truncate">
            LIVE DEMO SIMULATION — SYNCED ACROSS OPERATIONAL VIEWS (NO REAL EMERGENCY SERVICES CONNECTED).
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] opacity-95 shrink-0">
          <span>{scenario.label}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{simState.incidentId || scenario.incidentId}</span>
        </div>
      </div>

      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] px-4 py-3 space-y-2.5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span className="font-mono font-semibold text-[var(--brand-teal)] tabular-nums">
                Stage {simState.stage} of 9
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
                  <span className="inline-flex items-center gap-1 text-[var(--brand-teal)] font-medium">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Speaking ({simState.speakingSpeaker || 'AUDIO'})</span>
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
                {simState.completed
                  ? 'Simulation Completed — Archived Read-Only in Incident History'
                  : `${stageMeta.stage}. ${stageMeta.title}`}
              </h2>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">
                Next action:{' '}
              </span>
              {simState.statusMessage || stageMeta.nextExpectedAction}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full xl:w-auto min-w-0">
            {!simState.completed && (
              <>
                {onPrevStep && (
                  <button
                    type="button"
                    disabled={busy || simState.stage <= 1}
                    onClick={onPrevStep}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-surface-elevated)] hover:border-[var(--border-strong)] disabled:opacity-45 border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap shrink-0 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onPauseResume}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-surface-elevated)] hover:border-[var(--border-strong)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap shrink-0 transition-colors"
                >
                  {simState.paused ? (
                    <>
                      <Play className="w-3.5 h-3.5 text-[var(--status-verified-text)]" />
                      <span>Resume</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5 text-[var(--status-urgent-text)]" />
                      <span>Pause</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={onNextStep}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--action-blue)] hover:bg-[var(--action-blue-hover)] disabled:opacity-50 text-xs font-semibold text-[var(--text-on-solid)] whitespace-nowrap shrink-0 transition-colors"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onToggleAudio}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-surface-elevated)] hover:border-[var(--border-strong)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap shrink-0 transition-colors"
            >
              {simState.audioEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-[var(--brand-teal)]" />
                  <span>Audio On</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>Audio Off</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={onRestart}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-surface-elevated)] hover:border-[var(--border-strong)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap shrink-0 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restart</span>
            </button>

            <button
              type="button"
              onClick={onEnd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--status-critical-bg)] hover:opacity-90 border border-[var(--status-critical-border)] text-xs font-semibold text-[var(--status-critical-text)] whitespace-nowrap shrink-0 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              <span>End Simulation</span>
            </button>
          </div>
        </div>

        <div className="space-y-1.5 pt-1.5 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <div className="hidden md:grid md:grid-cols-9 gap-1.5 flex-1 mr-4">
              {PRESENTATION_STAGE_PIPS.map((item) => {
                const done = simState.stage > item.step || simState.completed;
                const current = simState.stage === item.step && !simState.completed;
                return (
                  <div
                    key={item.step}
                    className={`px-2 py-1 rounded text-[11px] font-medium truncate border flex items-center gap-1 ${
                      done
                        ? 'bg-[var(--status-verified-bg)] border-[var(--status-verified-border)] text-[var(--status-verified-text)]'
                        : current
                        ? 'bg-[var(--action-blue)] border-[var(--action-blue)] text-[var(--text-on-solid)] font-semibold'
                        : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                    }`}
                  >
                    {done && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{item.label}</span>
                  </div>
                );
              })}
            </div>
            <span className="md:hidden font-medium text-[var(--text-primary)]">
              {stageMeta.shortLabel}
            </span>
            <span className="font-mono tabular-nums font-semibold text-[var(--text-primary)] shrink-0">
              {progressPct}%
            </span>
          </div>
        </div>

        {!simState.speechSupported && (
          <div className="text-[11px] text-[var(--status-urgent-text)] bg-[var(--status-urgent-bg)] border border-[var(--status-urgent-border)] rounded-lg px-3 py-1">
            Browser speech synthesis unavailable — live text transcript and call indicators remain active.
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
  const scenarioOptions = Object.values(SIMULATION_SCENARIOS).map((sc) => ({
    value: sc.id,
    label: sc.label,
    sublabel: sc.subtitle,
  }));

  return (
    <div className="flex flex-wrap md:flex-nowrap items-center gap-2 w-full md:w-auto">
      <SelectMenu<SimulationScenarioId>
        ariaLabel="Select simulation scenario"
        value={selectedScenario}
        options={scenarioOptions}
        onChange={onSelectScenario}
        className="w-full md:w-auto min-w-0"
        buttonClassName="bg-[var(--bg-surface)] py-2 font-medium w-full md:w-auto md:min-w-[240px]"
      />

      <button
        type="button"
        onClick={onToggleAudio}
        title="Toggle generated voice audio during simulation"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-surface-elevated)] hover:border-[var(--border-strong)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap shrink-0"
      >
        {audioEnabled ? (
          <>
            <Volume2 className="w-3.5 h-3.5 text-[var(--brand-teal)]" />
            <span>Audio On</span>
          </>
        ) : (
          <>
            <VolumeX className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>Audio Off</span>
          </>
        )}
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={onRunSimulation}
        data-testid="run-simulation-button"
        className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--action-blue)] hover:bg-[var(--action-blue-hover)] disabled:opacity-50 text-xs font-bold text-[var(--text-on-solid)] transition-colors whitespace-nowrap shrink-0"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>RUN SIMULATION</span>
      </button>
    </div>
  );
}
