import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  Bell,
  Bot,
  Headphones,
  HelpCircle,
  LayoutDashboard,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PhoneCall,
  Play,
  Radio,
  Settings,
  ShieldCheck,
  Sun,
  Truck,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  AppSection,
  IncidentPriority,
  IncidentRecord,
  IncidentStatus,
  IntegrationStatus,
  NotificationLog,
  OperatorProfile,
  ResponseUnit,
  RouteResult,
  SimulationRuntimeState,
  SimulationScenarioId,
  SimulationStageNumber,
  UnitAvailability,
  UserRole,
} from './types/responda';
import { AiIntakeWorkspace } from './components/AiIntakeWorkspace';
import { AnalyticsView } from './components/AnalyticsView';
import { CommandCentre } from './components/CommandCentre';
import {
  ConversationCentreView,
  WorkflowDestinationTab,
} from './components/ConversationCentreView';
import { IncidentWorkspace } from './components/IncidentWorkspace';
import { LiveIncidentsView } from './components/LiveIncidentsView';
import { OperatorGuideModal } from './components/OperatorGuideModal';
import { ResponseUnitsView } from './components/ResponseUnitsView';
import { ResponsiveShowcaseView } from './components/ResponsiveShowcaseView';
import { SettingsIntegrationsView } from './components/SettingsIntegrationsView';
import { SimulationControlPanel } from './components/SimulationControlPanel';
import { SimulationWorkspace } from './components/SimulationWorkspace';
import { RespondaLogo } from './components/StatusBadges';
import {
  buildSimulatedCorridorRoute,
  getTrackingMilestoneForElapsed,
  interpolatePointAlongRoute,
  rankUnitsForIncident,
  SIMULATION_SCENARIOS,
  SIMULATION_STAGES,
  SIMULATION_TRACKING_DURATION_SEC,
} from './utils/simulationEngine';
import {
  isSpeechSynthesisSupported,
  pauseSpeech,
  resumeSpeech,
  speakSimulationTurn,
  stopAllSpeech,
} from './utils/voiceSynthesis';

const DEMO_PROFILES: Record<UserRole, OperatorProfile> = {
  Administrator: {
    id: 'op-admin',
    name: 'Dr. Tunde Bakare',
    role: 'Administrator',
    organisation: 'Lagos Private Response Command (Demo)',
    badgeCode: 'ADM-01',
  },
  'Call Operator': {
    id: 'op-call',
    name: 'Amina Bello',
    role: 'Call Operator',
    organisation: 'Lagos Private Response Command (Demo)',
    badgeCode: 'OPR-04',
  },
  Dispatcher: {
    id: 'op-disp',
    name: 'Seyi Ogunleye',
    role: 'Dispatcher',
    organisation: 'Lagos Private Response Command (Demo)',
    badgeCode: 'DSP-02',
  },
  Responder: {
    id: 'op-resp',
    name: 'Unit Lead Chinedu',
    role: 'Responder',
    organisation: 'Lagos Metro EMS (Demo)',
    badgeCode: 'EMS-09',
  },
};

interface ToastMessage {
  id: string;
  text: string;
  tone: 'info' | 'success' | 'error';
}

export default function App() {
  const [section, setSection] = useState<AppSection>('command-centre');
  const [workspaceIncidentId, setWorkspaceIncidentId] = useState<string | null>(null);
  const [workspaceInitialTab, setWorkspaceInitialTab] =
    useState<WorkflowDestinationTab>('overview');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>('INC-2026-1048');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);

  const [userRole, setUserRole] = useState<UserRole>('Dispatcher');
  const operator = DEMO_PROFILES[userRole];

  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [units, setUnits] = useState<ResponseUnit[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [clock, setClock] = useState(() => new Date());
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light'
  );

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', next === 'dark');
      try {
        localStorage.setItem('responda-theme', next);
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  // 10-Stage Live Simulation Engine State
  const [selectedScenario, setSelectedScenario] =
    useState<SimulationScenarioId>('yaba-accident');
  const [simBusy, setSimBusy] = useState(false);
  const [simWorkspaceOpen, setSimWorkspaceOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [simState, setSimState] = useState<SimulationRuntimeState>(() => ({
    active: false,
    paused: false,
    scenarioId: 'yaba-accident',
    stage: 1,
    incidentId: null,
    selectedUnitId: null,
    callStatus: 'IDLE',
    callElapsedSec: 0,
    audioEnabled: true,
    audioPlaying: false,
    speakingSpeaker: null,
    speechSupported: isSpeechSynthesisSupported(),
    revealedTurnCount: 0,
    locationResolvedInSim: false,
    operatorTakenOver: false,
    dispatchApproved: false,
    trackingProgressPct: 0,
    trackingRemainingSec: SIMULATION_TRACKING_DURATION_SEC,
    trackingElapsedSec: 0,
    trackingStatusText: '',
    simulatedArrivalAt: undefined,
    patientPickupStatus: 'PENDING',
    arrivedOnScene: false,
    completed: false,
    activeRoute: null,
    statusMessage: '',
  }));

  const simStateRef = useRef(simState);
  simStateRef.current = simState;
  const incidentsRef = useRef(incidents);
  incidentsRef.current = incidents;
  const unitsRef = useRef(units);
  unitsRef.current = units;
  const simTimersRef = useRef<Set<number>>(new Set());
  const trackingIntervalRef = useRef<number | null>(null);
  const trackingRemainingMsRef = useRef<number>(SIMULATION_TRACKING_DURATION_SEC * 1000);
  const trackingLastTickRef = useRef<number>(0);
  const trackingArrivalHandledRef = useRef<boolean>(false);
  const trackingMilestonesSentRef = useRef<Set<string>>(new Set());
  const speechCancelRef = useRef<(() => void) | null>(null);

  const scheduleSimTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      simTimersRef.current.delete(id);
      fn();
    }, ms);
    simTimersRef.current.add(id);
    return id;
  }, []);

  const stopTrackingInterval = useCallback(() => {
    if (trackingIntervalRef.current !== null) {
      window.clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
  }, []);

  const clearSimExecution = useCallback(() => {
    stopTrackingInterval();
    simTimersRef.current.forEach((id) => window.clearTimeout(id));
    simTimersRef.current.clear();
    if (speechCancelRef.current) {
      speechCancelRef.current();
      speechCancelRef.current = null;
    }
    stopAllSpeech();
  }, [stopTrackingInterval]);

  useEffect(() => {
    return () => {
      clearSimExecution();
    };
  }, [clearSimExecution]);

  // Call duration clock while simulation call is active
  useEffect(() => {
    if (
      !simState.active ||
      simState.paused ||
      simState.callStatus === 'IDLE' ||
      simState.callStatus === 'ENDED'
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setSimState((prev) => ({
        ...prev,
        callElapsedSec: prev.callElapsedSec + 1,
      }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [simState.active, simState.paused, simState.callStatus]);

  const pushToast = useCallback(
    (text: string, tone: 'info' | 'success' | 'error' = 'info') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-1), { id, text, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const fetchBootstrap = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch('/api/bootstrap');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        incidents: IncidentRecord[];
        units: ResponseUnit[];
        notifications: NotificationLog[];
        integrations: IntegrationStatus[];
      };
      setIncidents(data.incidents);
      setUnits(data.units);
      setNotifications(data.notifications);
      setIntegrations(data.integrations);
      setSelectedIncidentId((prev) =>
        prev && data.incidents.some((i) => i.id === prev)
          ? prev
          : data.incidents[0]?.id || null
      );
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? `Failed to connect to RESPONDA server: ${err.message}`
          : 'Failed to load operational data.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  // Live Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Real-time WebSocket Event Sync
  const wsReconnectTimer = useRef<number | null>(null);
  useEffect(() => {
    let ws: WebSocket | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${proto}//${location.host}/ws/events`);

      ws.onopen = () => {
        if (disposed) {
          ws?.close();
          return;
        }
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            event: string;
            payload: unknown;
          };
          if (msg.event === 'incident:created') {
            const inc = msg.payload as IncidentRecord;
            setIncidents((prev) => {
              if (prev.some((i) => i.id === inc.id)) return prev;
              return [inc, ...prev];
            });
          } else if (msg.event === 'incident:updated') {
            const inc = msg.payload as IncidentRecord;
            setIncidents((prev) =>
              prev.map((i) => (i.id === inc.id ? inc : i))
            );
          } else if (msg.event === 'unit:updated') {
            const unit = msg.payload as ResponseUnit;
            setUnits((prev) =>
              prev.map((u) => (u.id === unit.id ? unit : u))
            );
          } else if (msg.event === 'units:sync') {
            setUnits(msg.payload as ResponseUnit[]);
          } else if (msg.event === 'notification:created') {
            const notif = msg.payload as NotificationLog;
            setNotifications((prev) => {
              if (prev.some((n) => n.id === notif.id)) return prev;
              return [notif, ...prev];
            });
          } else if (msg.event === 'state:reset') {
            const fresh = msg.payload as {
              incidents: IncidentRecord[];
              units: ResponseUnit[];
              notifications: NotificationLog[];
            };
            setIncidents(fresh.incidents);
            setUnits(fresh.units);
            setNotifications(fresh.notifications);
          }
        } catch {
          // ignore parse error
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!disposed) {
          wsReconnectTimer.current = window.setTimeout(connect, 2500);
        }
      };
    };

    connect();
    return () => {
      disposed = true;
      if (wsReconnectTimer.current) clearTimeout(wsReconnectTimer.current);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      'x-responda-role': userRole,
      'x-responda-operator': operator.name,
    }),
    [userRole, operator.name]
  );

  // Operational API handlers
  const handleTakeOver = async (id: string) => {
    const res = await fetch(`/api/incidents/${id}/takeover`, {
      method: 'POST',
      headers: authHeaders,
    });
    const data = await res.json();
    if (!res.ok) {
      pushToast(data.error || 'Takeover failed', 'error');
      return;
    }
    setIncidents((prev) => prev.map((i) => (i.id === id ? data.incident : i)));
    if (simStateRef.current.active && simStateRef.current.incidentId === id) {
      setSimState((prev) => ({
        ...prev,
        stage: prev.stage === 5 ? 6 : prev.stage,
        operatorTakenOver: true,
        callStatus: 'OPERATOR_CONNECTED',
        statusMessage: 'Human operator takeover recorded — review incident details before unit selection.',
      }));
      pushToast('Operator accepted incident — Simulation.', 'success');
    } else {
      pushToast(`Human operator takeover completed for ${id}.`, 'success');
    }
  };

  const handleVerifyLocation = async (
    id: string,
    payload: {
      correctedDescription?: string;
      landmark?: string;
      area?: string;
      lat?: number;
      lng?: number;
      markVerified: boolean;
      summary?: string;
      priority?: IncidentPriority;
      peopleAffected?: number | null;
    }
  ) => {
    const res = await fetch(`/api/incidents/${id}/verify-location`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      pushToast(data.error || 'Verification failed', 'error');
      return;
    }
    setIncidents((prev) => prev.map((i) => (i.id === id ? data.incident : i)));
    pushToast(
      payload.markVerified
        ? `Location verified for ${id}.`
        : `Details saved for ${id}.`,
      'success'
    );
  };

  const handleUpdateStatus = async (
    id: string,
    status: IncidentStatus,
    reason: string
  ) => {
    const res = await fetch(`/api/incidents/${id}/status`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ status, reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      pushToast(data.error || 'Status update rejected', 'error');
      return;
    }
    setIncidents((prev) => prev.map((i) => (i.id === id ? data.incident : i)));
    if (Array.isArray(data.units)) {
      setUnits(data.units);
    }
    if (
      status === 'CLOSED' &&
      simStateRef.current.active &&
      simStateRef.current.incidentId === id
    ) {
      clearSimExecution();
      setSimState((prev) => ({
        ...prev,
        stage: 10,
        callStatus: 'ENDED',
        audioPlaying: false,
        speakingSpeaker: null,
        arrivedOnScene: true,
        completed: true,
        statusMessage: 'Simulation completed successfully.',
      }));
      pushToast('Simulation completed successfully.', 'success');
    } else {
      pushToast(`${id} status updated to ${status}.`, 'success');
    }
  };

  const handleDispatchUnit = async (
    incidentId: string,
    unitId: string,
    notes: string,
    notifySms: boolean
  ) => {
    const res = await fetch(`/api/incidents/${incidentId}/dispatch`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        unitId,
        humanConfirmed: true,
        notes,
        notifyUnitSms: notifySms,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      pushToast(data.error || 'Dispatch rejected', 'error');
      return;
    }
    setIncidents((prev) =>
      prev.map((i) => (i.id === incidentId ? data.incident : i))
    );
    setUnits((prev) =>
      prev.map((u) => (u.id === unitId ? data.unit : u))
    );
    if (simStateRef.current.active && simStateRef.current.incidentId === incidentId) {
      setSimState((prev) => ({
        ...prev,
        selectedUnitId: unitId,
        dispatchApproved: true,
        statusMessage: 'Dispatch approved by operator — Simulation.',
      }));
      pushToast('Dispatch approved by operator — Simulation.', 'success');
    } else {
      pushToast(
        `Dispatch approved: ${data.unit.callsign} assigned to ${incidentId}.`,
        'success'
      );
    }
  };

  const handleUpdateUnitStatus = async (
    unitId: string,
    availability: UnitAvailability | 'COMPLETED' | 'CANCELLED'
  ) => {
    const res = await fetch(`/api/units/${unitId}/status`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ availability }),
    });
    const data = await res.json();
    if (!res.ok) {
      pushToast(data.error || 'Unit status update failed', 'error');
      return;
    }
    setUnits((prev) => prev.map((u) => (u.id === unitId ? data.unit : u)));
    if (data.incident) {
      setIncidents((prev) =>
        prev.map((i) => (i.id === data.incident.id ? data.incident : i))
      );
    }
    pushToast(`Unit ${data.unit.callsign} updated (${availability}).`, 'info');
  };

  const handleAddNote = async (id: string, text: string) => {
    const res = await fetch(`/api/incidents/${id}/notes`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) {
      pushToast(data.error || 'Could not add note', 'error');
      return;
    }
    setIncidents((prev) => prev.map((i) => (i.id === id ? data.incident : i)));
    pushToast('Operator note saved to audit trail.', 'success');
  };

  const handleSendOperatorMessage = async (id: string, text: string) => {
    const res = await fetch(`/api/incidents/${id}/transcript`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) {
      pushToast(data.error || 'Could not send operator reply', 'error');
      return;
    }
    setIncidents((prev) => prev.map((i) => (i.id === id ? data.incident : i)));
    pushToast('Operator reply recorded in call transcript.', 'success');
  };

  // 10-Stage Live Simulation Orchestrator
  const syncSimIncident = useCallback(
    async (opts: {
      scenarioId: SimulationScenarioId;
      turnCount: number;
      includeCoords: boolean;
      markLocationResolved: boolean;
    }): Promise<IncidentRecord | null> => {
      const res = await fetch('/api/simulation/incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { incident: IncidentRecord };
      setIncidents((prev) => {
        const exists = prev.some((i) => i.id === data.incident.id);
        return exists
          ? prev.map((i) => (i.id === data.incident.id ? data.incident : i))
          : [data.incident, ...prev];
      });
      setSelectedIncidentId(data.incident.id);
      return data.incident;
    },
    []
  );

  const persistSimUnitMilestone = useCallback(
    async (payload: {
      unitId: string;
      lat: number;
      lng: number;
      availability: UnitAvailability;
      incidentId: string;
      incidentStatus: IncidentStatus;
      timelineTitle: string;
      timelineDescription: string;
      extraTimelineEvents?: Array<{
        type?: IncidentRecord['timeline'][number]['type'];
        title: string;
        description: string;
      }>;
    }) => {
      const res = await fetch('/api/simulation/unit-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const d = (await res.json()) as {
          unit: ResponseUnit;
          incident?: IncidentRecord;
        };
        setUnits((prev) => prev.map((u) => (u.id === d.unit.id ? d.unit : u)));
        if (d.incident) {
          setIncidents((prev) =>
            prev.map((i) => (i.id === d.incident!.id ? d.incident! : i))
          );
        }
      }
    },
    []
  );

  const completeTrackingArrival = useCallback(
    async (
      scenarioId: SimulationScenarioId,
      unitId: string,
      advanceImmediately: boolean = false
    ) => {
      if (trackingArrivalHandledRef.current) return;
      trackingArrivalHandledRef.current = true;
      stopTrackingInterval();
      trackingRemainingMsRef.current = 0;

      const scenario = SIMULATION_SCENARIOS[scenarioId];
      const arrivalIso = new Date().toISOString();

      await persistSimUnitMilestone({
        unitId,
        lat: scenario.resolvedCoords.lat,
        lng: scenario.resolvedCoords.lng,
        availability: 'ON_SCENE',
        incidentId: scenario.incidentId,
        incidentStatus: 'ON_SCENE',
        timelineTitle: 'Response unit arrived (Simulation)',
        timelineDescription: `Response unit has arrived at the incident location (${scenario.verifiedLocationDescription}).`,
        extraTimelineEvents: [
          {
            type: 'STATUS_CHANGED',
            title: 'Patient picked up — En route to hospital (Simulation)',
            description: `Simulated patient pickup recorded. En route to ${scenario.hospitalDestination.name} (Demo Destination).`,
          },
        ],
      });

      setSimState((prev) => ({
        ...prev,
        trackingProgressPct: 100,
        trackingRemainingSec: 0,
        trackingElapsedSec: SIMULATION_TRACKING_DURATION_SEC,
        trackingStatusText: 'Response unit has arrived at the incident location.',
        arrivedOnScene: true,
        simulatedArrivalAt: arrivalIso,
        patientPickupStatus: 'PICKED_UP_EN_ROUTE_TO_HOSPITAL',
        stage: advanceImmediately ? 10 : prev.stage,
        statusMessage: advanceImmediately
          ? SIMULATION_STAGES[9].nextExpectedAction
          : `RESPONSE UNIT ARRIVED — PATIENT PICKED UP — EN ROUTE TO HOSPITAL (${scenario.hospitalDestination.name} · Simulated).`,
      }));

      pushToast(
        `Response unit arrived — patient picked up (en route to ${scenario.hospitalDestination.name} · Demo).`,
        'success'
      );

      if (!advanceImmediately) {
        scheduleSimTimeout(() => {
          if (
            !simStateRef.current.active ||
            simStateRef.current.paused ||
            simStateRef.current.stage !== 9
          ) {
            return;
          }
          setSimState((prev) => ({
            ...prev,
            stage: 10,
            arrivedOnScene: true,
            statusMessage: SIMULATION_STAGES[9].nextExpectedAction,
          }));
        }, 2500);
      }
    },
    [persistSimUnitMilestone, pushToast, scheduleSimTimeout, stopTrackingInterval]
  );

  const runSimulationTracking = useCallback(
    async (
      scenarioId: SimulationScenarioId,
      unitId: string,
      routeToUse: RouteResult,
      options: { resumeExisting?: boolean } = {}
    ) => {
      const scenario = SIMULATION_SCENARIOS[scenarioId];
      const totalMs = SIMULATION_TRACKING_DURATION_SEC * 1000;
      const coords =
        routeToUse.coordinates && routeToUse.coordinates.length >= 2
          ? routeToUse.coordinates
          : buildSimulatedCorridorRoute(
              unitsRef.current.find((u) => u.id === unitId)?.lat ?? 6.5068,
              unitsRef.current.find((u) => u.id === unitId)?.lng ?? 3.3775,
              scenario.resolvedCoords.lat,
              scenario.resolvedCoords.lng
            ).coordinates!;

      stopTrackingInterval();

      if (!options.resumeExisting) {
        trackingRemainingMsRef.current = totalMs;
        trackingArrivalHandledRef.current = false;
        trackingMilestonesSentRef.current = new Set(['DEPARTED']);
        const startMilestone = getTrackingMilestoneForElapsed(
          0,
          SIMULATION_TRACKING_DURATION_SEC,
          scenario.area
        );
        const [startLat, startLng] = interpolatePointAlongRoute(coords, 0);

        setSimState((prev) => ({
          ...prev,
          trackingRemainingSec: SIMULATION_TRACKING_DURATION_SEC,
          trackingElapsedSec: 0,
          trackingProgressPct: 0,
          trackingStatusText: startMilestone.statusText,
          arrivedOnScene: false,
          simulatedArrivalAt: undefined,
          patientPickupStatus: 'PENDING',
          statusMessage: `${startMilestone.statusText} (01:00 simulated countdown active)`,
        }));

        await persistSimUnitMilestone({
          unitId,
          lat: startLat,
          lng: startLng,
          availability: startMilestone.availability,
          incidentId: scenario.incidentId,
          incidentStatus: 'RESPONDING',
          timelineTitle: startMilestone.timelineTitle,
          timelineDescription: startMilestone.timelineDescription,
        });
      }

      if (trackingArrivalHandledRef.current || trackingRemainingMsRef.current <= 0) {
        void completeTrackingArrival(scenarioId, unitId);
        return;
      }

      trackingLastTickRef.current = Date.now();
      trackingIntervalRef.current = window.setInterval(() => {
        const cur = simStateRef.current;
        if (!cur.active || cur.paused || cur.stage !== 9) {
          stopTrackingInterval();
          return;
        }

        const now = Date.now();
        const deltaMs = Math.max(0, now - trackingLastTickRef.current);
        trackingLastTickRef.current = now;

        const nextRemainingMs = Math.max(0, trackingRemainingMsRef.current - deltaMs);
        trackingRemainingMsRef.current = nextRemainingMs;

        const remainingSec = Math.ceil(nextRemainingMs / 1000);
        const elapsedSec = Math.max(
          0,
          Math.min(SIMULATION_TRACKING_DURATION_SEC, SIMULATION_TRACKING_DURATION_SEC - remainingSec)
        );
        const exactPct = Math.min(
          100,
          Math.round(((totalMs - nextRemainingMs) / totalMs) * 100)
        );

        const milestone = getTrackingMilestoneForElapsed(
          elapsedSec,
          SIMULATION_TRACKING_DURATION_SEC,
          scenario.area
        );

        const [lat, lng] = interpolatePointAlongRoute(coords, exactPct);
        setUnits((prev) =>
          prev.map((u) => (u.id === unitId ? { ...u, lat, lng, availability: milestone.availability } : u))
        );

        if (
          (milestone.milestoneKey === 'EN_ROUTE' || milestone.milestoneKey === 'APPROACHING') &&
          !trackingMilestonesSentRef.current.has(milestone.milestoneKey)
        ) {
          trackingMilestonesSentRef.current.add(milestone.milestoneKey);
          void persistSimUnitMilestone({
            unitId,
            lat,
            lng,
            availability: milestone.availability,
            incidentId: scenario.incidentId,
            incidentStatus: 'RESPONDING',
            timelineTitle: milestone.timelineTitle,
            timelineDescription: milestone.timelineDescription,
          });
          if (milestone.milestoneKey === 'EN_ROUTE') {
            pushToast('Emergency vehicle is en route — Simulation.', 'info');
          }
        }

        if (nextRemainingMs <= 0) {
          void completeTrackingArrival(scenarioId, unitId);
          return;
        }

        setSimState((prev) => ({
          ...prev,
          trackingRemainingSec: remainingSec,
          trackingElapsedSec: elapsedSec,
          trackingProgressPct: exactPct,
          trackingStatusText: milestone.statusText,
          statusMessage: `${milestone.statusText} (${String(
            Math.floor(remainingSec / 60)
          ).padStart(2, '0')}:${String(remainingSec % 60).padStart(2, '0')} remaining)`,
        }));
      }, 250);
    },
    [completeTrackingArrival, persistSimUnitMilestone, pushToast, stopTrackingInterval]
  );

  const playDialogueSequence = useCallback(
    (scenarioId: SimulationScenarioId, startIndex: number) => {
      const scenario = SIMULATION_SCENARIOS[scenarioId];
      const runTurn = async (turnIdx: number) => {
        const cur = simStateRef.current;
        if (!cur.active || cur.paused || (cur.stage !== 2 && cur.stage !== 3)) {
          return;
        }
        if (turnIdx >= scenario.dialogue.length) {
          setSimState((prev) => ({
            ...prev,
            audioPlaying: false,
            speakingSpeaker: null,
            stage: 4,
            locationResolvedInSim: true,
            statusMessage: SIMULATION_STAGES[3].nextExpectedAction,
          }));
          await syncSimIncident({
            scenarioId,
            turnCount: scenario.dialogue.length,
            includeCoords: true,
            markLocationResolved: false,
          });
          return;
        }

        const turn = scenario.dialogue[turnIdx];
        const nextStage: SimulationStageNumber = turnIdx >= 2 ? 3 : 2;
        await syncSimIncident({
          scenarioId,
          turnCount: turnIdx + 1,
          includeCoords: false,
          markLocationResolved: false,
        });

        setSimState((prev) => ({
          ...prev,
          stage: nextStage,
          revealedTurnCount: turnIdx + 1,
          statusMessage:
            nextStage === 2
              ? `AI Voice Intake turn ${turnIdx + 1}/${scenario.dialogue.length} — extracting details.`
              : `Voice playback turn ${turnIdx + 1}/${scenario.dialogue.length} — ${turn.speaker} speaking.`,
        }));

        speechCancelRef.current = speakSimulationTurn({
          speaker: turn.speaker,
          text: turn.text,
          enabled: simStateRef.current.audioEnabled,
          onStart: () => {
            setSimState((prev) => ({
              ...prev,
              audioPlaying: true,
              speakingSpeaker: turn.speaker,
            }));
          },
          onEnd: () => {
            setSimState((prev) => ({
              ...prev,
              audioPlaying: false,
              speakingSpeaker: null,
            }));
            if (simStateRef.current.active && !simStateRef.current.paused) {
              scheduleSimTimeout(() => {
                void runTurn(turnIdx + 1);
              }, 350);
            }
          },
        });
      };

      void runTurn(startIndex);
    },
    [scheduleSimTimeout, syncSimIncident]
  );

  const startSimulation = useCallback(
    async (scenarioIdOverride?: SimulationScenarioId) => {
      const targetId = scenarioIdOverride || selectedScenario;
      const scenario = SIMULATION_SCENARIOS[targetId];
      clearSimExecution();
      setSimBusy(true);
      try {
        setSelectedScenario(targetId);
        const res = await fetch('/api/simulation/prepare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenarioId: targetId }),
        });
        if (res.ok) {
          const fresh = (await res.json()) as {
            incidents: IncidentRecord[];
            units: ResponseUnit[];
            notifications: NotificationLog[];
          };
          setIncidents(fresh.incidents);
          setUnits(fresh.units);
          setNotifications(fresh.notifications);
        }

        setActiveRoute(null);
        setSelectedUnitId(null);
        setWorkspaceIncidentId(null);
        setSimWorkspaceOpen(true);
        setSidebarCollapsed(true);

        trackingRemainingMsRef.current = SIMULATION_TRACKING_DURATION_SEC * 1000;
        trackingArrivalHandledRef.current = false;
        trackingMilestonesSentRef.current.clear();

        setSimState({
          active: true,
          paused: false,
          scenarioId: targetId,
          stage: 1,
          incidentId: scenario.incidentId,
          selectedUnitId: null,
          callStatus: 'INCOMING',
          callElapsedSec: 0,
          audioEnabled: simStateRef.current.audioEnabled,
          audioPlaying: false,
          speakingSpeaker: null,
          speechSupported: isSpeechSynthesisSupported(),
          revealedTurnCount: 0,
          locationResolvedInSim: false,
          operatorTakenOver: false,
          dispatchApproved: false,
          trackingProgressPct: 0,
          trackingRemainingSec: SIMULATION_TRACKING_DURATION_SEC,
          trackingElapsedSec: 0,
          trackingStatusText: 'Response unit awaiting dispatch.',
          simulatedArrivalAt: undefined,
          patientPickupStatus: 'PENDING',
          arrivedOnScene: false,
          completed: false,
          activeRoute: null,
          statusMessage: SIMULATION_STAGES[0].nextExpectedAction,
        });

        pushToast(scenario.incomingCallNotification, 'info');
      } finally {
        setSimBusy(false);
      }
    },
    [clearSimExecution, pushToast, selectedScenario]
  );

  const answerSimulationCall = useCallback(async () => {
    const cur = simStateRef.current;
    if (!cur.active) return;
    clearSimExecution();
    const scenario = SIMULATION_SCENARIOS[cur.scenarioId];
    setWorkspaceIncidentId(null);
    setSimState((prev) => ({
      ...prev,
      stage: 2,
      callStatus: 'CONNECTED_AI',
      revealedTurnCount: 1,
      statusMessage: SIMULATION_STAGES[1].nextExpectedAction,
    }));
    await syncSimIncident({
      scenarioId: cur.scenarioId,
      turnCount: 1,
      includeCoords: false,
      markLocationResolved: false,
    });
    if (!simStateRef.current.paused) {
      playDialogueSequence(cur.scenarioId, 0);
    } else {
      setSimState((prev) => ({
        ...prev,
        statusMessage: `Paused at AI Intake (${scenario.incidentId}). Click Resume or Next Step.`,
      }));
    }
  }, [clearSimExecution, playDialogueSequence, syncSimIncident]);

  const advanceSimulationStage = useCallback(async () => {
    const cur = simStateRef.current;
    if (!cur.active || cur.completed) return;
    const scenario = SIMULATION_SCENARIOS[cur.scenarioId];
    clearSimExecution();
    setSimBusy(true);

    try {
      if (cur.stage === 1) {
        await answerSimulationCall();
        return;
      }

      if (cur.stage === 2 || cur.stage === 3) {
        // Reveal full transcript and advance to Stage 4: Location Intelligence
        await syncSimIncident({
          scenarioId: cur.scenarioId,
          turnCount: scenario.dialogue.length,
          includeCoords: true,
          markLocationResolved: false,
        });
        setSimState((prev) => ({
          ...prev,
          stage: 4,
          audioPlaying: false,
          speakingSpeaker: null,
          revealedTurnCount: scenario.dialogue.length,
          locationResolvedInSim: true,
          statusMessage: SIMULATION_STAGES[3].nextExpectedAction,
        }));
        setWorkspaceInitialTab('location');
        setWorkspaceIncidentId(scenario.incidentId);
        return;
      }

      if (cur.stage === 4) {
        // Stage 4 -> 5: Structured Incident Created -> Human Operator Takeover Screen
        await syncSimIncident({
          scenarioId: cur.scenarioId,
          turnCount: scenario.dialogue.length,
          includeCoords: true,
          markLocationResolved: true,
        });
        setSelectedIncidentId(scenario.incidentId);
        setSimState((prev) => ({
          ...prev,
          stage: 5,
          statusMessage: SIMULATION_STAGES[4].nextExpectedAction,
        }));
        pushToast('Structured incident created — ready for human operator takeover.', 'success');
        return;
      }

      if (cur.stage === 5) {
        // Stage 5 -> 6: Execute Human Operator Takeover -> Enter Incident Review
        if (userRole === 'Responder') setUserRole('Dispatcher');
        const takeoverHeaders = {
          'Content-Type': 'application/json',
          'x-responda-role': userRole === 'Responder' ? 'Dispatcher' : userRole,
          'x-responda-operator': operator.name,
        };
        const tRes = await fetch(`/api/incidents/${scenario.incidentId}/takeover`, {
          method: 'POST',
          headers: takeoverHeaders,
        });
        if (tRes.ok) {
          const td = (await tRes.json()) as { incident: IncidentRecord };
          setIncidents((prev) =>
            prev.map((i) => (i.id === scenario.incidentId ? td.incident : i))
          );
        }
        setSimState((prev) => ({
          ...prev,
          stage: 6,
          callStatus: 'OPERATOR_CONNECTED',
          operatorTakenOver: true,
          statusMessage: 'Human operator takeover complete. Review details & verify location.',
        }));
        pushToast('Operator accepted incident — Simulation.', 'success');
        return;
      }

      if (cur.stage === 6) {
        // Stage 6 -> 7: Ensure location verified, rank units, enter Response Unit Selection
        const inc =
          incidentsRef.current.find((i) => i.id === scenario.incidentId) ||
          (await syncSimIncident({
            scenarioId: cur.scenarioId,
            turnCount: scenario.dialogue.length,
            includeCoords: true,
            markLocationResolved: true,
          }));

        if (inc && inc.location.verificationStatus !== 'VERIFIED') {
          const verifyHeaders = {
            'Content-Type': 'application/json',
            'x-responda-role': userRole === 'Responder' ? 'Dispatcher' : userRole,
            'x-responda-operator': operator.name,
          };
          const vRes = await fetch(
            `/api/incidents/${scenario.incidentId}/verify-location`,
            {
              method: 'POST',
              headers: verifyHeaders,
              body: JSON.stringify({
                correctedDescription: scenario.verifiedLocationDescription,
                landmark: scenario.landmark,
                area: scenario.area,
                lat: scenario.resolvedCoords.lat,
                lng: scenario.resolvedCoords.lng,
                markVerified: true,
              }),
            }
          );
          if (vRes.ok) {
            const vd = (await vRes.json()) as { incident: IncidentRecord };
            setIncidents((prev) =>
              prev.map((i) => (i.id === scenario.incidentId ? vd.incident : i))
            );
          }
        }

        const ranked = inc
          ? rankUnitsForIncident(
              unitsRef.current,
              inc,
              scenario.recommendedUnitId
            )
          : [];
        const bestUnit =
          ranked.find((r) => r.unit.availability === 'AVAILABLE')?.unit ||
          unitsRef.current.find((u) => u.id === scenario.recommendedUnitId) ||
          unitsRef.current.find((u) => u.availability === 'AVAILABLE') ||
          null;

        setSelectedIncidentId(scenario.incidentId);
        if (bestUnit) setSelectedUnitId(bestUnit.id);

        setSimState((prev) => ({
          ...prev,
          stage: 7,
          locationResolvedInSim: true,
          selectedUnitId: bestUnit?.id || scenario.recommendedUnitId,
          statusMessage: bestUnit
            ? `Recommended unit ${bestUnit.callsign} highlighted for review.`
            : SIMULATION_STAGES[6].nextExpectedAction,
        }));
        return;
      }

      if (cur.stage === 7) {
        // Stage 7 -> 8: Calculate route and enter Dedicated Dispatch Approval screen (do NOT pre-dispatch)
        const targetUnitId = cur.selectedUnitId || scenario.recommendedUnitId;
        const targetUnit =
          unitsRef.current.find((u) => u.id === targetUnitId) ||
          unitsRef.current.find((u) => u.availability === 'AVAILABLE');
        if (!targetUnit) return;

        const routeRes = await fetch('/api/routing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromLat: targetUnit.lat,
            fromLng: targetUnit.lng,
            toLat: scenario.resolvedCoords.lat,
            toLng: scenario.resolvedCoords.lng,
            allowSimulatedOverlay: true,
          }),
        });
        const calculatedRoute: RouteResult = routeRes.ok
          ? await routeRes.json()
          : buildSimulatedCorridorRoute(
              targetUnit.lat,
              targetUnit.lng,
              scenario.resolvedCoords.lat,
              scenario.resolvedCoords.lng
            );

        setActiveRoute(calculatedRoute);
        setSimState((prev) => ({
          ...prev,
          stage: 8,
          selectedUnitId: targetUnit.id,
          dispatchApproved: false,
          activeRoute: calculatedRoute,
          statusMessage: 'Explicit human dispatch authorization required before unit mobilisation.',
        }));
        return;
      }

      if (cur.stage === 8) {
        // Stage 8 -> 9: Perform human-confirmed dispatch (if not yet approved), show confirmation, then begin tracking
        const unitId = cur.selectedUnitId || scenario.recommendedUnitId;
        const targetUnit =
          unitsRef.current.find((u) => u.id === unitId) ||
          unitsRef.current.find((u) => u.availability === 'AVAILABLE');
        const routeToUse =
          cur.activeRoute ||
          activeRoute ||
          buildSimulatedCorridorRoute(
            targetUnit?.lat ?? 6.5068,
            targetUnit?.lng ?? 3.3775,
            scenario.resolvedCoords.lat,
            scenario.resolvedCoords.lng
          );

        if (!cur.dispatchApproved && targetUnit) {
          const dispatchHeaders = {
            'Content-Type': 'application/json',
            'x-responda-role': userRole === 'Responder' ? 'Dispatcher' : userRole,
            'x-responda-operator': operator.name,
          };
          const dRes = await fetch(
            `/api/incidents/${scenario.incidentId}/dispatch`,
            {
              method: 'POST',
              headers: dispatchHeaders,
              body: JSON.stringify({
                unitId: targetUnit.id,
                humanConfirmed: true,
                notes: `Simulation Dispatch: ${targetUnit.callsign} approved by ${operator.name}.`,
                notifyUnitSms: true,
              }),
            }
          );
          if (dRes.ok) {
            const dd = await dRes.json();
            setIncidents((prev) =>
              prev.map((i) => (i.id === scenario.incidentId ? dd.incident : i))
            );
            setUnits((prev) =>
              prev.map((u) => (u.id === targetUnit.id ? dd.unit : u))
            );
          }
          setSimState((prev) => ({
            ...prev,
            selectedUnitId: targetUnit.id,
            dispatchApproved: true,
            activeRoute: routeToUse,
            statusMessage: 'Dispatch approved by human operator (Simulated). Initiating route tracking...',
          }));
          pushToast('Dispatch approved by operator — Simulation.', 'success');

          scheduleSimTimeout(() => {
            if (!simStateRef.current.active || simStateRef.current.paused) return;
            setSimState((prev) => ({
              ...prev,
              stage: 9,
              trackingProgressPct: 0,
              trackingRemainingSec: SIMULATION_TRACKING_DURATION_SEC,
              trackingElapsedSec: 0,
              trackingStatusText: 'Response unit has departed.',
              patientPickupStatus: 'PENDING',
              arrivedOnScene: false,
              activeRoute: routeToUse,
              statusMessage: SIMULATION_STAGES[8].nextExpectedAction,
            }));
            void runSimulationTracking(cur.scenarioId, targetUnit.id, routeToUse);
          }, 1150);
          return;
        }

        setSimState((prev) => ({
          ...prev,
          stage: 9,
          trackingProgressPct: 0,
          trackingRemainingSec: SIMULATION_TRACKING_DURATION_SEC,
          trackingElapsedSec: 0,
          trackingStatusText: 'Response unit has departed.',
          patientPickupStatus: 'PENDING',
          arrivedOnScene: false,
          activeRoute: routeToUse,
          statusMessage: SIMULATION_STAGES[8].nextExpectedAction,
        }));
        void runSimulationTracking(cur.scenarioId, unitId, routeToUse);
        return;
      }

      if (cur.stage === 9) {
        // Fast-forward tracking directly through Arrival & Hospital Pickup to Stage 10 (Closure)
        const unitId = cur.selectedUnitId || scenario.recommendedUnitId;
        if (!trackingArrivalHandledRef.current) {
          await completeTrackingArrival(cur.scenarioId, unitId, true);
        } else {
          setSimState((prev) => ({
            ...prev,
            stage: 10,
            trackingRemainingSec: 0,
            trackingElapsedSec: SIMULATION_TRACKING_DURATION_SEC,
            trackingProgressPct: 100,
            arrivedOnScene: true,
            statusMessage: SIMULATION_STAGES[9].nextExpectedAction,
          }));
        }
        return;
      }

      if (cur.stage === 10) {
        // Close incident cleanly & complete simulation
        const statusHeaders = {
          'Content-Type': 'application/json',
          'x-responda-role': userRole === 'Responder' ? 'Dispatcher' : userRole,
          'x-responda-operator': operator.name,
        };
        const cRes = await fetch(`/api/incidents/${scenario.incidentId}/status`, {
          method: 'POST',
          headers: statusHeaders,
          body: JSON.stringify({
            status: 'CLOSED',
            reason:
              'Simulation completed successfully — unit arrived on scene and incident closed.',
          }),
        });
        if (cRes.ok) {
          const cd = await cRes.json();
          setIncidents((prev) =>
            prev.map((i) => (i.id === scenario.incidentId ? cd.incident : i))
          );
        }
        setSimState((prev) => ({
          ...prev,
          stage: 10,
          callStatus: 'ENDED',
          arrivedOnScene: true,
          completed: true,
          statusMessage: 'Simulation completed successfully.',
        }));
        pushToast('Simulation completed successfully.', 'success');
      }
    } finally {
      setSimBusy(false);
    }
  }, [
    activeRoute,
    answerSimulationCall,
    clearSimExecution,
    completeTrackingArrival,
    operator.name,
    pushToast,
    runSimulationTracking,
    syncSimIncident,
    userRole,
  ]);

  // Automatic progression between non-speech stages when unpaused
  useEffect(() => {
    if (!simState.active || simState.paused || simState.completed) return;
    // Stages 2 & 3 are driven by playDialogueSequence; Stage 9 is driven by runSimulationTracking
    if (simState.stage === 2 || simState.stage === 3 || simState.stage === 9) {
      return;
    }
    // Stage 8 waits briefly during confirmation animation before entering Stage 9
    if (simState.stage === 8 && simState.dispatchApproved) {
      return;
    }
    // At Stage 10, pause for explicit user Close Incident click (or Next Step)
    if (simState.stage === 10) return;

    const delayMs =
      simState.stage === 5 || simState.stage === 8 ? 3400 : 2600;
    const id = scheduleSimTimeout(() => {
      if (
        simStateRef.current.active &&
        !simStateRef.current.paused &&
        !simStateRef.current.completed &&
        simStateRef.current.stage === simState.stage
      ) {
        void advanceSimulationStage();
      }
    }, delayMs);

    return () => {
      window.clearTimeout(id);
      simTimersRef.current.delete(id);
    };
  }, [
    simState.active,
    simState.paused,
    simState.completed,
    simState.stage,
    simState.dispatchApproved,
    advanceSimulationStage,
    scheduleSimTimeout,
  ]);

  const handleToggleSimPause = useCallback(() => {
    setSimState((prev) => {
      const nextPaused = !prev.paused;
      if (nextPaused) {
        clearSimExecution();
        pauseSpeech();
      } else {
        resumeSpeech();
        if ((prev.stage === 2 || prev.stage === 3) && prev.active) {
          scheduleSimTimeout(() => {
            playDialogueSequence(
              prev.scenarioId,
              Math.max(0, prev.revealedTurnCount)
            );
          }, 150);
        } else if (prev.stage === 9 && prev.active && prev.selectedUnitId) {
          if (prev.arrivedOnScene) {
            scheduleSimTimeout(() => {
              setSimState((s) => ({
                ...s,
                stage: 10,
                statusMessage: SIMULATION_STAGES[9].nextExpectedAction,
              }));
            }, 600);
          } else {
            const routeToUse =
              prev.activeRoute ||
              buildSimulatedCorridorRoute(
                6.5068,
                3.3775,
                SIMULATION_SCENARIOS[prev.scenarioId].resolvedCoords.lat,
                SIMULATION_SCENARIOS[prev.scenarioId].resolvedCoords.lng
              );
            scheduleSimTimeout(() => {
              void runSimulationTracking(
                prev.scenarioId,
                prev.selectedUnitId!,
                routeToUse,
                { resumeExisting: true }
              );
            }, 100);
          }
        }
      }
      return {
        ...prev,
        paused: nextPaused,
        audioPlaying: nextPaused ? false : prev.audioPlaying,
      };
    });
  }, [clearSimExecution, playDialogueSequence, runSimulationTracking, scheduleSimTimeout]);

  const handleToggleSimAudio = useCallback(() => {
    setSimState((prev) => {
      const nextAudio = !prev.audioEnabled;
      if (!nextAudio) {
        stopAllSpeech();
      }
      return {
        ...prev,
        audioEnabled: nextAudio,
        audioPlaying: nextAudio ? prev.audioPlaying : false,
      };
    });
  }, []);

  const handleExitSimulationWorkspace = useCallback(() => {
    setSimWorkspaceOpen(false);
    setSidebarCollapsed(false);
    setWorkspaceIncidentId(null);
    setSection('command-centre');
    pushToast('Returned to Command Centre. Active simulation preserved.', 'info');
  }, [pushToast]);

  const handleEndSimulation = useCallback(() => {
    clearSimExecution();
    setSimWorkspaceOpen(false);
    setSidebarCollapsed(false);
    setSimState((prev) => ({
      ...prev,
      active: false,
      paused: false,
      callStatus: 'IDLE',
      audioPlaying: false,
      speakingSpeaker: null,
    }));
    pushToast('Live simulation ended cleanly.', 'info');
  }, [clearSimExecution, pushToast]);

  const workspaceIncident = workspaceIncidentId
    ? incidents.find((i) => i.id === workspaceIncidentId) || null
    : null;

  const geminiConfigured =
    integrations.find((i) => i.id === 'gemini')?.configured ?? false;
  const carrierConfigured =
    integrations.find((i) => i.id === 'carrier_location')?.configured ?? false;

  const navItems: Array<{
    id: AppSection;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    {
      id: 'command-centre',
      label: 'Command Centre',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'live-incidents',
      label: 'Live Incidents',
      icon: <AlertTriangle className="w-4 h-4" />,
      badge: incidents.filter(
        (i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED'
      ).length,
    },
    {
      id: 'conversation-centre',
      label: 'Conversation Centre',
      icon: <Headphones className="w-4 h-4" />,
      badge: incidents.filter(
        (i) =>
          i.aiIntakeActive && i.status !== 'RESOLVED' && i.status !== 'CLOSED'
      ).length,
    },
    {
      id: 'ai-intake',
      label: 'AI Intake',
      icon: <Bot className="w-4 h-4" />,
    },
    {
      id: 'response-units',
      label: 'Response Units',
      icon: <Truck className="w-4 h-4" />,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: 'incident-history',
      label: 'Incident History',
      icon: <Archive className="w-4 h-4" />,
    },
    {
      id: 'responsive-showcase',
      label: 'Responsive Showcase',
      icon: <Monitor className="w-4 h-4" />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  const navigateTo = (target: AppSection) => {
    setSimWorkspaceOpen(false);
    setWorkspaceIncidentId(null);
    setSection(target);
    setMobileMenuOpen(false);
    setMoreMenuOpen(false);
  };

  const isImmersiveSimActive = simState.active && simWorkspaceOpen;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-[#0B1220] dark:text-[#F8FAFC]">
      {/* Competition Disclaimer Strip */}
      <div className="bg-amber-50 border-b border-amber-200 text-amber-900 dark:bg-[#111C2E] dark:border-[#26364B] dark:text-amber-200/90 px-4 py-1.5 text-[11px] flex items-center justify-center gap-2 text-center">
        <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>
          Responda competition prototype. Not connected to a public emergency number or live emergency-response network. Do not use for real emergencies.
        </span>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Desktop Collapsible Left Sidebar */}
        <aside
          className={`hidden lg:flex lg:flex-col bg-white border-r border-slate-200 dark:bg-[#111C2E] dark:border-[#26364B] shrink-0 transition-all duration-200 ${
            sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-64'
          }`}
        >
          <div
            className={`p-3.5 border-b border-slate-200 dark:border-[#26364B] flex items-center ${
              sidebarCollapsed ? 'justify-center' : 'justify-between gap-2'
            }`}
          >
            {!sidebarCollapsed && <RespondaLogo />}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={sidebarCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
              title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] text-slate-700 dark:text-slate-200 transition-colors"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          <nav aria-label="Primary navigation" className="flex-1 p-2.5 space-y-1">
            {navItems.map((item) => {
              const active =
                !isImmersiveSimActive && !workspaceIncident && section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={sidebarCollapsed ? item.label : undefined}
                  onClick={() => navigateTo(item.id)}
                  className={`w-full flex items-center ${
                    sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-3'
                  } gap-2 py-2.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#172438] dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.icon}
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </span>
                  {!sidebarCollapsed && item.badge !== undefined && (
                    <span
                      className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                        active
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 text-slate-700 dark:bg-[#172438] dark:text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer: Hotline Notice & Real Connection Status */}
          {!sidebarCollapsed && (
            <div className="p-3 space-y-2.5 border-t border-slate-200 dark:border-[#26364B]">
              <div className="rounded-xl bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/30 p-3 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-red-700 dark:text-red-300">
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Simulated Demo Ops</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                  Lagos Private Command Prototype. Human approval required for all dispatches.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 dark:bg-[#0B1220] dark:border-[#26364B] px-3 py-2.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  {wsConnected ? (
                    <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  )}
                  <span>{wsConnected ? 'Live Sync Active' : 'Reconnecting'}</span>
                </span>
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">WS</span>
              </div>
            </div>
          )}
        </aside>

        {/* Mobile Drawer Sidebar */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[900] lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/50 dark:bg-black/60"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="relative w-64 max-w-[80vw] bg-white border-r border-slate-200 dark:bg-[#111C2E] dark:border-[#26364B] flex flex-col z-10">
              <div className="p-4 border-b border-slate-200 dark:border-[#26364B] flex items-center justify-between">
                <RespondaLogo />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="flex-1 p-3 space-y-1">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${
                      !workspaceIncident && section === item.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#172438]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {item.icon}
                      <span>{item.label}</span>
                    </span>
                  </button>
                ))}
              </nav>
            </aside>
          </div>
        )}

        {/* Right Main Content Column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Navigation Bar */}
          <header className="bg-white border-b border-slate-200 dark:bg-[#111C2E] dark:border-[#26364B] px-3 sm:px-4 lg:px-6 py-3 flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className="lg:hidden p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 dark:bg-[#172438] dark:border-[#26364B] dark:text-slate-200 shrink-0"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="lg:hidden shrink-0">
                <RespondaLogo compact />
              </div>
              <div className="hidden sm:block truncate">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {operator.organisation}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {clock.toLocaleDateString('en-NG', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}{' '}
                  · {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Switch to White Light Mode' : 'Switch to Midnight Dark Mode'}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-700 dark:bg-[#172438] dark:hover:bg-[#1E293B] dark:border-[#26364B] dark:text-slate-200 transition-colors whitespace-nowrap"
              >
                {theme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-slate-700" />
                )}
                <span className="hidden sm:inline">
                  {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                title="First-time operator walkthrough and 8-step workflow guide"
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-blue-700 dark:bg-[#172438] dark:hover:bg-[#1E293B] dark:border-[#26364B] dark:text-blue-300 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Operator Guide</span>
              </button>

              {/* Demo Role Selector */}
              <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg bg-slate-50 border border-slate-200 dark:bg-[#0B1220] dark:border-[#26364B] px-2 sm:px-2.5 py-1">
                <span className="hidden md:inline text-[11px] text-slate-500 dark:text-slate-400">
                  Demo Role:
                </span>
                <label htmlFor="role-selector" className="sr-only">
                  Select demonstration operator role
                </label>
                <select
                  id="role-selector"
                  value={userRole}
                  onChange={(e) => {
                    const nextRole = e.target.value as UserRole;
                    setUserRole(nextRole);
                    pushToast(
                      `Switched demo account to ${DEMO_PROFILES[nextRole].name} (${nextRole}).`,
                      'info'
                    );
                  }}
                  className="bg-transparent text-xs font-semibold text-blue-700 dark:text-blue-300 focus:outline-none max-w-[135px] sm:max-w-none truncate"
                >
                  <option value="Dispatcher" className="bg-white text-slate-900 dark:bg-[#111C2E] dark:text-slate-100">
                    Dispatcher · Seyi O.
                  </option>
                  <option value="Call Operator" className="bg-white text-slate-900 dark:bg-[#111C2E] dark:text-slate-100">
                    Call Operator · Amina B.
                  </option>
                  <option value="Administrator" className="bg-white text-slate-900 dark:bg-[#111C2E] dark:text-slate-100">
                    Administrator · Dr. Bakare
                  </option>
                  <option value="Responder" className="bg-white text-slate-900 dark:bg-[#111C2E] dark:text-slate-100">
                    Responder · Unit Lead
                  </option>
                </select>
              </div>

              {/* Notification Centre */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((o) => !o)}
                  aria-label="Toggle notification centre"
                  className="relative p-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-[#172438] dark:hover:bg-[#1E293B] dark:border-[#26364B] dark:text-slate-200 transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-[10px] font-mono font-bold text-white flex items-center justify-center">
                      {Math.min(9, notifications.length)}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white border border-slate-200 dark:bg-[#111C2E] dark:border-[#26364B] shadow-2xl z-[800] p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#26364B] pb-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Notification Centre
                      </span>
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        className="text-[11px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        Close
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {notifications.length === 0 ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                          No notifications recorded.
                        </div>
                      ) : (
                        notifications.slice(0, 8).map((n) => (
                          <div
                            key={n.id}
                            className="rounded-lg bg-slate-50 border border-slate-200 dark:bg-[#0B1220] dark:border-[#26364B] p-2.5 text-[11px] space-y-1"
                          >
                            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                              <span className="font-mono text-blue-700 dark:text-blue-400">{n.channel}</span>
                              <span className="font-mono">
                                {new Date(n.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-200">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Operational Viewport */}
          <main
            className={`flex-1 flex flex-col min-h-0 max-w-[1640px] w-full mx-auto ${
              isImmersiveSimActive
                ? 'p-3 lg:p-4 pb-20 lg:pb-4 space-y-3 lg:h-[calc(100vh-84px)] lg:overflow-hidden'
                : 'p-4 lg:p-6 pb-20 lg:pb-8 space-y-5'
            }`}
          >
            <SimulationControlPanel
              simState={simState}
              immersiveOpen={simWorkspaceOpen}
              busy={simBusy}
              onPauseResume={handleToggleSimPause}
              onNextStep={() => void advanceSimulationStage()}
              onRestart={() => void startSimulation(simState.scenarioId)}
              onExitWorkspace={handleExitSimulationWorkspace}
              onReturnToWorkspace={() => {
                setSidebarCollapsed(true);
                setSimWorkspaceOpen(true);
              }}
              onEnd={handleEndSimulation}
              onToggleAudio={handleToggleSimAudio}
            />

            {loading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-24 rounded-xl bg-white border border-slate-200 dark:bg-[#111C2E] dark:border-[#26364B] animate-pulse"
                    />
                  ))}
                </div>
                <div className="h-[460px] rounded-xl bg-white border border-slate-200 dark:bg-[#111C2E] dark:border-[#26364B] animate-pulse" />
              </div>
            ) : loadError ? (
              <div className="rounded-xl bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/35 p-6 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400 mx-auto" />
                <div className="text-sm font-bold text-red-800 dark:text-red-200">{loadError}</div>
                <button
                  type="button"
                  onClick={fetchBootstrap}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white"
                >
                  Retry Connection
                </button>
              </div>
            ) : isImmersiveSimActive ? (
              <SimulationWorkspace
                simState={simState}
                incidents={incidents}
                units={units}
                operator={operator}
                userRole={userRole}
                carrierConfigured={carrierConfigured}
                busy={simBusy}
                onAnswerCall={() => void answerSimulationCall()}
                onTogglePause={handleToggleSimPause}
                onToggleAudio={handleToggleSimAudio}
                onNextStep={() => void advanceSimulationStage()}
                onRestart={() => void startSimulation(simState.scenarioId)}
                onExitSimulation={handleExitSimulationWorkspace}
                onVerifyLocation={handleVerifyLocation}
                onTakeOverIncident={handleTakeOver}
                onAddNote={handleAddNote}
                onSelectUnit={(unitId) => {
                  setSelectedUnitId(unitId);
                  setSimState((prev) => ({
                    ...prev,
                    selectedUnitId: unitId,
                  }));
                }}
                onApproveDispatch={async (incidentId, unitId, notes) => {
                  clearSimExecution();
                  setSimBusy(true);
                  try {
                    await handleDispatchUnit(incidentId, unitId, notes, true);
                    const scenario = SIMULATION_SCENARIOS[simStateRef.current.scenarioId];
                    const unitObj = unitsRef.current.find((u) => u.id === unitId);
                    const routeToUse =
                      simStateRef.current.activeRoute ||
                      activeRoute ||
                      buildSimulatedCorridorRoute(
                        unitObj?.lat ?? 6.5068,
                        unitObj?.lng ?? 3.3775,
                        scenario.resolvedCoords.lat,
                        scenario.resolvedCoords.lng
                      );
                    scheduleSimTimeout(() => {
                      if (!simStateRef.current.active) return;
                      setSimState((prev) => ({
                        ...prev,
                        paused: false,
                        stage: 9,
                        trackingProgressPct: 0,
                        trackingRemainingSec: SIMULATION_TRACKING_DURATION_SEC,
                        trackingElapsedSec: 0,
                        trackingStatusText: 'Response unit has departed.',
                        patientPickupStatus: 'PENDING',
                        arrivedOnScene: false,
                        activeRoute: routeToUse,
                        statusMessage: SIMULATION_STAGES[8].nextExpectedAction,
                      }));
                      void runSimulationTracking(
                        simStateRef.current.scenarioId,
                        unitId,
                        routeToUse
                      );
                    }, 1150);
                  } finally {
                    setSimBusy(false);
                  }
                }}
                onCloseIncident={(incidentId, reason) =>
                  handleUpdateStatus(incidentId, 'CLOSED', reason)
                }
              />
            ) : workspaceIncident ? (
              <IncidentWorkspace
                incident={workspaceIncident}
                units={units}
                userRole={userRole}
                operatorName={operator.name}
                initialTab={workspaceInitialTab}
                simState={simState}
                carrierConfigured={carrierConfigured}
                preselectedUnitId={
                  simState.active && simState.incidentId === workspaceIncident.id
                    ? simState.selectedUnitId
                    : selectedUnitId
                }
                onBack={() => setWorkspaceIncidentId(null)}
                onOpenConversation={(id) => {
                  setSelectedIncidentId(id);
                  setWorkspaceIncidentId(null);
                  setSection('conversation-centre');
                }}
                onTakeOver={handleTakeOver}
                onVerifyLocation={handleVerifyLocation}
                onUpdateStatus={handleUpdateStatus}
                onDispatchUnit={handleDispatchUnit}
                onUpdateUnitStatus={handleUpdateUnitStatus}
                onAddNote={handleAddNote}
                onRouteCalculated={setActiveRoute}
              />
            ) : section === 'command-centre' ? (
              <CommandCentre
                incidents={incidents}
                units={units}
                userRole={userRole}
                selectedIncidentId={selectedIncidentId}
                selectedUnitId={selectedUnitId}
                activeRoute={activeRoute}
                simulationActive={simState.active}
                selectedScenario={selectedScenario}
                simulationAudioEnabled={simState.audioEnabled}
                onSelectScenario={setSelectedScenario}
                onToggleSimulationAudio={handleToggleSimAudio}
                onRunSimulation={() => void startSimulation(selectedScenario)}
                onSelectIncident={(id) => {
                  setSelectedIncidentId(id);
                  setSelectedUnitId(null);
                }}
                onSelectUnit={(id) => {
                  setSelectedUnitId(id);
                  setSelectedIncidentId(null);
                }}
                onOpenWorkspace={(id) => {
                  setSelectedIncidentId(id);
                  setWorkspaceInitialTab('overview');
                  setWorkspaceIncidentId(id);
                }}
                onTakeOver={handleTakeOver}
                onGoToIntake={() => navigateTo('ai-intake')}
                onOpenHistory={() => navigateTo('incident-history')}
                onOpenGuide={() => setGuideOpen(true)}
              />
            ) : section === 'live-incidents' ? (
              <LiveIncidentsView
                mode="live"
                incidents={incidents}
                units={units}
                userRole={userRole}
                onOpenWorkspace={(id) => {
                  setWorkspaceInitialTab('overview');
                  setWorkspaceIncidentId(id);
                }}
                onTakeOver={handleTakeOver}
              />
            ) : section === 'incident-history' ? (
              <LiveIncidentsView
                mode="history"
                incidents={incidents}
                units={units}
                userRole={userRole}
                onOpenWorkspace={(id) => {
                  setWorkspaceInitialTab('overview');
                  setWorkspaceIncidentId(id);
                }}
                onTakeOver={handleTakeOver}
              />
            ) : section === 'ai-intake' ? (
              <AiIntakeWorkspace
                geminiConfigured={geminiConfigured}
                activeIncident={
                  selectedIncidentId
                    ? incidents.find((i) => i.id === selectedIncidentId) || null
                    : null
                }
                onIncidentCreated={(inc) => {
                  setIncidents((prev) =>
                    prev.some((i) => i.id === inc.id) ? prev : [inc, ...prev]
                  );
                  setSelectedIncidentId(inc.id);
                  pushToast(
                    `${inc.id} created and queued on Command Centre.`,
                    'success'
                  );
                }}
                onOpenIncident={(id) => {
                  setWorkspaceInitialTab('overview');
                  setWorkspaceIncidentId(id);
                }}
              />
            ) : section === 'conversation-centre' ? (
              <ConversationCentreView
                incidents={incidents}
                units={units}
                integrations={integrations}
                selectedIncidentId={selectedIncidentId}
                userRole={userRole}
                operatorName={operator.name}
                simState={simState}
                onAnswerSimCall={() => void answerSimulationCall()}
                onToggleSimAudio={handleToggleSimAudio}
                onToggleSimPause={handleToggleSimPause}
                onSelectIncident={(id) => setSelectedIncidentId(id)}
                onTakeOver={handleTakeOver}
                onSendOperatorMessage={handleSendOperatorMessage}
                onAddNote={handleAddNote}
                onOpenIncidentTab={(id, tab) => {
                  setSelectedIncidentId(id);
                  setWorkspaceInitialTab(tab);
                  setWorkspaceIncidentId(id);
                }}
              />
            ) : section === 'response-units' ? (
              <ResponseUnitsView
                units={units}
                incidents={incidents}
                userRole={userRole}
                focusedIncident={
                  selectedIncidentId
                    ? incidents.find((i) => i.id === selectedIncidentId) || null
                    : null
                }
                recommendedUnitId={
                  simState.active
                    ? simState.selectedUnitId ||
                      SIMULATION_SCENARIOS[simState.scenarioId].recommendedUnitId
                    : null
                }
                onUpdateUnitStatus={handleUpdateUnitStatus}
                onOpenIncident={(id) => {
                  setWorkspaceInitialTab('overview');
                  setWorkspaceIncidentId(id);
                }}
                onSelectUnitForIncident={(unitId, incidentId) => {
                  setSelectedUnitId(unitId);
                  setSelectedIncidentId(incidentId);
                  setWorkspaceInitialTab('units');
                  setWorkspaceIncidentId(incidentId);
                  if (simState.active && simState.incidentId === incidentId) {
                    setSimState((prev) => ({
                      ...prev,
                      selectedUnitId: unitId,
                      stage: 8,
                      statusMessage: SIMULATION_STAGES[7].nextExpectedAction,
                    }));
                  }
                }}
              />
            ) : section === 'analytics' ? (
              <AnalyticsView
                incidents={incidents}
                units={units}
                onOpenIncident={(id) => {
                  setSelectedIncidentId(id);
                  setWorkspaceInitialTab('overview');
                  setWorkspaceIncidentId(id);
                }}
              />
            ) : section === 'responsive-showcase' ? (
              <ResponsiveShowcaseView
                incidents={incidents}
                units={units}
                userRole={userRole}
                operatorName={operator.name}
                selectedIncidentId={selectedIncidentId}
                onSelectIncident={(id) => setSelectedIncidentId(id)}
                onOpenWorkspace={(id) => {
                  setSelectedIncidentId(id);
                  setWorkspaceIncidentId(id);
                }}
                onTakeOver={handleTakeOver}
                onNavigateSection={navigateTo}
              />
            ) : (
              <SettingsIntegrationsView
                integrations={integrations}
                notifications={notifications}
                onRefreshBootstrap={fetchBootstrap}
                onToast={pushToast}
              />
            )}
          </main>
        </div>
      </div>

      {/* Mobile "More" Bottom Sheet */}
      {moreMenuOpen && (
        <div className="fixed inset-0 z-[850] lg:hidden flex items-end">
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/60"
            onClick={() => setMoreMenuOpen(false)}
          />
          <div className="relative z-10 w-full rounded-t-2xl bg-white border-t border-slate-200 dark:bg-[#111C2E] dark:border-[#26364B] p-4 pb-20 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#26364B]">
              <span className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                More Operations &amp; Tools
              </span>
              <button
                type="button"
                onClick={() => setMoreMenuOpen(false)}
                aria-label="Close more menu"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => navigateTo('ai-intake')}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 dark:bg-[#0B1220] dark:border-[#26364B] dark:text-slate-100"
              >
                <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>AI Intake</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('conversation-centre')}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 dark:bg-[#0B1220] dark:border-[#26364B] dark:text-slate-100"
              >
                <Headphones className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Conversation Centre</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('incident-history')}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 dark:bg-[#0B1220] dark:border-[#26364B] dark:text-slate-100"
              >
                <Archive className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                <span>Incident History</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('responsive-showcase')}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 dark:bg-[#0B1220] dark:border-[#26364B] dark:text-slate-100"
              >
                <Monitor className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Responsive Showcase (Desktop · Tablet · Mobile)</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('settings')}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 dark:bg-[#0B1220] dark:border-[#26364B] dark:text-slate-100"
              >
                <Settings className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                <span>Settings &amp; Integrations</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                  setMoreMenuOpen(false);
                }}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 dark:bg-[#0B1220] dark:border-[#26364B] dark:text-slate-100"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-500" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700" />
                )}
                <span>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  setGuideOpen(true);
                }}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-blue-700 dark:bg-[#0B1220] dark:border-[#26364B] dark:text-blue-300"
              >
                <HelpCircle className="w-4 h-4" />
                <span>First-Time Operator Guide</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  void startSimulation(selectedScenario);
                }}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-blue-600 text-white"
              >
                <Play className="w-4 h-4" />
                <span>RUN SIMULATION</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile quick navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-[900] bg-white border-t border-slate-200 dark:bg-[#111C2E] dark:border-[#26364B] grid grid-cols-5"
      >
        {(
          [
            { id: 'command-centre', label: 'Home', icon: <LayoutDashboard className="w-4 h-4" /> },
            { id: 'live-incidents', label: 'Incidents', icon: <AlertTriangle className="w-4 h-4" /> },
            { id: 'response-units', label: 'Units', icon: <Truck className="w-4 h-4" /> },
            { id: 'analytics', label: 'Analytics', icon: <Activity className="w-4 h-4" /> },
          ] as const
        ).map((item) => {
          const active = !workspaceIncident && section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={`Mobile ${item.label}`}
              onClick={() => navigateTo(item.id)}
              className={`flex flex-col items-center justify-center py-2.5 text-[10px] font-medium ${
                active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {item.icon}
              <span className="mt-0.5">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Mobile More"
          aria-expanded={moreMenuOpen}
          onClick={() => setMoreMenuOpen((o) => !o)}
          className={`flex flex-col items-center justify-center py-2.5 text-[10px] font-medium ${
            moreMenuOpen
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Menu className="w-4 h-4" />
          <span className="mt-0.5">More</span>
        </button>
      </nav>

      {/* First-Use Operator Guide Modal */}
      {guideOpen && (
        <OperatorGuideModal
          onClose={() => setGuideOpen(false)}
          onStartDemoScenario={() => {
            void startSimulation(selectedScenario);
          }}
        />
      )}

      {/* Toast Stack */}
      <div className="fixed bottom-16 lg:bottom-4 right-4 z-[1100] space-y-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`rounded-xl px-4 py-3 text-xs font-medium shadow-xl border ${
              t.tone === 'error'
                ? 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/95 dark:border-red-500/50 dark:text-red-100'
                : t.tone === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/95 dark:border-emerald-500/50 dark:text-emerald-100'
                : 'bg-white border-slate-200 text-slate-900 dark:bg-[#172438]/95 dark:border-[#26364B] dark:text-slate-100'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
