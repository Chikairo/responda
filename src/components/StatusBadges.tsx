import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  MapPin,
  Navigation,
  Radio,
  ShieldAlert,
  Truck,
  UserCheck,
} from 'lucide-react';
import {
  IncidentPriority,
  IncidentStatus,
  LocationSource,
  UnitAvailability,
  VerificationStatus,
} from '../types/responda';
import { getLocationSourceBadgeMeta } from '../utils/intakeParser';

export function RespondaLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 shrink-0 select-none">
      <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-red-600/15 border border-red-500/30">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="text-red-500"
        >
          <path
            d="M12 2C7.58 2 4 5.58 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4.42-3.58-8-8-8z"
            fill="currentColor"
            fillOpacity="0.22"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M7.5 10.2h2.1l1.2-2.7 2 5.2 1.3-2.5h2.4"
            stroke="#F8FAFC"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="font-display font-bold tracking-tight text-base text-slate-900 dark:text-slate-50 whitespace-nowrap">
            RESPONDA
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Every second matters
          </div>
        </div>
      )}
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: IncidentPriority }) {
  const styles: Record<IncidentPriority, { cls: string; icon: React.ReactNode; label: string }> = {
    CRITICAL: {
      cls: 'bg-red-500/15 text-red-400 border-red-500/35',
      icon: <AlertOctagon className="w-3.5 h-3.5 shrink-0" />,
      label: 'Critical',
    },
    HIGH: {
      cls: 'bg-orange-500/15 text-orange-400 border-orange-500/35',
      icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
      label: 'High',
    },
    MEDIUM: {
      cls: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
      icon: <Info className="w-3.5 h-3.5 shrink-0" />,
      label: 'Medium',
    },
    LOW: {
      cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35',
      icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
      label: 'Low',
    },
  };
  const cfg = styles[priority];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap shrink-0 ${cfg.cls}`}
    >
      {cfg.icon}
      <span>{cfg.label}</span>
    </span>
  );
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const map: Record<IncidentStatus, { cls: string; label: string }> = {
    NEW: { cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30', label: 'New' },
    AI_INTAKE: { cls: 'bg-blue-500/15 text-blue-400 border-blue-500/35', label: 'AI Intake' },
    AWAITING_OPERATOR: {
      cls: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
      label: 'Awaiting Operator',
    },
    UNDER_REVIEW: {
      cls: 'bg-blue-500/15 text-blue-300 border-blue-500/35',
      label: 'Under Review',
    },
    VERIFIED: {
      cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35',
      label: 'Verified',
    },
    UNIT_ASSIGNED: {
      cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35',
      label: 'Unit Assigned',
    },
    RESPONDING: {
      cls: 'bg-orange-500/15 text-orange-300 border-orange-500/35',
      label: 'Responding',
    },
    ON_SCENE: {
      cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/35',
      label: 'On Scene',
    },
    RESOLVED: {
      cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35',
      label: 'Resolved',
    },
    CLOSED: {
      cls: 'bg-slate-600/20 text-slate-400 border-slate-600/35',
      label: 'Closed',
    },
  };
  const cfg = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap shrink-0 ${cfg.cls}`}
    >
      <Clock className="w-3 h-3 shrink-0" />
      <span>{cfg.label}</span>
    </span>
  );
}

export function UnitAvailabilityBadge({
  availability,
}: {
  availability: UnitAvailability;
}) {
  const map: Record<UnitAvailability, { cls: string; label: string; icon: React.ReactNode }> = {
    AVAILABLE: {
      cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35',
      label: 'Available',
      icon: <CheckCircle2 className="w-3 h-3 shrink-0" />,
    },
    ASSIGNED: {
      cls: 'bg-blue-500/15 text-blue-400 border-blue-500/35',
      label: 'Assigned',
      icon: <UserCheck className="w-3 h-3 shrink-0" />,
    },
    ACKNOWLEDGED: {
      cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35',
      label: 'Acknowledged',
      icon: <Radio className="w-3 h-3 shrink-0" />,
    },
    EN_ROUTE: {
      cls: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
      label: 'En route',
      icon: <Navigation className="w-3 h-3 shrink-0" />,
    },
    ON_SCENE: {
      cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/35',
      label: 'On scene',
      icon: <Truck className="w-3 h-3 shrink-0" />,
    },
    UNAVAILABLE: {
      cls: 'bg-slate-600/20 text-slate-400 border-slate-600/35',
      label: 'Unavailable',
      icon: <ShieldAlert className="w-3 h-3 shrink-0" />,
    },
  };
  const cfg = map[availability];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap shrink-0 ${cfg.cls}`}
    >
      {cfg.icon}
      <span>{cfg.label}</span>
    </span>
  );
}

export function LocationSourceBadge({ source }: { source: LocationSource }) {
  const meta = getLocationSourceBadgeMeta(source);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide border whitespace-nowrap shrink-0 ${meta.toneClass}`}
    >
      <MapPin className="w-3 h-3 shrink-0" />
      <span>{meta.label}</span>
    </span>
  );
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  if (status === 'VERIFIED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/35 whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-3 h-3 shrink-0" />
        <span>VERIFIED</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/35 whitespace-nowrap shrink-0">
      <AlertTriangle className="w-3 h-3 shrink-0" />
      <span>UNVERIFIED</span>
    </span>
  );
}
