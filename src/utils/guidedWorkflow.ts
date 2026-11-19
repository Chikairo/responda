import { IncidentRecord, ResponseUnit } from '../types/responda';
import { isActiveIncidentStatus } from './incidentLogic';

export type WorkflowActionType =
  | 'GATHER_INFO'
  | 'VERIFY_LOCATION'
  | 'TAKE_OVER'
  | 'SELECT_UNIT'
  | 'APPROVE_DISPATCH'
  | 'TRACK_RESPONSE'
  | 'CLOSE_INCIDENT'
  | 'COMPLETED';

export interface WorkflowStepItem {
  number: number;
  id:
    | 'new'
    | 'gather'
    | 'verify_location'
    | 'review'
    | 'select_unit'
    | 'approve_dispatch'
    | 'track'
    | 'close';
  label: string;
  shortLabel: string;
  status: 'done' | 'current' | 'upcoming';
}

export interface IncidentWorkflowGuidance {
  currentStepIndex: number; // 0-based index into the 8 steps
  steps: WorkflowStepItem[];
  whatIsHappening: string;
  needsAttention: string;
  nextActionLabel: string;
  nextActionDescription: string;
  nextActionType: WorkflowActionType;
  nextTabTarget: 'overview' | 'transcript' | 'location' | 'units' | 'timeline' | 'notes';
}

const STEP_DEFINITIONS: Array<{
  id: WorkflowStepItem['id'];
  label: string;
  shortLabel: string;
}> = [
  { id: 'new', label: 'New Incident', shortLabel: 'New' },
  { id: 'gather', label: 'Gather Information', shortLabel: 'Gather' },
  { id: 'verify_location', label: 'Verify Location', shortLabel: 'Location' },
  { id: 'review', label: 'Review Incident', shortLabel: 'Review' },
  { id: 'select_unit', label: 'Select Unit', shortLabel: 'Unit' },
  { id: 'approve_dispatch', label: 'Approve Dispatch', shortLabel: 'Approve' },
  { id: 'track', label: 'Track Response', shortLabel: 'Track' },
  { id: 'close', label: 'Close Incident', shortLabel: 'Close' },
];

export function computeIncidentWorkflow(
  incident: IncidentRecord,
  assignedUnit: ResponseUnit | null,
  candidateUnitSelected: boolean = false
): IncidentWorkflowGuidance {
  const hasHumanControl = Boolean(incident.assignedOperator) || !incident.aiIntakeActive;
  const locationVerified = incident.location.verificationStatus === 'VERIFIED';
  const hasDispatchApproved = Boolean(incident.assignedUnitId && incident.dispatchedAt);
  const isResolvedOrClosed =
    incident.status === 'RESOLVED' || incident.status === 'CLOSED';
  const isClosed = incident.status === 'CLOSED';

  let currentStepIndex = 0;
  let whatIsHappening = '';
  let needsAttention = '';
  let nextActionLabel = '';
  let nextActionDescription = '';
  let nextActionType: WorkflowActionType = 'TAKE_OVER';
  let nextTabTarget: IncidentWorkflowGuidance['nextTabTarget'] = 'overview';

  if (isClosed) {
    currentStepIndex = 7;
    whatIsHappening = `Incident ${incident.id} (${incident.category}) is closed and archived with full audit history.`;
    needsAttention = 'No immediate operator action is required.';
    nextActionLabel = 'View Audit Timeline';
    nextActionDescription = 'Review the preserved conversation transcript, dispatch timestamps, and closure notes.';
    nextActionType = 'COMPLETED';
    nextTabTarget = 'timeline';
  } else if (incident.status === 'RESOLVED') {
    currentStepIndex = 7;
    whatIsHappening = `Field work for ${incident.id} (${incident.category}) is marked resolved and ready for final case closure.`;
    needsAttention = 'Confirm final notes and formally close the incident record.';
    nextActionLabel = 'Close Incident';
    nextActionDescription = 'Confirm with a brief closure summary so this incident moves cleanly to Incident History.';
    nextActionType = 'CLOSE_INCIDENT';
    nextTabTarget = 'overview';
  } else if (
    hasDispatchApproved ||
    incident.status === 'UNIT_ASSIGNED' ||
    incident.status === 'RESPONDING' ||
    incident.status === 'ON_SCENE'
  ) {
    if (assignedUnit?.availability === 'ON_SCENE' || incident.status === 'ON_SCENE') {
      currentStepIndex = 7;
      whatIsHappening = `${assignedUnit?.callsign || 'Assigned unit'} is on scene at ${incident.location.area || 'Lagos'}.`;
      needsAttention = 'Confirm scene completion and mark the incident resolved or closed once safe.';
      nextActionLabel = 'Close Incident';
      nextActionDescription = 'Record final outcome and close the incident after unit clearance.';
      nextActionType = 'CLOSE_INCIDENT';
      nextTabTarget = 'units';
    } else {
      currentStepIndex = 6;
      whatIsHappening = `${assignedUnit?.callsign || 'Assigned unit'} is ${
        assignedUnit?.availability === 'EN_ROUTE' || incident.status === 'RESPONDING'
          ? 'en route to the incident'
          : assignedUnit?.availability === 'ACKNOWLEDGED'
          ? 'acknowledged and preparing to move'
          : 'assigned and awaiting unit acknowledgement'
      }.`;
      needsAttention = 'Monitor responder progress on the map and keep status updates current.';
      nextActionLabel = 'Track Unit Response';
      nextActionDescription = 'Update or monitor unit acknowledgement, en-route progress, and arrival on scene.';
      nextActionType = 'TRACK_RESPONSE';
      nextTabTarget = 'units';
    }
  } else if (!hasHumanControl && (incident.status === 'NEW' || incident.status === 'AI_INTAKE' || incident.status === 'AWAITING_OPERATOR')) {
    if (incident.transcript.length <= 1 && incident.status === 'NEW') {
      currentStepIndex = 1;
      whatIsHappening = `New ${incident.priority.toLowerCase()} ${incident.category.toLowerCase()} report received.`;
      needsAttention = 'Initial caller details are still being gathered.';
      nextActionLabel = 'Take Over & Review Details';
      nextActionDescription = 'Accept human operator control to review caller messages and confirm missing facts.';
      nextActionType = 'TAKE_OVER';
      nextTabTarget = 'transcript';
    } else {
      currentStepIndex = 3;
      whatIsHappening = `AI intake collected a ${incident.priority.toLowerCase()} ${incident.category.toLowerCase()} report and is waiting for a human operator.`;
      needsAttention = 'No unit has been dispatched. A human operator must take over before dispatch.';
      nextActionLabel = 'Take Over Incident';
      nextActionDescription = 'Click Take Over to stop automated AI intake and take full human control.';
      nextActionType = 'TAKE_OVER';
      nextTabTarget = 'overview';
    }
  } else if (!locationVerified) {
    currentStepIndex = 2;
    whatIsHappening = `Operator ${incident.assignedOperator || 'on duty'} is reviewing ${incident.id}, but the exact Lagos location is not yet verified.`;
    needsAttention = `Location is currently ${incident.location.verificationStatus.toLowerCase()} (${incident.location.source.replace(/_/g, ' ').toLowerCase()}).`;
    nextActionLabel = 'Verify Location';
    nextActionDescription = 'Confirm the street, nearby landmark, and map pin on the Location tab before sending a unit.';
    nextActionType = 'VERIFY_LOCATION';
    nextTabTarget = 'location';
  } else if (!candidateUnitSelected) {
    currentStepIndex = 4;
    whatIsHappening = `Location for ${incident.id} is verified at ${incident.location.area || 'Lagos'} and ready for response coordination.`;
    needsAttention = 'No response unit has been selected yet.';
    nextActionLabel = 'Select Response Unit';
    nextActionDescription = 'Compare available Lagos ambulances or patrol units and select the closest fit.';
    nextActionType = 'SELECT_UNIT';
    nextTabTarget = 'units';
  } else {
    currentStepIndex = 5;
    whatIsHappening = `Location is verified and a candidate response unit is selected for ${incident.id}.`;
    needsAttention = 'Human dispatcher confirmation is required before the unit can be sent.';
    nextActionLabel = 'Approve Dispatch';
    nextActionDescription = 'Review the unit and route, then confirm human dispatch approval.';
    nextActionType = 'APPROVE_DISPATCH';
    nextTabTarget = 'units';
  }

  const hasGatherInfo =
    incident.transcript.some((m) => m.speaker === 'CALLER') ||
    Boolean(incident.description?.trim());

  const stepDoneMap: Record<WorkflowStepItem['id'], boolean> = {
    new: true,
    gather: hasGatherInfo,
    verify_location: locationVerified,
    review: hasHumanControl,
    select_unit: Boolean(incident.assignedUnitId) || candidateUnitSelected,
    approve_dispatch: hasDispatchApproved,
    track: isResolvedOrClosed || incident.status === 'ON_SCENE' || assignedUnit?.availability === 'ON_SCENE',
    close: isClosed,
  };

  const steps: WorkflowStepItem[] = STEP_DEFINITIONS.map((def, idx) => {
    let status: WorkflowStepItem['status'] = 'upcoming';
    if (stepDoneMap[def.id]) {
      status = 'done';
    } else if (idx === currentStepIndex) {
      status = 'current';
    }
    return {
      number: idx + 1,
      id: def.id,
      label: def.label,
      shortLabel: def.shortLabel,
      status,
    };
  });

  return {
    currentStepIndex,
    steps,
    whatIsHappening,
    needsAttention,
    nextActionLabel,
    nextActionDescription,
    nextActionType,
    nextTabTarget,
  };
}

export interface CommandBriefingSummary {
  whatIsHappening: string;
  needsAttention: string;
  nextStepText: string;
  focusIncident: IncidentRecord | null;
  focusAction: 'TAKE_OVER' | 'VERIFY_LOCATION' | 'ASSIGN_UNIT' | 'OPEN';
  focusActionLabel: string;
}

export function computeCommandBriefing(
  incidents: IncidentRecord[],
  units: ResponseUnit[]
): CommandBriefingSummary {
  const active = incidents.filter((i) => isActiveIncidentStatus(i.status));
  const criticalActive = active.filter((i) => i.priority === 'CRITICAL');
  const awaitingTakeover = active.filter(
    (i) => i.status === 'NEW' || i.status === 'AI_INTAKE' || i.status === 'AWAITING_OPERATOR'
  );
  const unverifiedOwned = active.filter(
    (i) =>
      Boolean(i.assignedOperator) &&
      i.location.verificationStatus !== 'VERIFIED' &&
      !i.assignedUnitId
  );
  const readyForDispatch = active.filter(
    (i) =>
      i.location.verificationStatus === 'VERIFIED' &&
      !i.assignedUnitId &&
      i.status !== 'RESOLVED'
  );
  const availableUnits = units.filter((u) => u.availability === 'AVAILABLE').length;

  const whatIsHappening =
    active.length === 0
      ? `All current cases are resolved. ${availableUnits} response units are available across Lagos.`
      : `${active.length} active incident${active.length === 1 ? '' : 's'} (${criticalActive.length} critical) and ${availableUnits} available response unit${availableUnits === 1 ? '' : 's'} across Lagos.`;

  // Pick highest priority incident requiring action
  const priorityRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const sortTop = (arr: IncidentRecord[]) =>
    [...arr].sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority])[0] || null;

  const topAwaiting = sortTop(awaitingTakeover);
  const topUnverified = sortTop(unverifiedOwned);
  const topDispatch = sortTop(readyForDispatch);
  const topActive = sortTop(active);

  if (topAwaiting) {
    return {
      whatIsHappening,
      needsAttention: `${awaitingTakeover.length} report${awaitingTakeover.length === 1 ? '' : 's'} waiting for human operator takeover — starting with ${topAwaiting.id} (${topAwaiting.category}, ${topAwaiting.priority}).`,
      nextStepText: `Take over ${topAwaiting.id} to review caller details and verify its Lagos location.`,
      focusIncident: topAwaiting,
      focusAction: 'TAKE_OVER',
      focusActionLabel: `Take Over ${topAwaiting.id}`,
    };
  }

  if (topUnverified) {
    return {
      whatIsHappening,
      needsAttention: `${topUnverified.id} (${topUnverified.category}) has an unverified location that needs confirmation before dispatch.`,
      nextStepText: `Open ${topUnverified.id} and confirm the exact street, landmark, or map pin.`,
      focusIncident: topUnverified,
      focusAction: 'VERIFY_LOCATION',
      focusActionLabel: `Verify ${topUnverified.id} Location`,
    };
  }

  if (topDispatch) {
    return {
      whatIsHappening,
      needsAttention: `${topDispatch.id} (${topDispatch.category}) is verified and waiting for a human-approved unit assignment.`,
      nextStepText: `Open ${topDispatch.id} to choose the nearest available unit and approve dispatch.`,
      focusIncident: topDispatch,
      focusAction: 'ASSIGN_UNIT',
      focusActionLabel: `Assign Unit to ${topDispatch.id}`,
    };
  }

  if (topActive) {
    return {
      whatIsHappening,
      needsAttention: `${topActive.id} (${topActive.category}) is currently ${topActive.status.replace(/_/g, ' ').toLowerCase()}.`,
      nextStepText: `Monitor unit arrival on the map or open ${topActive.id} to update response status or close when finished.`,
      focusIncident: topActive,
      focusAction: 'OPEN',
      focusActionLabel: `Open ${topActive.id}`,
    };
  }

  return {
    whatIsHappening,
    needsAttention: 'No incidents currently require urgent operator takeover or dispatch.',
    nextStepText: 'Start a new AI Intake call or run the guided Lagos demo scenario to practise the workflow.',
    focusIncident: null,
    focusAction: 'OPEN',
    focusActionLabel: 'Start AI Intake',
  };
}
