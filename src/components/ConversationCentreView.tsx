import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Headphones,
  Info,
  MapPin,
  Mic,
  Pause,
  PhoneCall,
  Play,
  Radio,
  RotateCcw,
  RotateCw,
  Send,
  ShieldAlert,
  UserCheck,
  Volume2,
} from 'lucide-react';
import {
  IncidentRecord,
  IntegrationStatus,
  ResponseUnit,
  SimulationRuntimeState,
  UserRole,
} from '../types/responda';
import {
  buildAiCallSummary,
  computeIntakeCompleteness,
  computeTalkRatio,
  extractKeyTopics,
  formatSecondsClock,
} from '../utils/conversationIntelligence';
import { canTakeOver, formatRelativeTime } from '../utils/incidentLogic';
import { SIMULATION_SCENARIOS } from '../utils/simulationEngine';
import {
  IncidentStatusBadge,
  LocationSourceBadge,
  PriorityBadge,
  VerificationBadge,
} from './StatusBadges';

export type WorkflowDestinationTab =
  | 'overview'
  | 'location'
  | 'units'
  | 'transcript'
  | 'timeline';

interface ConversationCentreViewProps {
  incidents: IncidentRecord[];
  units: ResponseUnit[];
  integrations: IntegrationStatus[];
  selectedIncidentId: string | null;
  userRole: UserRole;
  operatorName: string;
  simState?: SimulationRuntimeState;
  onAnswerSimCall?: () => void;
  onToggleSimAudio?: () => void;
  onToggleSimPause?: () => void;
  onSelectIncident: (id: string) => void;
  onTakeOver: (id: string) => Promise<void>;
  onSendOperatorMessage: (id: string, text: string) => Promise<void>;
  onAddNote: (id: string, text: string) => Promise<void>;
  onOpenIncidentTab: (id: string, tab: WorkflowDestinationTab) => void;
}

export function ConversationCentreView({
  incidents,
  units,
  integrations,
  selectedIncidentId,
  userRole,
  operatorName,
  simState,
  onAnswerSimCall,
  onToggleSimAudio,
  onToggleSimPause,
  onSelectIncident,
  onTakeOver,
  onSendOperatorMessage,
  onAddNote,
  onOpenIncidentTab,
}: ConversationCentreViewProps) {
  const [queueFilter, setQueueFilter] = useState<'ALL' | 'AI_ACTIVE' | 'HUMAN' | 'STORED'>('ALL');
  const [busy, setBusy] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [noteText, setNoteText] = useState('');

  // Audio Playback State (Simulated / Web Speech API playback for transcript)
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSec, setPlaybackSec] = useState(0);
  const [voiceReadAloud, setVoiceReadAloud] = useState(false);

  const filteredQueue = useMemo(() => {
    return incidents.filter((inc) => {
      const isClosed = inc.status === 'RESOLVED' || inc.status === 'CLOSED';
      const isHuman = Boolean(inc.assignedOperator) || !inc.aiIntakeActive;
      if (queueFilter === 'AI_ACTIVE') return inc.aiIntakeActive && !isClosed;
      if (queueFilter === 'HUMAN') return isHuman && !isClosed;
      if (queueFilter === 'STORED') return isClosed;
      return true;
    });
  }, [incidents, queueFilter]);

  const activeIncident = useMemo(() => {
    if (selectedIncidentId) {
      const match = incidents.find((i) => i.id === selectedIncidentId);
      if (match) return match;
    }
    return filteredQueue[0] || incidents[0] || null;
  }, [incidents, filteredQueue, selectedIncidentId]);

  const talkRatio = useMemo(
    () => computeTalkRatio(activeIncident?.transcript || []),
    [activeIncident?.transcript]
  );

  const completeness = useMemo(
    () => (activeIncident ? computeIntakeCompleteness(activeIncident) : null),
    [activeIncident]
  );

  const aiSummary = useMemo(
    () => (activeIncident ? buildAiCallSummary(activeIncident) : null),
    [activeIncident]
  );

  const keyTopics = useMemo(
    () => (activeIncident ? extractKeyTopics(activeIncident) : []),
    [activeIncident]
  );

  const voiceAdapter = integrations.find((i) => i.id === 'voice_telephony');
  const realTelephonyConfigured = voiceAdapter?.configured ?? false;
  const simScenario = simState?.active
    ? SIMULATION_SCENARIOS[simState.scenarioId]
    : null;
  const isIncomingSimCall = Boolean(
    simState?.active && simState.callStatus === 'INCOMING' && simScenario
  );

  // Reset audio playback when switching incidents
  useEffect(() => {
    setIsPlaying(false);
    setPlaybackSec(0);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [activeIncident?.id]);

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying || talkRatio.estimatedDurationSec <= 0) return;
    const timer = window.setInterval(() => {
      setPlaybackSec((prev) => {
        if (prev + 1 >= talkRatio.estimatedDurationSec) {
          setIsPlaying(false);
          return talkRatio.estimatedDurationSec;
        }
        return prev + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isPlaying, talkRatio.estimatedDurationSec]);

  // Identify current highlighted transcript turn during playback
  const activeTurnId = useMemo(() => {
    if (playbackSec === 0 && !isPlaying) return null;
    const match = talkRatio.turnWindows.find(
      (w) => playbackSec >= w.startSec && playbackSec < w.endSec
    );
    return match?.id || null;
  }, [playbackSec, isPlaying, talkRatio.turnWindows]);

  // Optional browser SpeechSynthesis read-aloud for the active turn
  useEffect(() => {
    if (
      !isPlaying ||
      !voiceReadAloud ||
      !activeTurnId ||
      !activeIncident ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      return;
    }
    const turn = activeIncident.transcript.find((t) => t.id === activeTurnId);
    if (!turn) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(turn.text);
    utter.rate = 1.05;
    window.speechSynthesis.speak(utter);
  }, [activeTurnId, isPlaying, voiceReadAloud, activeIncident]);

  if (!activeIncident || !completeness || !aiSummary) {
    return (
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-10 text-center space-y-2 shadow-2xs dark:shadow-none">
        <Headphones className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          No call or conversation sessions recorded yet
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Start an AI Intake session or trigger the Demo Scenario to inspect live transcripts and conversation intelligence.
        </p>
      </div>
    );
  }

  const isClosed =
    activeIncident.status === 'RESOLVED' || activeIncident.status === 'CLOSED';
  const isHumanTakenOver =
    Boolean(activeIncident.assignedOperator) || !activeIncident.aiIntakeActive;
  const isLiveSession = !isClosed;
  const assignedUnit = activeIncident.assignedUnitId
    ? units.find((u) => u.id === activeIncident.assignedUnitId) || null
    : null;

  const callStatusLabel = isClosed
    ? 'Call Ended · Stored Record'
    : isHumanTakenOver
    ? 'Human Operator Connected'
    : 'AI Intake Active · Awaiting Takeover';

  const handleTogglePlay = () => {
    if (talkRatio.estimatedDurationSec === 0) return;
    if (playbackSec >= talkRatio.estimatedDurationSec) {
      setPlaybackSec(0);
    }
    setIsPlaying((prev) => {
      const next = !prev;
      if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  const handleSeekOffset = (deltaSec: number) => {
    setPlaybackSec((prev) =>
      Math.max(0, Math.min(talkRatio.estimatedDurationSec, prev + deltaSec))
    );
  };

  return (
    <div className="space-y-4">
      {/* Stage 1 Simulated Incoming Emergency Call Card */}
      {isIncomingSimCall && simScenario && simState && (
        <div
          data-testid="incoming-call-card"
          className="rounded-xl bg-white dark:bg-[#111C2E] border-2 border-red-500 p-4 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-full bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-500/40 flex items-center justify-center shrink-0 animate-pulse">
              <PhoneCall className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-red-700 dark:text-red-400 uppercase tracking-wide">
                  Incoming Simulated Emergency Call
                </span>
                <span className="text-slate-400">·</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                  {formatSecondsClock(simState.callElapsedSec)}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-amber-800 dark:text-amber-300 font-medium">
                  Real telephone integration not configured.
                </span>
              </div>
              <div className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                {simScenario.callerName} ·{' '}
                <span className="font-mono text-sm">{simScenario.callerPhone}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {simScenario.incomingCallNotification} Cellular voice active; mobile data uncertain. Simulated voice adapter call (not a real PSTN call).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onAnswerSimCall && (
              <button
                type="button"
                onClick={onAnswerSimCall}
                data-testid="answer-sim-call-btn"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors whitespace-nowrap"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Answer Call &amp; Start AI Intake</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Simulation Live Call & Waveform Card (Stages 2–3+) */}
      {simState?.active && !isIncomingSimCall && simScenario && (
        <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-blue-200 dark:border-blue-500/40 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex items-end gap-1 h-8 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] shrink-0">
              {[14, 24, 18, 28, 16, 22, 12].map((barH, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full transition-all ${
                    simState.audioPlaying
                      ? simState.speakingSpeaker === 'CALLER'
                        ? 'bg-blue-500 animate-pulse'
                        : simState.speakingSpeaker === 'OPERATOR'
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-emerald-500 animate-pulse'
                      : 'bg-slate-400 dark:bg-slate-600'
                  }`}
                  style={{
                    height: simState.audioPlaying ? `${barH}px` : '6px',
                    animationDelay: `${i * 90}ms`,
                  }}
                />
              ))}
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {simState.callStatus === 'OPERATOR_CONNECTED'
                    ? 'Operator Connected (Simulation)'
                    : simState.callStatus === 'ENDED'
                    ? 'Call Completed (Simulation)'
                    : 'AI Voice Intake Active'}
                </span>
                <span className="text-slate-400">·</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                  {formatSecondsClock(simState.callElapsedSec)}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-blue-700 dark:text-blue-300 font-medium">
                  {simState.audioPlaying
                    ? `Speaking: ${simState.speakingSpeaker}`
                    : 'Generated demo speech — not a real call recording'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {simScenario.dialogue[Math.max(0, simState.revealedTurnCount - 1)]?.adaptiveNote ||
                  'Real telephone integration not configured. Local Simulation Voice Adapter active.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onToggleSimPause && (
              <button
                type="button"
                onClick={onToggleSimPause}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap"
              >
                {simState.paused ? (
                  <>
                    <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Play</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Pause</span>
                  </>
                )}
              </button>
            )}
            {onToggleSimAudio && (
              <button
                type="button"
                onClick={onToggleSimAudio}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap"
              >
                <Volume2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>{simState.audioEnabled ? 'Mute Audio' : 'Unmute Audio'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Call Queue Selector & Guided Workflow Connector */}
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 shadow-2xs dark:shadow-none">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                Conversation Centre
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                  isLiveSession
                    ? isHumanTakenOver
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/35'
                      : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/35'
                    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700/40 dark:text-slate-300 dark:border-slate-600'
                }`}
              >
                {callStatusLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Inspect AI intake transcripts, missing information, caller talk ratio, and take over live calls with full context preserved.
            </p>
          </div>

          {/* Workflow Navigation Strip: Conversation -> Incident Details -> Location -> Dispatch -> Response Tracking */}
          <div
            aria-label="Conversation to dispatch workflow links"
            className="flex flex-wrap items-center gap-1.5 text-[11px] shrink-0"
          >
            <span className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold whitespace-nowrap">
              1. Conversation
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400 dark:text-slate-500 hidden sm:inline" />
            <button
              type="button"
              onClick={() => onOpenIncidentTab(activeIncident.id, 'overview')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-[#0B1220] dark:hover:bg-[#172438] border border-slate-200 dark:border-[#26364B] text-slate-700 dark:text-slate-200 font-semibold transition-colors whitespace-nowrap"
            >
              2. Incident Details
            </button>
            <ArrowRight className="w-3 h-3 text-slate-400 dark:text-slate-500 hidden sm:inline" />
            <button
              type="button"
              onClick={() => onOpenIncidentTab(activeIncident.id, 'location')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-[#0B1220] dark:hover:bg-[#172438] border border-slate-200 dark:border-[#26364B] text-slate-700 dark:text-slate-200 font-semibold transition-colors whitespace-nowrap"
            >
              3. Location
            </button>
            <ArrowRight className="w-3 h-3 text-slate-400 dark:text-slate-500 hidden sm:inline" />
            <button
              type="button"
              onClick={() => onOpenIncidentTab(activeIncident.id, 'units')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-[#0B1220] dark:hover:bg-[#172438] border border-slate-200 dark:border-[#26364B] text-slate-700 dark:text-slate-200 font-semibold transition-colors whitespace-nowrap"
            >
              4. Dispatch
            </button>
            <ArrowRight className="w-3 h-3 text-slate-400 dark:text-slate-500 hidden sm:inline" />
            <button
              type="button"
              onClick={() => onOpenIncidentTab(activeIncident.id, 'timeline')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-[#0B1220] dark:hover:bg-[#172438] border border-slate-200 dark:border-[#26364B] text-slate-700 dark:text-slate-200 font-semibold transition-colors whitespace-nowrap"
            >
              5. Response Tracking
            </button>
          </div>
        </div>

        {/* Queue Filter & Call Session Picker */}
        <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-[#26364B]">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: `All Calls (${incidents.length})` },
                {
                  id: 'AI_ACTIVE',
                  label: `AI Active (${
                    incidents.filter(
                      (i) =>
                        i.aiIntakeActive &&
                        i.status !== 'RESOLVED' &&
                        i.status !== 'CLOSED'
                    ).length
                  })`,
                },
                {
                  id: 'HUMAN',
                  label: `Operator Handling (${
                    incidents.filter(
                      (i) =>
                        (Boolean(i.assignedOperator) || !i.aiIntakeActive) &&
                        i.status !== 'RESOLVED' &&
                        i.status !== 'CLOSED'
                    ).length
                  })`,
                },
                {
                  id: 'STORED',
                  label: `Stored (${
                    incidents.filter(
                      (i) => i.status === 'RESOLVED' || i.status === 'CLOSED'
                    ).length
                  })`,
                },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setQueueFilter(f.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  queueFilter === f.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-[#0B1220] dark:border-[#26364B] dark:text-slate-300 dark:hover:bg-[#172438]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {filteredQueue.map((inc) => {
              const selected = inc.id === activeIncident.id;
              return (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => onSelectIncident(inc.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg border text-left transition-colors ${
                    selected
                      ? 'bg-blue-50 border-blue-500 text-slate-900 dark:bg-[#172438] dark:border-blue-500 dark:text-slate-50'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-[#0B1220] dark:border-[#26364B] dark:text-slate-300 dark:hover:border-slate-500/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
                    <span>{inc.id}</span>
                    {inc.aiIntakeActive && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                    {inc.category} · {inc.location.area || 'Lagos'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Call Overview Strip */}
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 shadow-2xs dark:shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 flex-1 text-xs">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Incident ID</div>
              <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {activeIncident.id}
              </div>
              <div className="mt-1">
                <PriorityBadge priority={activeIncident.priority} />
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Caller Details</div>
              <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                {activeIncident.callerName || 'Anonymous Caller'}
              </div>
              <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {activeIncident.callerPhone || 'No callback number'}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Start &amp; Duration</div>
              <div className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                {new Date(activeIncident.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {formatRelativeTime(activeIncident.createdAt)} ·{' '}
                {formatSecondsClock(talkRatio.estimatedDurationSec)} est.
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Call Status</div>
              <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {isClosed
                  ? 'Stored Recording'
                  : isHumanTakenOver
                  ? 'Operator Live'
                  : 'AI Intake Active'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Channel: {activeIncident.callChannel.replace(/_/g, ' ')}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Assigned Operator</div>
              <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {activeIncident.assignedOperator || 'Unassigned'}
              </div>
              <div className="mt-1">
                <IncidentStatusBadge status={activeIncident.status} />
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Response Unit</div>
              <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                {assignedUnit ? assignedUnit.callsign : 'Pending human dispatch'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {assignedUnit ? assignedUnit.availability : 'Operator must approve'}
              </div>
            </div>
          </div>

          {/* Human Takeover CTA */}
          <div className="flex flex-col items-stretch sm:items-end gap-1.5 shrink-0">
            {!isHumanTakenOver && canTakeOver(userRole) ? (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onTakeOver(activeIncident.id);
                  setBusy(false);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap"
              >
                <UserCheck className="w-4 h-4" />
                <span>TAKE OVER INCIDENT</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isHumanTakenOver
                    ? `Operator Control (${activeIncident.assignedOperator || operatorName})`
                    : `Role '${userRole}' View-Only`}
                </span>
              </div>
            )}
            <span className="text-[10px] text-slate-500 dark:text-slate-400 text-right max-w-[260px]">
              {realTelephonyConfigured
                ? 'Voice provider adapter connected for live call handoff.'
                : 'Real telephone integration not configured. Takeover transfers AI intake control to human operator without claiming a live PSTN call transfer.'}
            </span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Workspace (Call Context Left + Live Transcript & Audio Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Call Context, AI Summary, Extracted Info, Conversation Intelligence */}
        <div className="lg:col-span-5 space-y-4 min-w-0">
          {/* AI Call Summary */}
          <section className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 shadow-2xs dark:shadow-none">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                AI Call Summary
              </h2>
              <span className="text-[11px] font-mono text-blue-700 dark:text-blue-300">
                Structured Intake
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3">
                <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 mb-0.5">
                  What happened
                </div>
                <p className="text-slate-800 dark:text-slate-100 leading-relaxed">
                  {aiSummary.whatHappened}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3">
                <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 mb-0.5">
                  Where it happened
                </div>
                <p className="text-slate-800 dark:text-slate-100">{aiSummary.whereItHappened}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    People affected
                  </div>
                  <div className="text-slate-900 dark:text-slate-100 font-semibold mt-0.5">
                    {aiSummary.peopleAffectedLabel}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Important landmarks
                  </div>
                  <div className="text-slate-900 dark:text-slate-100 font-semibold mt-0.5">
                    {aiSummary.landmarks}
                  </div>
                </div>
              </div>

              <div
                className={`rounded-lg border p-3 ${
                  activeIncident.immediateDanger
                    ? 'bg-red-50 border-red-200 text-red-900 dark:bg-red-500/10 dark:border-red-500/35 dark:text-red-200'
                    : 'bg-slate-50 border-slate-200 text-slate-800 dark:bg-[#0B1220] dark:border-[#26364B] dark:text-slate-200'
                }`}
              >
                <div className="text-[11px] font-semibold flex items-center gap-1.5 mb-0.5">
                  <AlertOctagon className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  <span>Injuries &amp; Immediate Dangers</span>
                </div>
                <p>{aiSummary.dangersAndInjuries}</p>
              </div>

              {aiSummary.missingInfo.length > 0 && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/35 p-3 space-y-1 text-amber-900 dark:text-amber-100">
                  <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Information Still Missing</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {aiSummary.missingInfo.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 space-y-1.5">
                <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  Suggested Follow-Up Questions for Caller
                </div>
                <ul className="space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                  {aiSummary.followUpQuestions.map((q, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        {idx + 1}.
                      </span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Extracted Information & Key Topics */}
          <section className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 shadow-2xs dark:shadow-none">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                Extracted Information &amp; Key Topics
              </h2>
              <button
                type="button"
                onClick={() => onOpenIncidentTab(activeIncident.id, 'location')}
                className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 hover:underline"
              >
                Verify Location →
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {keyTopics.map((topic) => (
                <span
                  key={topic}
                  className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-[#0B1220] border border-emerald-200 dark:border-[#26364B] text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
                >
                  {topic}
                </span>
              ))}
            </div>

            <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 space-y-2 text-xs">
              <div className="flex flex-wrap gap-1.5">
                <LocationSourceBadge source={activeIncident.location.source} />
                <VerificationBadge
                  status={activeIncident.location.verificationStatus}
                />
              </div>
              <div className="text-slate-800 dark:text-slate-200">
                <span className="text-slate-500 dark:text-slate-400">Location: </span>
                {activeIncident.location.correctedDescription ||
                  activeIncident.location.description}
              </div>
              <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>
                  {typeof activeIncident.location.lat === 'number' &&
                  typeof activeIncident.location.lng === 'number'
                    ? `${activeIncident.location.lat.toFixed(5)}, ${activeIncident.location.lng.toFixed(5)}`
                    : 'Coordinates not yet captured'}
                </span>
              </div>
              <div className="text-slate-700 dark:text-slate-300">
                <span className="text-slate-500 dark:text-slate-400">Contact: </span>
                {activeIncident.callerName || 'Anonymous'} ·{' '}
                <span className="font-mono">
                  {activeIncident.callerPhone || 'Not provided'}
                </span>
              </div>
            </div>
          </section>

          {/* Conversation Intelligence: Intake Completeness + Talk Ratio */}
          <section className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-4 shadow-2xs dark:shadow-none">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              Conversation Intelligence
            </h2>

            {/* Intake Completeness */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Intake Completeness
                </span>
                <span className="font-mono font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                  {completeness.scorePct}% ({completeness.capturedCount}/
                  {completeness.totalChecks})
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-[#0B1220] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    completeness.scorePct >= 85
                      ? 'bg-emerald-500'
                      : completeness.scorePct >= 55
                      ? 'bg-blue-500'
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${completeness.scorePct}%` }}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                {completeness.items.map((item) => (
                  <div
                    key={item.key}
                    title={item.detail}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded border ${
                      item.captured
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/25 dark:text-emerald-200'
                        : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/25 dark:text-amber-200'
                    }`}
                  >
                    {item.captured ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                    <span className="truncate">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Talk Ratio (Inspired by Reference UI) */}
            <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-[#26364B]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Talk Ratio (Speaking Distribution)
                </span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  {talkRatio.totalTurns} turn(s)
                </span>
              </div>

              {[
                {
                  code: 'CL',
                  label: 'Caller',
                  pct: talkRatio.callerPct,
                  color: 'bg-blue-500',
                  badgeBg: 'bg-blue-600 text-white',
                },
                {
                  code: 'AI',
                  label: 'Responda AI',
                  pct: talkRatio.aiPct,
                  color: 'bg-emerald-500',
                  badgeBg: 'bg-emerald-600 text-white',
                },
                {
                  code: 'OP',
                  label: 'Human Operator',
                  pct: talkRatio.operatorPct,
                  color: 'bg-amber-400',
                  badgeBg: 'bg-amber-500 text-slate-950',
                },
              ].map((speaker) => (
                <div
                  key={speaker.code}
                  className="flex items-center gap-2.5 text-xs"
                >
                  <span
                    className={`w-7 h-7 rounded-md font-mono text-[11px] font-bold flex items-center justify-center shrink-0 ${speaker.badgeBg}`}
                    title={speaker.label}
                  >
                    {speaker.code}
                  </span>
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 dark:text-slate-300">{speaker.label}</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                        {speaker.pct}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-[#0B1220] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${speaker.color}`}
                        style={{ width: `${speaker.pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Operator Note Synced with Incident Workspace */}
          <section className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-2.5 shadow-2xs dark:shadow-none">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                Operator Call Notes ({activeIncident.notes.length})
              </h2>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Synced to Incident Workspace
              </span>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!noteText.trim()) return;
                setBusy(true);
                await onAddNote(activeIncident.id, noteText.trim());
                setNoteText('');
                setBusy(false);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add dispatch or caller verification note..."
                aria-label="Add operator call note"
                className="flex-1 rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={busy || !noteText.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-blue-700 dark:text-blue-300 disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </form>
          </section>
        </div>

        {/* RIGHT COLUMN: Live Transcript + Operator Response + Audio Playback Dock */}
        <div className="lg:col-span-7 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] flex flex-col min-w-0 shadow-2xs dark:shadow-none">
          {/* Transcript Header */}
          <div className="p-4 border-b border-slate-200 dark:border-[#26364B] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                Live Conversation Transcript
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeIncident.transcript.length} message(s) ·{' '}
                {formatSecondsClock(talkRatio.estimatedDurationSec)} estimated spoken duration · Preserved on takeover
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300">
                <span className="w-1.5 h-3 rounded-full bg-blue-500" />
                Caller
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                <span className="w-1.5 h-3 rounded-full bg-emerald-500" />
                AI
              </span>
              <span className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-300">
                <span className="w-1.5 h-3 rounded-full bg-amber-400" />
                Operator
              </span>
            </div>
          </div>

          {/* Verbatim Color-Bar Transcript Stream */}
          <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
            {activeIncident.transcript.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                No transcript turns captured for this incident yet.
              </div>
            ) : (
              activeIncident.transcript.map((msg, idx) => {
                const win = talkRatio.turnWindows[idx];
                const isTurnPlaying = activeTurnId === msg.id;
                const barColor =
                  msg.speaker === 'CALLER'
                    ? 'bg-blue-500'
                    : msg.speaker === 'OPERATOR'
                    ? 'bg-amber-400'
                    : 'bg-emerald-500';
                const labelColor =
                  msg.speaker === 'CALLER'
                    ? 'text-blue-700 dark:text-blue-300'
                    : msg.speaker === 'OPERATOR'
                    ? 'text-amber-800 dark:text-amber-300'
                    : 'text-emerald-700 dark:text-emerald-300';
                const speakerTitle =
                  msg.speaker === 'CALLER'
                    ? activeIncident.callerName || 'Caller'
                    : msg.speaker === 'OPERATOR'
                    ? `Human Operator (${activeIncident.assignedOperator || operatorName})`
                    : 'Responda AI Intake';

                return (
                  <button
                    key={msg.id}
                    type="button"
                    onClick={() => {
                      if (win) setPlaybackSec(win.startSec);
                    }}
                    className={`w-full text-left flex items-stretch gap-3 rounded-xl p-3 border transition-colors ${
                      isTurnPlaying
                        ? 'bg-blue-50 border-blue-400 dark:bg-[#172438] dark:border-blue-400'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 dark:bg-[#0B1220] dark:border-[#26364B] dark:hover:border-slate-600'
                    }`}
                  >
                    <span
                      className={`w-1 rounded-full shrink-0 ${barColor}`}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className={`font-semibold ${labelColor}`}>
                          {speakerTitle}
                        </span>
                        <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                          {win ? ` · ${formatSecondsClock(win.startSec)}` : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 dark:text-slate-100 leading-relaxed">
                        {msg.text}
                      </p>
                      {msg.extractedTags && msg.extractedTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] font-mono text-blue-700 dark:text-blue-300">
                          {msg.extractedTags.map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-1.5 py-0.5 rounded bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B]"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Live Operator Reply Box (Requires Takeover) */}
          <div className="px-4 py-3 border-t border-slate-200 dark:border-[#26364B] bg-slate-50/70 dark:bg-[#0F172A]/60 space-y-2">
            {isHumanTakenOver ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!replyText.trim() || !canTakeOver(userRole)) return;
                  setBusy(true);
                  await onSendOperatorMessage(activeIncident.id, replyText.trim());
                  setReplyText('');
                  setBusy(false);
                }}
                className="flex flex-col sm:flex-row gap-2"
              >
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  disabled={!canTakeOver(userRole)}
                  placeholder="Send human operator message to caller (preserved in transcript)..."
                  aria-label="Operator live response"
                  className="flex-1 rounded-lg bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={busy || !replyText.trim() || !canTakeOver(userRole)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send as Operator</span>
                </button>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    AI Intake is currently active. Click Take Over Call above before sending direct human operator replies.
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Audio Controls Dock (Clearly distinguishes Live Call vs Simulated Recording Playback) */}
          <div className="p-4 border-t border-slate-200 dark:border-[#26364B] bg-slate-50 dark:bg-[#0B1220] rounded-b-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono font-semibold border ${
                    isLiveSession
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/35'
                      : 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-700/40 dark:text-slate-300 dark:border-slate-600'
                  }`}
                >
                  <Radio className="w-3 h-3" />
                  <span>
                    {isLiveSession
                      ? 'LIVE INTAKE SESSION'
                      : 'STORED CALL RECORD'}
                  </span>
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {activeIncident.isSimulated
                    ? 'Simulated transcript audio timeline (no carrier MP3 recording attached)'
                    : 'Transcript audio timeline'}
                </span>
              </div>

              <label className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voiceReadAloud}
                  onChange={(e) => {
                    setVoiceReadAloud(e.target.checked);
                    if (
                      !e.target.checked &&
                      typeof window !== 'undefined' &&
                      'speechSynthesis' in window
                    ) {
                      window.speechSynthesis.cancel();
                    }
                  }}
                  className="rounded border-slate-300 dark:border-[#26364B] bg-white dark:bg-[#111C2E] text-emerald-600"
                />
                <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Read turns aloud</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSeekOffset(-10)}
                  aria-label="Rewind 10 seconds"
                  title="Rewind 10 seconds"
                  className="p-2 rounded-lg bg-white hover:bg-slate-100 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-slate-700 dark:text-slate-200 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  aria-label={isPlaying ? 'Pause call playback' : 'Play call playback'}
                  className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 flex items-center justify-center transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleSeekOffset(10)}
                  aria-label="Forward 10 seconds"
                  title="Forward 10 seconds"
                  className="p-2 rounded-lg bg-white hover:bg-slate-100 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-slate-700 dark:text-slate-200 transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 flex items-center gap-2.5 min-w-0">
                <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 tabular-nums shrink-0">
                  {formatSecondsClock(playbackSec)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, talkRatio.estimatedDurationSec)}
                  value={playbackSec}
                  onChange={(e) => setPlaybackSec(Number(e.target.value))}
                  aria-label="Seek conversation playback timeline"
                  className="w-full accent-emerald-600 dark:accent-emerald-500 cursor-pointer"
                />
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                  {formatSecondsClock(talkRatio.estimatedDurationSec)}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span>
                Recording playback is permitted only for authorized operators on simulated or consented calls. Click any transcript block above to jump directly to that point.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
