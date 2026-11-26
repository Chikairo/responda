import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Bell,
  Building2,
  HelpCircle,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PhoneCall,
  PlugZap,
  ShieldCheck,
  Truck,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type {
  AdminSection,
  AppSection,
  ClinicalDetails,
  HospitalDestination,
  IncidentPriority,
  IncidentRecord,
  IncidentStatus,
  IntegrationStatus,
  MedicalEmergencyCategory,
  NotificationLog,
  OperationsSection,
  OrganisationSettings,
  ResponseUnit,
  RouteResult,
  SimulationRuntimeState,
  SimulationScenarioId,
  SimulationStageNumber,
  StaffAccount,
  UnitAvailability,
} from './types/responda';
import type { IncidentWorkspaceTabId } from './utils/guidedWorkflow';
import { isActiveIncidentStatus } from './utils/incidentLogic';
import {
  buildSimulatedCorridorRoute,
  getTrackingMilestoneForElapsed,
  interpolatePointAlongRoute,
  LAGOS_HOSPITAL_DESTINATIONS,
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
import { AdminOverviewView } from './components/AdminOverviewView';
import { CommandCentre } from './components/CommandCentre';
import { IncidentManagementView } from './components/IncidentManagementView';
import type { IncidentWorkspaceDraft } from './components/IncidentWorkspace';
import { LiveIncidentsView } from './components/LiveIncidentsView';
import { OperatorGuideModal } from './components/OperatorGuideModal';
import { OrganisationSettingsView } from './components/OrganisationSettingsView';
import { ResponseUnitsView } from './components/ResponseUnitsView';
import { SettingsIntegrationsView } from './components/SettingsIntegrationsView';
import { SimulationControlPanel } from './components/SimulationControlPanel';
import { SelectMenu } from './components/SelectMenu';
import { StaffManagementView } from './components/StaffManagementView';
import { RespondaLogo } from './components/StatusBadges';
import { UnitManagementView } from './components/UnitManagementView';

interface ToastMessage {
  id: string;
  text: string;
  tone: 'info' | 'success' | 'error';
}

const DEFAULT_ORG_SETTINGS: OrganisationSettings = {
  name: 'Lagos Private Medical Command (Demo)',
  city: 'Lagos',
  contactEmail: 'ops@responda.demo',
  contactPhone: '+234-800-RESPONDA',
  defaultOperationalArea: 'Yaba, Ikeja, Surulere & Lagos Island',
  requireLocationVerificationBeforeDispatch: true,
  clinicalTriageNotice:
    'Medical emergency prototype only. Never deploys units or selects hospitals without human operator approval.',
};

export default function App() {
  // Server-issued Bearer session kept strictly in React state (never localStorage/sessionStorage)
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentAccount, setCurrentAccount] = useState<StaffAccount | null>(null);
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [organisationSettings, setOrganisationSettings] =
    useState<OrganisationSettings>(DEFAULT_ORG_SETTINGS);

  const authTokenRef = useRef<string | null>(null);
  authTokenRef.current = authToken;

  const [section, setSection] = useState<AppSection>('command-centre');
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<IncidentWorkspaceTabId>('workflow');

  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>('INC-2026-1048');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [draftsByIncidentId, setDraftsByIncidentId] = useState<
    Record<string, IncidentWorkspaceDraft>
  >({});

  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [units, setUnits] = useState<ResponseUnit[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Automatically synchronize light/dark theme with system preferences
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applySystemTheme = (isDark: boolean) => {
      const next = isDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      document.documentElement.classList.toggle('dark', isDark);
    };
    applySystemTheme(media.matches);
    const handleChange = (e: MediaQueryListEvent) => applySystemTheme(e.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  // Dismiss Notification Centre popover on outside pointerdown or Escape
  useEffect(() => {
    if (!notifOpen) return;
    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notifOpen]);

  // Dismiss mobile navigation drawer on Escape
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const pushToast = useCallback(
    (text: string, tone: 'info' | 'success' | 'error' = 'info') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-1), { id, text, tone }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const authFetch: typeof fetch = useCallback(
    (input, init) => {
      const token = authTokenRef.current;
      const headers = new Headers(init?.headers || {});
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return fetch(input, { ...init, headers });
    },
    []
  );

  // Synced 9-Stage Live Simulation Engine State
  const [selectedScenario, setSelectedScenario] =
    useState<SimulationScenarioId>('yaba-accident');
  const [simBusy, setSimBusy] = useState(false);
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
    arrivedOnScene: false,
    patientPickedUp: false,
    confirmedHospital: null,
    transportStarted: false,
    hospitalArrived: false,
    completed: false,
    activeRoute: null,
    hospitalRoute: null,
    statusMessage: '',
  }));

  const simStateRef = useRef(simState);
  simStateRef.current = simState;

  const applySimState = useCallback(
    (
      updater:
        | SimulationRuntimeState
        | ((prev: SimulationRuntimeState) => SimulationRuntimeState)
    ) => {
      const next =
        typeof updater === 'function' ? updater(simStateRef.current) : updater;
      simStateRef.current = next;
      setSimState(next);
    },
    []
  );

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

  // Call duration clock during active simulation call
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

  const fetchBootstrap = useCallback(async (explicitToken?: string) => {
    const token = explicitToken ?? authTokenRef.current;
    if (!token) return;
    try {
      setLoadError(null);
      const res = await fetch('/api/bootstrap', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        incidents: IncidentRecord[];
        units: ResponseUnit[];
        notifications: NotificationLog[];
        staffAccounts: StaffAccount[];
        organisationSettings: OrganisationSettings;
        integrations: IntegrationStatus[];
      };
      setIncidents(data.incidents);
      setUnits(data.units);
      setNotifications(data.notifications);
      setStaffAccounts(data.staffAccounts);
      setOrganisationSettings(data.organisationSettings);
      setIntegrations(data.integrations);
      setSelectedIncidentId((prev) =>
        prev && data.incidents.some((i) => i.id === prev)
          ? prev
          : data.incidents.find((i) => !i.legacyOutOfScope && isActiveIncidentStatus(i.status))
              ?.id ||
            data.incidents[0]?.id ||
            null
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

  const issueAndActivateDemoSession = useCallback(
    async (accountId: string) => {
      const res = await fetch('/api/auth/demo-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not establish demo session.');
      }
      authTokenRef.current = data.token;
      setAuthToken(data.token);
      setCurrentAccount(data.account);
      await fetchBootstrap(data.token);
      return data.account as StaffAccount;
    },
    [fetchBootstrap]
  );

  // Initial server-validated demo auth bootstrap
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadError(null);
        const accRes = await fetch('/api/auth/accounts');
        if (!accRes.ok) throw new Error(`HTTP ${accRes.status}`);
        const accData = (await accRes.json()) as { accounts: StaffAccount[] };
        if (cancelled) return;
        setStaffAccounts(accData.accounts);

        const defaultAccount =
          accData.accounts.find(
            (a) => a.accountStatus === 'ACTIVE' && a.role === 'Operations Staff'
          ) || accData.accounts.find((a) => a.accountStatus === 'ACTIVE');

        if (!defaultAccount) {
          throw new Error('No active staff accounts available.');
        }

        await issueAndActivateDemoSession(defaultAccount.id);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error
              ? `Failed to start RESPONDA session: ${err.message}`
              : 'Failed to load RESPONDA.'
          );
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [issueAndActivateDemoSession]);

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
            setIncidents((prev) =>
              prev.some((i) => i.id === inc.id) ? prev : [inc, ...prev]
            );
          } else if (msg.event === 'incident:updated') {
            const inc = msg.payload as IncidentRecord;
            setIncidents((prev) => prev.map((i) => (i.id === inc.id ? inc : i)));
          } else if (msg.event === 'unit:updated') {
            const unit = msg.payload as ResponseUnit;
            setUnits((prev) => {
              const exists = prev.some((u) => u.id === unit.id);
              return exists
                ? prev.map((u) => (u.id === unit.id ? unit : u))
                : [...prev, unit];
            });
          } else if (msg.event === 'units:sync') {
            setUnits(msg.payload as ResponseUnit[]);
          } else if (msg.event === 'notification:created') {
            const notif = msg.payload as NotificationLog;
            setNotifications((prev) =>
              prev.some((n) => n.id === notif.id) ? prev : [notif, ...prev]
            );
          } else if (msg.event === 'staff:updated') {
            const acc = msg.payload as StaffAccount;
            setStaffAccounts((prev) => {
              const exists = prev.some((s) => s.id === acc.id);
              return exists ? prev.map((s) => (s.id === acc.id ? acc : s)) : [...prev, acc];
            });
          } else if (msg.event === 'organisation:updated') {
            setOrganisationSettings(msg.payload as OrganisationSettings);
          } else if (msg.event === 'state:reset') {
            const fresh = msg.payload as {
              incidents: IncidentRecord[];
              units: ResponseUnit[];
              notifications: NotificationLog[];
              staffAccounts?: StaffAccount[];
              organisationSettings?: OrganisationSettings;
            };
            setIncidents(fresh.incidents);
            setUnits(fresh.units);
            setNotifications(fresh.notifications);
            if (fresh.staffAccounts) setStaffAccounts(fresh.staffAccounts);
            if (fresh.organisationSettings) setOrganisationSettings(fresh.organisationSettings);
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

  const userRole = currentAccount?.role || 'Operations Staff';
  const operatorName = currentAccount?.name || 'Operations Staff';

  const handleUpdateDraft = useCallback(
    (incidentId: string, patch: Partial<IncidentWorkspaceDraft>) => {
      setDraftsByIncidentId((prev) => ({
        ...prev,
        [incidentId]: {
          ...(prev[incidentId] || {}),
          ...patch,
        },
      }));
    },
    []
  );

  // Operational API handlers (all via authFetch)
  const handleTakeOver = async (id: string) => {
    const res = await authFetch(`/api/incidents/${id}/takeover`, {
      method: 'POST',
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
        stage: prev.stage < 5 ? 5 : prev.stage,
        operatorTakenOver: true,
        callStatus: 'OPERATOR_CONNECTED',
        statusMessage: 'Human operator took over call — verify location & clinical priority.',
      }));
    }
    pushToast(`Human operator takeover completed for ${id}.`, 'success');
  };

  const handleUpdateMedicalDetails = async (
    id: string,
    payload: {
      category?: MedicalEmergencyCategory;
      priority?: IncidentPriority;
      priorityReason?: string;
      peopleAffected?: number | null;
      immediateDanger?: boolean;
      dangerDetails?: string;
      clinicalDetails?: ClinicalDetails;
      summary?: string;
    }
  ) => {
    const res = await authFetch(`/api/incidents/${id}/medical-details`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      pushToast(data.error || 'Failed to update medical details.', 'error');
      return;
    }
    setIncidents((prev) => prev.map((i) => (i.id === id ? data.incident : i)));
    pushToast(`Medical assessment updated for ${id}.`, 'success');
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
    }
  ) => {
    const res = await authFetch(`/api/incidents/${id}/verify-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      pushToast(data.error || 'Location verification failed', 'error');
      return;
    }
    setIncidents((prev) => prev.map((i) => (i.id === id ? data.incident : i)));
    pushToast(
      payload.markVerified ? `Location verified for ${id}.` : `Location draft saved for ${id}.`,
      'success'
    );
  };

  const handleUpdateStatus = async (id: string, status: IncidentStatus, reason: string) => {
    const res = await authFetch(`/api/incidents/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    if (status === 'Closed') {
      setDraftsByIncidentId((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    pushToast(`${id} status updated to ${status}.`, 'success');
  };

  const handleDispatchUnit = async (
    incidentId: string,
    unitId: string,
    notes: string,
    notifySms: boolean
  ) => {
    const res = await authFetch(`/api/incidents/${incidentId}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    setIncidents((prev) => prev.map((i) => (i.id === incidentId ? data.incident : i)));
    setUnits((prev) => prev.map((u) => (u.id === unitId ? data.unit : u)));
    if (simStateRef.current.active && simStateRef.current.incidentId === incidentId) {
      setSimState((prev) => ({
        ...prev,
        selectedUnitId: unitId,
        dispatchApproved: true,
        statusMessage: 'Dispatch approved — entering Stage 8 route & transport tracking.',
      }));
    }
    pushToast(`Dispatch approved: ${data.unit.callsign} assigned to ${incidentId}.`, 'success');
  };

  const handleTransportEvent = useCallback(
    async (
      id: string,
      payload: {
        event:
          | 'ARRIVED_ON_SCENE'
          | 'PATIENT_PICKED_UP'
          | 'CONFIRM_HOSPITAL'
          | 'TRANSPORT_STARTED'
          | 'HOSPITAL_ARRIVED'
          | 'CLOSE_INCIDENT';
        hospitalDestination?: HospitalDestination;
        outcomeText?: string;
      }
    ) => {
      const res = await authFetch(`/api/incidents/${id}/transport-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'Transport milestone update failed', 'error');
        return;
      }
      if (data.incident) {
        setIncidents((prev) => prev.map((i) => (i.id === id ? data.incident : i)));
      }
      if (data.unit) {
        setUnits((prev) => prev.map((u) => (u.id === data.unit.id ? data.unit : u)));
      }

      if (simStateRef.current.active && simStateRef.current.incidentId === id) {
        if (payload.event === 'ARRIVED_ON_SCENE') {
          setSimState((prev) => ({ ...prev, arrivedOnScene: true }));
        } else if (payload.event === 'PATIENT_PICKED_UP') {
          setSimState((prev) => ({ ...prev, patientPickedUp: true }));
        } else if (payload.event === 'CONFIRM_HOSPITAL') {
          setSimState((prev) => ({
            ...prev,
            confirmedHospital: data.incident?.hospitalDestination || payload.hospitalDestination || null,
          }));
        } else if (payload.event === 'TRANSPORT_STARTED') {
          setSimState((prev) => ({ ...prev, transportStarted: true }));
        } else if (payload.event === 'HOSPITAL_ARRIVED') {
          setSimState((prev) => ({ ...prev, hospitalArrived: true }));
        } else if (payload.event === 'CLOSE_INCIDENT') {
          clearSimExecution();
          setSimState((prev) => ({
            ...prev,
            stage: 9,
            callStatus: 'ENDED',
            audioPlaying: false,
            speakingSpeaker: null,
            completed: true,
            statusMessage: 'Simulation completed — incident archived read-only in Incident History.',
          }));
          setWorkspaceOpen(false);
          setSection('incident-history');
        }
      }

      if (payload.event === 'CLOSE_INCIDENT') {
        setDraftsByIncidentId((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        pushToast(`Incident ${id} closed and archived to Incident History.`, 'success');
      } else {
        pushToast(`Recorded ${payload.event.replace(/_/g, ' ').toLowerCase()}.`, 'success');
      }
    },
    [authFetch, clearSimExecution, pushToast]
  );

  const handleUpdateUnitStatus = async (
    unitId: string,
    availability: UnitAvailability | 'CANCELLED',
    note: string
  ) => {
    const res = await authFetch(`/api/units/${unitId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availability, note }),
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
    const res = await authFetch(`/api/incidents/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await authFetch(`/api/incidents/${id}/transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) {
      pushToast(data.error || 'Could not send operator reply', 'error');
      return;
    }
    setIncidents((prev) => prev.map((i) => (i.id === id ? data.incident : i)));
    pushToast('Operator reply recorded in transcript.', 'success');
  };

  // =========================================================================
  // SYNCED 9-STAGE SIMULATION ENGINE (Never locks operational navigation)
  // =========================================================================

  const syncSimIncident = useCallback(
    async (opts: {
      scenarioId: SimulationScenarioId;
      turnCount: number;
      includeCoords: boolean;
      markLocationResolved: boolean;
      completeIntake?: boolean;
    }): Promise<IncidentRecord | null> => {
      const res = await authFetch('/api/simulation/incident', {
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
    [authFetch]
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
    }) => {
      const res = await authFetch('/api/simulation/unit-position', {
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
    [authFetch]
  );

  const completeTrackingArrival = useCallback(
    async (scenarioId: SimulationScenarioId) => {
      if (trackingArrivalHandledRef.current) return;
      trackingArrivalHandledRef.current = true;
      stopTrackingInterval();
      trackingRemainingMsRef.current = 0;

      const scenario = SIMULATION_SCENARIOS[scenarioId];
      await handleTransportEvent(scenario.incidentId, { event: 'ARRIVED_ON_SCENE' });

      setSimState((prev) => ({
        ...prev,
        trackingProgressPct: 100,
        trackingRemainingSec: 0,
        trackingElapsedSec: SIMULATION_TRACKING_DURATION_SEC,
        trackingStatusText: 'Response unit arrived at scene.',
        arrivedOnScene: true,
        simulatedArrivalAt: new Date().toISOString(),
        statusMessage:
          'Unit arrived at scene — confirm patient pickup, choose destination hospital, and start transport.',
      }));
    },
    [handleTransportEvent, stopTrackingInterval]
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
          statusMessage: `${startMilestone.statusText} (01:00 simulated tracking active)`,
        }));

        await persistSimUnitMilestone({
          unitId,
          lat: startLat,
          lng: startLng,
          availability: startMilestone.availability,
          incidentId: scenario.incidentId,
          incidentStatus: 'Dispatched',
          timelineTitle: startMilestone.timelineTitle,
          timelineDescription: startMilestone.timelineDescription,
        });
      }

      if (trackingArrivalHandledRef.current || trackingRemainingMsRef.current <= 0) {
        void completeTrackingArrival(scenarioId);
        return;
      }

      trackingLastTickRef.current = Date.now();
      trackingIntervalRef.current = window.setInterval(() => {
        const cur = simStateRef.current;
        if (!cur.active || cur.paused || cur.stage !== 8) {
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
          Math.min(
            SIMULATION_TRACKING_DURATION_SEC,
            SIMULATION_TRACKING_DURATION_SEC - remainingSec
          )
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
          prev.map((u) =>
            u.id === unitId ? { ...u, lat, lng, availability: milestone.availability } : u
          )
        );

        if (
          (milestone.milestoneKey === 'EN_ROUTE' ||
            milestone.milestoneKey === 'APPROACHING') &&
          !trackingMilestonesSentRef.current.has(milestone.milestoneKey)
        ) {
          trackingMilestonesSentRef.current.add(milestone.milestoneKey);
          void persistSimUnitMilestone({
            unitId,
            lat,
            lng,
            availability: milestone.availability,
            incidentId: scenario.incidentId,
            incidentStatus: 'Dispatched',
            timelineTitle: milestone.timelineTitle,
            timelineDescription: milestone.timelineDescription,
          });
        }

        if (nextRemainingMs <= 0) {
          void completeTrackingArrival(scenarioId);
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
    [completeTrackingArrival, persistSimUnitMilestone, stopTrackingInterval]
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
          await syncSimIncident({
            scenarioId,
            turnCount: scenario.dialogue.length,
            includeCoords: true,
            markLocationResolved: false,
            completeIntake: true,
          });
          setSection('incident-management');
          setWorkspaceOpen(true);
          setWorkspaceTab('workflow');
          applySimState((prev) => ({
            ...prev,
            audioPlaying: false,
            speakingSpeaker: null,
            stage: 3,
            revealedTurnCount: scenario.dialogue.length,
            locationResolvedInSim: true,
            statusMessage:
              'AI intake Q&A complete — incident moved to Milestone 2: Assessment & Verification.',
          }));
          return;
        }

        const turn = scenario.dialogue[turnIdx];
        const nextStage: SimulationStageNumber = turnIdx >= 4 ? 3 : 2;
        await syncSimIncident({
          scenarioId,
          turnCount: turnIdx + 1,
          includeCoords: nextStage === 3,
          markLocationResolved: false,
        });

        setSection('incident-management');
        setWorkspaceOpen(true);
        setWorkspaceTab('workflow');
        applySimState((prev) => ({
          ...prev,
          stage: nextStage,
          revealedTurnCount: turnIdx + 1,
          statusMessage:
            nextStage === 2
              ? `AI Medical Intake turn ${turnIdx + 1}/${scenario.dialogue.length}`
              : `Location & Clinical extraction turn ${turnIdx + 1}/${scenario.dialogue.length}`,
        }));

        speechCancelRef.current = speakSimulationTurn({
          speaker: turn.speaker,
          text: turn.text,
          enabled: simStateRef.current.audioEnabled,
          onStart: () => {
            applySimState((prev) => ({
              ...prev,
              audioPlaying: true,
              speakingSpeaker: turn.speaker,
            }));
          },
          onEnd: () => {
            applySimState((prev) => ({
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
    [applySimState, scheduleSimTimeout, syncSimIncident]
  );

  const startSimulation = useCallback(
    async (scenarioIdOverride?: SimulationScenarioId) => {
      if (userRole !== 'Operations Staff') {
        pushToast('Switch to an Operations Staff account to run live simulations.', 'error');
        return;
      }
      const targetId = scenarioIdOverride || selectedScenario;
      const scenario = SIMULATION_SCENARIOS[targetId];
      clearSimExecution();
      setSimBusy(true);
      try {
        setSelectedScenario(targetId);
        const res = await authFetch('/api/simulation/prepare', {
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

        await syncSimIncident({
          scenarioId: targetId,
          turnCount: 1,
          includeCoords: false,
          markLocationResolved: false,
        });

        setActiveRoute(null);
        setSelectedUnitId(null);
        setSelectedIncidentId(scenario.incidentId);
        setSection('incident-management');
        setWorkspaceOpen(true);
        setWorkspaceTab('workflow');

        trackingRemainingMsRef.current = SIMULATION_TRACKING_DURATION_SEC * 1000;
        trackingArrivalHandledRef.current = false;
        trackingMilestonesSentRef.current.clear();

        applySimState({
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
          revealedTurnCount: 1,
          locationResolvedInSim: false,
          operatorTakenOver: false,
          dispatchApproved: false,
          trackingProgressPct: 0,
          trackingRemainingSec: SIMULATION_TRACKING_DURATION_SEC,
          trackingElapsedSec: 0,
          trackingStatusText: 'Response unit awaiting dispatch.',
          simulatedArrivalAt: undefined,
          arrivedOnScene: false,
          patientPickedUp: false,
          confirmedHospital: null,
          transportStarted: false,
          hospitalArrived: false,
          completed: false,
          activeRoute: null,
          hospitalRoute: null,
          statusMessage: 'Incoming emergency call connected — starting AI intake Q&A...',
        });

        pushToast(scenario.incomingCallNotification, 'info');

        // Automatically answer call and begin sequential 6-turn Q&A playback
        scheduleSimTimeout(() => {
          const live = simStateRef.current;
          if (!live.active || live.paused || live.stage !== 1) return;
          applySimState((prev) => ({
            ...prev,
            stage: 2,
            callStatus: 'CONNECTED_AI',
            statusMessage: SIMULATION_STAGES[1].nextExpectedAction,
          }));
          playDialogueSequence(targetId, 1);
        }, 900);
      } finally {
        setSimBusy(false);
      }
    },
    [
      applySimState,
      authFetch,
      clearSimExecution,
      playDialogueSequence,
      pushToast,
      scheduleSimTimeout,
      selectedScenario,
      syncSimIncident,
      userRole,
    ]
  );

  const advanceSimulationStage = useCallback(async () => {
    const cur = simStateRef.current;
    if (!cur.active || cur.completed) return;
    const scenario = SIMULATION_SCENARIOS[cur.scenarioId];
    clearSimExecution();
    setSimBusy(true);

    try {
      if (cur.stage === 1) {
        setSection('incident-management');
        setWorkspaceOpen(true);
        setWorkspaceTab('workflow');
        applySimState((prev) => ({
          ...prev,
          stage: 2,
          callStatus: 'CONNECTED_AI',
          statusMessage: SIMULATION_STAGES[1].nextExpectedAction,
        }));
        if (!cur.paused) {
          playDialogueSequence(cur.scenarioId, Math.max(1, cur.revealedTurnCount));
        }
        return;
      }

      if (cur.stage === 2) {
        if (cur.paused && cur.revealedTurnCount < scenario.dialogue.length) {
          const nextTurn = cur.revealedTurnCount + 1;
          const finishedIntake = nextTurn >= scenario.dialogue.length;
          await syncSimIncident({
            scenarioId: cur.scenarioId,
            turnCount: nextTurn,
            includeCoords: nextTurn >= 5,
            markLocationResolved: false,
            completeIntake: finishedIntake,
          });
          setSection('incident-management');
          setWorkspaceOpen(true);
          setWorkspaceTab('workflow');
          applySimState((prev) => ({
            ...prev,
            stage: finishedIntake ? 3 : 2,
            audioPlaying: false,
            speakingSpeaker: null,
            revealedTurnCount: nextTurn,
            locationResolvedInSim: finishedIntake || prev.locationResolvedInSim,
            statusMessage: finishedIntake
              ? 'AI intake Q&A complete — incident moved to Milestone 2: Assessment & Verification.'
              : `AI Medical Intake turn ${nextTurn}/${scenario.dialogue.length}`,
          }));
          return;
        }

        await syncSimIncident({
          scenarioId: cur.scenarioId,
          turnCount: scenario.dialogue.length,
          includeCoords: true,
          markLocationResolved: false,
          completeIntake: true,
        });
        setSection('incident-management');
        setWorkspaceOpen(true);
        setWorkspaceTab('workflow');
        applySimState((prev) => ({
          ...prev,
          stage: 3,
          audioPlaying: false,
          speakingSpeaker: null,
          revealedTurnCount: scenario.dialogue.length,
          locationResolvedInSim: true,
          statusMessage:
            'AI intake Q&A complete — incident moved to Milestone 2: Assessment & Verification.',
        }));
        return;
      }

      if (cur.stage === 3) {
        await syncSimIncident({
          scenarioId: cur.scenarioId,
          turnCount: scenario.dialogue.length,
          includeCoords: true,
          markLocationResolved: true,
          completeIntake: true,
        });
        setSection('command-centre');
        setWorkspaceOpen(false);
        setSelectedIncidentId(scenario.incidentId);
        applySimState((prev) => ({
          ...prev,
          stage: 4,
          statusMessage: SIMULATION_STAGES[3].nextExpectedAction,
        }));
        return;
      }

      if (cur.stage === 4) {
        await handleTakeOver(scenario.incidentId);
        await handleVerifyLocation(scenario.incidentId, {
          correctedDescription: scenario.verifiedLocationDescription,
          landmark: scenario.landmark,
          area: scenario.area,
          lat: scenario.resolvedCoords.lat,
          lng: scenario.resolvedCoords.lng,
          markVerified: true,
        });
        setSection('incident-management');
        setWorkspaceOpen(true);
        setWorkspaceTab('location');
        applySimState((prev) => ({
          ...prev,
          stage: 5,
          operatorTakenOver: true,
          callStatus: 'OPERATOR_CONNECTED',
          statusMessage: SIMULATION_STAGES[4].nextExpectedAction,
        }));
        return;
      }

      if (cur.stage === 5) {
        const inc = incidentsRef.current.find((i) => i.id === scenario.incidentId);
        const ranked = inc
          ? rankUnitsForIncident(unitsRef.current, inc, scenario.recommendedUnitId)
          : [];
        const bestUnit =
          ranked.find((r) => r.unit.availability === 'Available')?.unit ||
          unitsRef.current.find((u) => u.id === scenario.recommendedUnitId) ||
          null;

        setSelectedIncidentId(scenario.incidentId);
        if (bestUnit) setSelectedUnitId(bestUnit.id);
        setSection('response-units');
        setWorkspaceOpen(false);
        applySimState((prev) => ({
          ...prev,
          stage: 6,
          selectedUnitId: bestUnit?.id || scenario.recommendedUnitId,
          statusMessage: SIMULATION_STAGES[5].nextExpectedAction,
        }));
        return;
      }

      if (cur.stage === 6) {
        const unitId = cur.selectedUnitId || scenario.recommendedUnitId;
        const unit = unitsRef.current.find((u) => u.id === unitId);
        if (unit) {
          const routeRes = await authFetch('/api/routing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromLat: unit.lat,
              fromLng: unit.lng,
              toLat: scenario.resolvedCoords.lat,
              toLng: scenario.resolvedCoords.lng,
              allowSimulatedOverlay: true,
            }),
          });
          const calcRoute = routeRes.ok
            ? await routeRes.json()
            : buildSimulatedCorridorRoute(
                unit.lat,
                unit.lng,
                scenario.resolvedCoords.lat,
                scenario.resolvedCoords.lng
              );
          setActiveRoute(calcRoute);
          applySimState((prev) => ({
            ...prev,
            stage: 7,
            selectedUnitId: unit.id,
            activeRoute: calcRoute,
            statusMessage: SIMULATION_STAGES[6].nextExpectedAction,
          }));
        } else {
          applySimState((prev) => ({
            ...prev,
            stage: 7,
            statusMessage: SIMULATION_STAGES[6].nextExpectedAction,
          }));
        }
        setSection('incident-management');
        setWorkspaceOpen(true);
        setWorkspaceTab('response');
        return;
      }

      if (cur.stage === 7) {
        const unitId = cur.selectedUnitId || scenario.recommendedUnitId;
        const unit = unitsRef.current.find((u) => u.id === unitId);
        if (!cur.dispatchApproved && unit) {
          await handleDispatchUnit(
            scenario.incidentId,
            unit.id,
            `Simulation dispatch approved by ${operatorName}.`,
            true
          );
        }
        const routeToUse =
          cur.activeRoute ||
          activeRoute ||
          buildSimulatedCorridorRoute(
            unit?.lat ?? 6.5068,
            unit?.lng ?? 3.3775,
            scenario.resolvedCoords.lat,
            scenario.resolvedCoords.lng
          );
        setSection('incident-management');
        setWorkspaceOpen(true);
        setWorkspaceTab('response');
        applySimState((prev) => ({
          ...prev,
          stage: 8,
          dispatchApproved: true,
          activeRoute: routeToUse,
          statusMessage: SIMULATION_STAGES[7].nextExpectedAction,
        }));
        void runSimulationTracking(cur.scenarioId, unitId, routeToUse);
        return;
      }

      if (cur.stage === 8) {
        // Sequentially step remaining Milestone 4 events one by one (never bundled)
        if (!cur.arrivedOnScene) {
          await completeTrackingArrival(cur.scenarioId);
          return;
        }
        if (!cur.patientPickedUp) {
          await handleTransportEvent(scenario.incidentId, { event: 'PATIENT_PICKED_UP' });
          return;
        }
        if (!cur.confirmedHospital) {
          await handleTransportEvent(scenario.incidentId, {
            event: 'CONFIRM_HOSPITAL',
            hospitalDestination: LAGOS_HOSPITAL_DESTINATIONS[0],
          });
          return;
        }
        if (!cur.transportStarted) {
          await handleTransportEvent(scenario.incidentId, { event: 'TRANSPORT_STARTED' });
          return;
        }
        if (!cur.hospitalArrived) {
          await handleTransportEvent(scenario.incidentId, { event: 'HOSPITAL_ARRIVED' });
          return;
        }
        // Once hospital arrived, proceed to closure
        await handleTransportEvent(scenario.incidentId, {
          event: 'CLOSE_INCIDENT',
          outcomeText: `Simulation completed — patient delivered to ${cur.confirmedHospital.name} and incident archived.`,
        });
      }
    } finally {
      setSimBusy(false);
    }
  }, [
    activeRoute,
    applySimState,
    authFetch,
    clearSimExecution,
    completeTrackingArrival,
    handleDispatchUnit,
    handleTakeOver,
    handleTransportEvent,
    handleVerifyLocation,
    operatorName,
    playDialogueSequence,
    runSimulationTracking,
    syncSimIncident,
  ]);

  const handlePrevSimulationStage = useCallback(async () => {
    const cur = simStateRef.current;
    if (!cur.active || cur.completed || cur.stage <= 1) return;
    const scenario = SIMULATION_SCENARIOS[cur.scenarioId];
    clearSimExecution();
    setSimBusy(true);
    try {
      if ((cur.stage === 2 || cur.stage === 3) && cur.revealedTurnCount > 1) {
        const prevTurn = cur.revealedTurnCount - 1;
        await syncSimIncident({
          scenarioId: cur.scenarioId,
          turnCount: prevTurn,
          includeCoords: prevTurn >= 5,
          markLocationResolved: false,
        });
        setSection('incident-management');
        setWorkspaceOpen(true);
        setWorkspaceTab('workflow');
        applySimState((prev) => ({
          ...prev,
          paused: true,
          stage: prevTurn >= 5 ? 3 : 2,
          audioPlaying: false,
          speakingSpeaker: null,
          revealedTurnCount: prevTurn,
          statusMessage: `Paused at intake turn ${prevTurn}/${scenario.dialogue.length}.`,
        }));
        return;
      }

      const prevStage = Math.max(1, cur.stage - 1) as SimulationStageNumber;
      const meta = SIMULATION_STAGES[prevStage - 1];
      setSection(meta.targetSection);
      if (meta.targetSection === 'incident-management') {
        setWorkspaceOpen(true);
        setWorkspaceTab(
          prevStage <= 3 ? 'workflow' : meta.targetWorkspaceTab || 'workflow'
        );
      } else {
        setWorkspaceOpen(false);
      }
      applySimState((prev) => ({
        ...prev,
        paused: true,
        stage: prevStage,
        audioPlaying: false,
        speakingSpeaker: null,
        statusMessage: `Stepped back to Stage ${prevStage}: ${meta.title}`,
      }));
    } finally {
      setSimBusy(false);
    }
  }, [applySimState, clearSimExecution, syncSimIncident]);

  const handleToggleSimPause = useCallback(() => {
    const prev = simStateRef.current;
    const nextPaused = !prev.paused;
    if (nextPaused) {
      clearSimExecution();
      pauseSpeech();
    } else {
      resumeSpeech();
      if (prev.stage === 1 && prev.active) {
        scheduleSimTimeout(() => {
          const live = simStateRef.current;
          if (!live.active || live.paused || live.stage !== 1) return;
          applySimState((p) => ({
            ...p,
            stage: 2,
            callStatus: 'CONNECTED_AI',
            statusMessage: SIMULATION_STAGES[1].nextExpectedAction,
          }));
          playDialogueSequence(live.scenarioId, Math.max(1, live.revealedTurnCount));
        }, 200);
      } else if ((prev.stage === 2 || prev.stage === 3) && prev.active) {
        scheduleSimTimeout(() => {
          playDialogueSequence(prev.scenarioId, Math.max(0, prev.revealedTurnCount));
        }, 150);
      } else if (prev.stage === 8 && prev.active && prev.selectedUnitId && !prev.arrivedOnScene) {
        const routeToUse =
          prev.activeRoute ||
          buildSimulatedCorridorRoute(
            6.5068,
            3.3775,
            SIMULATION_SCENARIOS[prev.scenarioId].resolvedCoords.lat,
            SIMULATION_SCENARIOS[prev.scenarioId].resolvedCoords.lng
          );
        scheduleSimTimeout(() => {
          void runSimulationTracking(prev.scenarioId, prev.selectedUnitId!, routeToUse, {
            resumeExisting: true,
          });
        }, 100);
      }
    }
    applySimState((p) => ({
      ...p,
      paused: nextPaused,
      audioPlaying: nextPaused ? false : p.audioPlaying,
    }));
  }, [applySimState, clearSimExecution, playDialogueSequence, runSimulationTracking, scheduleSimTimeout]);

  const handleToggleSimAudio = useCallback(() => {
    applySimState((prev) => {
      const nextAudio = !prev.audioEnabled;
      if (!nextAudio) stopAllSpeech();
      return {
        ...prev,
        audioEnabled: nextAudio,
        audioPlaying: nextAudio ? prev.audioPlaying : false,
      };
    });
  }, [applySimState]);

  const handleEndSimulation = useCallback(() => {
    clearSimExecution();
    applySimState((prev) => ({
      ...prev,
      active: false,
      paused: false,
      callStatus: 'IDLE',
      audioPlaying: false,
      speakingSpeaker: null,
    }));
    pushToast('Live simulation ended cleanly.', 'info');
  }, [applySimState, clearSimExecution, pushToast]);

  const carrierConfigured =
    integrations.find((i) => i.id === 'carrier_location')?.configured ?? false;

  const openIncidentsCount = incidents.filter(
    (i) => !i.legacyOutOfScope && isActiveIncidentStatus(i.status)
  ).length;

  const navItems: Array<{
    id: AppSection;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> =
    userRole === 'Organisation Administrator'
      ? [
          {
            id: 'admin-overview' as AdminSection,
            label: 'Overview',
            icon: <LayoutDashboard className="w-4 h-4" />,
          },
          {
            id: 'staff-management' as AdminSection,
            label: 'Staff Management',
            icon: <Users className="w-4 h-4" />,
          },
          {
            id: 'unit-management' as AdminSection,
            label: 'Unit Management',
            icon: <Truck className="w-4 h-4" />,
          },
          {
            id: 'organisation-settings' as AdminSection,
            label: 'Organisation Settings',
            icon: <Building2 className="w-4 h-4" />,
          },
          {
            id: 'integrations' as AdminSection,
            label: 'Integrations',
            icon: <PlugZap className="w-4 h-4" />,
          },
        ]
      : [
          {
            id: 'command-centre' as OperationsSection,
            label: 'Command Centre',
            icon: <LayoutDashboard className="w-4 h-4" />,
          },
          {
            id: 'incident-management' as OperationsSection,
            label: 'Incident Management',
            icon: <AlertTriangle className="w-4 h-4" />,
            badge: openIncidentsCount,
          },
          {
            id: 'response-units' as OperationsSection,
            label: 'Response Units',
            icon: <Truck className="w-4 h-4" />,
          },
          {
            id: 'incident-history' as OperationsSection,
            label: 'Incident History',
            icon: <Archive className="w-4 h-4" />,
          },
        ];

  const navigateTo = (target: AppSection) => {
    setSection(target);
    if (target !== 'incident-management') {
      setWorkspaceOpen(false);
    }
    setMobileMenuOpen(false);
  };

  const handleSwitchDemoAccount = async (accountId: string) => {
    setSwitchingAccount(true);
    try {
      const nextAcc = await issueAndActivateDemoSession(accountId);
      if (nextAcc.role === 'Organisation Administrator') {
        clearSimExecution();
        applySimState((prev) => ({ ...prev, active: false, callStatus: 'IDLE' }));
        setSection('admin-overview');
      } else {
        setSection('command-centre');
      }
      setWorkspaceOpen(false);
      pushToast(`Signed in (Demo Session) as ${nextAcc.name} — ${nextAcc.role}.`, 'info');
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : 'Could not switch demo account.',
        'error'
      );
    } finally {
      setSwitchingAccount(false);
    }
  };

  return (
    <div className="h-screen h-dvh overflow-hidden flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Medical Prototype Disclaimer Strip */}
      <div className="shrink-0 bg-[var(--status-urgent-bg)] border-b border-[var(--status-urgent-border)] text-[var(--status-urgent-text)] px-4 py-1.5 text-[11px] flex items-center justify-center gap-2 text-center">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        <span>
          Responda medical coordination prototype. Not connected to public emergency services. Do not use for real emergencies.
        </span>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Desktop Collapsible Sidebar (Persistent; never auto-closed on outside click) */}
        <aside
          className={`hidden lg:flex lg:flex-col h-full overflow-y-auto bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] shrink-0 transition-all duration-200 ${
            sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-64'
          }`}
        >
          <div
            className={`p-3.5 border-b border-[var(--border-subtle)] flex items-center ${
              sidebarCollapsed ? 'justify-center' : 'justify-between gap-2'
            }`}
          >
            {!sidebarCollapsed && <RespondaLogo />}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={sidebarCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
              className="p-1.5 rounded-lg bg-[var(--bg-surface-elevated)] hover:border-[var(--border-strong)] border border-[var(--border-subtle)] text-[var(--text-primary)] transition-colors"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          {!sidebarCollapsed && (
            <div className="px-3.5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {userRole === 'Organisation Administrator'
                ? 'Organisation Admin'
                : 'Operations Staff'}
            </div>
          )}

          <nav aria-label="Primary navigation" className="flex-1 p-2.5 space-y-1">
            {navItems.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={sidebarCollapsed ? item.label : undefined}
                  onClick={() => navigateTo(item.id)}
                  className={`w-full flex items-center ${
                    sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-3'
                  } gap-2 py-2.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[var(--action-blue)] text-[var(--text-on-solid)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.icon}
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </span>
                  {!sidebarCollapsed && item.badge !== undefined && (
                    <span
                      className={`font-mono tabular-nums text-[11px] px-1.5 py-0.5 rounded ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {!sidebarCollapsed && (
            <div className="p-3 space-y-2.5 border-t border-[var(--border-subtle)]">
              <div className="rounded-xl bg-[var(--status-critical-bg)] border border-[var(--status-critical-border)] p-3 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-[var(--status-critical-text)]">
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Medical Command Prototype</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
                  Human verification and approval required for every dispatch decision.
                </p>
              </div>

              <div className="rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-2.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                  {wsConnected ? (
                    <Wifi className="w-3.5 h-3.5 text-[var(--status-verified-text)]" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5 text-[var(--status-urgent-text)]" />
                  )}
                  <span>{wsConnected ? 'Live Sync Active' : 'Reconnecting'}</span>
                </span>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">WS</span>
              </div>
            </div>
          )}
        </aside>

        {/* Mobile Drawer Sidebar (Fixed & Scroll-Isolated) */}
        {mobileMenuOpen && (
          <div className="lg:hidden">
            <div
              className="fixed inset-0 z-30 bg-[var(--bg-overlay)]"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-40 h-dvh w-64 max-w-[80vw] bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex flex-col overflow-y-auto shadow-[var(--shadow-floating)]">
              <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                <RespondaLogo showSubtitle={false} wordmark="Responda" />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap ${
                      section === item.id
                        ? 'bg-[var(--action-blue)] text-[var(--text-on-solid)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]'
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
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* Top Navigation Bar */}
          <header className="shrink-0 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-3 sm:px-4 lg:px-6 py-3 flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className="lg:hidden p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] shrink-0"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="shrink-0">
                <RespondaLogo showSubtitle={false} wordmark="Responda" hideWordmarkOnMobile />
              </div>
            </div>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-3 min-w-0">
              {userRole === 'Operations Staff' && (
                <button
                  type="button"
                  onClick={() => setGuideOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-elevated)] hover:border-[var(--border-strong)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--action-blue)] dark:text-[#60A5FA] whitespace-nowrap shrink-0 transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Guide</span>
                </button>
              )}

              {/* Server-Issued Demo Profile Switcher */}
              <div className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-1.5 sm:px-2 py-1 min-w-0">
                <span className="hidden lg:inline text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
                  Demo Profile (Prototype Auth):
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wide whitespace-nowrap shrink-0 ${
                    userRole === 'Organisation Administrator'
                      ? 'bg-[var(--status-urgent-bg)] text-[var(--status-urgent-text)] border border-[var(--status-urgent-border)]'
                      : 'bg-[var(--brand-teal-bg)] text-[var(--brand-teal)] border border-[var(--brand-teal-border)]'
                  }`}
                >
                  {userRole === 'Organisation Administrator' ? 'Admin' : 'Ops'}
                </span>
                <SelectMenu<string>
                  ariaLabel="Switch active demo staff profile"
                  disabled={switchingAccount || staffAccounts.length === 0}
                  value={currentAccount?.id || ''}
                  onChange={(id) => void handleSwitchDemoAccount(id)}
                  menuAlign="right"
                  className="min-w-0"
                  options={staffAccounts.map((acc) => ({
                    value: acc.id,
                    label: `${acc.name} · ${acc.role}`,
                    sublabel: acc.accountStatus !== 'ACTIVE' ? acc.accountStatus : acc.badgeCode,
                    disabled: acc.accountStatus !== 'ACTIVE',
                  }))}
                  buttonClassName="border-transparent bg-transparent py-0.5 px-1 sm:px-1.5 font-semibold text-[var(--action-blue)] dark:text-[#60A5FA] max-w-[130px] sm:max-w-[240px]"
                />
              </div>

              {/* Notification Centre */}
              <div ref={notifRef} className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((o) => !o)}
                  aria-label="Toggle notification centre"
                  aria-expanded={notifOpen}
                  className="relative p-2 rounded-lg bg-[var(--bg-surface-elevated)] hover:border-[var(--border-strong)] border border-[var(--border-subtle)] text-[var(--text-primary)] transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--status-critical-accent)] text-[10px] font-mono tabular-nums font-bold text-[var(--text-on-solid)] flex items-center justify-center">
                      {Math.min(9, notifications.length)}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-[var(--shadow-floating)] z-[800] p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        Notification Centre
                      </span>
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        Close
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {notifications.length === 0 ? (
                        <div className="text-xs text-[var(--text-muted)] py-4 text-center">
                          No notifications recorded.
                        </div>
                      ) : (
                        notifications.slice(0, 8).map((n) => (
                          <div
                            key={n.id}
                            className="rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] p-2.5 text-[11px] space-y-1"
                          >
                            <div className="flex items-center justify-between text-[var(--text-secondary)]">
                              <span className="font-mono text-[var(--brand-teal)]">
                                {n.channel}
                              </span>
                              <span className="font-mono tabular-nums">
                                {new Date(n.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-[var(--text-primary)]">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Operational / Administrative Viewport (Only inner container scrolls) */}
          <main className="flex-1 overflow-y-auto min-h-0">
            <div className="max-w-[1640px] w-full mx-auto p-4 lg:p-6 pb-6 lg:pb-8 space-y-4">
              {userRole === 'Operations Staff' && (
                <SimulationControlPanel
                  simState={simState}
                  busy={simBusy}
                  onPauseResume={handleToggleSimPause}
                  onPrevStep={() => void handlePrevSimulationStage()}
                  onNextStep={() => void advanceSimulationStage()}
                  onRestart={() => void startSimulation(simState.scenarioId)}
                  onEnd={handleEndSimulation}
                  onToggleAudio={handleToggleSimAudio}
                />
              )}

            {loading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-24 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] animate-pulse"
                    />
                  ))}
                </div>
                <div className="h-[440px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] animate-pulse" />
              </div>
            ) : loadError ? (
              <div className="rounded-xl bg-[var(--status-critical-bg)] border border-[var(--status-critical-border)] p-6 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-[var(--status-critical-text)] mx-auto" />
                <div className="text-sm font-bold text-[var(--status-critical-text)]">{loadError}</div>
                <button
                  type="button"
                  onClick={() => void fetchBootstrap()}
                  className="px-4 py-2 rounded-lg bg-[var(--status-critical-accent)] hover:opacity-90 text-xs font-semibold text-[var(--text-on-solid)]"
                >
                  Retry Connection
                </button>
              </div>
            ) : userRole === 'Organisation Administrator' ? (
              section === 'staff-management' ? (
                <StaffManagementView
                  staffAccounts={staffAccounts}
                  currentAccountId={currentAccount?.id || ''}
                  authFetch={authFetch}
                  onStaffUpdated={(acc) => {
                    setStaffAccounts((prev) => {
                      const exists = prev.some((s) => s.id === acc.id);
                      return exists
                        ? prev.map((s) => (s.id === acc.id ? acc : s))
                        : [...prev, acc];
                    });
                  }}
                  onToast={pushToast}
                />
              ) : section === 'unit-management' ? (
                <UnitManagementView
                  units={units}
                  organisationName={organisationSettings.name}
                  authFetch={authFetch}
                  onUnitUpdated={(unit) => {
                    setUnits((prev) => {
                      const exists = prev.some((u) => u.id === unit.id);
                      return exists
                        ? prev.map((u) => (u.id === unit.id ? unit : u))
                        : [...prev, unit];
                    });
                  }}
                  onToast={pushToast}
                />
              ) : section === 'organisation-settings' ? (
                <OrganisationSettingsView
                  settings={organisationSettings}
                  authFetch={authFetch}
                  onUpdated={setOrganisationSettings}
                  onToast={pushToast}
                />
              ) : section === 'integrations' ? (
                <SettingsIntegrationsView
                  integrations={integrations}
                  notifications={notifications}
                  authFetch={authFetch}
                  onRefreshBootstrap={() => fetchBootstrap()}
                  onToast={pushToast}
                />
              ) : (
                <AdminOverviewView
                  organisationSettings={organisationSettings}
                  staffAccounts={staffAccounts}
                  units={units}
                  integrations={integrations}
                  onNavigateAdmin={(s) => navigateTo(s)}
                />
              )
            ) : section === 'incident-management' ? (
              <IncidentManagementView
                incidents={incidents}
                units={units}
                userRole={userRole}
                operatorName={operatorName}
                authFetch={authFetch}
                carrierConfigured={carrierConfigured}
                requireLocationVerificationBeforeDispatch={
                  organisationSettings.requireLocationVerificationBeforeDispatch
                }
                selectedIncidentId={selectedIncidentId}
                workspaceOpen={workspaceOpen}
                initialTab={workspaceTab}
                simState={simState}
                preselectedUnitId={
                  simState.active && simState.incidentId === selectedIncidentId
                    ? simState.selectedUnitId
                    : selectedUnitId
                }
                draftsByIncidentId={draftsByIncidentId}
                onUpdateDraft={handleUpdateDraft}
                onSelectIncident={(id) => setSelectedIncidentId(id)}
                onOpenWorkspace={(id, tab = 'workflow') => {
                  setSelectedIncidentId(id);
                  setWorkspaceTab(tab);
                  setWorkspaceOpen(true);
                }}
                onCloseWorkspace={() => setWorkspaceOpen(false)}
                onTakeOver={handleTakeOver}
                onUpdateMedicalDetails={handleUpdateMedicalDetails}
                onVerifyLocation={handleVerifyLocation}
                onUpdateStatus={handleUpdateStatus}
                onDispatchUnit={handleDispatchUnit}
                onTransportEvent={handleTransportEvent}
                onAddNote={handleAddNote}
                onSendOperatorMessage={handleSendOperatorMessage}
                onRouteCalculated={setActiveRoute}
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
                  setSelectedIncidentId(id);
                  setWorkspaceTab('workflow');
                  setWorkspaceOpen(true);
                  setSection('incident-management');
                }}
                onSelectUnitForIncident={(unitId, incidentId) => {
                  setSelectedUnitId(unitId);
                  setSelectedIncidentId(incidentId);
                  setWorkspaceTab('response');
                  setWorkspaceOpen(true);
                  setSection('incident-management');
                  if (simState.active && simState.incidentId === incidentId) {
                    setSimState((prev) => ({
                      ...prev,
                      selectedUnitId: unitId,
                      stage: 7,
                      statusMessage: SIMULATION_STAGES[6].nextExpectedAction,
                    }));
                  }
                }}
              />
            ) : section === 'incident-history' ? (
              <LiveIncidentsView
                incidents={incidents}
                units={units}
                userRole={userRole}
                operatorName={operatorName}
                authFetch={authFetch}
                carrierConfigured={carrierConfigured}
              />
            ) : (
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
                  setWorkspaceTab('workflow');
                  setWorkspaceOpen(true);
                  setSection('incident-management');
                }}
                onTakeOver={handleTakeOver}
                onOpenHistory={() => navigateTo('incident-history')}
                onOpenGuide={() => setGuideOpen(true)}
              />
            )}
            </div>
          </main>
        </div>
      </div>

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
      <div className="fixed bottom-4 right-4 z-[1100] space-y-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`rounded-xl px-4 py-3 text-xs font-medium shadow-[var(--shadow-floating)] border ${
              t.tone === 'error'
                ? 'bg-[var(--status-critical-bg)] border-[var(--status-critical-border)] text-[var(--status-critical-text)]'
                : t.tone === 'success'
                ? 'bg-[var(--status-verified-bg)] border-[var(--status-verified-border)] text-[var(--status-verified-text)]'
                : 'bg-[var(--bg-surface-elevated)] border-[var(--border-strong)] text-[var(--text-primary)]'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
