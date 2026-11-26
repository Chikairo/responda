import type { IncidentRecord, ResponseUnit } from '../types/responda.ts';
import { isActiveIncidentStatus, PRIORITY_WEIGHT } from './incidentLogic.ts';

export type WorkflowActionType =
  | 'GATHER_INFO'
  | 'TAKE_OVER'
  | 'VERIFY_LOCATION'
  | 'ASSESS_PRIORITY'
  | 'SELECT_UNIT'
  | 'APPROVE_DISPATCH'
  | 'TRACK_RESPONSE'
  | 'CLOSE_INCIDENT'
  | 'COMPLETED';

export type IncidentWorkspaceTabId =
  | 'workflow'
  | 'medical-details'
  | 'location'
  | 'response';

export interface WorkflowMilestoneItem {
  number: number;
  id:
    | 'report_intake'
    | 'assessment_verification'
    | 'unit_dispatch'
    | 'response_transport'
    | 'closure';
  label: string;
  shortLabel: string;
  status: 'done' | 'current' | 'upcoming';
}

export interface IncidentWorkflowGuidance {
  currentMilestoneIndex: number; // 0..4
  milestones: WorkflowMilestoneItem[];
  whatIsHappening: string;
  needsAttention: string;
  nextActionLabel: string;
  nextActionDescription: string;
  nextActionType: WorkflowActionType;
  nextTabTarget: IncidentWorkspaceTabId;
}

const MILESTONE_DEFINITIONS: Array<{
  id: WorkflowMilestoneItem['id'];
  label: string;
  shortLabel: string;
}> = [
  { id: 'report_intake', label: '1. Report and Intake', shortLabel: 'Report & Intake' },
  {
    id: 'assessment_verification',
    label: '2. Assessment and Verification',
    shortLabel: 'Assessment',
  },
  { id: 'unit_dispatch', label: '3. Unit Dispatch', shortLabel: 'Unit Dispatch' },
  {
    id: 'response_transport',
    label: '4. Response and Transport',
    shortLabel: 'Response & Transport',
  },
  { id: 'closure', label: '5. Closure', shortLabel: 'Closure' },
];

export function computeIncidentWorkflow(
  incident: IncidentRecord,
  assignedUnit: ResponseUnit | null,
  candidateUnitSelected: boolean = false
): IncidentWorkflowGuidance {
  const hasHumanControl = Boolean(incident.assignedOperator) || !incident.aiIntakeActive;
  const locationVerified = incident.location.verificationStatus === 'VERIFIED';
  const priorityAssessed = incident.priority !== 'Unassessed';
  const hasDispatchApproved = Boolean(incident.assignedUnitId && incident.dispatchedAt);
  const isClosed = incident.status === 'Closed';
  const isTransport = incident.status === 'Patient Transport' || Boolean(incident.transportStartedAt);
  const hospitalArrived = Boolean(incident.hospitalArrivedAt);

  let currentMilestoneIndex = 0;
  let whatIsHappening = '';
  let needsAttention = '';
  let nextActionLabel = '';
  let nextActionDescription = '';
  let nextActionType: WorkflowActionType = 'TAKE_OVER';
  let nextTabTarget: IncidentWorkspaceTabId = 'workflow';

  if (isClosed) {
    currentMilestoneIndex = 4;
    whatIsHappening = `Incident ${incident.id} (${incident.category}) is closed and archived with full audit history.`;
    needsAttention = 'Read-only archived record in Incident History.';
    nextActionLabel = 'Review Archived Record';
    nextActionDescription = 'Inspect preserved medical details, hospital outcome, and audit timeline.';
    nextActionType = 'COMPLETED';
    nextTabTarget = 'workflow';
  } else if (hospitalArrived) {
    currentMilestoneIndex = 4;
    whatIsHappening = `${assignedUnit?.callsign || 'Assigned unit'} confirmed hospital arrival${
      incident.hospitalDestination ? ` at ${incident.hospitalDestination.name}` : ''
    }.`;
    needsAttention = 'Record final patient handover outcome and formally close the incident.';
    nextActionLabel = 'Close Incident';
    nextActionDescription =
      'Complete closure summary to release the unit and archive this record to Incident History.';
    nextActionType = 'CLOSE_INCIDENT';
    nextTabTarget = 'workflow';
  } else if (hasDispatchApproved || incident.status === 'Dispatched' || isTransport) {
    currentMilestoneIndex = 3;
    if (isTransport) {
      whatIsHappening = `${assignedUnit?.callsign || 'Medical unit'} is transporting patient${
        incident.hospitalDestination ? ` to ${incident.hospitalDestination.name}` : ''
      }.`;
      needsAttention = 'Confirm hospital arrival once handover at emergency reception occurs.';
      nextActionLabel = 'Confirm Hospital Arrival';
      nextActionDescription = 'Update patient transport milestones on the Response tab.';
      nextActionType = 'TRACK_RESPONSE';
      nextTabTarget = 'response';
    } else if (assignedUnit?.availability === 'At Scene' || incident.arrivedAtSceneAt) {
      whatIsHappening = `${assignedUnit?.callsign || 'Medical unit'} is at scene in ${
        incident.location.area || 'Lagos'
      }.`;
      needsAttention = incident.patientPickedUpAt
        ? incident.hospitalDestination
          ? `Start patient transport to ${incident.hospitalDestination.name}.`
          : 'Select and confirm destination hospital before starting patient transport.'
        : 'Confirm patient pickup, select receiving hospital, and start transport or close if treated on scene.';
      nextActionLabel = 'Manage Scene & Transport';
      nextActionDescription = 'Record patient pickup, confirm hospital destination, or close case.';
      nextActionType = 'TRACK_RESPONSE';
      nextTabTarget = 'response';
    } else {
      whatIsHappening = `${assignedUnit?.callsign || 'Medical unit'} is responding to ${
        incident.location.area || 'Lagos'
      }.`;
      needsAttention = 'Monitor responder progress and confirm arrival at scene.';
      nextActionLabel = 'Track Unit Response';
      nextActionDescription = 'Monitor response route and record Arrived at Scene on the Response tab.';
      nextActionType = 'TRACK_RESPONSE';
      nextTabTarget = 'response';
    }
  } else if (!hasHumanControl && incident.status === 'New') {
    currentMilestoneIndex = 0;
    whatIsHappening = `New ${incident.priority.toLowerCase()} ${incident.category.toLowerCase()} report received.`;
    needsAttention =
      incident.priority === 'Unassessed'
        ? 'Insufficient assessment details — human operator takeover and priority assessment required.'
        : 'Human operator takeover is required before verification and unit dispatch.';
    nextActionLabel = 'Take Over Incident';
    nextActionDescription =
      'Assume human operator control to review medical details and verify location.';
    nextActionType = 'TAKE_OVER';
    nextTabTarget = 'workflow';
  } else if (!priorityAssessed || !locationVerified) {
    currentMilestoneIndex = 1;
    if (!priorityAssessed && !locationVerified) {
      whatIsHappening = `Operator ${incident.assignedOperator || 'on duty'} is reviewing ${incident.id}.`;
      needsAttention = 'Priority is Unassessed and exact Lagos location is unverified.';
      nextActionLabel = 'Assess Priority & Verify Location';
      nextActionDescription =
        'Confirm clinical priority on Medical Details and verify location on the Location tab.';
      nextActionType = 'VERIFY_LOCATION';
      nextTabTarget = 'medical-details';
    } else if (!priorityAssessed) {
      whatIsHappening = `Location for ${incident.id} is verified, but clinical priority remains Unassessed.`;
      needsAttention = 'Set priority (Critical, Urgent, or Standard) based on patient details.';
      nextActionLabel = 'Assess Priority';
      nextActionDescription = 'Review chief complaint and consciousness details to assign priority.';
      nextActionType = 'ASSESS_PRIORITY';
      nextTabTarget = 'medical-details';
    } else {
      whatIsHappening = `Operator ${incident.assignedOperator || 'on duty'} is reviewing ${incident.id}, pending exact location verification.`;
      needsAttention = `Location is currently ${incident.location.verificationStatus.toLowerCase()} (${incident.location.source
        .replace(/_/g, ' ')
        .toLowerCase()}).`;
      nextActionLabel = 'Verify Location';
      nextActionDescription =
        'Confirm street, nearby landmark, and Lagos map pin on the Location tab before dispatch.';
      nextActionType = 'VERIFY_LOCATION';
      nextTabTarget = 'location';
    }
  } else if (!candidateUnitSelected) {
    currentMilestoneIndex = 2;
    whatIsHappening = `Location verified at ${incident.location.area || 'Lagos'} (${incident.priority} priority).`;
    needsAttention = 'No medical response unit has been selected yet.';
    nextActionLabel = 'Select Response Unit';
    nextActionDescription = 'Compare active medical units by capability and distance on the Response tab.';
    nextActionType = 'SELECT_UNIT';
    nextTabTarget = 'response';
  } else {
    currentMilestoneIndex = 2;
    whatIsHappening = `Location verified and candidate unit selected for ${incident.id}.`;
    needsAttention = 'Human operator dispatch approval is required before deploying the unit.';
    nextActionLabel = 'Approve Dispatch';
    nextActionDescription = 'Confirm selected medical unit and approve dispatch.';
    nextActionType = 'APPROVE_DISPATCH';
    nextTabTarget = 'response';
  }

  const hasGatherInfo =
    incident.transcript.some((m) => m.speaker === 'CALLER') ||
    Boolean(incident.description?.trim());

  const milestoneDoneMap: Record<WorkflowMilestoneItem['id'], boolean> = {
    report_intake: hasGatherInfo && hasHumanControl,
    assessment_verification: hasHumanControl && locationVerified && priorityAssessed,
    unit_dispatch: hasDispatchApproved,
    response_transport: isClosed || hospitalArrived,
    closure: isClosed,
  };

  const milestones: WorkflowMilestoneItem[] = MILESTONE_DEFINITIONS.map((def, idx) => {
    let status: WorkflowMilestoneItem['status'] = 'upcoming';
    if (milestoneDoneMap[def.id]) {
      status = 'done';
    } else if (idx === currentMilestoneIndex) {
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
    currentMilestoneIndex,
    milestones,
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
  const active = incidents.filter((i) => !i.legacyOutOfScope && isActiveIncidentStatus(i.status));
  const criticalActive = active.filter((i) => i.priority === 'Critical');
  const unassessedActive = active.filter((i) => i.priority === 'Unassessed');
  const awaitingTakeover = active.filter((i) => i.status === 'New');
  const unverifiedOwned = active.filter(
    (i) =>
      i.status === 'Under Review' &&
      (i.location.verificationStatus !== 'VERIFIED' || i.priority === 'Unassessed') &&
      !i.assignedUnitId
  );
  const readyForDispatch = active.filter(
    (i) =>
      i.location.verificationStatus === 'VERIFIED' &&
      i.priority !== 'Unassessed' &&
      !i.assignedUnitId &&
      i.status === 'Under Review'
  );
  const availableUnits = units.filter(
    (u) =>
      u.registrationStatus === 'Active' &&
      !u.legacyOutOfScope &&
      u.availability === 'Available'
  ).length;

  const whatIsHappening =
    active.length === 0
      ? `All current medical cases are closed. ${availableUnits} active medical units are available across Lagos.`
      : `${active.length} active medical incident${active.length === 1 ? '' : 's'} (${criticalActive.length} Critical${
          unassessedActive.length > 0 ? `, ${unassessedActive.length} Unassessed` : ''
        }) and ${availableUnits} available medical unit${availableUnits === 1 ? '' : 's'}.`;

  const sortTop = (arr: IncidentRecord[]) =>
    [...arr].sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])[0] || null;

  const topAwaiting = sortTop(awaitingTakeover);
  const topUnverified = sortTop(unverifiedOwned);
  const topDispatch = sortTop(readyForDispatch);
  const topActive = sortTop(active);

  if (topAwaiting) {
    return {
      whatIsHappening,
      needsAttention: `${awaitingTakeover.length} new report${
        awaitingTakeover.length === 1 ? '' : 's'
      } awaiting operator takeover — starting with ${topAwaiting.id} (${topAwaiting.category}, ${topAwaiting.priority}).`,
      nextStepText: `Open ${topAwaiting.id} in Incident Management, take over control, and verify location & clinical priority.`,
      focusIncident: topAwaiting,
      focusAction: 'TAKE_OVER',
      focusActionLabel: `Take Over ${topAwaiting.id}`,
    };
  }

  if (topUnverified) {
    return {
      whatIsHappening,
      needsAttention: `${topUnverified.id} (${topUnverified.category}) needs ${
        topUnverified.priority === 'Unassessed' ? 'clinical priority assessment and ' : ''
      }location verification before dispatch.`,
      nextStepText: `Open ${topUnverified.id} to verify exact Lagos coordinates and confirm priority.`,
      focusIncident: topUnverified,
      focusAction: 'VERIFY_LOCATION',
      focusActionLabel: `Verify ${topUnverified.id}`,
    };
  }

  if (topDispatch) {
    return {
      whatIsHappening,
      needsAttention: `${topDispatch.id} (${topDispatch.category}, ${topDispatch.priority}) is verified and ready for unit assignment.`,
      nextStepText: `Select an active medical unit and approve dispatch for ${topDispatch.id}.`,
      focusIncident: topDispatch,
      focusAction: 'ASSIGN_UNIT',
      focusActionLabel: `Dispatch ${topDispatch.id}`,
    };
  }

  if (topActive) {
    return {
      whatIsHappening,
      needsAttention: `${topActive.id} (${topActive.category}) is currently ${topActive.status}.`,
      nextStepText: `Monitor response or transport milestones on ${topActive.id} until closure.`,
      focusIncident: topActive,
      focusAction: 'OPEN',
      focusActionLabel: `Open ${topActive.id}`,
    };
  }

  return {
    whatIsHappening,
    needsAttention: 'No open medical incidents require immediate action.',
    nextStepText: 'Start a new emergency intake in Incident Management or run the 9-stage demo simulation.',
    focusIncident: null,
    focusAction: 'OPEN',
    focusActionLabel: 'Open Incident Management',
  };
}
