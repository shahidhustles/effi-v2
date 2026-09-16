export const analyticsCategories = ["roads", "sanitation", "water", "lighting", "drainage", "other"] as const;
export type AnalyticsCategory = (typeof analyticsCategories)[number];

export const analyticsPriorities = ["critical", "high", "medium", "low"] as const;
export type AnalyticsPriority = (typeof analyticsPriorities)[number];

export const analyticsStatuses = ["new", "assigned", "under_inspection", "work_in_progress", "resolved"] as const;
export type AnalyticsStatus = (typeof analyticsStatuses)[number];

export const analyticsChannels = ["telegram", "whatsapp", "app"] as const;
export type AnalyticsChannel = (typeof analyticsChannels)[number];

type AnalyticsAuditEvent =
  | { kind: "case_assigned"; assignedOfficerId: string; assignedOfficerName?: string }
  | { kind: "priority_changed"; from: AnalyticsPriority; to: AnalyticsPriority }
  | { kind: "status_changed"; from: AnalyticsStatus; to: AnalyticsStatus }
  | { kind: "case_resolved"; from: "work_in_progress"; to: "resolved"; resolutionNote: string };

export type AnalyticsCase = {
  caseId: string;
  reportNumber: string;
  summary: string;
  category: AnalyticsCategory;
  channel: AnalyticsChannel;
  status: AnalyticsStatus;
  recommendedPriority: AnalyticsPriority;
  currentPriority: AnalyticsPriority;
  submittedAt: number;
  location: {
    source: "current_gps" | "selected_pin";
    latitude: number;
    longitude: number;
    place?: { name: string; formattedAddress: string };
  };
  assignedOfficerName?: string;
  repostCount: number;
  audit: Array<{ occurredAt: number; event: AnalyticsAuditEvent }>;
};

export type AnalyticsPeriod = 7 | 30 | 90;
export type AnalyticsCategoryFilter = AnalyticsCategory | "all";

type SlaTarget =
  | { kind: "calendar"; hours: number; label: string }
  | { kind: "working"; hours: number; label: string };

export type SlaState =
  | { kind: "unavailable" }
  | {
      kind: "tracked";
      consumedPercent: number;
      targetLabel: string;
      risk: "healthy" | "at_risk" | "breached" | "escalate";
      remainingMs: number;
    };

export type AttentionCase = AnalyticsCase & { sla: Extract<SlaState, { kind: "tracked" }>; riskScore: number };

export type FlowStage = {
  key: "received" | "assigned" | "inspection" | "work" | "resolved";
  label: string;
  count: number;
  medianFromPreviousMs: number | null;
};

export type RecurrenceCluster = {
  id: string;
  category: AnalyticsCategory;
  label: string;
  caseCount: number;
  repostCount: number;
  latitude: number;
  longitude: number;
};

export type OperationalAnalytics = {
  filteredCases: AnalyticsCase[];
  openCases: number;
  trackedOpenCases: number;
  slaCompliancePercent: number | null;
  medianAssignmentMs: number | null;
  medianResolutionMs: number | null;
  attentionCases: AttentionCase[];
  flow: FlowStage[];
  recurrenceClusters: RecurrenceCluster[];
  priorityAgreement: { unchanged: number; raised: number; lowered: number };
  dailyIntake: Array<{ day: string; cases: number }>;
  channelCounts: Array<{ channel: AnalyticsChannel; cases: number }>;
};

const priorityWeight: Record<AnalyticsPriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const workingDayStartHour = 8;
const workingDayEndHour = 18;
const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;
const recurrenceRadiusMetres = 500;

const slaTargetFor = (category: AnalyticsCategory, priority: AnalyticsPriority): SlaTarget | null => {
  switch (category) {
    case "roads":
      if (priority === "critical") return { kind: "calendar", hours: 2, label: "2 calendar hours" };
      if (priority === "high") return { kind: "working", hours: 10, label: "1 working day" };
      return { kind: "working", hours: 50, label: "5 working days" };
    case "sanitation":
      if (priority === "critical") return { kind: "calendar", hours: 2, label: "2 calendar hours" };
      if (priority === "high") return { kind: "working", hours: 10, label: "1 working day" };
      return null;
    case "lighting":
      if (priority === "critical") return { kind: "calendar", hours: 1, label: "1 calendar hour" };
      if (priority === "high") return { kind: "working", hours: 10, label: "1 working day" };
      return null;
    case "water":
    case "drainage":
    case "other":
      return null;
    default: {
      const unhandled: never = category;
      return unhandled;
    }
  }
};

const workingMillisecondsBetween = (start: number, end: number): number => {
  if (end <= start) return 0;
  let total = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const lastDay = new Date(end);
  lastDay.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= lastDay.getTime()) {
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6) {
      const windowStart = new Date(cursor);
      windowStart.setHours(workingDayStartHour, 0, 0, 0);
      const windowEnd = new Date(cursor);
      windowEnd.setHours(workingDayEndHour, 0, 0, 0);
      const overlapStart = Math.max(start, windowStart.getTime());
      const overlapEnd = Math.min(end, windowEnd.getTime());
      total += Math.max(0, overlapEnd - overlapStart);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
};

const elapsedForTarget = (start: number, end: number, target: SlaTarget): number =>
  target.kind === "calendar" ? Math.max(0, end - start) : workingMillisecondsBetween(start, end);

const resolvedAt = (entry: AnalyticsCase): number | null => {
  const event = entry.audit.find((auditEntry) => auditEntry.event.kind === "case_resolved");
  return event?.occurredAt ?? null;
};

export const calculateSlaState = (entry: AnalyticsCase, now: number): SlaState => {
  const target = slaTargetFor(entry.category, entry.currentPriority);
  if (!target) return { kind: "unavailable" };
  const targetMs = target.hours * hourMs;
  const end = resolvedAt(entry) ?? now;
  const elapsed = elapsedForTarget(entry.submittedAt, end, target);
  const consumedPercent = Math.round((elapsed / targetMs) * 100);
  const risk = consumedPercent >= 200
    ? "escalate"
    : consumedPercent >= 100
      ? "breached"
      : consumedPercent >= 75
        ? "at_risk"
        : "healthy";
  return {
    kind: "tracked",
    consumedPercent,
    targetLabel: target.label,
    risk,
    remainingMs: targetMs - elapsed,
  };
};

const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const left = sorted[middle];
  if (left === undefined) return null;
  if (sorted.length % 2 === 1) return left;
  const right = sorted[middle - 1];
  return right === undefined ? left : (left + right) / 2;
};

const firstStatusTime = (entry: AnalyticsCase, status: AnalyticsStatus): number | null => {
  const event = entry.audit.find((auditEntry) =>
    (auditEntry.event.kind === "status_changed" && auditEntry.event.to === status)
    || (status === "resolved" && auditEntry.event.kind === "case_resolved"),
  );
  return event?.occurredAt ?? null;
};

const distanceMetres = (left: AnalyticsCase, right: AnalyticsCase): number => {
  const earthRadiusMetres = 6_371_000;
  const degreesToRadians = Math.PI / 180;
  const latitudeDelta = (right.location.latitude - left.location.latitude) * degreesToRadians;
  const longitudeDelta = (right.location.longitude - left.location.longitude) * degreesToRadians;
  const leftLatitude = left.location.latitude * degreesToRadians;
  const rightLatitude = right.location.latitude * degreesToRadians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMetres * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const recurrenceClusters = (cases: readonly AnalyticsCase[]): RecurrenceCluster[] => {
  const visited = new Set<string>();
  const clusters: RecurrenceCluster[] = [];

  for (const seed of cases) {
    if (visited.has(seed.caseId)) continue;
    const members: AnalyticsCase[] = [];
    const queue = [seed];
    visited.add(seed.caseId);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      members.push(current);
      for (const candidate of cases) {
        if (visited.has(candidate.caseId) || candidate.category !== seed.category) continue;
        if (distanceMetres(current, candidate) <= recurrenceRadiusMetres) {
          visited.add(candidate.caseId);
          queue.push(candidate);
        }
      }
    }

    if (members.length < 2) continue;
    const latitude = members.reduce((sum, entry) => sum + entry.location.latitude, 0) / members.length;
    const longitude = members.reduce((sum, entry) => sum + entry.location.longitude, 0) / members.length;
    const place = members.find((entry) => entry.location.place?.name)?.location.place?.name;
    clusters.push({
      id: members.map((entry) => entry.caseId).sort().join(":"),
      category: seed.category,
      label: place ?? "Mapped area",
      caseCount: members.length,
      repostCount: members.reduce((sum, entry) => sum + entry.repostCount, 0),
      latitude,
      longitude,
    });
  }

  return clusters.sort((left, right) =>
    right.caseCount + right.repostCount - (left.caseCount + left.repostCount),
  );
};

const stageTime = (entry: AnalyticsCase, stage: FlowStage["key"]): number | null => {
  switch (stage) {
    case "received": return entry.submittedAt;
    case "assigned": return firstStatusTime(entry, "assigned");
    case "inspection": return firstStatusTime(entry, "under_inspection");
    case "work": return firstStatusTime(entry, "work_in_progress");
    case "resolved": return resolvedAt(entry);
    default: {
      const unhandled: never = stage;
      return unhandled;
    }
  }
};

const flowStages = (cases: readonly AnalyticsCase[]): FlowStage[] => {
  const definitions: Array<{ key: FlowStage["key"]; label: string; previous: FlowStage["key"] | null }> = [
    { key: "received", label: "Received", previous: null },
    { key: "assigned", label: "Assigned", previous: "received" },
    { key: "inspection", label: "Inspected", previous: "assigned" },
    { key: "work", label: "Work started", previous: "inspection" },
    { key: "resolved", label: "Resolved", previous: "work" },
  ];
  return definitions.map((definition) => {
    const reached = cases.filter((entry) => stageTime(entry, definition.key) !== null);
    const previous = definition.previous;
    const durations = previous === null
      ? []
      : reached.flatMap((entry) => {
          const start = stageTime(entry, previous);
          const end = stageTime(entry, definition.key);
          return start === null || end === null || end < start ? [] : [end - start];
        });
    return { key: definition.key, label: definition.label, count: reached.length, medianFromPreviousMs: median(durations) };
  });
};

const dayKey = (timestamp: number): string => {
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export const buildOperationalAnalytics = ({
  cases,
  now,
  period,
  category,
}: {
  cases: readonly AnalyticsCase[];
  now: number;
  period: AnalyticsPeriod;
  category: AnalyticsCategoryFilter;
}): OperationalAnalytics => {
  const periodStart = now - period * dayMs;
  const filteredCases = cases.filter((entry) =>
    entry.submittedAt >= periodStart && entry.submittedAt <= now && (category === "all" || entry.category === category),
  );
  const open = filteredCases.filter((entry) => entry.status !== "resolved");
  const resolved = filteredCases.filter((entry) => entry.status === "resolved");
  const resolvedSlaStates = resolved.map((entry) => calculateSlaState(entry, now)).filter((state): state is Extract<SlaState, { kind: "tracked" }> => state.kind === "tracked");
  const assignmentDurations = filteredCases.flatMap((entry) => {
    const assigned = firstStatusTime(entry, "assigned");
    return assigned === null || assigned < entry.submittedAt ? [] : [assigned - entry.submittedAt];
  });
  const resolutionDurations = resolved.flatMap((entry) => {
    const completed = resolvedAt(entry);
    return completed === null || completed < entry.submittedAt ? [] : [completed - entry.submittedAt];
  });
  const attentionCases = open.flatMap((entry): AttentionCase[] => {
    const sla = calculateSlaState(entry, now);
    if (sla.kind !== "tracked") return [];
    const riskScore = sla.consumedPercent
      + priorityWeight[entry.currentPriority] * 12
      + entry.repostCount * 8
      + (entry.assignedOfficerName ? 0 : 18);
    return [{ ...entry, sla, riskScore }];
  }).sort((left, right) => right.riskScore - left.riskScore).slice(0, 8);
  const priorityAgreement = filteredCases.reduce((counts, entry) => {
    const recommended = priorityWeight[entry.recommendedPriority];
    const current = priorityWeight[entry.currentPriority];
    if (current === recommended) counts.unchanged += 1;
    else if (current > recommended) counts.raised += 1;
    else counts.lowered += 1;
    return counts;
  }, { unchanged: 0, raised: 0, lowered: 0 });
  const intakeByDay = new Map<string, number>();
  for (let offset = period - 1; offset >= 0; offset -= 1) {
    intakeByDay.set(dayKey(now - offset * dayMs), 0);
  }
  for (const entry of filteredCases) {
    const key = dayKey(entry.submittedAt);
    intakeByDay.set(key, (intakeByDay.get(key) ?? 0) + 1);
  }
  const channelCounts = analyticsChannels.map((channel) => ({
    channel,
    cases: filteredCases.filter((entry) => entry.channel === channel).length,
  }));

  return {
    filteredCases,
    openCases: open.length,
    trackedOpenCases: attentionCases.length,
    slaCompliancePercent: resolvedSlaStates.length === 0
      ? null
      : Math.round((resolvedSlaStates.filter((state) => state.consumedPercent <= 100).length / resolvedSlaStates.length) * 100),
    medianAssignmentMs: median(assignmentDurations),
    medianResolutionMs: median(resolutionDurations),
    attentionCases,
    flow: flowStages(filteredCases),
    recurrenceClusters: recurrenceClusters(filteredCases).slice(0, 5),
    priorityAgreement,
    dailyIntake: [...intakeByDay].map(([day, count]) => ({ day, cases: count })),
    channelCounts,
  };
};
