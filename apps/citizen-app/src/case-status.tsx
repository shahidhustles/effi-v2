import { StyleSheet } from "react-native";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";

export const caseStatuses = [
  "new",
  "assigned",
  "under_inspection",
  "work_in_progress",
  "resolved",
] as const;

export const casePriorities = ["critical", "high", "medium", "low"] as const;
export const caseCategories = ["roads", "sanitation", "water", "lighting", "drainage", "other"] as const;

export type CaseStatus = (typeof caseStatuses)[number];
export type CasePriority = (typeof casePriorities)[number];
export type CaseCategory = (typeof caseCategories)[number];

export const caseStatusLabels: Record<CaseStatus, string> = {
  new: "New",
  assigned: "Assigned",
  under_inspection: "Under inspection",
  work_in_progress: "In progress",
  resolved: "Resolved",
};

export const casePriorityLabels: Record<CasePriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const caseCategoryLabels: Record<CaseCategory, string> = {
  roads: "Roads",
  sanitation: "Sanitation",
  water: "Water",
  lighting: "Lighting",
  drainage: "Drainage",
  other: "Other",
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success";

const statusVariants: Record<CaseStatus, BadgeVariant> = {
  new: "default",
  assigned: "secondary",
  under_inspection: "secondary",
  work_in_progress: "outline",
  resolved: "success",
};

const priorityVariants: Record<CasePriority, BadgeVariant> = {
  critical: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <Badge variant={statusVariants[status]}>{caseStatusLabels[status]}</Badge>;
}

export function CasePriorityBadge({ priority }: { priority: CasePriority }) {
  return <Badge variant={priorityVariants[priority]}>{casePriorityLabels[priority]}</Badge>;
}

export function CaseStatusTimeline({ status }: { status: CaseStatus }) {
  const primary = useColor("primary");
  const border = useColor("border");
  const text = useColor("text");
  const muted = useColor("textMuted");
  const currentIndex = caseStatuses.indexOf(status);

  return (
    <View>
      {caseStatuses.map((step, index) => {
        const reached = index <= currentIndex;
        return (
          <View key={step} style={styles.step}>
            <View style={styles.marker}>
              <View style={[styles.dot, { backgroundColor: reached ? primary : border }]} />
              {index < caseStatuses.length - 1 ? (
                <View style={[styles.line, { backgroundColor: index < currentIndex ? primary : border }]} />
              ) : null}
            </View>
            <View style={styles.stepCopy}>
              <Text style={{ color: reached ? text : muted }}>{caseStatusLabels[step]}</Text>
              {index === currentIndex ? (
                <Text variant="caption">Current status</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export const formatCaseTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const styles = StyleSheet.create({
  step: {
    flexDirection: "row",
    gap: 12,
  },
  marker: {
    alignItems: "center",
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  line: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  stepCopy: {
    flex: 1,
    paddingBottom: 16,
  },
});
