import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Crosshair,
  FileText,
  Headphones,
  MapPin,
  Navigation,
  Pause,
  PhoneCall,
  PhoneIncoming,
  Play,
  RotateCcw,
  ShieldCheck,
  Truck,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  IncidentRecord,
  OperatorProfile,
  ResponseUnit,
  RouteResult,
  SimulationRuntimeState,
  UserRole,
} from '../types/responda';
import {
  buildLocationIntelligenceMethods,
  buildScenarioTranscript,
  buildSimulatedCorridorRoute,
  buildSimulationFinalSummary,
  rankUnitsForIncident,
  SIMULATION_SCENARIOS,
} from '../utils/simulationEngine';
import {
  formatDistanceKm,
  formatDurationMinutes,
} from '../utils/incidentLogic';
import { LagosMap } from './LagosMap';
import {
  IncidentStatusBadge,
  LocationSourceBadge,
  PriorityBadge,
  UnitAvailabilityBadge,
  VerificationBadge,
} from './StatusBadges';

interface SimulationWorkspaceProps {
  simState: SimulationRuntimeState;
  incidents: IncidentRecord[];
  units: ResponseUnit[];
  operator: OperatorProfile;
  userRole: UserRole;
  carrierConfigured: boolean;
  busy?: boolean;
  onAnswerCall: () => void;
  onTogglePause: () => void;
  onToggleAudio: () => void;
  onNextStep: () => void;
  onRestart: () => void;
  onExitSimulation: () => void;
  onVerifyLocation: (
    incidentId: string,
    payload: {
      correctedDescription: string;
      landmark: string;
      area: string;
      lat: number;
      lng: number;
      markVerified: boolean;
    }
  ) => Promise<void>;
  onTakeOverIncident: (incidentId: string) => Promise<void>;
  onAddNote: (incidentId: string, text: string) => Promise<void>;
  onSelectUnit: (unitId: string) => void;
  onApproveDispatch: (
    incidentId: string,
    unitId: string,
    notes: string
  ) => Promise<void>;
  onCloseIncident: (incidentId: string, reason: string) => Promise<void>;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function AudioWaveform({
  active,
  speaker,
}: {
  active: boolean;
  speaker: 'CALLER' | 'AI' | 'OPERATOR' | null;
}) {
  const heights = [38, 65, 92, 54, 86, 100, 62, 78, 44, 90, 68, 48, 82, 56, 72, 40];
  const barTone =
    speaker === 'AI'
      ? 'bg-emerald-500'
      : speaker === 'OPERATOR'
      ? 'bg-amber-500'
      : 'bg-blue-500';

  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-1 h-9 px-3 rounded-lg bg-slate-100 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B]"
    >
      {heights.map((h, idx) => (
        <span
          key={idx}
          className={`w-1 rounded-full transition-opacity ${barTone} ${
            active ? 'responda-wave-bar opacity-95' : 'opacity-30'
          }`}
          style={{
            height: `${active ? h : 28}%`,
            animationDelay: `${(idx % 6) * 0.11}s`,
          }}
        />
      ))}
    </div>
  );
}

export function SimulationWorkspace({
  simState,
  incidents,
  units,
  operator,
  carrierConfigured,
  busy = false,
  onAnswerCall,
  onTogglePause,
  onToggleAudio,
  onNextStep,
  onRestart,
  onExitSimulation,
  onVerifyLocation,
  onTakeOverIncident,
  onAddNote,
  onSelectUnit,
  onApproveDispatch,
  onCloseIncident,
}: SimulationWorkspaceProps) {
  const scenario = SIMULATION_SCENARIOS[simState.scenarioId];

  const liveIncident = useMemo(
    () =>
      incidents.find(
        (i) => i.id === (simState.incidentId || scenario.incidentId)
      ) || null,
    [incidents, simState.incidentId, scenario.incidentId]
  );

  // Mobile dual-pane tab toggle so mobile always focuses on one primary activity at a time
  const [mobilePane, setMobilePane] = useState<'primary' | 'secondary'>('primary');
  useEffect(() => {
    // Default map-heavy stages (Location Resolution, Unit Selection, Tracking) to primary view
    setMobilePane('primary');
  }, [simState.stage]);

  // Real browser geolocation permission check (honest — never fakes carrier/GPS)
  const [gpsPermission, setGpsPermission] = useState<
    'granted' | 'prompt' | 'denied' | 'unsupported'
  >('prompt');
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsPermission('unsupported');
      return;
    }
    if ('permissions' in navigator && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((res) => {
          setGpsPermission(res.state);
        })
        .catch(() => {
          setGpsPermission('prompt');
        });
    }
  }, []);

  // Editable operator fields for Stage 3 (Location Resolution) & Stage 5 (Review)
  const [editAddress, setEditAddress] = useState(scenario.verifiedLocationDescription);
  const [editLandmark, setEditLandmark] = useState(scenario.landmark);
  const [editLat, setEditLat] = useState(scenario.resolvedCoords.lat);
  const [editLng, setEditLng] = useState(scenario.resolvedCoords.lng);
  const [noteDraft, setNoteDraft] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [closureReason, setClosureReason] = useState(
    'Response unit arrived On Scene and assumed medical/security handover cleanly.'
  );

  useEffect(() => {
    setEditAddress(
      liveIncident?.location.correctedDescription ||
        scenario.verifiedLocationDescription
    );
    setEditLandmark(liveIncident?.location.landmark || scenario.landmark);
    setEditLat(liveIncident?.location.lat ?? scenario.resolvedCoords.lat);
    setEditLng(liveIncident?.location.lng ?? scenario.resolvedCoords.lng);
  }, [
    simState.scenarioId,
    scenario,
    liveIncident?.location.correctedDescription,
    liveIncident?.location.landmark,
    liveIncident?.location.lat,
    liveIncident?.location.lng,
  ]);

  // Build progressive transcript from live incident or scenario dialogue turns revealed so far
  const revealedTurns = useMemo(() => {
    if (liveIncident && liveIncident.transcript.length > 0) {
      return liveIncident.transcript;
    }
    if (simState.revealedTurnCount > 0) {
      return buildScenarioTranscript(scenario, simState.revealedTurnCount);
    }
    return [];
  }, [liveIncident, simState.revealedTurnCount, scenario]);

  const currentDialogueTurn =
    simState.revealedTurnCount > 0
      ? scenario.dialogue[
          Math.min(simState.revealedTurnCount - 1, scenario.dialogue.length - 1)
        ]
      : null;

  const extractedTags = useMemo(() => {
    const tags = new Set<string>();
    const count = Math.max(
      simState.revealedTurnCount,
      liveIncident?.transcript.length ?? 0
    );
    scenario.dialogue.slice(0, count).forEach((t) => {
      t.extractedTags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags);
  }, [scenario.dialogue, simState.revealedTurnCount, liveIncident?.transcript.length]);

  const missingInfoFlags = useMemo(() => {
    if (liveIncident && liveIncident.missingInfoFlags) {
      return liveIncident.missingInfoFlags;
    }
    if (currentDialogueTurn) {
      return currentDialogueTurn.remainingMissingFlags;
    }
    return [
      'What happened',
      'Exact street or landmark',
      'Injuries & people affected',
      'Immediate danger check',
    ];
  }, [liveIncident, currentDialogueTurn]);

  const callerRevealedLocation =
    simState.revealedTurnCount >= 5 ||
    Boolean(liveIncident?.location.lat && liveIncident.location.lat !== undefined);

  const syntheticStageIncident: IncidentRecord = useMemo(() => {
    const now = new Date().toISOString();
    if (liveIncident) return liveIncident;
    return {
      id: scenario.incidentId,
      createdAt: now,
      updatedAt: now,
      category: simState.revealedTurnCount >= 1 ? scenario.category : 'Other urgent incident',
      priority: scenario.priority,
      priorityReason: scenario.priorityReason,
      status: 'AI_INTAKE',
      callerName: simState.revealedTurnCount >= 5 ? scenario.callerName : 'Incoming Caller (Demo)',
      callerPhone: scenario.callerPhone,
      summary:
        simState.revealedTurnCount >= 1
          ? scenario.summary
          : 'Incoming simulated emergency call awaiting intake answers.',
      description: scenario.description,
      peopleAffected: simState.revealedTurnCount >= 3 ? scenario.peopleAffected : null,
      immediateDanger: simState.revealedTurnCount >= 3 ? scenario.immediateDanger : false,
      dangerDetails: simState.revealedTurnCount >= 3 ? scenario.dangerDetails : undefined,
      missingInfoFlags,
      transcript: revealedTurns,
      location: {
        source: callerRevealedLocation ? 'CALLER_DESCRIPTION' : 'UNKNOWN',
        verificationStatus: 'UNVERIFIED',
        description: callerRevealedLocation
          ? scenario.vagueLocationDescription
          : `Lagos call incoming (${scenario.area} sector hint) — awaiting caller landmark.`,
        landmark: callerRevealedLocation ? scenario.landmark : undefined,
        area: simState.revealedTurnCount >= 1 ? scenario.area : undefined,
        lat: callerRevealedLocation ? scenario.resolvedCoords.lat : undefined,
        lng: callerRevealedLocation ? scenario.resolvedCoords.lng : undefined,
        accuracyMeters: callerRevealedLocation
          ? scenario.resolvedCoords.accuracyMeters
          : undefined,
        carrierNote: 'Carrier location integration not configured',
        capturedAt: now,
      },
      timeline: [],
      notes: [],
      aiIntakeActive: true,
      isSimulated: true,
      callChannel: 'TELEPHONY_ADAPTER',
    };
  }, [
    liveIncident,
    scenario,
    simState.revealedTurnCount,
    missingInfoFlags,
    revealedTurns,
    callerRevealedLocation,
  ]);

  const rankedUnits = useMemo(
    () =>
      rankUnitsForIncident(
        units,
        syntheticStageIncident,
        scenario.recommendedUnitId
      ),
    [units, syntheticStageIncident, scenario.recommendedUnitId]
  );

  const selectedUnitId =
    simState.selectedUnitId ||
    liveIncident?.assignedUnitId ||
    rankedUnits.find((r) => r.unit.availability === 'AVAILABLE')?.unit.id ||
    scenario.recommendedUnitId;

  const selectedUnit =
    units.find((u) => u.id === selectedUnitId) ||
    rankedUnits[0]?.unit ||
    null;

  const previewRoute: RouteResult | null = useMemo(() => {
    if (simState.activeRoute) return simState.activeRoute;
    if (
      selectedUnit &&
      typeof syntheticStageIncident.location.lat === 'number' &&
      typeof syntheticStageIncident.location.lng === 'number'
    ) {
      return buildSimulatedCorridorRoute(
        selectedUnit.lat,
        selectedUnit.lng,
        syntheticStageIncident.location.lat,
        syntheticStageIncident.location.lng
      );
    }
    return null;
  }, [simState.activeRoute, selectedUnit, syntheticStageIncident.location.lat, syntheticStageIncident.location.lng]);

  const focusBoundsPoints = useMemo<[number, number][] | null>(() => {
    const incLat = syntheticStageIncident.location.lat;
    const incLng = syntheticStageIncident.location.lng;
    if (typeof incLat !== 'number' || typeof incLng !== 'number' || !selectedUnit) {
      return null;
    }
    return [
      [incLat, incLng],
      [selectedUnit.lat, selectedUnit.lng],
    ];
  }, [syntheticStageIncident.location.lat, syntheticStageIncident.location.lng, selectedUnit]);

  const locationMethods = useMemo(
    () => buildLocationIntelligenceMethods(syntheticStageIncident, carrierConfigured),
    [syntheticStageIncident, carrierConfigured]
  );

  const callStatusLabel =
    simState.callStatus === 'INCOMING'
      ? 'Incoming Call Ringing'
      : simState.callStatus === 'CONNECTED_AI'
      ? 'Connected · Responda AI Intake'
      : simState.callStatus === 'OPERATOR_CONNECTED'
      ? `Human Operator Active (${operator.name})`
      : simState.callStatus === 'ENDED'
      ? 'Call Completed'
      : 'Standby';

  // ============================================================================
  // STAGE 1 & STAGE 2/3 — INCOMING CALL + AI CONVERSATION & LOCATION INTELLIGENCE
  // ============================================================================
  if (simState.stage === 1 || simState.stage === 2 || simState.stage === 3) {
    const isIncoming = simState.stage === 1;
    const intakePct = Math.round(
      (Math.min(simState.revealedTurnCount, scenario.dialogue.length) /
        scenario.dialogue.length) *
        100
    );

    const mapIncidents = callerRevealedLocation ? [syntheticStageIncident] : [];
    const radarPoint: [number, number] | null = callerRevealedLocation
      ? [scenario.resolvedCoords.lat, scenario.resolvedCoords.lng]
      : [scenario.resolvedCoords.lat, scenario.resolvedCoords.lng];

    return (
      <div
        data-testid="sim-stage-call-intake"
        className="flex-1 min-h-0 flex flex-col gap-3"
      >
        {/* Mobile Activity Switcher */}
        <div className="flex lg:hidden items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B]">
          <button
            type="button"
            onClick={() => setMobilePane('primary')}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              mobilePane === 'primary'
                ? 'bg-white text-slate-900 dark:bg-blue-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {isIncoming ? 'Incoming Call' : 'Live Transcript'}
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('secondary')}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              mobilePane === 'secondary'
                ? 'bg-white text-slate-900 dark:bg-blue-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Location &amp; Intake Intel
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* LEFT PANEL — CALL EXPERIENCE & PROGRESSIVE TRANSCRIPT */}
          <section
            className={`lg:col-span-7 flex-col min-h-0 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] overflow-hidden ${
              mobilePane === 'primary' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {/* Call Header */}
            <div className="px-4 py-3.5 border-b border-slate-200 dark:border-[#26364B] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isIncoming
                      ? 'bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/35'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/35'
                  }`}
                >
                  {isIncoming ? (
                    <PhoneIncoming className="w-5 h-5" />
                  ) : (
                    <PhoneCall className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {callStatusLabel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatTimer(simState.callElapsedSec)}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate">
                    {scenario.callerName} ·{' '}
                    <span className="font-mono font-normal text-slate-600 dark:text-slate-300">
                      {scenario.callerPhone}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isIncoming ? (
                  <button
                    type="button"
                    onClick={onAnswerCall}
                    data-testid="answer-simulation-call-btn"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white whitespace-nowrap shrink-0 transition-colors"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Answer Call</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={onTogglePause}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap shrink-0"
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
                    <button
                      type="button"
                      onClick={onToggleAudio}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap shrink-0"
                    >
                      {simState.audioEnabled ? (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Mute</span>
                        </>
                      ) : (
                        <>
                          <VolumeX className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          <span>Unmute</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Waveform & Voice Activity Strip */}
            <div className="px-4 py-3 bg-slate-50 dark:bg-[#0E1727] border-b border-slate-200 dark:border-[#26364B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AudioWaveform
                  active={
                    isIncoming || simState.audioPlaying || (!simState.paused && !isIncoming)
                  }
                  speaker={simState.speakingSpeaker}
                />
                <div className="text-xs space-y-0.5">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {isIncoming
                      ? 'Ringing via Local Simulation Voice Adapter'
                      : simState.speakingSpeaker === 'AI'
                      ? 'Responda AI Intake Speaking'
                      : simState.speakingSpeaker === 'CALLER'
                      ? 'Caller Speaking'
                      : 'Voice Stream Active'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Generated demo speech — not a real call recording
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300 shrink-0">
                <span className="inline-flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    AI Voice:{' '}
                    <strong className="text-slate-900 dark:text-slate-100">
                      {simState.speakingSpeaker === 'AI' ? 'Speaking' : 'Listening'}
                    </strong>
                  </span>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Caller:{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {simState.speakingSpeaker === 'CALLER'
                      ? 'Speaking'
                      : isIncoming
                      ? 'Ringing'
                      : 'On Line'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Progressive Live Transcript */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {revealedTurns.length === 0 ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center px-6 space-y-3">
                  <Headphones className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  <div className="space-y-1 max-w-md">
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                      {scenario.incomingCallNotification}
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Click <strong>Answer Call</strong> (or wait for automatic pickup) to start AI voice intake and progressive live transcription.
                    </p>
                  </div>
                </div>
              ) : (
                revealedTurns.map((msg) => {
                  const isAi = msg.speaker === 'AI';
                  const isOp = msg.speaker === 'OPERATOR';
                  return (
                    <div
                      key={msg.id}
                      className={`rounded-xl p-3.5 border ${
                        isAi
                          ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 ml-4 sm:ml-8'
                          : isOp
                          ? 'bg-amber-50/80 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 ml-4 sm:ml-8'
                          : 'bg-slate-50 border-slate-200 dark:bg-[#0B1220] dark:border-[#26364B] mr-4 sm:mr-8'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
                        <span
                          className={`font-semibold ${
                            isAi
                              ? 'text-emerald-800 dark:text-emerald-300'
                              : isOp
                              ? 'text-amber-800 dark:text-amber-300'
                              : 'text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          {isAi
                            ? 'Responda AI Assistant'
                            : isOp
                            ? 'Human Operator'
                            : `${scenario.callerName} (Caller)`}
                        </span>
                        <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-900 dark:text-slate-100 leading-relaxed">
                        {msg.text}
                      </p>
                      {msg.extractedTags && msg.extractedTags.length > 0 && (
                        <div className="mt-2 pt-1.5 border-t border-slate-200/70 dark:border-white/10 text-[11px] text-slate-600 dark:text-slate-300">
                          Extracted: {msg.extractedTags.join(' · ')}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* RIGHT PANEL — LOCATION INTELLIGENCE & STRUCTURED INTAKE */}
          <aside
            className={`lg:col-span-5 flex-col min-h-0 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] overflow-hidden ${
              mobilePane === 'secondary' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <div className="px-4 py-3 border-b border-slate-200 dark:border-[#26364B] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                  {isIncoming
                    ? 'Location Intelligence'
                    : 'Live Extraction & Location Intel'}
                </h2>
              </div>
              <VerificationBadge
                status={syntheticStageIncident.location.verificationStatus}
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5">
              {/* Interactive Lagos Map with Radar Search Visualization */}
              <LagosMap
                incidents={mapIncidents}
                units={[]}
                selectedIncidentId={
                  mapIncidents.length > 0 ? syntheticStageIncident.id : null
                }
                radarCoords={radarPoint}
                heightClass="h-[220px] xl:h-[245px]"
                showLegend={false}
                showInfoCard={false}
              />

              {/* Location Matching Progression */}
              <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    Location Evidence Pipeline
                  </span>
                  <LocationSourceBadge
                    source={syntheticStageIncident.location.source}
                  />
                </div>
                <div className="space-y-1 text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Caller Description:{' '}
                    </span>
                    {callerRevealedLocation
                      ? scenario.vagueLocationDescription
                      : simState.revealedTurnCount >= 1
                      ? `${scenario.area} sector mentioned — listening for landmark.`
                      : 'Awaiting caller description...'}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Landmark Identification:{' '}
                    </span>
                    {callerRevealedLocation
                      ? `Candidate matched: ${scenario.landmark} (±${scenario.resolvedCoords.accuracyMeters}m estimate) — Awaiting operator verification`
                      : 'Scanning incoming speech for Lagos landmarks...'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-[#26364B] flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>
                      Device GPS:{' '}
                      {gpsPermission === 'granted'
                        ? 'Browser permission granted'
                        : 'Not shared by PSTN/demo caller'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Carrier Triangulation:{' '}
                      <strong className="text-amber-700 dark:text-amber-300">
                        {carrierConfigured
                          ? 'Configured'
                          : 'Carrier location integration not configured'}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Intake Completion & Extracted Information */}
              <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    AI Intake Progress
                  </span>
                  <span className="font-mono font-semibold text-blue-700 dark:text-blue-400 tabular-nums">
                    {intakePct}% ({Math.min(simState.revealedTurnCount, scenario.dialogue.length)}/{scenario.dialogue.length})
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-[#172438] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${intakePct}%` }}
                  />
                </div>

                {currentDialogueTurn?.adaptiveNote && (
                  <div className="text-[11px] text-emerald-800 dark:text-emerald-300">
                    {currentDialogueTurn.adaptiveNote}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Category
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {syntheticStageIncident.category}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      People Affected
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {syntheticStageIncident.peopleAffected ?? 'Assessing...'}
                    </div>
                  </div>
                </div>

                {extractedTags.length > 0 && (
                  <div className="pt-1 border-t border-slate-200 dark:border-[#26364B]">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                      Extracted Details
                    </div>
                    <div className="text-slate-800 dark:text-slate-200 font-medium">
                      {extractedTags.join(' · ')}
                    </div>
                  </div>
                )}

                <div className="pt-1 border-t border-slate-200 dark:border-[#26364B]">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                    Missing Information
                  </div>
                  <div className="text-amber-700 dark:text-amber-300">
                    {missingInfoFlags.join(' · ')}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STAGE 3 (internal 4) — LOCATION RESOLUTION (LARGE MAP FOCUS + RADAR + VERIFY)
  // ============================================================================
  if (simState.stage === 4) {
    const isVerified =
      syntheticStageIncident.location.verificationStatus === 'VERIFIED';

    return (
      <div
        data-testid="sim-stage-location-resolution"
        className="flex-1 min-h-0 flex flex-col gap-3"
      >
        <div className="flex lg:hidden items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B]">
          <button
            type="button"
            onClick={() => setMobilePane('primary')}
            className={`flex-1 py-2 text-xs font-semibold rounded-md ${
              mobilePane === 'primary'
                ? 'bg-white text-slate-900 dark:bg-blue-600 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Lagos Map &amp; Radar
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('secondary')}
            className={`flex-1 py-2 text-xs font-semibold rounded-md ${
              mobilePane === 'secondary'
                ? 'bg-white text-slate-900 dark:bg-blue-600 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Verify Coordinates
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Primary Map Focus */}
          <div
            className={`lg:col-span-8 flex-col min-h-0 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-2 ${
              mobilePane === 'primary' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <LagosMap
              incidents={[
                {
                  ...syntheticStageIncident,
                  location: {
                    ...syntheticStageIncident.location,
                    lat: editLat,
                    lng: editLng,
                  },
                },
              ]}
              units={[]}
              selectedIncidentId={syntheticStageIncident.id}
              radarCoords={[editLat, editLng]}
              editablePin
              onPinMove={(lat, lng) => {
                setEditLat(lat);
                setEditLng(lng);
              }}
              heightClass="h-[380px] lg:h-full min-h-[380px]"
              showLegend={false}
              showInfoCard
            />
          </div>

          {/* Right Location Intelligence & Operator Verification Controls */}
          <aside
            className={`lg:col-span-4 flex-col min-h-0 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] overflow-hidden ${
              mobilePane === 'secondary' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <div className="px-4 py-3 border-b border-slate-200 dark:border-[#26364B] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                  Location Resolution
                </h2>
              </div>
              <VerificationBadge
                status={syntheticStageIncident.location.verificationStatus}
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 text-xs">
              <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Coordinates &amp; Accuracy
                  </span>
                  <LocationSourceBadge
                    source={syntheticStageIncident.location.source}
                  />
                </div>
                <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {editLat.toFixed(5)}, {editLng.toFixed(5)} · ±
                  {scenario.resolvedCoords.accuracyMeters}m candidate estimate
                </div>
                <div className="text-slate-600 dark:text-slate-300">
                  Click anywhere on the Lagos map to refine the incident pin before human confirmation.
                </div>
              </div>

              {/* 4-Method Location Intelligence Breakdown */}
              <div className="space-y-2">
                {locationMethods.map((m) => (
                  <div
                    key={m.key}
                    className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-2.5 space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {m.label}
                      </span>
                      <span
                        className={`text-[11px] font-medium ${
                          m.available
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {m.statusText}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {m.detail}
                    </p>
                  </div>
                ))}
              </div>

              {/* Operator Address & Landmark Confirmation Inputs */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#26364B]">
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Verified Street / Junction Address
                  </span>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Nearest Lagos Landmark
                  </span>
                  <input
                    type="text"
                    value={editLandmark}
                    onChange={(e) => setEditLandmark(e.target.value)}
                    className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-[#26364B] space-y-2">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  await onVerifyLocation(syntheticStageIncident.id, {
                    correctedDescription: editAddress,
                    landmark: editLandmark,
                    area: scenario.area,
                    lat: editLat,
                    lng: editLng,
                    markVerified: true,
                  });
                  onNextStep();
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {isVerified
                    ? 'Location Verified · Continue'
                    : 'Verify Location & Continue'}
                </span>
              </button>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STAGE 4 (internal 5) — HUMAN OPERATOR TAKEOVER
  // ============================================================================
  if (simState.stage === 5) {
    return (
      <div
        data-testid="sim-stage-takeover"
        className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch"
      >
        {/* Left: Structured Summary + Full Conversation Transcript */}
        <section className="lg:col-span-7 flex flex-col min-h-0 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-[#26364B] flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {syntheticStageIncident.id} · {syntheticStageIncident.category}
              </div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                AI Handover Briefing &amp; Full Conversation Transcript
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={syntheticStageIncident.priority} />
              <IncidentStatusBadge status={syntheticStageIncident.status} />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-xs">
            {/* Key Incident Facts */}
            <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3.5 space-y-2">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {syntheticStageIncident.summary}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Caller: </span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    {syntheticStageIncident.callerName || scenario.callerName}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">People Affected: </span>
                  <strong className="text-slate-900 dark:text-slate-100 tabular-nums">
                    {syntheticStageIncident.peopleAffected ?? scenario.peopleAffected}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Immediate Hazards: </span>
                  <strong className="text-red-700 dark:text-red-300">
                    {syntheticStageIncident.immediateDanger ? 'Yes — Active' : 'None reported'}
                  </strong>
                </div>
              </div>
              {syntheticStageIncident.dangerDetails && (
                <div className="text-amber-800 dark:text-amber-300 pt-1 border-t border-slate-200 dark:border-[#26364B]">
                  Hazard Detail: {syntheticStageIncident.dangerDetails}
                </div>
              )}
            </div>

            {/* Preserved Full Transcript */}
            <div className="space-y-2">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Preserved AI Intake Transcript ({revealedTurns.length} turns)
              </h3>
              <div className="space-y-2">
                {revealedTurns.map((msg) => (
                  <div
                    key={msg.id}
                    className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {msg.speaker === 'AI' ? 'Responda AI' : msg.speaker}
                      </span>
                      <span className="font-mono tabular-nums">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200">{msg.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Right: Takeover Responsibility Transfer */}
        <aside className="lg:col-span-5 flex flex-col min-h-0 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-[#26364B] flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
              Transfer to Human Operator Control
            </h2>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 text-xs">
            <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Current Control</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  AI Intake Completed · Awaiting Human
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Assuming Operator</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {operator.name} ({operator.role} · {operator.badgeCode})
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200 dark:border-[#26364B]">
                Taking over assigns workflow responsibility inside Responda and halts automated intake. It does not claim a live PSTN telephone call transfer.
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  Identified Location
                </span>
                <VerificationBadge
                  status={syntheticStageIncident.location.verificationStatus}
                />
              </div>
              <p className="text-slate-700 dark:text-slate-300">
                {syntheticStageIncident.location.correctedDescription ||
                  syntheticStageIncident.location.description}
              </p>
              <div className="text-[11px] text-amber-700 dark:text-amber-300">
                Missing / Pending: {missingInfoFlags.join(' · ') || 'None'}
              </div>
            </div>

            <div className="rounded-lg bg-blue-50/70 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 p-3.5 space-y-1">
              <div className="font-semibold text-blue-900 dark:text-blue-200">
                AI Recommendations for Operator
              </div>
              <ul className="space-y-1 text-slate-700 dark:text-slate-300 list-disc pl-4">
                <li>Confirm landmark coordinates with caller/map before dispatch.</li>
                <li>
                  Review suggested {syntheticStageIncident.priority} priority:{' '}
                  {syntheticStageIncident.priorityReason}
                </li>
                <li>
                  Compare nearby available units (recommended:{' '}
                  {scenario.recommendedUnitId}).
                </li>
              </ul>
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-[#26364B]">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                await onTakeOverIncident(syntheticStageIncident.id);
              }}
              data-testid="sim-takeover-button"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              <span>TAKE OVER INCIDENT</span>
            </button>
          </div>
        </aside>
      </div>
    );
  }

  // ============================================================================
  // STAGE 5 (internal 6) — INCIDENT REVIEW
  // ============================================================================
  if (simState.stage === 6) {
    const isVerified =
      syntheticStageIncident.location.verificationStatus === 'VERIFIED';

    return (
      <div
        data-testid="sim-stage-review"
        className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch"
      >
        <section className="lg:col-span-8 flex flex-col min-h-0 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-[#26364B] flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {syntheticStageIncident.id} · Owner:{' '}
                {syntheticStageIncident.assignedOperator || operator.name}
              </div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                Structured Incident Review
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={syntheticStageIncident.priority} />
              <IncidentStatusBadge status={syntheticStageIncident.status} />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3.5 space-y-1.5">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Emergency Details &amp; AI Summary
              </div>
              <p className="text-slate-700 dark:text-slate-300">
                {syntheticStageIncident.summary}
              </p>
              <div className="text-slate-500 dark:text-slate-400 pt-1">
                Priority Basis: {syntheticStageIncident.priorityReason}
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  Location &amp; Verification
                </span>
                <VerificationBadge
                  status={syntheticStageIncident.location.verificationStatus}
                />
              </div>
              <p className="text-slate-700 dark:text-slate-300">
                {syntheticStageIncident.location.correctedDescription ||
                  syntheticStageIncident.location.description}
              </p>
              {typeof syntheticStageIncident.location.lat === 'number' &&
                typeof syntheticStageIncident.location.lng === 'number' && (
                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {syntheticStageIncident.location.lat.toFixed(5)},{' '}
                    {syntheticStageIncident.location.lng.toFixed(5)}
                  </div>
                )}
              {!isVerified && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void onVerifyLocation(syntheticStageIncident.id, {
                      correctedDescription: editAddress,
                      landmark: editLandmark,
                      area: scenario.area,
                      lat: editLat,
                      lng: editLng,
                      markVerified: true,
                    })
                  }
                  className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verify Location Now</span>
                </button>
              )}
            </div>

            <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3.5 space-y-1.5">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Caller, People Affected &amp; Hazards
              </div>
              <div className="text-slate-700 dark:text-slate-300">
                Caller: {syntheticStageIncident.callerName || scenario.callerName} (
                <span className="font-mono">
                  {syntheticStageIncident.callerPhone || scenario.callerPhone}
                </span>
                )
              </div>
              <div className="text-slate-700 dark:text-slate-300 tabular-nums">
                People Affected: {syntheticStageIncident.peopleAffected ?? scenario.peopleAffected}
              </div>
              <div className="text-red-700 dark:text-red-300">
                Hazards: {syntheticStageIncident.dangerDetails || 'Active scene hazard'}
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3.5 space-y-1.5">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Conversation History ({revealedTurns.length} turns)
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                {revealedTurns.map((m) => (
                  <div key={m.id} className="text-[11px] text-slate-600 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-slate-100">
                      {m.speaker}:
                    </strong>{' '}
                    {m.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Right: Readiness Gate & Operator Notes */}
        <aside className="lg:col-span-4 flex flex-col min-h-0 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-[#26364B] flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
              Dispatch Readiness &amp; Notes
            </h2>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 text-xs">
            <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 space-y-2">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Mandatory Pre-Dispatch Checks
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Human operator takeover recorded</span>
                </div>
                <div
                  className={`flex items-center gap-2 ${
                    isVerified
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-amber-700 dark:text-amber-300'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isVerified
                      ? 'Incident location verified'
                      : 'Location verification required before dispatch'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>Select and authorize response unit next</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Operator Notes ({syntheticStageIncident.notes.length})
              </div>
              <div className="space-y-1.5 max-h-28 overflow-y-auto">
                {syntheticStageIncident.notes.length === 0 ? (
                  <div className="text-slate-500 dark:text-slate-400">
                    No notes logged yet.
                  </div>
                ) : (
                  syntheticStageIncident.notes.map((n) => (
                    <div
                      key={n.id}
                      className="rounded bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-2 text-[11px]"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {n.author}:{' '}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">{n.text}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Add operator verification note..."
                  className="flex-1 rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  disabled={!noteDraft.trim() || busy}
                  onClick={async () => {
                    const txt = noteDraft.trim();
                    if (!txt) return;
                    setNoteDraft('');
                    await onAddNote(syntheticStageIncident.id, txt);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-[#172438] dark:hover:bg-[#1E293B] text-xs font-semibold text-slate-800 dark:text-slate-100 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-[#26364B]">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (!isVerified) {
                  await onVerifyLocation(syntheticStageIncident.id, {
                    correctedDescription: editAddress,
                    landmark: editLandmark,
                    area: scenario.area,
                    lat: editLat,
                    lng: editLng,
                    markVerified: true,
                  });
                }
                onNextStep();
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white transition-colors"
            >
              <Truck className="w-4 h-4" />
              <span>Select Response Unit</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </aside>
      </div>
    );
  }

  // ============================================================================
  // STAGE 6 (internal 7) — RESPONSE UNIT SELECTION
  // ============================================================================
  if (simState.stage === 7) {
    return (
      <div
        data-testid="sim-stage-unit-selection"
        className="flex-1 min-h-0 flex flex-col gap-3"
      >
        <div className="flex lg:hidden items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B]">
          <button
            type="button"
            onClick={() => setMobilePane('primary')}
            className={`flex-1 py-2 text-xs font-semibold rounded-md ${
              mobilePane === 'primary'
                ? 'bg-white text-slate-900 dark:bg-blue-600 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Units &amp; Recommendation
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('secondary')}
            className={`flex-1 py-2 text-xs font-semibold rounded-md ${
              mobilePane === 'secondary'
                ? 'bg-white text-slate-900 dark:bg-blue-600 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Route Preview Map
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div
            className={`lg:col-span-7 flex-col min-h-0 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-2 ${
              mobilePane === 'secondary' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <LagosMap
              incidents={[syntheticStageIncident]}
              units={units}
              selectedIncidentId={syntheticStageIncident.id}
              selectedUnitId={selectedUnit?.id || null}
              route={previewRoute}
              focusBoundsPoints={focusBoundsPoints}
              onSelectUnit={(id) => onSelectUnit(id)}
              heightClass="h-[380px] lg:h-full min-h-[380px]"
              showLegend
              showInfoCard={false}
            />
          </div>

          <aside
            className={`lg:col-span-5 flex-col min-h-0 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] overflow-hidden ${
              mobilePane === 'primary' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <div className="px-4 py-3 border-b border-slate-200 dark:border-[#26364B]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                  Response Unit Selection
                </h2>
                <VerificationBadge
                  status={syntheticStageIncident.location.verificationStatus}
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Verified destination:{' '}
                {syntheticStageIncident.location.correctedDescription ||
                  syntheticStageIncident.location.description}
              </p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-2.5 text-xs">
              {rankedUnits.map(({ unit, distanceKm, recommended, reason }) => {
                const isSelected = unit.id === selectedUnit?.id;
                const canPick = unit.availability === 'AVAILABLE';
                return (
                  <button
                    key={unit.id}
                    type="button"
                    disabled={!canPick}
                    onClick={() => onSelectUnit(unit.id)}
                    className={`w-full text-left rounded-xl p-3 border transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500 dark:bg-blue-500/15 dark:border-blue-400'
                        : canPick
                        ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 dark:bg-[#0B1220] dark:hover:bg-[#172438] dark:border-[#26364B]'
                        : 'bg-slate-50/50 border-slate-200/70 opacity-60 cursor-not-allowed dark:bg-[#0B1220]/50 dark:border-[#26364B]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-50">
                            {unit.callsign}
                          </span>
                          {recommended && (
                            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                              Recommended
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {unit.id} · {unit.unitType} · {unit.area}
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <UnitAvailabilityBadge availability={unit.availability} />
                        {distanceKm !== null && (
                          <div className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                            {distanceKm} km away
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                      {reason} · {unit.crewDescription}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-[#26364B]">
              <button
                type="button"
                disabled={busy || !selectedUnit}
                onClick={onNextStep}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white transition-colors"
              >
                <span>Proceed to Dispatch Approval</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STAGE 7 (internal 8) — DISPATCH APPROVAL
  // ============================================================================
  if (simState.stage === 8) {
    const hasRealOrsEta =
      previewRoute &&
      !previewRoute.isSimulatedFallback &&
      typeof previewRoute.durationSeconds === 'number';

    return (
      <div
        data-testid="sim-stage-dispatch-approval"
        className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch"
      >
        <div className="lg:col-span-7 flex flex-col min-h-0 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-2">
          <LagosMap
            incidents={[syntheticStageIncident]}
            units={selectedUnit ? [selectedUnit] : []}
            selectedIncidentId={syntheticStageIncident.id}
            selectedUnitId={selectedUnit?.id || null}
            route={previewRoute}
            focusBoundsPoints={focusBoundsPoints}
            heightClass="h-[320px] lg:h-full min-h-[320px]"
            showLegend={false}
            showInfoCard={false}
          />
        </div>

        <aside className="lg:col-span-5 flex flex-col min-h-0 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-[#26364B] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                Human Dispatch Confirmation
              </h2>
            </div>
            <span className="text-[11px] font-mono font-semibold text-amber-700 dark:text-amber-300">
              SIMULATED APPROVAL
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 text-xs">
            {simState.dispatchApproved ? (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/40 p-5 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <div className="font-display text-base font-bold text-emerald-900 dark:text-emerald-200">
                  Dispatch Approved (Simulated)
                </div>
                <p className="text-slate-700 dark:text-slate-200">
                  {selectedUnit?.callsign} assigned to {syntheticStageIncident.id}. Updating incident timeline and initiating live response tracking...
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/35 p-3 text-amber-900 dark:text-amber-200">
                  Explicit human authorization required. In simulation mode, approving dispatches the demonstration unit inside Responda only — no real emergency vehicle is mobilised.
                </div>

                <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3.5 space-y-2">
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Incident Summary
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {syntheticStageIncident.id} · {syntheticStageIncident.summary}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-[#26364B]">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Selected Response Unit
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {selectedUnit?.callsign} ({selectedUnit?.unitType}) ·{' '}
                      {selectedUnit?.organisation}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-[#26364B]">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Verified Destination
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {syntheticStageIncident.location.correctedDescription ||
                        syntheticStageIncident.location.description}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-[#26364B]">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Route &amp; Travel Estimate
                    </div>
                    <div className="text-slate-800 dark:text-slate-200">
                      {hasRealOrsEta ? (
                        <span className="font-mono tabular-nums">
                          OpenRouteService: {formatDistanceKm(previewRoute.distanceMeters)} · ETA{' '}
                          {formatDurationMinutes(previewRoute.durationSeconds)}
                        </span>
                      ) : (
                        <span>
                          Simulated demo Lagos corridor shown (real driving ETA unavailable without OpenRouteService API key).
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Dispatch Instructions (Optional)
                  </span>
                  <input
                    type="text"
                    value={dispatchNotes}
                    onChange={(e) => setDispatchNotes(e.target.value)}
                    placeholder="e.g., Approach via University Road junction gate..."
                    className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </label>
              </>
            )}
          </div>

          {!simState.dispatchApproved && (
            <div className="p-4 border-t border-slate-200 dark:border-[#26364B]">
              <button
                type="button"
                disabled={busy || !selectedUnit}
                onClick={() =>
                  selectedUnit &&
                  void onApproveDispatch(
                    syntheticStageIncident.id,
                    selectedUnit.id,
                    dispatchNotes.trim() ||
                      `Simulation Dispatch: ${selectedUnit.callsign} approved by ${operator.name}.`
                  )
                }
                data-testid="sim-approve-dispatch-button"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>APPROVE &amp; DISPATCH (SIMULATED)</span>
              </button>
            </div>
          )}
        </aside>
      </div>
    );
  }

  // ============================================================================
  // STAGE 8 (internal 9) — LIVE RESPONSE TRACKING (MAP-FIRST + UNIT PROGRESSION)
  // ============================================================================
  if (simState.stage === 9) {
    const unitAvail = selectedUnit?.availability || 'ASSIGNED';
    const trackSteps: Array<{ key: string; label: string; done: boolean; active: boolean }> = [
      {
        key: 'ASSIGNED',
        label: 'Assigned',
        done: ['ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE'].includes(unitAvail),
        active: unitAvail === 'ASSIGNED',
      },
      {
        key: 'ACKNOWLEDGED',
        label: 'Acknowledged',
        done: ['EN_ROUTE', 'ON_SCENE'].includes(unitAvail),
        active: unitAvail === 'ACKNOWLEDGED',
      },
      {
        key: 'EN_ROUTE',
        label: 'En Route',
        done: unitAvail === 'ON_SCENE',
        active: unitAvail === 'EN_ROUTE',
      },
      {
        key: 'ON_SCENE',
        label: 'On Scene',
        done: unitAvail === 'ON_SCENE',
        active: false,
      },
    ];

    return (
      <div
        data-testid="sim-stage-tracking"
        className="flex-1 min-h-0 flex flex-col gap-3"
      >
        <div className="flex lg:hidden items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B]">
          <button
            type="button"
            onClick={() => setMobilePane('primary')}
            className={`flex-1 py-2 text-xs font-semibold rounded-md ${
              mobilePane === 'primary'
                ? 'bg-white text-slate-900 dark:bg-blue-600 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Live Response Map
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('secondary')}
            className={`flex-1 py-2 text-xs font-semibold rounded-md ${
              mobilePane === 'secondary'
                ? 'bg-white text-slate-900 dark:bg-blue-600 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Status &amp; Timeline
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Primary Focus Map */}
          <div
            className={`lg:col-span-8 flex-col min-h-0 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-2 ${
              mobilePane === 'primary' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <LagosMap
              incidents={[syntheticStageIncident]}
              units={selectedUnit ? [selectedUnit] : []}
              selectedIncidentId={syntheticStageIncident.id}
              selectedUnitId={selectedUnit?.id || null}
              route={previewRoute}
              focusBoundsPoints={focusBoundsPoints}
              heightClass="h-[380px] lg:h-full min-h-[380px]"
              showLegend={false}
              showInfoCard
            />
          </div>

          {/* Compact Side Tracking Panel */}
          <aside
            className={`lg:col-span-4 flex-col min-h-0 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] overflow-hidden ${
              mobilePane === 'secondary' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <div className="px-4 py-3 border-b border-slate-200 dark:border-[#26364B] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                  Live Response Tracking
                </h2>
              </div>
              <span className="font-mono text-xs font-bold text-cyan-700 dark:text-cyan-300 tabular-nums">
                {simState.trackingProgressPct}%
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 text-xs">
              {/* 4-Step Progression */}
              <div className="grid grid-cols-4 gap-1.5">
                {trackSteps.map((st) => (
                  <div
                    key={st.key}
                    className={`px-2 py-2 rounded-lg text-center border text-[11px] font-semibold ${
                      st.done
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/35 dark:text-emerald-300'
                        : st.active
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-[#0B1220] dark:border-[#26364B] dark:text-slate-400'
                    }`}
                  >
                    {st.label}
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-[#0B1220] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                    style={{ width: `${simState.trackingProgressPct}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {previewRoute?.isSimulatedFallback
                    ? 'Tracking along clearly labelled simulated Lagos corridor'
                    : 'Tracking along OpenRouteService geometry'}
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {selectedUnit?.callsign}
                  </span>
                  {selectedUnit && (
                    <UnitAvailabilityBadge availability={selectedUnit.availability} />
                  )}
                </div>
                <div className="text-slate-600 dark:text-slate-300">
                  Destination:{' '}
                  {syntheticStageIncident.location.correctedDescription ||
                    syntheticStageIncident.location.description}
                </div>
                {selectedUnit && (
                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    Unit Coords: {selectedUnit.lat.toFixed(5)}, {selectedUnit.lng.toFixed(5)}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  Live Timeline ({syntheticStageIncident.timeline.length})
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {syntheticStageIncident.timeline
                    .slice()
                    .reverse()
                    .map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-2.5"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {ev.title}
                          </span>
                          <span className="font-mono tabular-nums">
                            {new Date(ev.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                          {ev.description}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STAGE 9 (internal 10) — ARRIVAL & INCIDENT CLOSURE + FINAL COMPLETION SCREEN
  // ============================================================================
  const finalSummary = buildSimulationFinalSummary(
    syntheticStageIncident,
    selectedUnit,
    previewRoute
  );

  if (simState.completed) {
    const timeline = syntheticStageIncident.timeline;
    const findEv = (type: string) => timeline.find((e) => e.type === type);
    const journeySteps = [
      {
        title: 'Call Received',
        detail: `${scenario.callerPhone} via Local Simulation Voice Adapter`,
        time: findEv('INCIDENT_RECEIVED')?.timestamp || syntheticStageIncident.createdAt,
      },
      {
        title: 'Information Collected',
        detail: `${revealedTurns.length} transcript turns · ${syntheticStageIncident.category} (${syntheticStageIncident.peopleAffected ?? scenario.peopleAffected} affected)`,
        time: syntheticStageIncident.createdAt,
      },
      {
        title: 'Location Identified & Verified',
        detail: `${finalSummary.locationLine}`,
        time:
          syntheticStageIncident.location.verifiedAt ||
          findEv('LOCATION_VERIFIED')?.timestamp ||
          syntheticStageIncident.updatedAt,
      },
      {
        title: 'Incident Created',
        detail: `${syntheticStageIncident.id} (${syntheticStageIncident.priority})`,
        time: findEv('INCIDENT_CREATED')?.timestamp || syntheticStageIncident.createdAt,
      },
      {
        title: 'Operator Takeover',
        detail: `${syntheticStageIncident.assignedOperator || operator.name} assumed workflow control`,
        time:
          syntheticStageIncident.acceptedAt ||
          findEv('OPERATOR_TAKEOVER')?.timestamp ||
          syntheticStageIncident.updatedAt,
      },
      {
        title: 'Dispatch Approved',
        detail: `${selectedUnit?.callsign || 'Response Unit'} authorized by human dispatcher`,
        time:
          syntheticStageIncident.dispatchedAt ||
          findEv('UNIT_ASSIGNED')?.timestamp ||
          syntheticStageIncident.updatedAt,
      },
      {
        title: 'Unit Arrived',
        detail: `Status transitioned Assigned → Acknowledged → En Route → On Scene`,
        time:
          findEv('UNIT_ON_SCENE')?.timestamp ||
          syntheticStageIncident.updatedAt,
      },
      {
        title: 'Incident Closed',
        detail: `Closed cleanly after operator confirmation (${finalSummary.timelineCount} audit events)`,
        time: syntheticStageIncident.resolvedAt || syntheticStageIncident.updatedAt,
      },
    ];

    return (
      <div
        data-testid="sim-stage-completed"
        className="flex-1 min-h-0 overflow-y-auto rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-6 flex flex-col justify-between gap-6"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-[#26364B] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-500/15 dark:border-emerald-500/35 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-mono text-emerald-700 dark:text-emerald-300 font-semibold">
                  SIMULATION COMPLETE · {syntheticStageIncident.id}
                </div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                  End-to-End Emergency Response Simulation Completed
                </h2>
              </div>
            </div>
            <IncidentStatusBadge status={syntheticStageIncident.status} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
            {journeySteps.map((step, idx) => (
              <div
                key={step.title}
                className="rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3.5 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    0{idx + 1}. {step.title}
                  </span>
                  <span className="font-mono tabular-nums">
                    {new Date(step.time).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-200 leading-snug">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
            <strong className="text-slate-900 dark:text-slate-100">Routing Note: </strong>
            {finalSummary.routingNote}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-[#26364B]">
          <button
            type="button"
            disabled={busy}
            onClick={onRestart}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart Simulation</span>
          </button>
          <button
            type="button"
            onClick={onExitSimulation}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white"
          >
            <span>Return to Command Centre</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Stage 10 pre-closure: Arrival Confirmation & Explicit Human Closure Gate
  return (
    <div
      data-testid="sim-stage-arrival-closure"
      className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch"
    >
      <section className="lg:col-span-7 flex flex-col min-h-0 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-[#26364B] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
              Unit Arrival Confirmed — On Scene
            </h2>
          </div>
          <IncidentStatusBadge status={syntheticStageIncident.status} />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 text-xs">
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/35 p-3.5 space-y-1">
            <div className="font-bold text-emerald-900 dark:text-emerald-200">
              {selectedUnit?.callsign} arrived On Scene at{' '}
              {syntheticStageIncident.location.correctedDescription ||
                syntheticStageIncident.location.description}
            </div>
            <p className="text-slate-700 dark:text-slate-300">
              {finalSummary.headline} · {finalSummary.unitLine}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              Arrival &amp; Operations Audit Timeline ({syntheticStageIncident.timeline.length} events)
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {syntheticStageIncident.timeline
                .slice()
                .reverse()
                .map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-2.5"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {ev.title}
                      </span>
                      <span className="font-mono tabular-nums">
                        {new Date(ev.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                      {ev.description}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </section>

      <aside className="lg:col-span-5 flex flex-col min-h-0 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-[#26364B]">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
            Final Incident Summary &amp; Operator Closure
          </h2>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 text-xs">
          <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3.5 space-y-1.5">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Incident: </span>
              <strong className="text-slate-900 dark:text-slate-100">
                {finalSummary.headline}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Location: </span>
              <span className="text-slate-800 dark:text-slate-200">
                {finalSummary.locationLine}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Assigned Unit: </span>
              <span className="text-slate-800 dark:text-slate-200">
                {finalSummary.unitLine}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Routing: </span>
              <span className="text-slate-700 dark:text-slate-300">
                {finalSummary.routingNote}
              </span>
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Operator Closure Note
            </span>
            <textarea
              rows={3}
              value={closureReason}
              onChange={(e) => setClosureReason(e.target.value)}
              className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </label>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Responda requires explicit human operator confirmation to close an emergency incident record.
          </p>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-[#26364B]">
          <button
            type="button"
            disabled={busy || !closureReason.trim()}
            onClick={() =>
              void onCloseIncident(
                syntheticStageIncident.id,
                closureReason.trim()
              )
            }
            data-testid="sim-close-incident-button"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>CLOSE INCIDENT</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
