import { useAuth } from "@clerk/expo";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { Image } from "expo-image";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
import { ArrowLeft, Check, CircleCheck, ImageOff, MapPin, ShieldCheck, VideoOff } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  caseCategoryLabels,
  caseStatusDescriptions,
  caseStatusLabels,
  caseStatuses,
  formatCaseTime,
  type CaseCategory,
  type CaseStatus,
} from "@/case-status";
import {
  caseMedia,
  statusStepState,
  timelineEntryTitle,
  type CitizenEvidence,
  type CitizenTimelineEntry,
} from "@/case-detail";
import { CaseLocationMap } from "@/components/case-location-map";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";
import { useReadableLocation } from "@/hooks/use-readable-location";
import { formatReportNumber } from "@/report-display";

type ViewerCaseDetail = {
  case: {
    caseId: string;
    reportId: string;
    reportNumber: string;
    summary: string;
    category: CaseCategory;
    status: CaseStatus;
    location: {
      source: "current_gps" | "selected_pin";
      latitude: number;
      longitude: number;
      place?: { name: string; formattedAddress: string };
    };
    submittedAt: number;
  };
  evidence: CitizenEvidence[];
  timeline: CitizenTimelineEntry[];
};

const viewerCase = makeFunctionReference<"query", { caseId: string }, ViewerCaseDetail | null>("citizen:viewerCase");

type Tone = { background: string; foreground: string };

function StatusProgress({ status }: { status: CaseStatus }) {
  const surface = useColor("homeSurface");
  const border = useColor("homeBorder");
  const text = useColor("foreground");
  const muted = useColor("textMuted");
  const blue = useColor("submittedAccent");
  const resolved = useColor("resolvedAccent");
  const accent = status === "resolved" ? resolved : blue;
  const currentIndex = caseStatuses.indexOf(status);

  return (
    <View
      accessible
      accessibilityLabel={`Current status: ${caseStatusLabels[status]}`}
      style={[styles.statusCard, { backgroundColor: surface, borderColor: border }]}
    >
      <View style={styles.statusHeading}>
        <Text style={styles.sectionTitle}>Status</Text>
        <Text style={[styles.currentStatus, { color: accent }]}>{caseStatusLabels[status]}</Text>
      </View>
      <View style={styles.statusSteps}>
        {caseStatuses.map((step, index) => {
          const state = statusStepState(step, status);
          const reached = state !== "upcoming";
          return (
            <View key={step} style={styles.statusStep}>
              <View style={styles.statusTrack}>
                {index > 0 ? (
                  <View style={[styles.connector, styles.connectorLeft, { backgroundColor: reached ? accent : border }]} />
                ) : null}
                <View style={[styles.statusDot, { backgroundColor: reached ? accent : surface, borderColor: reached ? accent : border }]}> 
                  {state === "complete" ? <Check color={surface} size={12} strokeWidth={3} /> : null}
                  {state === "current" ? <View style={[styles.currentDot, { backgroundColor: surface }]} /> : null}
                </View>
                {index < caseStatuses.length - 1 ? (
                  <View
                    style={[
                      styles.connector,
                      styles.connectorRight,
                      { backgroundColor: index < currentIndex ? accent : border },
                    ]}
                  />
                ) : null}
              </View>
              <Text style={[styles.statusLabel, { color: state === "current" ? text : muted }]}>{caseStatusLabels[step]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function CaseVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url);

  return (
    <VideoView
      accessibilityLabel="Case video evidence"
      player={player}
      style={styles.evidenceImage}
      nativeControls
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
    />
  );
}

function EvidenceTile({ entry, width }: { entry: CitizenEvidence; width: number }) {
  const [failed, setFailed] = useState(false);
  const border = useColor("homeBorder");
  const surface = useColor("homeSurface");
  const muted = useColor("textMuted");
  const mediaUrl = failed ? null : entry.url;
  const isVideo = entry.mediaType.toLowerCase().startsWith("video/");

  return (
    <View style={[styles.evidenceTile, { width, backgroundColor: surface, borderColor: border }]}> 
      {mediaUrl === null ? (
        <View accessible accessibilityLabel={`Case ${isVideo ? "video" : "image"} unavailable`} style={styles.evidenceUnavailable}>
          {isVideo ? <VideoOff color={muted} size={28} strokeWidth={1.8} /> : <ImageOff color={muted} size={28} strokeWidth={1.8} />}
          <Text style={[styles.evidenceUnavailableText, { color: muted }]}>{isVideo ? "Video unavailable" : "Image unavailable"}</Text>
        </View>
      ) : isVideo ? (
        <CaseVideo url={mediaUrl} />
      ) : (
        <Image
          accessibilityLabel="Case evidence"
          source={{ uri: mediaUrl }}
          style={styles.evidenceImage}
          contentFit="cover"
          transition={150}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}

function EvidenceGallery({ evidence }: { evidence: readonly CitizenEvidence[] }) {
  const { width } = useWindowDimensions();
  const media = caseMedia(evidence);
  const muted = useColor("textMuted");
  const surface = useColor("homeSurface");
  const border = useColor("homeBorder");
  const tileWidth = media.length === 1 ? Math.max(240, width - 40) : Math.min(270, width * 0.72);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionTitle}>Case media</Text>
        <Text style={[styles.sectionCount, { color: muted }]}>{media.length}</Text>
      </View>
      {media.length === 0 ? (
        <View style={[styles.emptyMedia, { backgroundColor: surface, borderColor: border }]}> 
          <ImageOff color={muted} size={28} strokeWidth={1.8} />
          <Text style={[styles.emptyMediaText, { color: muted }]}>No case media is available.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.evidenceRow}>
          {media.map((entry) => <EvidenceTile key={entry.attachmentId} entry={entry} width={tileWidth} />)}
        </ScrollView>
      )}
    </View>
  );
}

function Timeline({ entries }: { entries: readonly CitizenTimelineEntry[] }) {
  const surface = useColor("homeSurface");
  const border = useColor("homeBorder");
  const text = useColor("foreground");
  const muted = useColor("textMuted");
  const green = useColor("resolvedAccent");
  const greenTint = useColor("resolvedTint");

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionTitle}>Timeline and actions taken</Text>
        <Text style={[styles.sectionCount, { color: muted }]}>{entries.length}</Text>
      </View>
      <View style={[styles.timelineCard, { backgroundColor: surface, borderColor: border }]}> 
        {entries.map((entry, index) => (
          <View key={entry.id} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View style={[styles.timelineMarker, { backgroundColor: greenTint }]}> 
                <CircleCheck color={green} size={18} strokeWidth={2.4} />
              </View>
              {index < entries.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: border }]} /> : null}
            </View>
            <View
              style={[
                styles.timelineCopy,
                index < entries.length - 1 ? { borderBottomColor: border, borderBottomWidth: 1 } : null,
              ]}
            >
              <Text style={[styles.timelineTitle, { color: text }]}>{timelineEntryTitle(entry)}</Text>
              <Text style={[styles.timelineMeta, { color: muted }]}>{formatCaseTime(entry.occurredAt)}, {entry.actorName}</Text>
              {entry.event.kind === "resolved" ? (
                <Text style={[styles.resolutionNote, { color: text, backgroundColor: greenTint }]}>{entry.event.resolutionNote}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function DetailLoading() {
  const canvas = useColor("homeCanvas");
  const surface = useColor("homeSurface");
  const border = useColor("homeBorder");
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: canvas }]}> 
      <View accessible accessibilityLabel="Loading report details" style={styles.loadingContent}>
        <View style={[styles.loadingHeader, { backgroundColor: border }]} />
        <View style={[styles.loadingStatus, { backgroundColor: surface, borderColor: border }]} />
        <View style={[styles.loadingImage, { backgroundColor: border }]} />
        <View style={[styles.loadingMap, { backgroundColor: surface, borderColor: border }]} />
      </View>
    </SafeAreaView>
  );
}

function CaseDetail({ caseId }: { caseId: string }) {
  const router = useRouter();
  const detail = useQuery(viewerCase, { caseId });
  const canvas = useColor("homeCanvas");
  const surface = useColor("homeSurface");
  const border = useColor("homeBorder");
  const text = useColor("foreground");
  const muted = useColor("textMuted");
  const blue = useColor("submittedAccent");
  const blueTint = useColor("submittedTint");
  const assignedTint = useColor("assignedTint");
  const assignedAccent = useColor("assignedAccent");
  const progressTint = useColor("progressTint");
  const progressAccent = useColor("progressAccent");
  const resolvedTint = useColor("resolvedTint");
  const resolvedAccent = useColor("resolvedAccent");
  const statusTones: Record<CaseStatus, Tone> = {
    new: { background: useColor("submittedTint"), foreground: blue },
    assigned: { background: assignedTint, foreground: assignedAccent },
    under_inspection: { background: progressTint, foreground: progressAccent },
    work_in_progress: { background: progressTint, foreground: progressAccent },
    resolved: { background: resolvedTint, foreground: resolvedAccent },
  };
  const readableLocation = useReadableLocation(detail?.case.location ?? null);

  if (detail === undefined) return <DetailLoading />;

  if (detail === null) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: canvas }]}> 
        <StatusBar style="auto" />
        <View style={styles.unavailableContent}>
          <View style={styles.header}>
            <Button variant="ghost" size="icon" haptic={false} onPress={() => router.back()} icon={ArrowLeft} />
            <Text style={[styles.headerTitle, { color: text }]}>Report details</Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={[styles.unavailableCard, { backgroundColor: surface, borderColor: border }]}> 
            <ShieldCheck color={blue} size={34} strokeWidth={1.8} />
            <Text style={styles.unavailableTitle}>Report not available</Text>
            <Text style={[styles.unavailableCopy, { color: muted }]}>This report is not linked to your account, or it no longer exists.</Text>
            <Button variant="secondary" onPress={() => router.replace("/cases")}>Back to my reports</Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const record = detail.case;
  const statusTone = statusTones[record.status];

  return (
    <SafeAreaView edges={["top"]} style={[styles.flex, { backgroundColor: canvas }]}> 
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Button variant="ghost" size="icon" haptic={false} onPress={() => router.back()} icon={ArrowLeft} />
          <Text accessibilityRole="header" style={[styles.headerTitle, { color: text }]}>Report details</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={[styles.currentBanner, { backgroundColor: statusTone.background }]}> 
          {record.status === "resolved" ? (
            <CircleCheck color={statusTone.foreground} size={24} strokeWidth={2.25} />
          ) : (
            <ShieldCheck color={statusTone.foreground} size={24} strokeWidth={2.15} />
          )}
          <View style={styles.currentBannerCopy}>
            <Text style={[styles.currentBannerTitle, { color: statusTone.foreground }]}>{caseStatusLabels[record.status]}</Text>
            <Text style={[styles.currentBannerText, { color: statusTone.foreground }]}>{caseStatusDescriptions[record.status]}</Text>
          </View>
        </View>

        <StatusProgress status={record.status} />

        <View style={styles.reportIntro}>
          <View style={styles.reportMetaRow}>
            <Text numberOfLines={1} style={[styles.reportNumber, { color: muted }]}>{formatReportNumber(record.reportNumber)}</Text>
            <Text style={[styles.reportDate, { color: muted }]}>Submitted {formatCaseTime(record.submittedAt)}</Text>
          </View>
          <Text accessibilityRole="header" style={[styles.reportTitle, { color: text }]}>{record.summary}</Text>
          <View style={styles.reportFacts}>
            <Text style={[styles.reportFact, { color: muted }]}>{caseCategoryLabels[record.category]}</Text>
            <View style={[styles.factDivider, { backgroundColor: border }]} />
            <MapPin color={muted} size={16} strokeWidth={2} />
            <Text style={[styles.reportFact, { color: muted }]}>
              {readableLocation.label}
            </Text>
          </View>
        </View>

        <EvidenceGallery evidence={detail.evidence} />

        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitle}>Exact location</Text>
            <Text numberOfLines={1} style={[styles.sectionCount, { color: muted }]}>{readableLocation.label}</Text>
          </View>
          {record.location.place ? (
            <View style={styles.placeDetails}>
              <View style={[styles.placeIcon, { backgroundColor: blueTint }]}>
                <MapPin color={blue} size={18} strokeWidth={2.2} />
              </View>
              <View style={styles.placeCopy}>
                <Text style={[styles.placeName, { color: text }]}>{record.location.place.name}</Text>
                <Text style={[styles.placeAddress, { color: muted }]}>{record.location.place.formattedAddress}</Text>
              </View>
            </View>
          ) : null}
          <CaseLocationMap
            latitude={record.location.latitude}
            longitude={record.location.longitude}
            label={readableLocation.label}
          />
        </View>

        <Timeline entries={detail.timeline} />
      </ScrollView>
    </SafeAreaView>
  );
}

export default function CaseDetailScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { caseId } = useLocalSearchParams<{ caseId?: string }>();

  if (!isLoaded) return <DetailLoading />;
  if (!isSignedIn) return <Redirect href="/" />;
  if (!caseId) return <Redirect href="/cases" />;
  return <CaseDetail caseId={caseId} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 44 },
  header: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 18, fontWeight: "700", letterSpacing: -0.2 },
  headerSpacer: { width: 48 },
  currentBanner: { minHeight: 72, marginTop: 8, borderRadius: 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  currentBannerCopy: { flex: 1, gap: 2 },
  currentBannerTitle: { fontSize: 18, fontWeight: "800" },
  currentBannerText: { fontSize: 13, lineHeight: 18, opacity: 0.82 },
  statusCard: { marginTop: 12, padding: 16, borderWidth: 1, borderRadius: 16 },
  statusHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  currentStatus: { fontSize: 14, fontWeight: "700" },
  statusSteps: { marginTop: 18, flexDirection: "row" },
  statusStep: { flex: 1, alignItems: "center" },
  statusTrack: { width: "100%", height: 20, alignItems: "center", justifyContent: "center" },
  statusDot: { zIndex: 1, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  currentDot: { width: 6, height: 6, borderRadius: 3 },
  connector: { position: "absolute", top: 9, height: 2, width: "50%" },
  connectorLeft: { left: 0 },
  connectorRight: { right: 0 },
  statusLabel: { minHeight: 34, marginTop: 7, paddingHorizontal: 2, fontSize: 10, fontWeight: "600", lineHeight: 13, textAlign: "center" },
  reportIntro: { paddingTop: 24 },
  reportMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  reportNumber: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  reportDate: { flex: 1, fontSize: 12, textAlign: "right" },
  reportTitle: { marginTop: 10, fontSize: 27, fontWeight: "800", letterSpacing: -0.55, lineHeight: 33 },
  reportFacts: { marginTop: 10, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
  reportFact: { fontSize: 14, fontWeight: "500", fontVariant: ["tabular-nums"] },
  factDivider: { width: 1, height: 14 },
  placeDetails: { marginBottom: 12, flexDirection: "row", alignItems: "flex-start", gap: 11 },
  placeIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  placeCopy: { flex: 1, gap: 2 },
  placeName: { fontSize: 16, fontWeight: "700", lineHeight: 21 },
  placeAddress: { fontSize: 13, lineHeight: 18 },
  section: { marginTop: 28 },
  sectionHeadingRow: { minHeight: 28, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionTitle: { flexShrink: 1, fontSize: 19, fontWeight: "800", letterSpacing: -0.25 },
  sectionCount: { flexShrink: 1, fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"], textAlign: "right" },
  evidenceRow: { gap: 10 },
  evidenceTile: { height: 214, overflow: "hidden", borderWidth: 1, borderRadius: 16 },
  evidenceImage: { width: "100%", height: "100%" },
  evidenceUnavailable: { flex: 1, alignItems: "center", justifyContent: "center", gap: 9 },
  evidenceUnavailableText: { fontSize: 14, fontWeight: "600" },
  emptyMedia: { minHeight: 150, borderWidth: 1, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyMediaText: { fontSize: 14 },
  timelineCard: { overflow: "hidden", borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingTop: 18 },
  timelineRow: { flexDirection: "row", gap: 12 },
  timelineRail: { width: 34, alignItems: "center" },
  timelineMarker: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  timelineLine: { width: 2, flex: 1, minHeight: 30, marginVertical: 4 },
  timelineCopy: { flex: 1, minHeight: 76, paddingTop: 3, paddingBottom: 17 },
  timelineTitle: { fontSize: 16, fontWeight: "700", lineHeight: 21 },
  timelineMeta: { marginTop: 4, fontSize: 12, lineHeight: 17 },
  resolutionNote: { marginTop: 10, overflow: "hidden", borderRadius: 10, padding: 11, fontSize: 14, lineHeight: 20 },
  loadingContent: { padding: 20, gap: 16 },
  loadingHeader: { width: "42%", height: 24, alignSelf: "center", borderRadius: 8 },
  loadingStatus: { height: 164, marginTop: 20, borderWidth: 1, borderRadius: 16 },
  loadingImage: { height: 214, borderRadius: 16 },
  loadingMap: { height: 224, borderWidth: 1, borderRadius: 16 },
  unavailableContent: { flex: 1, paddingHorizontal: 20 },
  unavailableCard: { marginTop: 48, padding: 24, borderWidth: 1, borderRadius: 16, alignItems: "center", gap: 14 },
  unavailableTitle: { fontSize: 21, fontWeight: "800" },
  unavailableCopy: { maxWidth: 300, fontSize: 14, lineHeight: 20, textAlign: "center" },
});
