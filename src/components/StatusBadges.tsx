import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  HelpCircle,
  Info,
  MapPin,
  Navigation,
  ShieldAlert,
  Truck,
} from 'lucide-react';
import type {
  IncidentPriority,
  IncidentStatus,
  LocationSource,
  UnitAvailability,
  UnitLocationFreshness,
  UnitRegistrationStatus,
  VerificationStatus,
} from '../types/responda';
import { getLocationSourceBadgeMeta } from '../utils/intakeParser';

export function RespondaLogo({
  compact = false,
  showSubtitle = true,
  wordmark = 'RESPONDA',
  hideWordmarkOnMobile = false,
}: {
  compact?: boolean;
  showSubtitle?: boolean;
  wordmark?: string;
  hideWordmarkOnMobile?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 shrink-0 select-none">
      <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--status-critical-bg)] border border-[var(--status-critical-border)]">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="text-[var(--status-critical-accent)]"
        >
          <path
            d="M12 2C7.58 2 4 5.58 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4.42-3.58-8-8-8z"
            fill="currentColor"
            fillOpacity="0.18"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M7.5 10.2h2.1l1.2-2.7 2 5.2 1.3-2.5h2.4"
            className="stroke-[var(--status-critical-text)] dark:stroke-[var(--text-primary)]"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {!compact && (
        <div className={`leading-tight ${hideWordmarkOnMobile ? 'hidden md:block' : ''}`}>
          <div className="font-display font-bold tracking-tight text-base text-[var(--text-primary)] whitespace-nowrap">
            {wordmark}
          </div>
          {showSubtitle && (
            <div className="text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
              Every second matters
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: IncidentPriority }) {
  const styles: Record<IncidentPriority, { cls: string; icon: React.ReactNode; label: string }> = {
    Critical: {
      cls: 'bg-[var(--status-critical-bg)] text-[var(--status-critical-text)] border-[var(--status-critical-border)]',
      icon: <AlertOctagon className="w-3.5 h-3.5 shrink-0" />,
      label: 'Critical',
    },
    Urgent: {
      cls: 'bg-[var(--status-urgent-bg)] text-[var(--status-urgent-text)] border-[var(--status-urgent-border)]',
      icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
      label: 'Urgent',
    },
    Standard: {
      cls: 'bg-[var(--status-standard-bg)] text-[var(--status-standard-text)] border-[var(--status-standard-border)]',
      icon: <Info className="w-3.5 h-3.5 shrink-0" />,
      label: 'Standard',
    },
    Unassessed: {
      cls: 'bg-[var(--status-unassessed-bg)] text-[var(--status-unassessed-text)] border-[var(--status-unassessed-border)]',
      icon: <HelpCircle className="w-3.5 h-3.5 shrink-0" />,
      label: 'Unassessed',
    },
  };
  const cfg = styles[priority] || styles.Unassessed;
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
    New: {
      cls: 'bg-[var(--status-urgent-bg)] text-[var(--status-urgent-text)] border-[var(--status-urgent-border)]',
      label: 'New',
    },
    'Under Review': {
      cls: 'bg-[var(--action-blue-bg)] text-[var(--action-blue)] dark:text-[#60A5FA] border-[var(--action-blue-border)]',
      label: 'Under Review',
    },
    Dispatched: {
      cls: 'bg-[var(--status-standard-bg)] text-[var(--status-standard-text)] border-[var(--status-standard-border)]',
      label: 'Dispatched',
    },
    'Patient Transport': {
      cls: 'bg-[var(--brand-teal-bg)] text-[var(--brand-teal)] border-[var(--brand-teal-border)]',
      label: 'Patient Transport',
    },
    Closed: {
      cls: 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border-[var(--status-neutral-border)]',
      label: 'Closed',
    },
  };
  const cfg = map[status] || map.New;
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
    Available: {
      cls: 'bg-[var(--status-verified-bg)] text-[var(--status-verified-text)] border-[var(--status-verified-border)]',
      label: 'Available',
      icon: <CheckCircle2 className="w-3 h-3 shrink-0" />,
    },
    Responding: {
      cls: 'bg-[var(--status-urgent-bg)] text-[var(--status-urgent-text)] border-[var(--status-urgent-border)]',
      label: 'Responding',
      icon: <Navigation className="w-3 h-3 shrink-0" />,
    },
    'At Scene': {
      cls: 'bg-[var(--action-blue-bg)] text-[var(--action-blue)] dark:text-[#60A5FA] border-[var(--action-blue-border)]',
      label: 'At Scene',
      icon: <Truck className="w-3 h-3 shrink-0" />,
    },
    Transporting: {
      cls: 'bg-[var(--brand-teal-bg)] text-[var(--brand-teal)] border-[var(--brand-teal-border)]',
      label: 'Transporting',
      icon: <Navigation className="w-3 h-3 shrink-0" />,
    },
    Unavailable: {
      cls: 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border-[var(--status-neutral-border)]',
      label: 'Unavailable',
      icon: <ShieldAlert className="w-3 h-3 shrink-0" />,
    },
  };
  const cfg = map[availability] || map.Unavailable;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap shrink-0 ${cfg.cls}`}
    >
      {cfg.icon}
      <span>{cfg.label}</span>
    </span>
  );
}

export function UnitRegistrationBadge({ status }: { status: UnitRegistrationStatus }) {
  if (status === 'Active') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[var(--status-verified-bg)] text-[var(--status-verified-text)] border border-[var(--status-verified-border)] whitespace-nowrap shrink-0">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border border-[var(--status-neutral-border)] whitespace-nowrap shrink-0">
      Inactive
    </span>
  );
}

export function LocationFreshnessBadge({ freshness }: { freshness: UnitLocationFreshness }) {
  const map: Record<UnitLocationFreshness, { cls: string; label: string }> = {
    LIVE: {
      cls: 'bg-[var(--status-verified-bg)] text-[var(--status-verified-text)] border-[var(--status-verified-border)]',
      label: 'LIVE GPS',
    },
    LAST_KNOWN: {
      cls: 'bg-[var(--status-standard-bg)] text-[var(--status-standard-text)] border-[var(--status-standard-border)]',
      label: 'LAST KNOWN',
    },
    MANUAL: {
      cls: 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border-[var(--status-neutral-border)]',
      label: 'MANUAL PIN',
    },
    UNAVAILABLE: {
      cls: 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border-[var(--status-neutral-border)]',
      label: 'UNAVAILABLE',
    },
  };
  const cfg = map[freshness] || map.MANUAL;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border whitespace-nowrap shrink-0 ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

export function LegacyBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border border-[var(--status-neutral-border)] whitespace-nowrap shrink-0">
      <Archive className="w-3 h-3 shrink-0" />
      <span>Legacy / Out-of-Scope</span>
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
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[var(--status-verified-bg)] text-[var(--status-verified-text)] border border-[var(--status-verified-border)] whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-3 h-3 shrink-0" />
        <span>VERIFIED</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[var(--status-urgent-bg)] text-[var(--status-urgent-text)] border border-[var(--status-urgent-border)] whitespace-nowrap shrink-0">
      <AlertTriangle className="w-3 h-3 shrink-0" />
      <span>UNVERIFIED</span>
    </span>
  );
}
