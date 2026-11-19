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
  PhoneCall,
  Play,
  Radio,
  Settings,
  ShieldCheck,
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
import { DemoScenarioGuide } from './components/DemoScenarioGuide';
import { IncidentWorkspace } from './components/IncidentWorkspace';
import { LiveIncidentsView } from './components/LiveIncidentsView';
import { OperatorGuideModal } from './components/OperatorGuideModal';
import { ResponseUnitsView } from './components/ResponseUnitsView';
import { ResponsiveShowcaseView } from './components/ResponsiveShowcaseView';
import { SettingsIntegrationsView } from './components/SettingsIntegrationsView';
import { RespondaLogo } from './components/StatusBadges';

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

  // Guided Competition Demo State
  const [demoActive, setDemoActive] = useState(false);
  const [demoStep, setDemoStep] = useState(1);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoIncidentId, setDemoIncidentId] = useState<string | null>(null);

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
    pushToast(`Human operator takeover completed for ${id}.`, 'success');
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
    pushToast(`${id} status updated to ${status}.`, 'success');
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
    pushToast(
      `Dispatch approved: ${data.unit.callsign} assigned to ${incidentId}.`,
      'success'
    );
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

  // Repeatable Competition Demo Scenario (Yaba Road Accident)
  const [demoUnitId, setDemoUnitId] = useState<string | null>(null);

  const executeDemoStep = async (
    stepNumber: number,
    ctx: { incidentId: string | null; unitId: string | null }
  ): Promise<{ incidentId: string | null; unitId: string | null }> => {
    if (stepNumber === 1) {
      setSection('ai-intake');
      pushToast(
        'Demo Step 1: Simulated caller reporting Yaba road accident.',
        'info'
      );
      return ctx;
    }

    if (stepNumber === 2) {
      const now = new Date().toISOString();
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'Road accident',
          priority: 'CRITICAL',
          priorityReason:
            'Road collision in Yaba with two reported injuries; exact street uncertain (landmark provided).',
          summary:
            'Road accident near UNILAG main gate / Sabo axis, Yaba; two people reported injured (Simulated Demo Scenario).',
          description:
            'Caller reports a collision in Yaba involving a commercial bus and private car. Two people may be injured. Unsure of exact street number; nearby landmark is UNILAG main gate.',
          callerName: 'Folake S. (Demo Scenario)',
          callerPhone: '+234-800-010-2026',
          peopleAffected: 2,
          immediateDanger: true,
          dangerDetails: 'Two injured occupants near moving traffic.',
          missingInfoFlags: ['Exact street confirmation by human operator'],
          locationDescription:
            'In Yaba near UNILAG main gate / Sabo bus stop (caller unsure of exact street)',
          landmark: 'UNILAG Main Gate',
          area: 'Yaba',
          callChannel: 'DEMO_SCENARIO',
          isSimulated: true,
          transcript: [
            {
              id: 'demo-t-1',
              speaker: 'AI',
              text: "Hello, this is Responda's automated intake assistant. Please tell me what happened and where you are located.",
              timestamp: now,
            },
            {
              id: 'demo-t-2',
              speaker: 'CALLER',
              text: 'There is a road accident here in Yaba. Two people look injured!',
              timestamp: now,
            },
            {
              id: 'demo-t-3',
              speaker: 'AI',
              text: 'Understood. Is there an immediate threat, and what nearby street or landmark can help us locate you?',
              timestamp: now,
            },
            {
              id: 'demo-t-4',
              speaker: 'CALLER',
              text: "I'm not sure of the exact street number, but we are right by the UNILAG main gate junction in Yaba.",
              timestamp: now,
            },
          ],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const created = data.incident as IncidentRecord;
        setIncidents((prev) =>
          prev.some((i) => i.id === created.id) ? prev : [created, ...prev]
        );
        setSelectedIncidentId(created.id);
        setSection('command-centre');
        pushToast(
          `Demo Step 2: ${created.id} created (CALLER_DESCRIPTION · UNVERIFIED).`,
          'success'
        );
        return { incidentId: created.id, unitId: ctx.unitId };
      }
      return ctx;
    }

    if (stepNumber === 3 && ctx.incidentId) {
      if (userRole === 'Responder') setUserRole('Dispatcher');
      await fetch(`/api/incidents/${ctx.incidentId}/takeover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-responda-role': 'Dispatcher',
          'x-responda-operator': 'Seyi Ogunleye',
        },
      }).then(async (r) => {
        if (r.ok) {
          const d = await r.json();
          setIncidents((prev) =>
            prev.map((i) => (i.id === ctx.incidentId ? d.incident : i))
          );
        }
      });
      setWorkspaceIncidentId(ctx.incidentId);
      setSelectedIncidentId(ctx.incidentId);
      pushToast(`Demo Step 3: Human operator took over ${ctx.incidentId}.`, 'success');
      return ctx;
    }

    if (stepNumber === 4 && ctx.incidentId) {
      await fetch(`/api/incidents/${ctx.incidentId}/verify-location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-responda-role': 'Dispatcher',
          'x-responda-operator': 'Seyi Ogunleye',
        },
        body: JSON.stringify({
          correctedDescription:
            'University Road / Abule Oja Junction by UNILAG Main Gate, Yaba, Lagos',
          landmark: 'UNILAG Main Gate',
          area: 'Yaba',
          lat: 6.5158,
          lng: 3.3845,
          markVerified: true,
        }),
      }).then(async (r) => {
        if (r.ok) {
          const d = await r.json();
          setIncidents((prev) =>
            prev.map((i) => (i.id === ctx.incidentId ? d.incident : i))
          );
        }
      });
      pushToast('Demo Step 4: Location verified by human operator.', 'success');
      return ctx;
    }

    if (stepNumber === 5 && ctx.incidentId) {
      const availableAmb =
        units.find(
          (u) => u.id === 'UNIT-AMB-02' && u.availability === 'AVAILABLE'
        ) ||
        units.find(
          (u) => u.availability === 'AVAILABLE' && u.unitType === 'Ambulance'
        ) ||
        units.find((u) => u.availability === 'AVAILABLE');

      if (availableAmb) {
        const res = await fetch(`/api/incidents/${ctx.incidentId}/dispatch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-responda-role': 'Dispatcher',
            'x-responda-operator': 'Seyi Ogunleye',
          },
          body: JSON.stringify({
            unitId: availableAmb.id,
            humanConfirmed: true,
            notes: 'Demo Scenario: Human dispatcher approved ambulance dispatch to UNILAG Gate, Yaba.',
            notifyUnitSms: true,
          }),
        });
        if (res.ok) {
          const d = await res.json();
          setIncidents((prev) =>
            prev.map((i) => (i.id === ctx.incidentId ? d.incident : i))
          );
          setUnits((prev) =>
            prev.map((u) => (u.id === availableAmb.id ? d.unit : u))
          );
          setSelectedUnitId(availableAmb.id);
          const routeRes = await fetch('/api/routing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromLat: availableAmb.lat,
              fromLng: availableAmb.lng,
              toLat: 6.5158,
              toLng: 3.3845,
              allowSimulatedOverlay: true,
            }),
          });
          if (routeRes.ok) {
            setActiveRoute(await routeRes.json());
          }
          pushToast(
            `Demo Step 5: Dispatcher approved ${availableAmb.callsign} for ${ctx.incidentId}.`,
            'success'
          );
          return { incidentId: ctx.incidentId, unitId: availableAmb.id };
        }
      }
      return ctx;
    }

    if (stepNumber === 6 && ctx.incidentId) {
      const targetUnitId =
        ctx.unitId ||
        incidents.find((i) => i.id === ctx.incidentId)?.assignedUnitId ||
        selectedUnitId;
      if (targetUnitId) {
        await handleUpdateUnitStatus(targetUnitId, 'ACKNOWLEDGED');
        await handleUpdateUnitStatus(targetUnitId, 'EN_ROUTE');
      }
      setWorkspaceIncidentId(ctx.incidentId);
      pushToast(
        'Demo Step 6: Unit acknowledged and moved En Route (Simulated Mode).',
        'success'
      );
      return ctx;
    }

    return ctx;
  };

  const handleAdvanceDemo = async () => {
    setDemoBusy(true);
    try {
      const next = await executeDemoStep(demoStep, {
        incidentId: demoIncidentId,
        unitId: demoUnitId,
      });
      setDemoIncidentId(next.incidentId);
      setDemoUnitId(next.unitId);
      setDemoStep((s) => s + 1);
    } finally {
      setDemoBusy(false);
    }
  };

  const handleRunAllDemo = async () => {
    setDemoBusy(true);
    try {
      let ctx = { incidentId: demoIncidentId, unitId: demoUnitId };
      for (let s = demoStep; s <= 6; s++) {
        ctx = await executeDemoStep(s, ctx);
        setDemoIncidentId(ctx.incidentId);
        setDemoUnitId(ctx.unitId);
        setDemoStep(s + 1);
      }
    } finally {
      setDemoBusy(false);
    }
  };

  const handleResetDemo = async () => {
    setDemoBusy(true);
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      if (res.ok) {
        const fresh = await res.json();
        setIncidents(fresh.incidents);
        setUnits(fresh.units);
        setNotifications(fresh.notifications);
        setWorkspaceIncidentId(null);
        setDemoIncidentId(null);
        setDemoUnitId(null);
        setDemoStep(1);
        setActiveRoute(null);
        setSection('command-centre');
        pushToast('Demo dataset reset cleanly.', 'info');
      }
    } finally {
      setDemoBusy(false);
    }
  };

  const workspaceIncident = workspaceIncidentId
    ? incidents.find((i) => i.id === workspaceIncidentId) || null
    : null;

  const geminiConfigured =
    integrations.find((i) => i.id === 'gemini')?.configured ?? false;

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
      id: 'ai-intake',
      label: 'AI Intake',
      icon: <Bot className="w-4 h-4" />,
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
      id: 'response-units',
      label: 'Response Units',
      icon: <Truck className="w-4 h-4" />,
    },
    {
      id: 'incident-history',
      label: 'Incident History',
      icon: <Archive className="w-4 h-4" />,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: 'responsive-showcase',
      label: 'Responsive Showcase',
      icon: <Monitor className="w-4 h-4" />,
    },
    {
      id: 'settings',
      label: 'Settings & Integrations',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  const navigateTo = (target: AppSection) => {
    setWorkspaceIncidentId(null);
    setSection(target);
    setMobileMenuOpen(false);
    setMoreMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0B1220] text-[#F8FAFC]">
      {/* Competition Disclaimer Strip */}
      <div className="bg-[#111C2E] border-b border-[#26364B] px-4 py-1.5 text-[11px] text-amber-200/90 flex items-center justify-center gap-2 text-center">
        <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>
          Responda competition prototype. Not connected to a public emergency number or live emergency-response network. Do not use for real emergencies.
        </span>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Desktop Left Sidebar */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-[#111C2E] border-r border-[#26364B] shrink-0">
          <div className="p-4 border-b border-[#26364B]">
            <RespondaLogo />
          </div>

          <nav aria-label="Primary navigation" className="flex-1 p-3 space-y-1">
            {navItems.map((item) => {
              const active = !workspaceIncident && section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-[#172438] hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span
                      className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                        active
                          ? 'bg-blue-500 text-white'
                          : 'bg-[#172438] text-slate-300'
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
          <div className="p-3 space-y-2.5 border-t border-[#26364B]">
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-red-300">
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Simulated Demo Ops</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Lagos Private Command Prototype. Human approval required for all dispatches.
              </p>
            </div>

            <div className="rounded-xl bg-[#0B1220] border border-[#26364B] px-3 py-2.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-300">
                {wsConnected ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>{wsConnected ? 'Live Sync Active' : 'Reconnecting'}</span>
              </span>
              <span className="font-mono text-[10px] text-slate-400">WS</span>
            </div>
          </div>
        </aside>

        {/* Mobile Drawer Sidebar */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[900] lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/60"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="relative w-64 max-w-[80vw] bg-[#111C2E] border-r border-[#26364B] flex flex-col z-10">
              <div className="p-4 border-b border-[#26364B] flex items-center justify-between">
                <RespondaLogo />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white"
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
                        : 'text-slate-300 hover:bg-[#172438]'
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
          <header className="bg-[#111C2E] border-b border-[#26364B] px-3 sm:px-4 lg:px-6 py-3 flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className="lg:hidden p-2 rounded-lg bg-[#172438] border border-[#26364B] text-slate-200 shrink-0"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="lg:hidden shrink-0">
                <RespondaLogo compact />
              </div>
              <div className="hidden sm:block truncate">
                <div className="text-xs font-semibold text-slate-100 truncate">
                  {operator.organisation}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
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
                onClick={() => setGuideOpen(true)}
                title="First-time operator walkthrough and 8-step workflow guide"
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-xs font-semibold text-blue-300 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Operator Guide</span>
              </button>

              {/* Demo Role Selector */}
              <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg bg-[#0B1220] border border-[#26364B] px-2 sm:px-2.5 py-1">
                <span className="hidden md:inline text-[11px] text-slate-400">
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
                  className="bg-transparent text-xs font-semibold text-blue-300 focus:outline-none max-w-[145px] sm:max-w-none truncate"
                >
                  <option value="Dispatcher" className="bg-[#111C2E]">
                    Dispatcher · Seyi O.
                  </option>
                  <option value="Call Operator" className="bg-[#111C2E]">
                    Call Operator · Amina B.
                  </option>
                  <option value="Administrator" className="bg-[#111C2E]">
                    Administrator · Dr. Bakare
                  </option>
                  <option value="Responder" className="bg-[#111C2E]">
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
                  className="relative p-2 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-slate-200 transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-[10px] font-mono font-bold text-white flex items-center justify-center">
                      {Math.min(9, notifications.length)}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[#111C2E] border border-[#26364B] shadow-2xl z-[800] p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-[#26364B] pb-2">
                      <span className="text-xs font-bold text-slate-100">
                        Notification Centre
                      </span>
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        className="text-[11px] text-slate-400 hover:text-white"
                      >
                        Close
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {notifications.length === 0 ? (
                        <div className="text-xs text-slate-400 py-4 text-center">
                          No notifications recorded.
                        </div>
                      ) : (
                        notifications.slice(0, 8).map((n) => (
                          <div
                            key={n.id}
                            className="rounded-lg bg-[#0B1220] border border-[#26364B] p-2.5 text-[11px] space-y-1"
                          >
                            <div className="flex items-center justify-between text-slate-400">
                              <span className="font-mono text-blue-400">{n.channel}</span>
                              <span className="font-mono">
                                {new Date(n.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-slate-200">{n.message}</p>
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
          <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-8 space-y-5 max-w-[1600px] w-full mx-auto">
            <DemoScenarioGuide
              active={demoActive}
              currentStep={demoStep}
              busy={demoBusy}
              demoIncidentId={demoIncidentId}
              onAdvanceStep={handleAdvanceDemo}
              onRunAllSteps={handleRunAllDemo}
              onResetDemo={handleResetDemo}
              onClose={() => setDemoActive(false)}
            />

            {loading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-24 rounded-xl bg-[#111C2E] border border-[#26364B] animate-pulse"
                    />
                  ))}
                </div>
                <div className="h-[460px] rounded-xl bg-[#111C2E] border border-[#26364B] animate-pulse" />
              </div>
            ) : loadError ? (
              <div className="rounded-xl bg-red-500/10 border border-red-500/35 p-6 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
                <div className="text-sm font-bold text-red-200">{loadError}</div>
                <button
                  type="button"
                  onClick={fetchBootstrap}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white"
                >
                  Retry Connection
                </button>
              </div>
            ) : workspaceIncident ? (
              <IncidentWorkspace
                incident={workspaceIncident}
                units={units}
                userRole={userRole}
                operatorName={operator.name}
                initialTab={workspaceInitialTab}
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
                onStartDemoScenario={() => {
                  setDemoActive(true);
                  setDemoStep(1);
                  setDemoIncidentId(null);
                }}
                onGoToIntake={() => navigateTo('ai-intake')}
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
                onUpdateUnitStatus={handleUpdateUnitStatus}
                onOpenIncident={(id) => {
                  setWorkspaceInitialTab('overview');
                  setWorkspaceIncidentId(id);
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
            className="fixed inset-0 bg-black/60"
            onClick={() => setMoreMenuOpen(false)}
          />
          <div className="relative z-10 w-full rounded-t-2xl bg-[#111C2E] border-t border-[#26364B] p-4 pb-20 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-[#26364B]">
              <span className="font-display text-sm font-bold text-slate-100">
                More Operations &amp; Tools
              </span>
              <button
                type="button"
                onClick={() => setMoreMenuOpen(false)}
                aria-label="Close more menu"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => navigateTo('ai-intake')}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[#0B1220] border border-[#26364B] text-slate-100"
              >
                <Bot className="w-4 h-4 text-blue-400" />
                <span>AI Intake</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('conversation-centre')}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[#0B1220] border border-[#26364B] text-slate-100"
              >
                <Headphones className="w-4 h-4 text-emerald-400" />
                <span>Conversation Centre</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('incident-history')}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[#0B1220] border border-[#26364B] text-slate-100"
              >
                <Archive className="w-4 h-4 text-slate-300" />
                <span>Incident History</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('responsive-showcase')}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[#0B1220] border border-[#26364B] text-slate-100"
              >
                <Monitor className="w-4 h-4 text-blue-400" />
                <span>Responsive Showcase (Desktop · Tablet · Mobile)</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('settings')}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[#0B1220] border border-[#26364B] text-slate-100"
              >
                <Settings className="w-4 h-4 text-slate-300" />
                <span>Settings &amp; Integrations</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  setGuideOpen(true);
                }}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[#0B1220] border border-[#26364B] text-blue-300"
              >
                <HelpCircle className="w-4 h-4" />
                <span>First-Time Operator Guide</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  setDemoActive(true);
                  setDemoStep(1);
                  setDemoIncidentId(null);
                }}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-blue-600 text-white"
              >
                <Play className="w-4 h-4" />
                <span>Run Guided Demo Scenario</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile quick navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-[900] bg-[#111C2E] border-t border-[#26364B] grid grid-cols-5"
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
                active ? 'text-blue-400' : 'text-slate-400'
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
            moreMenuOpen ? 'text-blue-400' : 'text-slate-400'
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
            setDemoActive(true);
            setDemoStep(1);
            setDemoIncidentId(null);
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
                ? 'bg-red-950/95 border-red-500/50 text-red-100'
                : t.tone === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100'
                : 'bg-[#172438]/95 border-[#26364B] text-slate-100'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
