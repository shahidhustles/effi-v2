import { makeFunctionReference } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import { StatusBar } from "expo-status-bar";
import {
  ArrowBigUp,
  CircleDot,
  Droplets,
  Lightbulb,
  MapPin,
  MapPinOff,
  Route,
  Trash2,
  TriangleAlert,
  Wrench,
} from "lucide-react-native";
import { useCallback, useState, type ComponentType } from "react";
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from "react-native";
import type { LucideProps } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NearbyIssuesMap } from "@/components/nearby-issues-map";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useHaptics } from "@/hooks/useHaptics";
import { useNearbyLocation } from "@/hooks/use-nearby-location";
import { useColor } from "@/hooks/useColor";
import {
  formatDistance,
  nearbyIssueCountLabel,
  repostAccessibilityLabel,
  statusLabel,
  type NearbyIssue,
  type NearbyIssueCategory,
  type NearbyIssuesResult,
} from "@/nearby-issues";

const nearbyAssignedCases = makeFunctionReference<
  "query",
  { latitude: number; longitude: number },
  NearbyIssuesResult
>("nearbyIssues:nearbyAssignedCases");

type RepostResult = { repostCount: number; viewerHasReposted: boolean };

const repostCase = makeFunctionReference<
  "mutation",
  { caseId: string; latitude: number; longitude: number },
  RepostResult
>("caseReposts:repostCase");

const removeRepost = makeFunctionReference<
  "mutation",
  { caseId: string },
  RepostResult
>("caseReposts:removeRepost");

type StatusTone = { background: string; foreground: string };

function CategoryIcon({
  category,
  color,
}: {
  category: NearbyIssueCategory;
  color: string;
}) {
  switch (category) {
    case "roads":
      return <Route color={color} size={25} strokeWidth={2.05} />;
    case "sanitation":
      return <Trash2 color={color} size={25} strokeWidth={2.05} />;
    case "water":
      return <Droplets color={color} size={25} strokeWidth={2.05} />;
    case "lighting":
      return <Lightbulb color={color} size={25} strokeWidth={2.05} />;
    case "drainage":
      return <CircleDot color={color} size={25} strokeWidth={2.05} />;
    case "other":
      return <Wrench color={color} size={25} strokeWidth={2.05} />;
    default: {
      const unhandled: never = category;
      return unhandled;
    }
  }
}

function RepostButton({
  count,
  active,
  pending,
  onPress,
}: {
  count: number;
  active: boolean;
  pending: boolean;
  onPress: () => void;
}) {
  const navy = useColor("civicNavy");
  const canvas = useColor("homeCanvas");
  const accent = useColor("progressAccent");
  const tint = useColor("progressTint");
  const muted = useColor("textMuted");
  const foreground = active ? accent : navy;
  return (
    <Pressable
      accessibilityLabel={repostAccessibilityLabel(count, active)}
      accessibilityRole="button"
      accessibilityState={{ busy: pending, selected: active }}
      disabled={pending}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [
        styles.repostButton,
        {
          backgroundColor: active ? tint : canvas,
          opacity: pending ? 0.55 : pressed ? 0.72 : 1,
        },
      ]}
    >
      <ArrowBigUp
        color={foreground}
        fill={active ? accent : "none"}
        size={18}
        strokeWidth={2.2}
      />
      <Text style={[styles.repostCount, { color: active ? accent : muted }]}>
        {count}
      </Text>
    </Pressable>
  );
}

function IssueRow({
  issue,
  isLast,
  isRepostPending,
  onToggleRepost,
}: {
  issue: NearbyIssue;
  isLast: boolean;
  isRepostPending: boolean;
  onToggleRepost: (issue: NearbyIssue) => void;
}) {
  const surface = useColor("homeSurface");
  const border = useColor("homeBorder");
  const text = useColor("civicNavy");
  const muted = useColor("textMuted");
  const blue = useColor("submittedAccent");
  const iconBackground = useColor("submittedTint");
  const statusTones: Record<NearbyIssue["status"], StatusTone> = {
    assigned: {
      background: useColor("assignedTint"),
      foreground: useColor("assignedAccent"),
    },
    under_inspection: {
      background: useColor("submittedTint"),
      foreground: blue,
    },
    work_in_progress: {
      background: useColor("progressTint"),
      foreground: useColor("progressAccent"),
    },
  };
  const tone = statusTones[issue.status];
  return (
    <View
      style={[
        styles.issueRow,
        { backgroundColor: surface },
        !isLast && { borderBottomColor: border, borderBottomWidth: 1 },
      ]}
    >
      <View style={[styles.categoryIcon, { backgroundColor: iconBackground }]}>
        <CategoryIcon category={issue.category} color={blue} />
      </View>
      <View style={styles.issueCopy}>
        <Text numberOfLines={2} style={[styles.issueSummary, { color: text }]}>
          {issue.summary}
        </Text>
        <Text numberOfLines={1} style={[styles.issueMeta, { color: muted }]}>
          {issue.locality} · {formatDistance(issue.distanceMetres)}
        </Text>
        <View style={styles.badgeRow}>
          <View
            style={[styles.statusBadge, { backgroundColor: tone.background }]}
          >
            <Text style={[styles.statusText, { color: tone.foreground }]}>
              {statusLabel(issue.status)}
            </Text>
          </View>
          <RepostButton
            active={issue.viewerHasReposted}
            count={issue.repostCount}
            onPress={() => onToggleRepost(issue)}
            pending={isRepostPending}
          />
        </View>
      </View>
    </View>
  );
}

function StateCard({
  icon: Icon,
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  icon: ComponentType<LucideProps>;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const surface = useColor("homeSurface");
  const border = useColor("homeBorder");
  const navy = useColor("civicNavy");
  const muted = useColor("textMuted");
  const blue = useColor("submittedAccent");
  const white = useColor("civicHeaderForeground");
  const iconBackground = useColor("submittedTint");
  return (
    <View
      style={[
        styles.stateCard,
        { backgroundColor: surface, borderColor: border },
      ]}
    >
      <View style={[styles.stateIcon, { backgroundColor: iconBackground }]}>
        <Icon color={blue} size={30} strokeWidth={2} />
      </View>
      <Text
        accessibilityRole="header"
        style={[styles.stateTitle, { color: navy }]}
      >
        {title}
      </Text>
      <Text style={[styles.stateMessage, { color: muted }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.primaryAction,
            { backgroundColor: blue, opacity: pressed ? 0.72 : 1 },
          ]}
        >
          <Text style={[styles.primaryActionText, { color: white }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
      {secondaryLabel && onSecondary ? (
        <Pressable
          accessibilityRole="button"
          onPress={onSecondary}
          style={({ pressed }) => [
            styles.secondaryAction,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.secondaryActionText, { color: blue }]}>
            {secondaryLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function NearbyIssuesScreen() {
  const { state, refresh } = useNearbyLocation();
  const queryArgs =
    state.kind === "ready"
      ? { latitude: state.latitude, longitude: state.longitude }
      : "skip";
  const result = useQuery(nearbyAssignedCases, queryArgs);
  const repostIssue = useMutation(repostCase);
  const undoRepost = useMutation(removeRepost);
  const feedback = useHaptics();
  const [pendingReposts, setPendingReposts] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [repostError, setRepostError] = useState<string | null>(null);
  const canvas = useColor("homeCanvas");
  const surface = useColor("homeSurface");
  const border = useColor("homeBorder");
  const navy = useColor("civicNavy");
  const muted = useColor("textMuted");
  const blue = useColor("submittedAccent");
  const red = useColor("red");

  const toggleRepost = useCallback(
    (issue: NearbyIssue) => {
      if (state.kind !== "ready") return;
      setRepostError(null);
      feedback(issue.viewerHasReposted ? "toggle-off" : "toggle-on");
      setPendingReposts((current) => new Set(current).add(issue.caseId));
      const request = issue.viewerHasReposted
        ? undoRepost({ caseId: issue.caseId })
        : repostIssue({
            caseId: issue.caseId,
            latitude: state.latitude,
            longitude: state.longitude,
          });
      void request
        .catch((cause: unknown) => {
          setRepostError(
            cause instanceof Error
              ? cause.message
              : "The repost could not be saved. Try again.",
          );
        })
        .finally(() => {
          setPendingReposts((current) => {
            const next = new Set(current);
            next.delete(issue.caseId);
            return next;
          });
        });
    },
    [feedback, repostIssue, state, undoRepost],
  );

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.screen, { backgroundColor: canvas }]}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={false}
            tintColor={blue}
            onRefresh={() => {
              setRepostError(null);
              void refresh();
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: navy }]}
        >
          Nearby issues
        </Text>

        {state.kind === "locating" ? (
          <StateCard
            icon={MapPin}
            message="Allow foreground location so Effi can find active problems within 3 km."
            title="Finding your location"
          />
        ) : state.kind === "denied" ? (
          <StateCard
            actionLabel="Try again"
            icon={MapPinOff}
            message="Effi only uses your current location to search nearby. It does not save your position."
            onAction={() => void refresh()}
            onSecondary={() => void Linking.openSettings()}
            secondaryLabel="Open settings"
            title={
              state.canAskAgain
                ? "Location access is needed"
                : "Location access is turned off"
            }
          />
        ) : state.kind === "error" ? (
          <StateCard
            actionLabel="Try again"
            icon={TriangleAlert}
            message={state.message}
            onAction={() => void refresh()}
            title="Location unavailable"
          />
        ) : (
          <>
            <View style={styles.placeRow}>
              <MapPin color={navy} size={24} strokeWidth={2.2} />
              <View style={styles.placeCopy}>
                <Text
                  numberOfLines={1}
                  style={[styles.placeName, { color: navy }]}
                >
                  {state.placeLabel}
                </Text>
                <Text style={[styles.placeMeta, { color: muted }]}>
                  {result
                    ? nearbyIssueCountLabel(result.issues.length)
                    : "Finding active issues within 3 km"}
                </Text>
              </View>
            </View>

            <View style={styles.mapWrap}>
              <NearbyIssuesMap
                heatPoints={result?.heatPoints ?? []}
                latitude={state.latitude}
                longitude={state.longitude}
                radiusMetres={result?.radiusMetres ?? 3_000}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.radiusBadge,
                  { backgroundColor: surface, borderColor: border },
                ]}
              >
                <Text style={[styles.radiusText, { color: navy }]}>
                  3 km radius
                </Text>
              </View>
            </View>

            <View style={styles.listHeading}>
              <Text
                accessibilityRole="header"
                style={[styles.sectionTitle, { color: navy }]}
              >
                Nearby problems
              </Text>
              {result ? (
                <Text style={[styles.issueCount, { color: muted }]}>
                  {result.issues.length}
                </Text>
              ) : null}
            </View>

            {repostError ? (
              <Text
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                style={[styles.repostError, { color: red }]}
              >
                {repostError}
              </Text>
            ) : null}

            <View
              style={[
                styles.issueList,
                { backgroundColor: surface, borderColor: border },
              ]}
            >
              {result === undefined ? (
                <View
                  accessible
                  accessibilityLabel="Loading nearby problems"
                  style={styles.loadingList}
                >
                  <Text style={[styles.stateTitle, { color: navy }]}>
                    Loading nearby problems
                  </Text>
                  <Text style={[styles.loadingCopy, { color: muted }]}>
                    Assigned cases will appear here.
                  </Text>
                </View>
              ) : result.issues.length === 0 ? (
                <View style={styles.loadingList}>
                  <Text style={[styles.stateTitle, { color: navy }]}>
                    No active assigned issues nearby
                  </Text>
                  <Text style={[styles.loadingCopy, { color: muted }]}>
                    There are no officer-assigned problems within 3 km right
                    now.
                  </Text>
                </View>
              ) : (
                result.issues.map((issue, index) => (
                  <IssueRow
                    key={issue.caseId}
                    isLast={index === result.issues.length - 1}
                    isRepostPending={pendingReposts.has(issue.caseId)}
                    issue={issue}
                    onToggleRepost={toggleRepost}
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 36,
  },
  title: { fontSize: 36, fontWeight: "800", letterSpacing: -1, lineHeight: 43 },
  placeRow: {
    marginTop: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  placeCopy: { flex: 1 },
  placeName: { fontSize: 21, fontWeight: "600", lineHeight: 27 },
  placeMeta: { marginTop: 2, fontSize: 15, lineHeight: 21 },
  mapWrap: { position: "relative", marginTop: 20 },
  radiusBadge: {
    position: "absolute",
    right: 14,
    top: 14,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  radiusText: { fontSize: 14, fontWeight: "600" },
  listHeading: {
    marginTop: 28,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.45,
    lineHeight: 34,
  },
  issueCount: { fontSize: 16, fontWeight: "600" },
  issueList: { overflow: "hidden", borderWidth: 1, borderRadius: 18 },
  issueRow: {
    minHeight: 132,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  issueCopy: { flex: 1, alignItems: "flex-start" },
  issueSummary: { fontSize: 17, fontWeight: "700", lineHeight: 23 },
  issueMeta: { marginTop: 4, fontSize: 14, lineHeight: 20 },
  badgeRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  statusText: { fontSize: 13, fontWeight: "700", lineHeight: 17 },
  repostButton: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  repostCount: { fontSize: 14, fontWeight: "700", lineHeight: 18 },
  repostError: {
    marginBottom: 12,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  stateCard: {
    marginTop: 24,
    minHeight: 330,
    padding: 28,
    borderWidth: 1,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  stateIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  stateTitle: {
    marginTop: 17,
    fontSize: 21,
    fontWeight: "700",
    lineHeight: 27,
    textAlign: "center",
  },
  stateMessage: {
    maxWidth: 310,
    marginTop: 7,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  primaryAction: {
    minHeight: 48,
    marginTop: 22,
    borderRadius: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionText: { fontSize: 16, fontWeight: "700" },
  secondaryAction: {
    minHeight: 44,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: { fontSize: 15, fontWeight: "700" },
  loadingList: {
    minHeight: 160,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingCopy: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
});
