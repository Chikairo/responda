import type {
  IncidentPriority,
  IncidentRecord,
  ResponseUnit,
} from '../types/responda.ts';
import {
  computeAverageAcceptanceMinutes,
  computeAverageAckMinutes,
  computeAverageResolutionMinutes,
  isActiveIncidentStatus,
} from './incidentLogic.ts';

export type AnalyticsDateRange = 'ALL' | 'TODAY' | '24H' | '7D';

export interface AnalyticsFilters {
  dateRange: AnalyticsDateRange;
  category: string;
  area: string;
}

export interface DailyTrendBucket {
  dateKey: string;
  label: string;
  total: number;
  critical: number;
  resolved: number;
}

export interface HourlyTrendBucket {
  hour: string;
  shortLabel: string;
  total: number;
  critical: number;
  resolved: number;
}

export interface AreaHotspotRow {
  area: string;
  total: number;
  critical: number;
  high: number;
  active: number;
  verified: number;
  resolved: number;
  avgAcceptMin: number | null;
  unitsCount: number;
  lat: number | null;
  lng: number | null;
}

export interface ResolutionStats {
  total: number;
  active: number;
  awaitingOperator: number;
  resolvedOrClosed: number;
  resolutionRatePct: number;
  verifiedLocationPct: number;
  dangerCount: number;
}

export interface IncidentPerformanceRow {
  id: string;
  category: string;
  priority: IncidentPriority;
  area: string;
  status: string;
  unitCallsign: string | null;
  acceptMin: number | null;
  ackMin: number | null;
  resolveMin: number | null;
  verifiedLocation: boolean;
  createdAt: string;
  isSimulated: boolean;
}

export function normalizeAreaName(area?: string): string {
  const trimmed = (area || '').trim();
  return trimmed.length > 0 ? trimmed : 'Unspecified Lagos';
}

export function filterAnalyticsIncidents(
  incidents: IncidentRecord[],
  filters: AnalyticsFilters,
  nowMs: number = Date.now()
): IncidentRecord[] {
  const todayKey = new Date(nowMs).toISOString().slice(0, 10);

  return incidents.filter((inc) => {
    if (filters.category !== 'ALL' && inc.category !== filters.category) {
      return false;
    }

    const incArea = normalizeAreaName(inc.location.area);
    if (filters.area !== 'ALL' && incArea !== filters.area) {
      return false;
    }

    if (filters.dateRange !== 'ALL') {
      const createdMs = Date.parse(inc.createdAt);
      if (!Number.isFinite(createdMs)) return false;

      if (filters.dateRange === 'TODAY') {
        if (inc.createdAt.slice(0, 10) !== todayKey) return false;
      } else if (filters.dateRange === '24H') {
        if (nowMs - createdMs > 24 * 60 * 60 * 1000) return false;
      } else if (filters.dateRange === '7D') {
        if (nowMs - createdMs > 7 * 24 * 60 * 60 * 1000) return false;
      }
    }

    return true;
  });
}

export function getAvailableLagosAreas(
  incidents: IncidentRecord[],
  units: ResponseUnit[]
): string[] {
  const set = new Set<string>();
  for (const inc of incidents) {
    set.add(normalizeAreaName(inc.location.area));
  }
  for (const unit of units) {
    if (unit.area?.trim()) set.add(unit.area.trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function computeDailyTrend(
  incidents: IncidentRecord[],
  days: number = 7,
  referenceNow: Date = new Date()
): DailyTrendBucket[] {
  const buckets: DailyTrendBucket[] = [];
  const lookup = new Map<string, DailyTrendBucket>();

  const base = new Date(referenceNow);
  base.setHours(0, 0, 0, 0);

  for (let offset = days - 1; offset >= 0; offset--) {
    const dt = new Date(base);
    dt.setDate(base.getDate() - offset);
    const dateKey = dt.toISOString().slice(0, 10);
    const label = dt.toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
    });
    const bucket: DailyTrendBucket = {
      dateKey,
      label,
      total: 0,
      critical: 0,
      resolved: 0,
    };
    buckets.push(bucket);
    lookup.set(dateKey, bucket);
  }

  for (const inc of incidents) {
    const key = inc.createdAt.slice(0, 10);
    const bucket = lookup.get(key);
    if (!bucket) continue;
    bucket.total += 1;
    if (inc.priority === 'CRITICAL') bucket.critical += 1;
    if (inc.status === 'RESOLVED' || inc.status === 'CLOSED') {
      bucket.resolved += 1;
    }
  }

  return buckets;
}

export function computeHourlyTrend(
  incidents: IncidentRecord[]
): HourlyTrendBucket[] {
  const buckets: HourlyTrendBucket[] = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, '0')}:00`,
    shortLabel: `${String(h).padStart(2, '0')}h`,
    total: 0,
    critical: 0,
    resolved: 0,
  }));

  for (const inc of incidents) {
    const dt = new Date(inc.createdAt);
    if (Number.isNaN(dt.getTime())) continue;
    const b = buckets[dt.getHours()];
    b.total += 1;
    if (inc.priority === 'CRITICAL') b.critical += 1;
    if (inc.status === 'RESOLVED' || inc.status === 'CLOSED') {
      b.resolved += 1;
    }
  }

  return buckets;
}

export function computeAreaHotspots(
  incidents: IncidentRecord[],
  units: ResponseUnit[]
): AreaHotspotRow[] {
  const groups = new Map<string, IncidentRecord[]>();
  for (const inc of incidents) {
    const area = normalizeAreaName(inc.location.area);
    const list = groups.get(area) || [];
    list.push(inc);
    groups.set(area, list);
  }

  const rows: AreaHotspotRow[] = [];
  for (const [area, list] of groups.entries()) {
    const latVals = list
      .map((i) => i.location.lat)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const lngVals = list
      .map((i) => i.location.lng)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

    rows.push({
      area,
      total: list.length,
      critical: list.filter((i) => i.priority === 'CRITICAL').length,
      high: list.filter((i) => i.priority === 'HIGH').length,
      active: list.filter((i) => isActiveIncidentStatus(i.status)).length,
      verified: list.filter(
        (i) => i.location.verificationStatus === 'VERIFIED'
      ).length,
      resolved: list.filter(
        (i) => i.status === 'RESOLVED' || i.status === 'CLOSED'
      ).length,
      avgAcceptMin: computeAverageAcceptanceMinutes(list),
      unitsCount: units.filter((u) => u.area === area).length,
      lat:
        latVals.length > 0
          ? Number((latVals.reduce((a, b) => a + b, 0) / latVals.length).toFixed(4))
          : null,
      lng:
        lngVals.length > 0
          ? Number((lngVals.reduce((a, b) => a + b, 0) / lngVals.length).toFixed(4))
          : null,
    });
  }

  return rows.sort((a, b) => b.total - a.total || b.critical - a.critical);
}

export function computeResolutionStats(
  incidents: IncidentRecord[]
): ResolutionStats {
  const total = incidents.length;
  const resolvedOrClosed = incidents.filter(
    (i) => i.status === 'RESOLVED' || i.status === 'CLOSED'
  ).length;
  const active = total - resolvedOrClosed;
  const awaitingOperator = incidents.filter(
    (i) =>
      i.status === 'NEW' ||
      i.status === 'AI_INTAKE' ||
      i.status === 'AWAITING_OPERATOR'
  ).length;
  const verifiedLocations = incidents.filter(
    (i) => i.location.verificationStatus === 'VERIFIED'
  ).length;
  const dangerCount = incidents.filter((i) => i.immediateDanger).length;

  return {
    total,
    active,
    awaitingOperator,
    resolvedOrClosed,
    resolutionRatePct: total > 0 ? Math.round((resolvedOrClosed / total) * 100) : 0,
    verifiedLocationPct:
      total > 0 ? Math.round((verifiedLocations / total) * 100) : 0,
    dangerCount,
  };
}

export function computeStatusSummaryGroups(incidents: IncidentRecord[]): Array<{
  label: string;
  count: number;
  color: string;
}> {
  const awaiting = incidents.filter(
    (i) =>
      i.status === 'NEW' ||
      i.status === 'AI_INTAKE' ||
      i.status === 'AWAITING_OPERATOR' ||
      i.status === 'UNDER_REVIEW' ||
      i.status === 'VERIFIED'
  ).length;
  const responding = incidents.filter(
    (i) =>
      i.status === 'UNIT_ASSIGNED' ||
      i.status === 'RESPONDING' ||
      i.status === 'ON_SCENE'
  ).length;
  const resolved = incidents.filter(
    (i) => i.status === 'RESOLVED' || i.status === 'CLOSED'
  ).length;

  return [
    { label: 'Intake & Triage', count: awaiting, color: '#F59E0B' },
    { label: 'Unit Dispatched / Active', count: responding, color: '#3B82F6' },
    { label: 'Resolved & Closed', count: resolved, color: '#10B981' },
  ];
}

export function computeResponseStageAverages(incidents: IncidentRecord[]): {
  intakeToAcceptMin: number | null;
  dispatchToAckMin: number | null;
  intakeToResolveMin: number | null;
} {
  return {
    intakeToAcceptMin: computeAverageAcceptanceMinutes(incidents),
    dispatchToAckMin: computeAverageAckMinutes(incidents),
    intakeToResolveMin: computeAverageResolutionMinutes(incidents),
  };
}

function diffMinutes(startIso?: string, endIso?: string): number | null {
  if (!startIso || !endIso) return null;
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null;
  return Number(((e - s) / 60000).toFixed(1));
}

export function computeIncidentPerformanceRows(
  incidents: IncidentRecord[],
  units: ResponseUnit[]
): IncidentPerformanceRow[] {
  const unitMap = new Map(units.map((u) => [u.id, u.callsign]));

  return [...incidents]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((inc) => ({
      id: inc.id,
      category: inc.category,
      priority: inc.priority,
      area: normalizeAreaName(inc.location.area),
      status: inc.status,
      unitCallsign: inc.assignedUnitId
        ? unitMap.get(inc.assignedUnitId) || inc.assignedUnitId
        : null,
      acceptMin: diffMinutes(inc.createdAt, inc.acceptedAt),
      ackMin: diffMinutes(inc.dispatchedAt, inc.acknowledgedAt),
      resolveMin: diffMinutes(inc.createdAt, inc.resolvedAt),
      verifiedLocation: inc.location.verificationStatus === 'VERIFIED',
      createdAt: inc.createdAt,
      isSimulated: inc.isSimulated,
    }));
}
