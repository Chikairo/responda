import type {
  EmergencyCategory,
  IncidentPriority,
  IncidentRecord,
  IncidentStatus,
  MedicalEmergencyCategory,
  ResponseUnit,
  UnitAvailability,
  UserRole,
} from '../types/responda.ts';

export const INCIDENT_STATUS_ORDER: IncidentStatus[] = [
  'New',
  'Under Review',
  'Dispatched',
  'Patient Transport',
  'Closed',
];

export const MEDICAL_CATEGORIES: MedicalEmergencyCategory[] = [
  'Medical',
  'Road accident',
  'Other medical emergency',
];

export const EMERGENCY_CATEGORIES: EmergencyCategory[] = MEDICAL_CATEGORIES;

export const PRIORITY_WEIGHT: Record<IncidentPriority, number> = {
  Critical: 4,
  Urgent: 3,
  Unassessed: 2,
  Standard: 1,
};

// Operations Staff permissions (dispatch, intake, triage, transport, closure)
export function canTakeOver(role: UserRole): boolean {
  return role === 'Operations Staff';
}

export function canVerifyIncident(role: UserRole): boolean {
  return role === 'Operations Staff';
}

export function canApproveDispatch(role: UserRole): boolean {
  return role === 'Operations Staff';
}

export function canUpdateIncidentStatus(role: UserRole): boolean {
  return role === 'Operations Staff';
}

export function canUpdateUnitStatus(role: UserRole): boolean {
  return role === 'Operations Staff';
}

export function canAddNote(role: UserRole): boolean {
  return role === 'Operations Staff';
}

// Organisation Administrator permissions (staff, fleet registration, org settings, integrations)
export function canManageStaff(role: UserRole): boolean {
  return role === 'Organisation Administrator';
}

export function canManageUnits(role: UserRole): boolean {
  return role === 'Organisation Administrator';
}

export function canManageOrganisation(role: UserRole): boolean {
  return role === 'Organisation Administrator';
}

export function canManageIntegrations(role: UserRole): boolean {
  return role === 'Organisation Administrator';
}

export function isActiveIncidentStatus(status: IncidentStatus): boolean {
  return status !== 'Closed';
}

export function validateStatusTransition(
  from: IncidentStatus,
  to: IncidentStatus,
  options: { hasHumanApproval?: boolean; hasAssignedUnit?: boolean } = {}
): { valid: boolean; reason?: string } {
  if (from === to) {
    return { valid: true };
  }

  if (from === 'Closed') {
    return {
      valid: false,
      reason: 'Closed incidents are permanently archived in Incident History and remain read-only.',
    };
  }

  if (
    (to === 'Dispatched' || to === 'Patient Transport') &&
    (!options.hasHumanApproval || !options.hasAssignedUnit)
  ) {
    return {
      valid: false,
      reason:
        'Human operator approval and an assigned active medical unit are required before moving to Dispatched or Patient Transport.',
    };
  }

  return { valid: true };
}

export function mapUnitAvailabilityToIncidentStatus(
  availability: UnitAvailability
): IncidentStatus | null {
  switch (availability) {
    case 'Responding':
    case 'At Scene':
      return 'Dispatched';
    case 'Transporting':
      return 'Patient Transport';
    default:
      return null;
  }
}

export function computeAverageAcceptanceMinutes(incidents: IncidentRecord[]): number | null {
  const diffs: number[] = [];
  for (const inc of incidents) {
    if (inc.acceptedAt && inc.createdAt) {
      const start = Date.parse(inc.createdAt);
      const end = Date.parse(inc.acceptedAt);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        diffs.push((end - start) / 60000);
      }
    }
  }
  if (diffs.length === 0) return null;
  return Number((diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1));
}

export function computeAverageAckMinutes(incidents: IncidentRecord[]): number | null {
  const diffs: number[] = [];
  for (const inc of incidents) {
    if (inc.acknowledgedAt && inc.dispatchedAt) {
      const start = Date.parse(inc.dispatchedAt);
      const end = Date.parse(inc.acknowledgedAt);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        diffs.push((end - start) / 60000);
      }
    }
  }
  if (diffs.length === 0) return null;
  return Number((diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1));
}

export function computeAverageResolutionMinutes(incidents: IncidentRecord[]): number | null {
  const diffs: number[] = [];
  for (const inc of incidents) {
    const endIso = inc.closedAt || inc.resolvedAt;
    if (endIso && inc.createdAt) {
      const start = Date.parse(inc.createdAt);
      const end = Date.parse(endIso);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        diffs.push((end - start) / 60000);
      }
    }
  }
  if (diffs.length === 0) return null;
  return Number((diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1));
}

export interface DashboardMetrics {
  totalToday: number;
  activeCount: number;
  criticalCount: number;
  unassessedCount: number;
  awaitingReviewCount: number;
  availableUnitsCount: number;
  respondingUnitsCount: number;
  avgAcceptanceMinutes: number | null;
}

export function computeDashboardMetrics(
  incidents: IncidentRecord[],
  units: ResponseUnit[],
  referenceNow: Date = new Date()
): DashboardMetrics {
  const todayStr = referenceNow.toISOString().slice(0, 10);
  const inScopeIncidents = incidents.filter((i) => !i.legacyOutOfScope);
  const totalToday = inScopeIncidents.filter(
    (i) => i.createdAt.slice(0, 10) === todayStr
  ).length;
  const activeIncidents = inScopeIncidents.filter((i) => isActiveIncidentStatus(i.status));
  const criticalCount = activeIncidents.filter((i) => i.priority === 'Critical').length;
  const unassessedCount = activeIncidents.filter((i) => i.priority === 'Unassessed').length;
  const awaitingReviewCount = activeIncidents.filter(
    (i) =>
      i.status === 'New' ||
      i.priority === 'Unassessed' ||
      (i.status === 'Under Review' && !i.assignedUnitId)
  ).length;

  const activeFleetUnits = units.filter(
    (u) => u.registrationStatus === 'Active' && !u.legacyOutOfScope
  );
  const availableUnitsCount = activeFleetUnits.filter(
    (u) => u.availability === 'Available'
  ).length;
  const respondingUnitsCount = activeFleetUnits.filter(
    (u) =>
      u.availability === 'Responding' ||
      u.availability === 'At Scene' ||
      u.availability === 'Transporting'
  ).length;

  return {
    totalToday: totalToday > 0 ? totalToday : inScopeIncidents.length,
    activeCount: activeIncidents.length,
    criticalCount,
    unassessedCount,
    awaitingReviewCount,
    availableUnitsCount,
    respondingUnitsCount,
    avgAcceptanceMinutes: computeAverageAcceptanceMinutes(inScopeIncidents),
  };
}

export function computeCategoryBreakdown(
  incidents: IncidentRecord[]
): Array<{ category: string; count: number }> {
  const counts = new Map<string, number>();
  for (const inc of incidents) {
    counts.set(inc.category, (counts.get(inc.category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export function computePriorityBreakdown(
  incidents: IncidentRecord[]
): Array<{ priority: IncidentPriority; count: number }> {
  const order: IncidentPriority[] = ['Critical', 'Urgent', 'Standard', 'Unassessed'];
  return order.map((priority) => ({
    priority,
    count: incidents.filter((i) => i.priority === priority).length,
  }));
}

export function computeStatusBreakdown(
  incidents: IncidentRecord[]
): Array<{ status: IncidentStatus; count: number }> {
  return INCIDENT_STATUS_ORDER.map((status) => ({
    status,
    count: incidents.filter((i) => i.status === status).length,
  })).filter((entry) => entry.count > 0);
}

export function computeUnitUtilisation(units: ResponseUnit[]): {
  available: number;
  dispatched: number;
  unavailable: number;
  inactive: number;
} {
  const active = units.filter((u) => u.registrationStatus === 'Active' && !u.legacyOutOfScope);
  return {
    available: active.filter((u) => u.availability === 'Available').length,
    dispatched: active.filter(
      (u) =>
        u.availability === 'Responding' ||
        u.availability === 'At Scene' ||
        u.availability === 'Transporting'
    ).length,
    unavailable: active.filter((u) => u.availability === 'Unavailable').length,
    inactive: units.filter((u) => u.registrationStatus === 'Inactive' || u.legacyOutOfScope).length,
  };
}

export function sortIncidents(
  incidents: IncidentRecord[],
  sortBy: 'newest' | 'priority'
): IncidentRecord[] {
  return [...incidents].sort((a, b) => {
    if (sortBy === 'priority') {
      const diff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (diff !== 0) return diff;
    }
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export function formatRelativeTime(iso: string, nowMs: number = Date.now()): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return 'Unknown';
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export function formatDistanceKm(meters?: number): string {
  if (meters === undefined || !Number.isFinite(meters)) return 'Unavailable';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDurationMinutes(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return 'Unavailable';
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${mins} min`;
}
