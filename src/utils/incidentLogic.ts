import type {
  EmergencyCategory,
  IncidentPriority,
  IncidentRecord,
  IncidentStatus,
  ResponseUnit,
  UnitAvailability,
  UserRole,
} from '../types/responda.ts';

export const INCIDENT_STATUS_ORDER: IncidentStatus[] = [
  'NEW',
  'AI_INTAKE',
  'AWAITING_OPERATOR',
  'UNDER_REVIEW',
  'VERIFIED',
  'UNIT_ASSIGNED',
  'RESPONDING',
  'ON_SCENE',
  'RESOLVED',
  'CLOSED',
];

export const EMERGENCY_CATEGORIES: EmergencyCategory[] = [
  'Medical',
  'Road accident',
  'Fire',
  'Security',
  'Rescue',
  'Disaster',
  'Environmental hazard',
  'Other urgent incident',
];

export const PRIORITY_WEIGHT: Record<IncidentPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export function canTakeOver(role: UserRole): boolean {
  return role === 'Administrator' || role === 'Call Operator' || role === 'Dispatcher';
}

export function canVerifyIncident(role: UserRole): boolean {
  return role === 'Administrator' || role === 'Call Operator' || role === 'Dispatcher';
}

export function canApproveDispatch(role: UserRole): boolean {
  return role === 'Administrator' || role === 'Dispatcher';
}

export function canUpdateIncidentStatus(role: UserRole): boolean {
  return role === 'Administrator' || role === 'Dispatcher' || role === 'Call Operator';
}

export function canUpdateUnitStatus(role: UserRole): boolean {
  return role === 'Administrator' || role === 'Dispatcher' || role === 'Responder';
}

export function canAddNote(role: UserRole): boolean {
  return true;
}

export function isActiveIncidentStatus(status: IncidentStatus): boolean {
  return status !== 'RESOLVED' && status !== 'CLOSED';
}

export function validateStatusTransition(
  from: IncidentStatus,
  to: IncidentStatus,
  options: { hasHumanApproval?: boolean; hasAssignedUnit?: boolean } = {}
): { valid: boolean; reason?: string } {
  if (from === to) {
    return { valid: true };
  }

  // Never allow automatic transition into UNIT_ASSIGNED or RESPONDING without human approval and assigned unit
  if ((to === 'UNIT_ASSIGNED' || to === 'RESPONDING') && (!options.hasHumanApproval || !options.hasAssignedUnit)) {
    return {
      valid: false,
      reason: 'Human dispatcher approval and an assigned response unit are required before moving to UNIT_ASSIGNED or RESPONDING.',
    };
  }

  if (to === 'ON_SCENE' && !options.hasAssignedUnit) {
    return {
      valid: false,
      reason: 'An assigned response unit is required before marking ON_SCENE.',
    };
  }

  if (from === 'CLOSED' && to !== 'UNDER_REVIEW') {
    return {
      valid: false,
      reason: 'Closed incidents can only be reopened into UNDER_REVIEW.',
    };
  }

  return { valid: true };
}

export function mapUnitAvailabilityToIncidentStatus(
  availability: UnitAvailability
): IncidentStatus | null {
  switch (availability) {
    case 'ASSIGNED':
    case 'ACKNOWLEDGED':
      return 'UNIT_ASSIGNED';
    case 'EN_ROUTE':
      return 'RESPONDING';
    case 'ON_SCENE':
      return 'ON_SCENE';
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
    if (inc.resolvedAt && inc.createdAt) {
      const start = Date.parse(inc.createdAt);
      const end = Date.parse(inc.resolvedAt);
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
  const totalToday = incidents.filter((i) => i.createdAt.slice(0, 10) === todayStr).length;
  const activeIncidents = incidents.filter((i) => isActiveIncidentStatus(i.status));
  const criticalCount = activeIncidents.filter((i) => i.priority === 'CRITICAL').length;
  const awaitingReviewCount = activeIncidents.filter(
    (i) => i.status === 'NEW' || i.status === 'AI_INTAKE' || i.status === 'AWAITING_OPERATOR'
  ).length;
  const availableUnitsCount = units.filter((u) => u.availability === 'AVAILABLE').length;
  const respondingUnitsCount = units.filter(
    (u) => u.availability === 'ASSIGNED' || u.availability === 'ACKNOWLEDGED' || u.availability === 'EN_ROUTE' || u.availability === 'ON_SCENE'
  ).length;

  return {
    totalToday: totalToday > 0 ? totalToday : incidents.length,
    activeCount: activeIncidents.length,
    criticalCount,
    awaitingReviewCount,
    availableUnitsCount,
    respondingUnitsCount,
    avgAcceptanceMinutes: computeAverageAcceptanceMinutes(incidents),
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
  const order: IncidentPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
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
  assigned: number;
  responding: number;
  unavailable: number;
} {
  return {
    available: units.filter((u) => u.availability === 'AVAILABLE').length,
    assigned: units.filter((u) => u.availability === 'ASSIGNED' || u.availability === 'ACKNOWLEDGED').length,
    responding: units.filter((u) => u.availability === 'EN_ROUTE' || u.availability === 'ON_SCENE').length,
    unavailable: units.filter((u) => u.availability === 'UNAVAILABLE').length,
  };
}

export function computeHourlyActivity(incidents: IncidentRecord[]): Array<{ hour: string; count: number }> {
  const buckets = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, '0')}:00`,
    count: 0,
  }));
  for (const inc of incidents) {
    const dt = new Date(inc.createdAt);
    if (!Number.isNaN(dt.getTime())) {
      buckets[dt.getHours()].count += 1;
    }
  }
  return buckets;
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
