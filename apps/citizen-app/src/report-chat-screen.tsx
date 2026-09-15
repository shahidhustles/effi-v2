import { useAuth } from "@clerk/expo";
import {
  useEveAgentRuntime,
  useEveError,
  useEveReset,
} from "@assistant-ui/eve";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  makeAssistantToolUI,
  MessagePrimitive,
  ThreadPrimitive,
  type ToolCallMessagePartProps,
  useAui,
  useAuiState,
} from "@assistant-ui/react-native";
import { randomUUID } from "expo-crypto";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import {
  Clock3,
  Check,
  CheckCircle2,
  ImagePlus,
  LocateFixed,
  MapPin,
  PencilLine,
  Play,
  Send,
  SquarePen,
  X,
} from "lucide-react-native";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { botGatewayConfig } from "@/bot-gateway-config";
import { EffiMark } from "@/components/effi-mark";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";
import {
  readableUploadError,
  selectedReportMedia,
  type ReportMediaKind,
} from "@/report-media";

const OPENING_MESSAGE =
  "Hi, I'm Effi. Tell me what happened, and I'll help you report it.";
const gateway = botGatewayConfig(process.env.EXPO_PUBLIC_EFFI_BOT_GATEWAY_URL);

type RegisterMediaArgs = {
  storageId: string;
  kind: ReportMediaKind;
  mediaType: string;
  fileName: string;
  sizeBytes: number;
  assessmentKey: string;
};

type RegisteredMedia = {
  mediaId: string;
  assessmentKey: string;
  kind: ReportMediaKind;
  fileName: string;
};

type CapturedLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
};

type AskQuestionArgs = {
  prompt?: string;
  options?: readonly { id: string; label?: string }[];
  allowFreeform?: boolean;
};

type SubmitAppReportArgs = {
  issue?: string;
  category?:
    "roads" | "sanitation" | "water" | "lighting" | "drainage" | "other";
  latitude?: number;
  longitude?: number;
  mediaIds?: readonly string[];
  summary?: string;
  recommendedPriority?: "critical" | "high" | "medium" | "low";
  priorityReasons?: readonly string[];
};

type SubmittedReport = {
  reportId: string;
  caseId: string;
  reportNumber: string;
  alreadySubmitted: boolean;
};

type ReportFlowContextValue = {
  location: CapturedLocation | null;
  setLocation: (location: CapturedLocation | null) => void;
};

const ReportFlowContext = createContext<ReportFlowContextValue | null>(null);

const useReportFlow = (): ReportFlowContextValue => {
  const value = useContext(ReportFlowContext);
  if (!value) throw new Error("Report flow controls are unavailable.");
  return value;
};

const generateReportMediaUploadUrl = makeFunctionReference<
  "mutation",
  Record<string, never>,
  string
>("citizen:generateReportMediaUploadUrl");
const registerReportMedia = makeFunctionReference<
  "mutation",
  RegisterMediaArgs,
  { mediaId: string; url: string }
>("citizen:registerReportMedia");
const submitAppReport = makeFunctionReference<
  "mutation",
  {
    clientSubmissionId: string;
    issue: string;
    category: NonNullable<SubmitAppReportArgs["category"]>;
    location: { latitude: number; longitude: number };
    mediaIds: string[];
    summary: string;
    recommendedPriority: NonNullable<
      SubmitAppReportArgs["recommendedPriority"]
    >;
    priorityReasons: string[];
  },
  SubmittedReport
>("citizen:submitAppReport");

const isLocationQuestion = (args: AskQuestionArgs): boolean =>
  args.options?.some((option) => option.id === "share_location") === true;

function LocationQuestionCard({
  args,
  approval,
  respondToApproval,
}: ToolCallMessagePartProps<AskQuestionArgs, unknown>) {
  const { location, setLocation } = useReportFlow();
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navy = useColor("civicNavy");
  const foreground = useColor("foreground");
  const muted = useColor("textMuted");
  const blue = useColor("submittedAccent");
  const blueTint = useColor("submittedTint");
  const border = useColor("homeBorder");
  const surface = useColor("homeSurface");
  const white = useColor("civicHeaderForeground");
  const red = useColor("red");
  const pending = approval?.approved === undefined;

  const shareLocation = useCallback(async () => {
    setError(null);
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setError(
          "Location access was not allowed. Your report has not moved on.",
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const captured: CapturedLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        capturedAt: new Date(position.timestamp).toISOString(),
      };
      setLocation(captured);
      await respondToApproval({
        approved: true,
        text: JSON.stringify({
          source: "current_gps",
          latitude: captured.latitude,
          longitude: captured.longitude,
          accuracyMeters: captured.accuracy,
          capturedAt: captured.capturedAt,
        }),
      });
    } catch {
      setError(
        "Current location could not be detected. Try again when GPS is available.",
      );
    } finally {
      setIsLocating(false);
    }
  }, [respondToApproval, setLocation]);

  return (
    <View
      style={[
        styles.toolCard,
        { backgroundColor: surface, borderColor: border },
      ]}
    >
      <View style={styles.toolTitleRow}>
        <View style={[styles.toolIcon, { backgroundColor: blueTint }]}>
          {location && !pending ? (
            <Check color={blue} size={20} strokeWidth={2.7} />
          ) : (
            <LocateFixed color={blue} size={20} strokeWidth={2.3} />
          )}
        </View>
        <View style={styles.toolTitleCopy}>
          <Text style={[styles.toolEyebrow, { color: blue }]}>
            REPORT LOCATION
          </Text>
          <Text style={[styles.toolTitle, { color: navy }]}>
            Add your current location
          </Text>
        </View>
      </View>
      <Text style={[styles.toolCopy, { color: foreground }]}>
        {args.prompt ?? "Share your current GPS location for this report."}
      </Text>
      <Text style={[styles.toolNote, { color: muted }]}>
        Effi captures it once for this report. Location is not tracked in the
        background.
      </Text>
      {error ? (
        <Text style={[styles.toolError, { color: red }]}>{error}</Text>
      ) : null}
      {pending ? (
        <Pressable
          accessibilityRole="button"
          disabled={isLocating}
          onPress={() => void shareLocation()}
          style={({ pressed }) => [
            styles.primaryToolButton,
            {
              backgroundColor: blue,
              opacity: pressed || isLocating ? 0.68 : 1,
            },
          ]}
        >
          {isLocating ? (
            <Spinner color={white} size="sm" variant="circle" />
          ) : (
            <MapPin color={white} size={19} strokeWidth={2.4} />
          )}
          <Text style={[styles.primaryToolButtonText, { color: white }]}>
            Share current location
          </Text>
        </Pressable>
      ) : (
        <View style={[styles.toolSuccess, { backgroundColor: blueTint }]}>
          <CheckCircle2 color={blue} size={18} strokeWidth={2.4} />
          <Text style={[styles.toolSuccessText, { color: navy }]}>
            Current location added
          </Text>
        </View>
      )}
    </View>
  );
}

function GenericQuestionCard({
  args,
  approval,
  respondToApproval,
}: ToolCallMessagePartProps<AskQuestionArgs, unknown>) {
  const [isAnswering, setIsAnswering] = useState(false);
  const surface = useColor("homeSurface");
  const border = useColor("homeBorder");
  const foreground = useColor("foreground");
  const blue = useColor("submittedAccent");
  const blueTint = useColor("submittedTint");
  const pending = approval?.approved === undefined;

  return (
    <View
      style={[
        styles.toolCard,
        { backgroundColor: surface, borderColor: border },
      ]}
    >
      <Text style={[styles.toolTitle, { color: foreground }]}>
        {args.prompt ?? "Choose an option"}
      </Text>
      {pending && args.options?.length ? (
        <View style={styles.questionOptions}>
          {args.options.map((option) => (
            <Pressable
              accessibilityRole="button"
              disabled={isAnswering}
              key={option.id}
              onPress={() => {
                setIsAnswering(true);
                void respondToApproval({ optionId: option.id }).finally(() =>
                  setIsAnswering(false),
                );
              }}
              style={({ pressed }) => [
                styles.questionOption,
                { backgroundColor: blueTint, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.questionOptionText, { color: blue }]}>
                {option.label ?? option.id}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function AskQuestionRenderer(
  props: ToolCallMessagePartProps<AskQuestionArgs, unknown>,
) {
  return isLocationQuestion(props.args) ? (
    <LocationQuestionCard {...props} />
  ) : (
    <GenericQuestionCard {...props} />
  );
}

function validSubmitArgs(
  args: SubmitAppReportArgs,
): args is Required<SubmitAppReportArgs> {
  return Boolean(
    args.issue?.trim() &&
    args.category &&
    Number.isFinite(args.latitude) &&
    Number.isFinite(args.longitude) &&
    args.mediaIds?.length &&
    args.summary?.trim() &&
    args.recommendedPriority &&
    args.priorityReasons?.length,
  );
}

function SubmitReportCard({
  args,
  toolCallId,
  approval,
  isError,
  respondToApproval,
}: ToolCallMessagePartProps<SubmitAppReportArgs, unknown>) {
  const { location } = useReportFlow();
  const submit = useMutation(submitAppReport);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedReport | null>(null);
  const [edited, setEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navy = useColor("civicNavy");
  const foreground = useColor("foreground");
  const muted = useColor("textMuted");
  const blue = useColor("submittedAccent");
  const blueTint = useColor("submittedTint");
  const green = useColor("green");
  const surface = useColor("homeSurface");
  const border = useColor("homeBorder");
  const white = useColor("civicHeaderForeground");
  const red = useColor("red");
  const pending = approval?.approved === undefined && !edited;

  const approve = useCallback(async () => {
    if (!location || !validSubmitArgs(args)) {
      setError(
        "The report is missing verified information. Ask Effi to review it again.",
      );
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const created = await submit({
        clientSubmissionId: toolCallId,
        issue: args.issue,
        category: args.category,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        mediaIds: [...args.mediaIds],
        summary: args.summary,
        recommendedPriority: args.recommendedPriority,
        priorityReasons: [...args.priorityReasons],
      });
      setSubmitted(created);
      await respondToApproval({ approved: true });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The report could not be submitted. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [args, location, respondToApproval, submit, toolCallId]);

  const edit = useCallback(async () => {
    setError(null);
    setEdited(true);
    try {
      await respondToApproval({
        approved: false,
        reason: "The citizen asked to edit the report information.",
      });
    } catch (cause) {
      setEdited(false);
      setError(
        cause instanceof Error
          ? cause.message
          : "Effi could not reopen the report. Try again.",
      );
    }
  }, [respondToApproval]);

  if (submitted || (approval?.approved === true && !isError)) {
    return (
      <View
        style={[
          styles.toolCard,
          { backgroundColor: surface, borderColor: border },
        ]}
      >
        <View style={styles.submittedRow}>
          <CheckCircle2 color={green} size={24} strokeWidth={2.3} />
          <View style={styles.toolTitleCopy}>
            <Text style={[styles.toolTitle, { color: navy }]}>
              Report submitted
            </Text>
            {submitted ? (
              <Text style={[styles.reportNumber, { color: muted }]}>
                {submitted.reportNumber}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.toolCard,
        styles.reviewCard,
        { backgroundColor: surface, borderColor: border },
      ]}
    >
      <View style={styles.toolTitleRow}>
        <View style={[styles.toolIcon, { backgroundColor: blueTint }]}>
          <CheckCircle2 color={blue} size={20} strokeWidth={2.3} />
        </View>
        <View style={styles.toolTitleCopy}>
          <Text style={[styles.toolEyebrow, { color: blue }]}>
            FINAL REVIEW
          </Text>
          <Text style={[styles.toolTitle, { color: navy }]}>
            Ready to submit
          </Text>
        </View>
      </View>
      <View style={styles.reviewSection}>
        <Text style={[styles.reviewLabel, { color: muted }]}>PROBLEM</Text>
        <Text style={[styles.reviewValue, { color: foreground }]}>
          {args.issue ?? "Report details are incomplete"}
        </Text>
      </View>
      <View style={[styles.reviewFacts, { borderColor: border }]}>
        <View style={styles.reviewFact}>
          <Text style={[styles.reviewLabel, { color: muted }]}>CATEGORY</Text>
          <Text style={[styles.reviewFactValue, { color: foreground }]}>
            {args.category ?? "—"}
          </Text>
        </View>
        <View
          style={[
            styles.reviewFact,
            styles.reviewFactBorder,
            { borderColor: border },
          ]}
        >
          <Text style={[styles.reviewLabel, { color: muted }]}>EVIDENCE</Text>
          <Text style={[styles.reviewFactValue, { color: foreground }]}>
            {args.mediaIds?.length ?? 0} file
            {args.mediaIds?.length === 1 ? "" : "s"}
          </Text>
        </View>
      </View>
      <View style={[styles.locationAttached, { backgroundColor: blueTint }]}>
        <MapPin color={blue} size={18} strokeWidth={2.4} />
        <View style={styles.toolTitleCopy}>
          <Text style={[styles.locationAttachedTitle, { color: navy }]}>
            Current GPS location attached
          </Text>
          <Text style={[styles.locationAttachedCopy, { color: muted }]}>
            One precise location will be saved with this report.
          </Text>
        </View>
      </View>
      {error ? (
        <Text style={[styles.toolError, { color: red }]}>{error}</Text>
      ) : null}
      {pending ? (
        <View style={styles.reviewActions}>
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => void approve()}
            style={({ pressed }) => [
              styles.primaryToolButton,
              {
                backgroundColor: blue,
                opacity: pressed || isSubmitting ? 0.68 : 1,
              },
            ]}
          >
            {isSubmitting ? (
              <Spinner color={white} size="sm" variant="circle" />
            ) : (
              <Check color={white} size={19} strokeWidth={2.6} />
            )}
            <Text style={[styles.primaryToolButtonText, { color: white }]}>
              {isSubmitting ? "Submitting..." : "Approve & submit"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => void edit()}
            style={styles.editToolButton}
          >
            <PencilLine color={blue} size={18} strokeWidth={2.3} />
            <Text style={[styles.editToolButtonText, { color: blue }]}>
              Edit information
            </Text>
          </Pressable>
        </View>
      ) : (
        <Text style={[styles.toolNote, { color: muted }]}>
          Effi will ask what you want to change.
        </Text>
      )}
    </View>
  );
}

const AskQuestionToolUI = makeAssistantToolUI<AskQuestionArgs, unknown>({
  toolName: "ask_question",
  render: AskQuestionRenderer,
});

const SubmitAppReportToolUI = makeAssistantToolUI<SubmitAppReportArgs, unknown>(
  {
    toolName: "submit_app_report",
    render: SubmitReportCard,
  },
);

function MissingGateway() {
  const canvas = useColor("homeCanvas");
  const foreground = useColor("foreground");
  const muted = useColor("textMuted");

  return (
    <SafeAreaView
      style={[styles.configurationScreen, { backgroundColor: canvas }]}
    >
      <EffiMark size={56} />
      <Text variant="title" style={{ color: foreground }}>
        Effi chat needs the bot gateway
      </Text>
      <Text style={[styles.configurationCopy, { color: muted }]}>
        Set EXPO_PUBLIC_EFFI_BOT_GATEWAY_URL to the reachable Eve server URL,
        then restart Expo.
      </Text>
      {gateway.kind === "invalid" ? (
        <Text style={[styles.configurationValue, { color: muted }]}>
          {gateway.value}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}

function EffiHeader() {
  const reset = useEveReset();
  const { setLocation } = useReportFlow();
  const navy = useColor("civicNavy");
  const blue = useColor("submittedAccent");
  const blueTint = useColor("submittedTint");
  const green = useColor("green");
  const muted = useColor("textMuted");
  const surface = useColor("homeSurface");
  const border = useColor("homeBorder");

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: surface, borderBottomColor: border },
      ]}
    >
      <Pressable
        accessibilityLabel="Recent chats are not available yet"
        accessibilityRole="button"
        disabled
        style={styles.headerAction}
      >
        <Clock3 color={muted} size={25} strokeWidth={2.1} />
      </Pressable>

      <View style={styles.identity}>
        <EffiMark size={42} />
        <View>
          <Text style={[styles.identityName, { color: navy }]}>Effi</Text>
          <View style={styles.presenceRow}>
            <View style={[styles.presenceDot, { backgroundColor: green }]} />
            <Text style={[styles.identityStatus, { color: muted }]}>
              Here to help
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        accessibilityLabel="Start a new chat"
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => {
          setLocation(null);
          reset();
        }}
        style={({ pressed }) => [
          styles.headerAction,
          { backgroundColor: blueTint, opacity: pressed ? 0.65 : 1 },
        ]}
      >
        <SquarePen color={blue} size={23} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

function OpeningMessage() {
  const surface = useColor("homeSurface");
  const border = useColor("homeBorder");
  const foreground = useColor("foreground");
  const muted = useColor("textMuted");

  return (
    <View style={styles.assistantRow}>
      <View style={styles.avatar}>
        <EffiMark size={34} />
      </View>
      <View style={styles.messageColumn}>
        <View
          style={[
            styles.assistantBubble,
            { backgroundColor: surface, borderColor: border },
          ]}
        >
          <Text style={[styles.messageText, { color: foreground }]}>
            {OPENING_MESSAGE}
          </Text>
        </View>
        <Text style={[styles.messageMeta, { color: muted }]}>Now</Text>
      </View>
    </View>
  );
}

function ChatMessage() {
  const role = useAuiState((state) => state.message.role);
  const surface = useColor("homeSurface");
  const border = useColor("homeBorder");
  const foreground = useColor("foreground");
  const blue = useColor("submittedAccent");
  const white = useColor("civicHeaderForeground");

  if (role === "system") return null;
  const isUser = role === "user";

  return (
    <MessagePrimitive.Root
      style={isUser ? styles.userRow : styles.assistantRow}
    >
      {!isUser ? (
        <View style={styles.avatar}>
          <EffiMark size={34} />
        </View>
      ) : null}
      <View
        style={[
          isUser ? styles.userBubble : styles.assistantBubble,
          isUser
            ? { backgroundColor: blue }
            : { backgroundColor: surface, borderColor: border },
        ]}
      >
        {isUser ? (
          <MessagePrimitive.Attachments>
            {({ attachment }) => <MessageAttachment attachment={attachment} />}
          </MessagePrimitive.Attachments>
        ) : null}
        <MessagePrimitive.Content
          renderText={({ part }) => (
            <Text
              style={[
                styles.messageText,
                { color: isUser ? white : foreground },
              ]}
            >
              {part.text}
            </Text>
          )}
        />
      </View>
    </MessagePrimitive.Root>
  );
}

function attachmentUrl(attachment: {
  content?: readonly unknown[];
}): string | undefined {
  const part = attachment.content?.find(
    (value): value is { type: "file"; data: string } =>
      typeof value === "object" &&
      value !== null &&
      "type" in value &&
      value.type === "file" &&
      "data" in value &&
      typeof value.data === "string",
  );
  return part?.data;
}

function MessageAttachment({
  attachment,
}: {
  attachment: {
    type: string;
    name: string;
    content?: readonly unknown[];
  };
}) {
  const muted = useColor("textMuted");
  const tint = useColor("submittedTint");
  const url = attachmentUrl(attachment);
  const isImage = attachment.type === "image" && url;

  return (
    <View style={[styles.sentAttachment, { backgroundColor: tint }]}>
      {isImage ? (
        <Image contentFit="cover" source={url} style={styles.attachmentImage} />
      ) : (
        <View style={styles.videoPreview}>
          <Play color={muted} fill={muted} size={24} />
        </View>
      )}
      <Text numberOfLines={1} style={[styles.attachmentName, { color: muted }]}>
        {attachment.name}
      </Text>
    </View>
  );
}

function TypingIndicator() {
  const isWaitingForContent = useAuiState((state) => {
    if (!state.thread.isRunning) return false;
    const latestMessage = state.thread.messages.at(-1);
    return (
      latestMessage?.role !== "assistant" || latestMessage.content.length === 0
    );
  });
  const surface = useColor("homeSurface");
  const border = useColor("homeBorder");
  const blue = useColor("submittedAccent");

  if (!isWaitingForContent) return null;

  return (
    <View accessibilityLabel="Effi is responding" style={styles.assistantRow}>
      <View style={styles.avatar}>
        <EffiMark size={34} />
      </View>
      <View
        style={[
          styles.typingBubble,
          { backgroundColor: surface, borderColor: border },
        ]}
      >
        <Spinner color={blue} size="sm" speed="fast" variant="dots" />
      </View>
    </View>
  );
}

function EveErrorNotice() {
  const error = useEveError();
  const red = useColor("red");
  const redSurface = useColor("progressTint");
  if (!error) return null;

  return (
    <View
      accessibilityRole="alert"
      style={[styles.errorNotice, { backgroundColor: redSurface }]}
    >
      <Text style={[styles.errorText, { color: red }]}>
        {"Effi couldn't reply. Check the bot gateway and try again."}
      </Text>
    </View>
  );
}

function ChatComposer() {
  const aui = useAui();
  const isRunning = useAuiState((state) => state.thread.isRunning);
  const canSend = useAuiState((state) => state.composer.canSend);
  const attachments = useAuiState((state) => state.composer.attachments);
  const generateUploadUrl = useMutation(generateReportMediaUploadUrl);
  const registerMedia = useMutation(registerReportMedia);
  const [registeredMedia, setRegisteredMedia] = useState<
    Record<string, RegisteredMedia>
  >({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const surface = useColor("homeSurface");
  const border = useColor("homeBorder");
  const foreground = useColor("foreground");
  const muted = useColor("textMuted");
  const blue = useColor("submittedAccent");
  const white = useColor("civicHeaderForeground");
  const red = useColor("red");
  const errorSurface = useColor("progressTint");

  const pickMedia = useCallback(async () => {
    setUploadError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: false,
      quality: 0.9,
      videoMaxDuration: 30,
    });
    if (result.canceled || !result.assets[0]) return;

    setIsUploading(true);
    try {
      const selected = selectedReportMedia(result.assets[0]);
      const uploadUrl = await generateUploadUrl({});
      const localResponse = await fetch(selected.uri);
      if (!localResponse.ok)
        throw new Error("The selected file could not be read.");
      const blob = await localResponse.blob();
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "content-type": selected.mediaType },
        body: blob,
      });
      if (!uploadResponse.ok) throw new Error("The media upload failed.");
      const upload = (await uploadResponse.json()) as { storageId?: unknown };
      if (typeof upload.storageId !== "string") {
        throw new Error("The media upload returned an invalid response.");
      }
      const assessmentKey = randomUUID();
      const registered = await registerMedia({
        storageId: upload.storageId,
        kind: selected.kind,
        mediaType: selected.mediaType,
        fileName: selected.fileName,
        sizeBytes: selected.sizeBytes,
        assessmentKey,
      });
      await aui.composer.addAttachment({
        id: registered.mediaId,
        type: selected.kind,
        name: selected.fileName,
        contentType: selected.mediaType,
        content:
          selected.kind === "image"
            ? [
                {
                  type: "file",
                  data: registered.url,
                  mimeType: selected.mediaType,
                  filename: selected.fileName,
                  sourceType: "url",
                },
              ]
            : [],
      });
      setRegisteredMedia((current) => ({
        ...current,
        [registered.mediaId]: {
          mediaId: registered.mediaId,
          assessmentKey,
          kind: selected.kind,
          fileName: selected.fileName,
        },
      }));
    } catch (error) {
      setUploadError(readableUploadError(error));
    } finally {
      setIsUploading(false);
    }
  }, [aui, generateUploadUrl, registerMedia]);

  const removeAttachment = useCallback(
    async (attachmentId: string) => {
      await aui.composer.attachment({ id: attachmentId }).remove();
      setRegisteredMedia((current) => {
        const next = { ...current };
        delete next[attachmentId];
        return next;
      });
    },
    [aui],
  );

  const send = useCallback(() => {
    const media = attachments.flatMap((attachment) => {
      const registered = registeredMedia[attachment.id];
      return registered ? [registered] : [];
    });
    aui.composer.setRunConfig({
      custom: {
        effi_app: true,
        ...(media.length > 0 ? { effi_app_media: media } : {}),
      },
    });
    aui.composer.send();
    setRegisteredMedia({});
  }, [attachments, aui, registeredMedia]);

  return (
    <View
      style={[
        styles.composerDock,
        { backgroundColor: surface, borderTopColor: border },
      ]}
    >
      <EveErrorNotice />
      {uploadError ? (
        <View
          accessibilityRole="alert"
          style={[styles.errorNotice, { backgroundColor: errorSurface }]}
        >
          <Text style={[styles.errorText, { color: red }]}>{uploadError}</Text>
        </View>
      ) : null}
      {attachments.length > 0 ? (
        <View style={styles.composerAttachments}>
          <ComposerPrimitive.Attachments>
            {({ attachment }) => {
              const previewUrl = attachmentUrl(attachment);
              return (
                <View
                  style={[styles.pendingAttachment, { borderColor: border }]}
                >
                  {attachment.type === "image" && previewUrl ? (
                    <Image
                      contentFit="cover"
                      source={previewUrl}
                      style={styles.pendingAttachmentImage}
                    />
                  ) : (
                    <View
                      style={[
                        styles.pendingAttachmentImage,
                        styles.videoPreview,
                      ]}
                    >
                      <Play color={muted} fill={muted} size={21} />
                    </View>
                  )}
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.pendingAttachmentName,
                      { color: foreground },
                    ]}
                  >
                    {attachment.name}
                  </Text>
                  <Pressable
                    accessibilityLabel={`Remove ${attachment.name}`}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => void removeAttachment(attachment.id)}
                    style={[
                      styles.removeAttachment,
                      { backgroundColor: surface },
                    ]}
                  >
                    <X color={foreground} size={15} strokeWidth={2.5} />
                  </Pressable>
                </View>
              );
            }}
          </ComposerPrimitive.Attachments>
        </View>
      ) : null}
      <ComposerPrimitive.Root
        style={[styles.composer, { borderColor: border }]}
      >
        <Pressable
          accessibilityLabel="Attach image or video"
          accessibilityRole="button"
          disabled={isUploading || isRunning}
          hitSlop={6}
          onPress={() => void pickMedia()}
          style={({ pressed }) => [
            styles.attachButton,
            { opacity: pressed || isUploading || isRunning ? 0.45 : 1 },
          ]}
        >
          {isUploading ? (
            <Spinner color={blue} size="sm" variant="circle" />
          ) : (
            <ImagePlus color={blue} size={23} strokeWidth={2.2} />
          )}
        </Pressable>
        <ComposerPrimitive.Input
          accessibilityLabel="Message Effi"
          multiline
          placeholder="Describe the problem..."
          placeholderTextColor={muted}
          style={[styles.composerInput, { color: foreground }]}
        />
        {isRunning ? (
          <ComposerPrimitive.Cancel
            accessibilityLabel="Stop Effi"
            style={({ pressed }) => [
              styles.sendButton,
              { backgroundColor: blue, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <X color={white} size={22} strokeWidth={2.5} />
          </ComposerPrimitive.Cancel>
        ) : (
          <Pressable
            accessibilityLabel="Send message"
            accessibilityRole="button"
            disabled={!canSend || isUploading}
            onPress={send}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: blue,
                opacity: pressed || !canSend || isUploading ? 0.45 : 1,
              },
            ]}
          >
            <Send color={white} size={21} strokeWidth={2.4} />
          </Pressable>
        )}
      </ComposerPrimitive.Root>
    </View>
  );
}

function ConnectedReportChat({ host }: { host: string }) {
  const { getToken } = useAuth();
  const headers = useCallback(async () => {
    const token = await getToken();
    return token ? { authorization: `Bearer ${token}` } : {};
  }, [getToken]);
  const runtime = useEveAgentRuntime({ host, headers });
  const canvas = useColor("homeCanvas");
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const reportFlow = useMemo(() => ({ location, setLocation }), [location]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ReportFlowContext.Provider value={reportFlow}>
        <AskQuestionToolUI />
        <SubmitAppReportToolUI />
        <SafeAreaView
          edges={["top", "left", "right"]}
          style={[styles.screen, { backgroundColor: canvas }]}
        >
          <StatusBar style="dark" />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            enabled
            keyboardVerticalOffset={0}
            style={styles.screen}
          >
            <EffiHeader />
            <ThreadPrimitive.Root style={styles.thread}>
              <ThreadPrimitive.MessagesFlatList
                autoScroll
                contentContainerStyle={styles.messages}
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
                ListFooterComponent={TypingIndicator}
                ListHeaderComponent={OpeningMessage}
                scrollToBottomOnInitialize
                scrollToBottomOnRunStart
                scrollToBottomOnThreadSwitch
                showsVerticalScrollIndicator={false}
              >
                {() => <ChatMessage />}
              </ThreadPrimitive.MessagesFlatList>
              <ChatComposer />
            </ThreadPrimitive.Root>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ReportFlowContext.Provider>
    </AssistantRuntimeProvider>
  );
}

export function ReportChatScreen() {
  if (gateway.kind !== "ready") return <MissingGateway />;
  return <ConnectedReportChat host={gateway.host} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  thread: { flex: 1 },
  header: {
    minHeight: 76,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerAction: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  identity: { flexDirection: "row", alignItems: "center", gap: 9 },
  identityName: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.35,
    lineHeight: 25,
  },
  identityStatus: { fontSize: 13, fontWeight: "500", lineHeight: 17 },
  presenceRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  presenceDot: { width: 8, height: 8, borderRadius: 4 },
  messages: {
    flexGrow: 1,
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  assistantRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    alignSelf: "stretch",
    gap: 9,
  },
  userRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignSelf: "stretch",
  },
  avatar: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  messageColumn: { maxWidth: "81%" },
  assistantBubble: {
    maxWidth: "81%",
    borderWidth: 1,
    borderRadius: 18,
    borderTopLeftRadius: 7,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  userBubble: {
    maxWidth: "84%",
    borderRadius: 18,
    borderTopRightRadius: 7,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  messageText: { fontSize: 17, lineHeight: 24 },
  messageMeta: { marginTop: 5, marginLeft: 6, fontSize: 12, lineHeight: 16 },
  typingBubble: {
    minWidth: 54,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 16,
    borderTopLeftRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  composerDock: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composer: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 27,
    paddingLeft: 7,
    paddingRight: 5,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  composerInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    paddingTop: 10,
    paddingBottom: 9,
    fontSize: 17,
    lineHeight: 22,
  },
  attachButton: {
    width: 40,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  composerAttachments: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 9,
  },
  pendingAttachment: {
    width: 118,
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  pendingAttachmentImage: { width: "100%", height: 78 },
  pendingAttachmentName: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontSize: 12,
    lineHeight: 16,
  },
  removeAttachment: {
    position: "absolute",
    right: 5,
    top: 5,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  sentAttachment: {
    width: 190,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  attachmentImage: { width: "100%", height: 150 },
  attachmentName: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    fontSize: 12,
    lineHeight: 16,
  },
  videoPreview: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 78,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  errorNotice: {
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  errorText: { fontSize: 14, fontWeight: "600", lineHeight: 19 },
  toolCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 11,
  },
  reviewCard: { gap: 14 },
  toolTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  toolIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  toolTitleCopy: { flex: 1 },
  toolEyebrow: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  toolTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  toolCopy: { fontSize: 15, lineHeight: 21 },
  toolNote: { fontSize: 12, lineHeight: 17 },
  toolError: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  primaryToolButton: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryToolButtonText: { fontSize: 15, lineHeight: 20, fontWeight: "800" },
  toolSuccess: {
    minHeight: 44,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  toolSuccessText: { fontSize: 14, lineHeight: 19, fontWeight: "700" },
  questionOptions: { gap: 8 },
  questionOption: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 13,
  },
  questionOptionText: { fontSize: 14, lineHeight: 19, fontWeight: "700" },
  reviewSection: { gap: 4 },
  reviewLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  reviewValue: { fontSize: 16, lineHeight: 23, fontWeight: "600" },
  reviewFacts: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    paddingVertical: 11,
  },
  reviewFact: { flex: 1, gap: 3 },
  reviewFactBorder: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
  },
  reviewFactValue: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  locationAttached: {
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  locationAttachedTitle: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
  locationAttachedCopy: { fontSize: 11, lineHeight: 16 },
  reviewActions: { gap: 6 },
  editToolButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  editToolButtonText: { fontSize: 14, lineHeight: 19, fontWeight: "700" },
  submittedRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  reportNumber: { fontSize: 12, lineHeight: 17, fontWeight: "600" },
  configurationScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 28,
  },
  configurationCopy: { textAlign: "center", fontSize: 16, lineHeight: 23 },
  configurationValue: { textAlign: "center", fontSize: 13, lineHeight: 18 },
});
