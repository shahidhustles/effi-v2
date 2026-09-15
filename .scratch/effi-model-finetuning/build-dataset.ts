import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { caseBriefV1Schema } from "../../packages/ai-contracts/src/index.ts";
import { issueCategories, priorities, type IssueCategory, type Priority } from "../../packages/domain/src/index.ts";

const GENERATOR_VERSION = "effi-training-v4";
const RICH_VARIANTS_PER_LANGUAGE = 18;
const FIXED_VARIANTS_PER_LANGUAGE = 3;
const MODEL_ID = "Qwen/Qwen3-VL-4B-Instruct";
const MODEL_REVISION = "ebb281ec70b05090aa6165b016eac8ec08e71b17";
const ROOT = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(ROOT, "../..");
const DATASET_DIR = join(ROOT, "dataset");
const INSTRUCTIONS = readFileSync(join(REPO_ROOT, "apps/bot-gateway/agent/instructions.md"), "utf8").trim();

type Language = "en" | "hi" | "hinglish";
type ToolName = "assess_staged_image" | "record_report_interpretation" | "ask_question" | "prepare_submission";
type ToolCall = { id: string; type: "function"; function: { name: ToolName; arguments: Record<string, unknown> } };
type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image"; image: string };
type Message =
  | { role: "system"; content: string }
  | { role: "user"; content: string | Array<TextPart | ImagePart> }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; name: ToolName; tool_call_id: string; content: string };
type FixtureState = {
  issueKnown: boolean;
  exactLocationKnown: boolean;
  acceptedAttachmentIds: string[];
  interpretationRecorded: boolean;
  explicitlyConfirmed: boolean;
  cancelled: boolean;
};
type ConfirmedInterpretation = { issue: string; category: IssueCategory };
type DatasetRow = {
  id: string;
  generator_version: typeof GENERATOR_VERSION;
  model: { id: typeof MODEL_ID; revision: typeof MODEL_REVISION };
  source_category: "sanitized_project_demo_synthetic";
  language: Language;
  scenario_family: string;
  fact_fingerprint: string;
  priority_label: Priority | null;
  loss_policy: "assistant_messages_only";
  known_source_message_ids: string[];
  known_attachment_ids: string[];
  initial_state: FixtureState;
  confirmed_interpretation: ConfirmedInterpretation | null;
  tools: typeof TOOL_DEFINITIONS;
  messages: Message[];
};

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "assess_staged_image",
      description: "Record your assessment of a staged image that is already attached to the citizen's message. Call once with the verdict after judging the photo you can see directly.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["attachmentId", "assessment"],
        properties: {
          attachmentId: { type: "string", minLength: 1 },
          assessment: { type: "string", enum: ["satisfactory", "insufficient"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_report_interpretation",
      description: "Record the report interpretation the citizen will confirm: the exact issue text and category. Call it right before presenting the interpretation for confirmation, both initially and after every correction, so the frozen record matches what the citizen sees.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["issue", "category"],
        properties: {
          issue: { type: "string", minLength: 1, maxLength: 500 },
          category: { type: "string", enum: [...issueCategories] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_question",
      description: "Pause and ask the citizen one question, with optional choices.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["prompt"],
        properties: {
          prompt: { type: "string", minLength: 1 },
          options: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "label"],
              properties: { id: { type: "string" }, label: { type: "string" } },
            },
          },
          allowFreeform: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_submission",
      description: "Prepare an immutable pending civic-report submission after explicit citizen confirmation. Author only the short evidence-backed case brief with priority reasons and citations to persisted message IDs or accepted attachment IDs.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["summary", "category", "priority", "citations"],
        properties: {
          summary: { type: "string", minLength: 1, maxLength: 280 },
          category: { type: "string", enum: [...issueCategories] },
          priority: {
            type: "object",
            additionalProperties: false,
            required: ["priority", "reasons"],
            properties: {
              priority: { type: "string", enum: [...priorities] },
              reasons: { type: "array", minItems: 1, maxItems: 5, items: { type: "string", minLength: 1 } },
            },
          },
          citations: {
            type: "array",
            minItems: 1,
            maxItems: 10,
            items: {
              oneOf: [
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["kind", "sourceMessageId", "explanation"],
                  properties: {
                    kind: { const: "transcript_message" },
                    sourceMessageId: { type: "string", minLength: 1 },
                    explanation: { type: "string", minLength: 1 },
                  },
                },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["kind", "attachmentId", "explanation"],
                  properties: {
                    kind: { const: "accepted_evidence" },
                    attachmentId: { type: "string", minLength: 1 },
                    explanation: { type: "string", minLength: 1 },
                  },
                },
              ],
            },
          },
        },
      },
    },
  },
] as const;

const languageCopy = {
  en: {
    missingIssue: "Please describe the civic issue you want to report.",
    missingPhoto: "Please send one clear photo that shows the issue.",
    missingLocation: "Please share your current GPS location or select the exact pin on the map.",
    replacePhoto: "That photo is too blurred to verify the issue. Please send a clear, relevant replacement.",
    irrelevantPhoto: "That photo does not show the issue. Please send a clear photo of the actual problem.",
    confirm: (issue: string, category: IssueCategory) => `Issue: ${issue}\nCategory: ${category}\nThe exact pin and one accepted photo are recorded. Is this correct?`,
    ambiguous: "I still need an explicit choice. Reply Confirm to submit this interpretation or Edit to correct it.",
    cancelled: "This report draft has been cancelled. Nothing was submitted.",
    final: "Your report is ready. Complete registration using this secure link: <claim-link-redacted>",
  },
  hi: {
    missingIssue: "कृपया बताइए कि आप कौन-सी नागरिक समस्या दर्ज करना चाहते हैं।",
    missingPhoto: "कृपया समस्या दिखाने वाली एक साफ़ तस्वीर भेजें।",
    missingLocation: "कृपया अपनी मौजूदा GPS लोकेशन साझा करें या नक्शे पर सही पिन चुनें।",
    replacePhoto: "यह तस्वीर समस्या की पुष्टि के लिए बहुत धुंधली है। कृपया साफ़ और संबंधित तस्वीर दोबारा भेजें।",
    irrelevantPhoto: "यह तस्वीर समस्या नहीं दिखाती। कृपया असली समस्या की साफ़ तस्वीर भेजें।",
    confirm: (issue: string, category: IssueCategory) => `समस्या: ${issue}\nश्रेणी: ${category}\nसही पिन और एक स्वीकार की गई तस्वीर दर्ज है। क्या यह सही है?`,
    ambiguous: "मुझे स्पष्ट चुनाव चाहिए। इस विवरण को भेजने के लिए Confirm या सुधार के लिए Edit लिखें।",
    cancelled: "यह रिपोर्ट ड्राफ्ट रद्द कर दिया गया है। कुछ भी जमा नहीं हुआ।",
    final: "आपकी रिपोर्ट तैयार है। इस सुरक्षित लिंक से पंजीकरण पूरा करें: <claim-link-redacted>",
  },
  hinglish: {
    missingIssue: "Please bataiye ki aap kaunsi civic problem report karna chahte hain.",
    missingPhoto: "Please issue ki ek clear photo bhejiye.",
    missingLocation: "Please current GPS location share kijiye ya map par exact pin select kijiye.",
    replacePhoto: "Photo bahut blurred hai, issue verify nahi ho raha. Please ek clear aur relevant photo dobara bhejiye.",
    irrelevantPhoto: "Yeh photo issue nahi dikhati. Please actual problem ki clear photo bhejiye.",
    confirm: (issue: string, category: IssueCategory) => `Issue: ${issue}\nCategory: ${category}\nExact pin aur ek accepted photo record ho chuki hai. Kya yeh sahi hai?`,
    ambiguous: "Mujhe explicit choice chahiye. Submit karne ke liye Confirm ya correction ke liye Edit reply kijiye.",
    cancelled: "Report draft cancel ho gaya hai. Kuch submit nahi hua.",
    final: "Aapki report ready hai. Is secure link se registration complete kijiye: <claim-link-redacted>",
  },
} satisfies Record<Language, Record<string, unknown>>;

type IssueSet = Record<Language, readonly [string, string, string]>;
const issues = {
  roadsHigh: {
    en: [
      "A deep pothole outside the city hospital entrance is forcing vehicles to swerve, and two bike riders have fallen.",
      "Two riders have fallen because traffic swerves around a deep pothole at the hospital's main gate.",
      "There is a deep road crater by the hospital entrance. Drivers turn suddenly to avoid it and two motorcyclists have fallen.",
    ],
    hi: [
      "शहर के अस्पताल के मुख्य गेट के बाहर गहरा गड्ढा है। गाड़ियां अचानक मुड़ रही हैं और दो बाइक सवार गिर चुके हैं।",
      "अस्पताल के प्रवेश द्वार पर गहरे गड्ढे से बचने के लिए वाहन मुड़ते हैं और दो बाइक सवार गिर गए हैं।",
      "अस्पताल के मुख्य रास्ते पर बड़ा गड्ढा है। अचानक मुड़ती गाड़ियों के कारण दो बाइक सवार गिर चुके हैं।",
    ],
    hinglish: [
      "City hospital ke main gate ke bahar deep pothole hai. Vehicles achanak swerve kar rahe hain aur do bike riders gir chuke hain.",
      "Hospital entrance par gehra pothole hai, traffic usse bachne ke liye mudta hai aur do riders fall kar chuke hain.",
      "Hospital ke main road par bada gaddha hai. Gaadiyan sudden turn leti hain aur do bikers gir chuke hain.",
    ],
  },
  roadsLow: {
    en: ["A small shallow pothole at the quiet lane edge causes a minor bump but does not obstruct traffic.", "There is a minor shallow road chip beside the curb, with no traffic blockage or safety incident.", "A small localized pothole near the curb is inconvenient but vehicles can pass normally."],
    hi: ["शांत गली के किनारे छोटा उथला गड्ढा है। हल्का झटका लगता है, लेकिन यातायात नहीं रुकता।", "सड़क के किनारे छोटा गड्ढा है। रास्ता खुला है और कोई सुरक्षा घटना नहीं हुई।", "किनारे का छोटा स्थानीय गड्ढा असुविधाजनक है, लेकिन वाहन सामान्य रूप से निकल रहे हैं।"],
    hinglish: ["Quiet lane ke edge par chhota shallow pothole hai. Minor bump hai, traffic block nahi hota.", "Curb ke paas chhota road chip hai, koi blockage ya safety incident nahi hai.", "Road edge par small pothole inconvenience hai, lekin vehicles normally pass kar rahe hain."],
  },
  roadsMediumMarket: {
    en: [
      "A wide pothole in the middle of the main market road is slowing traffic down, and vehicles are changing lanes to avoid it. No one has been hurt.",
      "Traffic on the market road slows to a crawl because of a wide pothole in the driving lane. There are no injuries or falls.",
      "A large pothole on the market road is making vehicles slow down and shift lanes. No accident has happened here.",
    ],
    hi: [
      "बाजार की मुख्य सड़क के बीच चौड़ा गड्ढा है, जिससे यातायात धीमा हो रहा है और वाहन कतराकर निकल रहे हैं। किसी को चोट नहीं लगी है।",
      "बाजार मार्ग पर चौड़े गड्ढे के कारण वाहन धीमे चल रहे हैं। कोई चोट या गिरने की घटना नहीं हुई है।",
      "बाजार की सड़क पर बड़ा गड्ढा वाहनों की गति धीमी कर रहा है और वे लेन बदल रहे हैं। यहां कोई दुर्घटना नहीं हुई है।",
    ],
    hinglish: [
      "Market road ke beech mein wide pothole hai, traffic slow ho raha hai aur vehicles kataar se nikal rahe hain. Kisi ko chot nahi lagi.",
      "Market road par wide pothole ki wajah se vehicles dheere chal rahe hain. Koi chot ya girne ki ghatna nahi hui.",
      "Market road ke bade pothole se vehicles slow aur lane change kar rahe hain. Yahan koi accident nahi hua.",
    ],
  },
  roadsHighJunction: {
    en: [
      "A deep pothole at the busy station road junction is forcing two-wheelers to swerve into the oncoming lane. No rider has fallen yet.",
      "Two-wheelers swerve sharply at the station junction to avoid a deep pothole, putting them in front of oncoming traffic.",
      "There is a deep pothole at the station road junction. Riders are moving into the opposite lane to avoid it during peak hours.",
    ],
    hi: [
      "स्टेशन रोड चौक पर गहरा गड्ढा है, जिससे दोपहिया वाहन सामने की लेन में मुड़ रहे हैं। अभी कोई सवार गिरा नहीं है।",
      "स्टेशन चौक पर गहरे गड्ढे से बचने के लिए दोपहिया अचानक काटते हैं और सामने वाले यातायात के पास आ जाते हैं।",
      "स्टेशन रोड जंक्शन पर गहरा गड्ढा है। व्यस्त समय में सवार उससे बचने के लिए विपरीत लेन में जा रहे हैं।",
    ],
    hinglish: [
      "Station road chowk par deep pothole hai, two-wheelers oncoming lane mein mud rahe hain. Abhi koi rider gira nahi hai.",
      "Station chowk par deep pothole se bachne ke liye two-wheelers achanak cut karte hain aur oncoming traffic ke paas aa jate hain.",
      "Station road junction par gehra pothole hai. Peak hours mein riders usse bachne ke liye opposite lane mein ja rahe hain.",
    ],
  },
  lightingCritical: {
    en: ["A streetlight pole has fallen and live exposed wires are sparking beside people on the road.", "A fallen light pole has exposed live wires that are sparking next to pedestrians.", "Live electrical wires from a collapsed streetlight are sparking on an active roadside."],
    hi: ["स्ट्रीट लाइट का खंभा गिर गया है और सड़क पर लोगों के पास खुले तारों से चिंगारी निकल रही है।", "गिरे हुए लाइट पोल के खुले बिजली के तार पैदल लोगों के पास चिंगारी छोड़ रहे हैं।", "टूटी स्ट्रीट लाइट के लाइव तार चलती सड़क के किनारे चिंगारी छोड़ रहे हैं।"],
    hinglish: ["Streetlight pole gir gaya hai aur road par logon ke paas exposed live wires spark kar rahe hain.", "Fallen light pole ke live wires pedestrians ke paas sparking kar rahe hain.", "Collapsed streetlight ke exposed wires active roadside par spark ho rahe hain."],
  },
  lightingMedium: {
    en: ["The streetlight in our area has been off for three days. The whole route is dark at night and people have trouble travelling through it.", "A residential stretch has stayed dark for three days because three streetlights are not working.", "Three lights on the neighborhood road have failed, making the route dark at night without an active electrical hazard."],
    hi: ["हमारे इलाके में तीन दिन से स्ट्रीट लाइट बंद है। रात में पूरा रास्ता अंधेरा रहता है और लोगों को आने जाने में परेशानी हो रही है।", "तीन स्ट्रीट लाइट खराब होने से रिहायशी रास्ता तीन दिन से रात में अंधेरा रहता है।", "मोहल्ले की सड़क की तीन लाइट बंद हैं। रात में रास्ता अंधेरा है, लेकिन कोई खुला बिजली खतरा नहीं है।"],
    hinglish: ["Hamare area mein streetlight teen din se band hai. Raat mein poora route dark rehta hai aur logon ko aane jaane mein problem ho rahi hai.", "Teen streetlights kaam nahi kar rahi, isliye residential stretch teen din se raat mein dark hai.", "Neighborhood road ki teen lights fail hain. Raat ko darkness hai, koi active electrical hazard nahi."],
  },
  drainageHigh: {
    en: ["The drain in front of our school is completely blocked and dirty water is filling the road. Children have to walk through it to reach school.", "A blocked drain outside the school is flooding the road with dirty water where children walk.", "Dirty drain water has covered the road at the school entrance, and pupils must cross it every day."],
    hi: ["हमारे स्कूल के सामने नाली पूरी तरह बंद है और गंदा पानी सड़क पर भर रहा है। बच्चों को उसी पानी से होकर स्कूल जाना पड़ रहा है।", "स्कूल के बाहर बंद नाली का गंदा पानी सड़क पर भर गया है और बच्चों को वहीं से चलना पड़ता है।", "स्कूल के प्रवेश द्वार पर नाली का गंदा पानी सड़क पर फैला है। बच्चों को रोज़ इसे पार करना पड़ रहा है।"],
    hinglish: ["Hamare school ke saamne drain poori tarah blocked hai aur dirty water road par bhar raha hai. Bachchon ko usi paani se school jana pad raha hai.", "School ke bahar blocked drain ka dirty water road flood kar raha hai jahan se bachche walk karte hain.", "School entrance par drain water road par phaila hai aur students ko roz usse cross karna padta hai."],
  },
  drainageCorrection: {
    en: ["This is sewage leaking from a broken drain near the market, not clean water from a burst pipe.", "Correction: the market road is flooded by sewage from a damaged drain, not a water-supply leak.", "The location is right, but the liquid is sewage from a broken drain rather than clean pipe water."],
    hi: ["यह बाजार के पास टूटी नाली से बहता सीवेज है, साफ़ पानी की पाइप नहीं।", "सुधार: बाजार की सड़क पर टूटी नाली का गंदा पानी है, पानी की सप्लाई का रिसाव नहीं।", "लोकेशन सही है, लेकिन यह साफ़ पाइप का पानी नहीं, टूटी नाली का सीवेज है।"],
    hinglish: ["Market ke paas broken drain se sewage leak ho raha hai, clean water pipe burst nahi hai.", "Correction: market road par damaged drain ka sewage hai, water-supply leak nahi.", "Location sahi hai, but liquid broken drain ka sewage hai, clean pipe water nahi."],
  },
} satisfies Record<string, IssueSet>;

const issueLeadIns = {
  en: [
    "",
    "Please record this report. ",
    "I want to report the following problem. ",
    "This is the issue I need the civic team to inspect. ",
    "Please add this exact problem to my report. ",
    "Here are the current facts. ",
  ],
  hi: [
    "",
    "कृपया यह शिकायत दर्ज करें। ",
    "मैं यह नागरिक समस्या दर्ज करना चाहता हूं। ",
    "नगर टीम को इस समस्या की जांच करनी चाहिए। ",
    "कृपया यही समस्या मेरी रिपोर्ट में लिखें। ",
    "अभी की सही जानकारी यह है। ",
  ],
  hinglish: [
    "",
    "Please yeh complaint record kijiye. ",
    "Main yeh civic problem report karna chahta hoon. ",
    "Civic team ko yeh issue inspect karna chahiye. ",
    "Please meri report mein yahi exact problem likhiye. ",
    "Current facts yeh hain. ",
  ],
} satisfies Record<Language, readonly [string, string, string, string, string, string]>;

const issueFor = (set: IssueSet, language: Language, variant: number): string => {
  const seed = set[language][variant % set[language].length];
  const leadIn = issueLeadIns[language][Math.floor(variant / set[language].length)];
  if (leadIn === undefined) throw new Error(`Missing issue lead-in for ${language} variant ${variant}`);
  return `${leadIn}${seed}`;
};

type RoadsFact = { fingerprint: string; priority: Priority; set: IssueSet };
const roadsFacts: readonly RoadsFact[] = [
  { fingerprint: "roads_high_hospital_pothole", priority: "high", set: issues.roadsHigh },
  { fingerprint: "roads_low_quiet_lane", priority: "low", set: issues.roadsLow },
  { fingerprint: "roads_medium_market_road", priority: "medium", set: issues.roadsMediumMarket },
  { fingerprint: "roads_high_station_junction", priority: "high", set: issues.roadsHighJunction },
];
const roadsFactFor = (variant: number): RoadsFact => {
  const fact = roadsFacts[variant % roadsFacts.length];
  if (!fact) throw new Error(`Missing roads fact for variant ${variant}`);
  return fact;
};

const context = (state: FixtureState, sources: string[], attachments: string[], interpretation: ConfirmedInterpretation | null) => [
  "Training fixture state, all identifiers are synthetic.",
  `issue_known=${state.issueKnown}`,
  `exact_location_pin_available=${state.exactLocationKnown}`,
  `accepted_attachment_ids=${state.acceptedAttachmentIds.join(",") || "none"}`,
  `interpretation_recorded=${state.interpretationRecorded}`,
  `explicitly_confirmed=${state.explicitlyConfirmed}`,
  `source_message_ids=${sources.join(",") || "none"}`,
  `staged_attachment_ids=${attachments.join(",") || "none"}`,
  `confirmed_interpretation_issue=${interpretation?.issue ?? "none"}`,
  `confirmed_interpretation_category=${interpretation?.category ?? "none"}`,
  "Never invent a source identifier or numeric coordinate.",
].join("\n");

const assistant = (content: string): Message => ({ role: "assistant", content });
const user = (text: string, image?: string): Message => ({
  role: "user",
  content: image ? [{ type: "text", text }, { type: "image", image }] : text,
});
const call = (id: string, name: ToolName, args: Record<string, unknown>): Message => ({
  role: "assistant",
  content: "",
  tool_calls: [{ id, type: "function", function: { name, arguments: args } }],
});
const result = (id: string, name: ToolName, content: string): Message => ({ role: "tool", name, tool_call_id: id, content });
const baseState = (overrides: Partial<FixtureState> = {}): FixtureState => ({
  issueKnown: false,
  exactLocationKnown: false,
  acceptedAttachmentIds: [],
  interpretationRecorded: false,
  explicitlyConfirmed: false,
  cancelled: false,
  ...overrides,
});

const confirmationArgs = (prompt: string) => ({
  prompt,
  options: [{ id: "confirm", label: "Confirm" }, { id: "edit", label: "Edit" }],
  allowFreeform: true,
});

const brief = (args: {
  issue: string;
  category: IssueCategory;
  priority: Priority;
  reasons: string[];
  messageId: string;
  attachmentId: string;
}) => ({
  summary: args.issue.slice(0, 280),
  category: args.category,
  priority: { priority: args.priority, reasons: args.reasons },
  citations: [
    { kind: "transcript_message", sourceMessageId: args.messageId, explanation: "The confirmed citizen message states the issue and impact." },
    { kind: "accepted_evidence", attachmentId: args.attachmentId, explanation: "The accepted photo shows the reported condition." },
  ],
});

type RowInput = Omit<DatasetRow, "generator_version" | "model" | "source_category" | "loss_policy" | "tools" | "messages" | "confirmed_interpretation"> & {
  confirmed_interpretation?: ConfirmedInterpretation | null;
  citizenMessage: Message;
  continuation: Message[];
};

const makeRow = (input: RowInput): DatasetRow => ({
  id: input.id,
  generator_version: GENERATOR_VERSION,
  model: { id: MODEL_ID, revision: MODEL_REVISION },
  source_category: "sanitized_project_demo_synthetic",
  language: input.language,
  scenario_family: input.scenario_family,
  fact_fingerprint: input.fact_fingerprint,
  priority_label: input.priority_label,
  loss_policy: "assistant_messages_only",
  known_source_message_ids: input.known_source_message_ids,
  known_attachment_ids: input.known_attachment_ids,
  initial_state: input.initial_state,
  confirmed_interpretation: input.confirmed_interpretation ?? null,
  tools: TOOL_DEFINITIONS,
  messages: [
    { role: "system", content: `${INSTRUCTIONS}\n\n${context(input.initial_state, input.known_source_message_ids, input.known_attachment_ids, input.confirmed_interpretation ?? null)}` },
    input.citizenMessage,
    ...input.continuation,
  ],
});

const rows: DatasetRow[] = [];
for (const language of ["en", "hi", "hinglish"] as const) {
  const copy = languageCopy[language];
  for (let variant = 0; variant < RICH_VARIANTS_PER_LANGUAGE; variant += 1) {
    const suffix = `${language}_${variant + 1}`;
    const sourceId = `msg_${suffix}`;
    const attachmentId = `att_${suffix}`;
    const potholeImage = variant % 2 === 0 ? "images/pothole-1.png" : "images/pothole-2.png";
    const blurredImage = "images/blurred-1.png";
    const unrelatedImage = "images/unrelated-1.png";

    if (variant < FIXED_VARIANTS_PER_LANGUAGE) {
      rows.push(makeRow({
        id: `issue_missing_${suffix}`,
        language,
        scenario_family: "issue_missing",
        fact_fingerprint: `issue_missing_${language}`,
        priority_label: null,
        known_source_message_ids: [sourceId],
        known_attachment_ids: [],
        initial_state: baseState(),
        citizenMessage: user(language === "hi" ? "मुझे शिकायत दर्ज करनी है।" : language === "hinglish" ? "Mujhe complaint file karni hai." : "I need to report something."),
        continuation: [assistant(copy.missingIssue)],
      }));
    }

    const roadsFact = roadsFactFor(variant);
    const roadIssue = issueFor(roadsFact.set, language, variant);
    rows.push(makeRow({
      id: `photo_missing_${suffix}`,
      language,
      scenario_family: "photo_missing",
      fact_fingerprint: roadsFact.fingerprint,
      priority_label: roadsFact.priority,
      known_source_message_ids: [sourceId],
      known_attachment_ids: [],
      initial_state: baseState({ issueKnown: true }),
      citizenMessage: user(roadIssue),
      continuation: [assistant(copy.missingPhoto)],
    }));

    if (variant < FIXED_VARIANTS_PER_LANGUAGE) {
      rows.push(makeRow({
        id: `location_missing_${suffix}`,
        language,
        scenario_family: "location_missing",
        fact_fingerprint: roadsFact.fingerprint,
        priority_label: roadsFact.priority,
        known_source_message_ids: [sourceId],
        known_attachment_ids: [attachmentId],
        initial_state: baseState({ issueKnown: true, acceptedAttachmentIds: [attachmentId] }),
        citizenMessage: user(language === "hi" ? "तस्वीर भेज दी है।" : language === "hinglish" ? "Photo bhej di hai." : "I sent the photo."),
        continuation: [assistant(copy.missingLocation)],
      }));
    }

    const completeState = baseState({ issueKnown: true, exactLocationKnown: true });
    const assessCall = `call_assess_${suffix}`;
    const recordCall = `call_record_${suffix}`;
    const questionCall = `call_question_${suffix}`;
    rows.push(makeRow({
      id: `satisfactory_photo_${suffix}`,
      language,
      scenario_family: "satisfactory_photo",
      fact_fingerprint: roadsFact.fingerprint,
      priority_label: roadsFact.priority,
      known_source_message_ids: [sourceId],
      known_attachment_ids: [attachmentId],
      initial_state: completeState,
      citizenMessage: user(language === "hi" ? "यह साफ़ तस्वीर है। सही पिन पहले साझा किया था।" : language === "hinglish" ? "Yeh clear photo hai. Exact pin pehle share kiya tha." : "Here is a clear photo. I already shared the exact pin.", potholeImage),
      continuation: [
        call(assessCall, "assess_staged_image", { attachmentId, assessment: "satisfactory" }),
        result(assessCall, "assess_staged_image", `Staged image ${attachmentId} assessed as satisfactory.`),
        call(recordCall, "record_report_interpretation", { issue: roadIssue, category: "roads" }),
        result(recordCall, "record_report_interpretation", "The interpretation is recorded with an exact location and one accepted photo."),
        call(questionCall, "ask_question", confirmationArgs(copy.confirm(roadIssue, "roads"))),
      ],
    }));

    for (const completeScenario of [
      { family: "drainage_photo", facts: issues.drainageHigh, category: "drainage" as const, priority: "high" as const, image: "images/drain-1.png" },
      { family: "lighting_medium_photo", facts: issues.lightingMedium, category: "lighting" as const, priority: "medium" as const, image: "images/streetlight-1.png" },
    ]) {
      const completeIssue = issueFor(completeScenario.facts, language, variant);
      const completeAttachmentId = `att_${completeScenario.family}_${suffix}`;
      const completeAssessCall = `call_assess_${completeScenario.family}_${suffix}`;
      const completeRecordCall = `call_record_${completeScenario.family}_${suffix}`;
      const completeQuestionCall = `call_question_${completeScenario.family}_${suffix}`;
      rows.push(makeRow({
        id: `${completeScenario.family}_${suffix}`,
        language,
        scenario_family: completeScenario.family,
        fact_fingerprint: completeScenario.family,
        priority_label: completeScenario.priority,
        known_source_message_ids: [sourceId],
        known_attachment_ids: [completeAttachmentId],
        initial_state: completeState,
        citizenMessage: user(completeIssue, completeScenario.image),
        continuation: [
          call(completeAssessCall, "assess_staged_image", { attachmentId: completeAttachmentId, assessment: "satisfactory" }),
          result(completeAssessCall, "assess_staged_image", `Staged image ${completeAttachmentId} assessed as satisfactory.`),
          call(completeRecordCall, "record_report_interpretation", { issue: completeIssue, category: completeScenario.category }),
          result(completeRecordCall, "record_report_interpretation", "The interpretation is recorded with an exact location and one accepted photo."),
          call(completeQuestionCall, "ask_question", confirmationArgs(copy.confirm(completeIssue, completeScenario.category))),
        ],
      }));
    }

    const badCall = `call_bad_${suffix}`;
    rows.push(makeRow({
      id: `bad_photo_${suffix}`,
      language,
      scenario_family: "bad_photo_recovery",
      fact_fingerprint: "lighting_critical_exposed_wires",
      priority_label: "critical",
      known_source_message_ids: [sourceId],
      known_attachment_ids: [attachmentId],
      initial_state: baseState({ issueKnown: true, exactLocationKnown: true }),
      citizenMessage: user(`${issueFor(issues.lightingCritical, language, variant)} ${language === "hi" ? "यह तस्वीर है।" : language === "hinglish" ? "Yeh photo hai." : "Here is the photo."}`, blurredImage),
      continuation: [
        call(badCall, "assess_staged_image", { attachmentId, assessment: "insufficient" }),
        result(badCall, "assess_staged_image", `Staged image ${attachmentId} assessed as insufficient.`),
        assistant(copy.replacePhoto),
      ],
    }));

    const unrelatedCall = `call_unrelated_${suffix}`;
    rows.push(makeRow({
      id: `unrelated_photo_${suffix}`,
      language,
      scenario_family: "unrelated_photo_recovery",
      fact_fingerprint: roadsFact.fingerprint,
      priority_label: roadsFact.priority,
      known_source_message_ids: [sourceId],
      known_attachment_ids: [attachmentId],
      initial_state: baseState({ issueKnown: true, exactLocationKnown: true }),
      citizenMessage: user(`${roadIssue} ${language === "hi" ? "यह तस्वीर है।" : language === "hinglish" ? "Yeh photo hai." : "Here is the photo."}`, unrelatedImage),
      continuation: [
        call(unrelatedCall, "assess_staged_image", { attachmentId, assessment: "insufficient" }),
        result(unrelatedCall, "assess_staged_image", `Staged image ${attachmentId} assessed as insufficient.`),
        assistant(copy.irrelevantPhoto),
      ],
    }));

    const replacementAttachmentId = `att_replacement_${suffix}`;
    const replacementAssessCall = `call_replacement_assess_${suffix}`;
    const replacementRecordCall = `call_replacement_record_${suffix}`;
    const replacementQuestionCall = `call_replacement_question_${suffix}`;
    rows.push(makeRow({
      id: `replacement_photo_${suffix}`,
      language,
      scenario_family: "bad_photo_replacement",
      fact_fingerprint: "lighting_critical_exposed_wires",
      priority_label: "critical",
      known_source_message_ids: [sourceId],
      known_attachment_ids: [replacementAttachmentId],
      initial_state: baseState({ issueKnown: true, exactLocationKnown: true }),
      citizenMessage: user(`${language === "hi" ? "यह साफ़ और संबंधित नई तस्वीर है।" : language === "hinglish" ? "Yeh clear aur relevant replacement photo hai." : "Here is a clear and relevant replacement photo."} ${issueFor(issues.lightingCritical, language, variant)}`, "images/streetlight-1.png"),
      continuation: [
        call(replacementAssessCall, "assess_staged_image", { attachmentId: replacementAttachmentId, assessment: "satisfactory" }),
        result(replacementAssessCall, "assess_staged_image", `Staged image ${replacementAttachmentId} assessed as satisfactory.`),
        call(replacementRecordCall, "record_report_interpretation", { issue: issueFor(issues.lightingCritical, language, variant), category: "lighting" }),
        result(replacementRecordCall, "record_report_interpretation", "The interpretation is recorded with an exact location and one accepted replacement photo."),
        call(replacementQuestionCall, "ask_question", confirmationArgs(copy.confirm(issueFor(issues.lightingCritical, language, variant), "lighting"))),
      ],
    }));

    const correction = issueFor(issues.drainageCorrection, language, variant);
    const correctedState = baseState({ issueKnown: true, exactLocationKnown: true, acceptedAttachmentIds: [attachmentId], interpretationRecorded: true });
    const correctionCall = `call_correction_${suffix}`;
    const correctionQuestion = `call_correction_question_${suffix}`;
    rows.push(makeRow({
      id: `correction_${suffix}`,
      language,
      scenario_family: "correction_before_confirmation",
      fact_fingerprint: "drainage_sewage_market",
      priority_label: "high",
      known_source_message_ids: [sourceId],
      known_attachment_ids: [attachmentId],
      initial_state: correctedState,
      citizenMessage: user(correction),
      continuation: [
        call(correctionCall, "record_report_interpretation", { issue: correction, category: "drainage" }),
        result(correctionCall, "record_report_interpretation", "The corrected interpretation is recorded with an exact location and one accepted photo."),
        call(correctionQuestion, "ask_question", confirmationArgs(copy.confirm(correction, "drainage"))),
      ],
    }));

    if (variant < FIXED_VARIANTS_PER_LANGUAGE) {
      rows.push(makeRow({
        id: `ambiguous_approval_${suffix}`,
        language,
        scenario_family: "ambiguous_approval",
        fact_fingerprint: roadsFact.fingerprint,
        priority_label: roadsFact.priority,
        known_source_message_ids: [sourceId],
        known_attachment_ids: [attachmentId],
        initial_state: baseState({ issueKnown: true, exactLocationKnown: true, acceptedAttachmentIds: [attachmentId], interpretationRecorded: true }),
        citizenMessage: user(language === "hi" ? "शायद ठीक है।" : language === "hinglish" ? "Shayad theek hai." : "I guess that looks okay."),
        continuation: [assistant(copy.ambiguous)],
      }));

      rows.push(makeRow({
        id: `cancellation_${suffix}`,
        language,
        scenario_family: "cancellation",
        fact_fingerprint: `cancel_${language}`,
        priority_label: null,
        known_source_message_ids: [sourceId],
        known_attachment_ids: [],
        initial_state: baseState({ issueKnown: true }),
        citizenMessage: user(language === "hi" ? "रद्द करें।" : language === "hinglish" ? "Cancel kar do." : "Cancel this report."),
        continuation: [assistant(copy.cancelled)],
      }));
    }

    const submissionCases: Array<{ family: string; facts: keyof typeof issues; category: IssueCategory; priority: Priority; reasons: Record<Language, string[]> }> = [
      { family: "submission_high", facts: "roadsHigh", category: "roads", priority: "high", reasons: { en: ["Vehicles change direction suddenly at the pothole.", "Two people on two-wheelers have already fallen."], hi: ["गाड़ियां गड्ढे पर अचानक दिशा बदलती हैं।", "दोपहिया वाहनों पर सवार दो लोग गिर चुके हैं।"], hinglish: ["Vehicles pothole par achanak direction change karte hain.", "Do two-wheeler sawaar gir chuke hain."] } },
      { family: "submission_high_junction", facts: "roadsHighJunction", category: "roads", priority: "high", reasons: { en: ["Two-wheelers cut into the oncoming lane to avoid the pothole.", "The junction stays busy during peak hours."], hi: ["दोपहिया वाहन गड्ढे से बचने के लिए सामने की लेन में काटते हैं।", "व्यस्त समय में चौक पर भीड़ रहती है।"], hinglish: ["Two-wheelers pothole se bachne ke liye oncoming lane mein cut karte hain.", "Peak hours mein junction busy rehta hai."] } },
      { family: "submission_medium_roads", facts: "roadsMediumMarket", category: "roads", priority: "medium", reasons: { en: ["The pothole is wide and sits in the driving lane.", "Traffic slows and changes lanes to pass it."], hi: ["गड्ढा चौड़ा है और चलने वाली लेन में है।", "यातायात धीमा होकर लेन बदलकर निकल रहा है।"], hinglish: ["Pothole wide hai aur driving lane mein hai.", "Traffic slow hokar lane change kar raha hai."] } },
      { family: "submission_low", facts: "roadsLow", category: "roads", priority: "low", reasons: { en: ["The pothole is small and shallow.", "Vehicles pass normally at this spot."], hi: ["गड्ढा छोटा और उथला है।", "इस जगह वाहन सामान्य रूप से निकल जाते हैं।"], hinglish: ["Pothole chhota aur shallow hai.", "Is jagah vehicles normally pass kar jate hain."] } },
      { family: "submission_critical", facts: "lightingCritical", category: "lighting", priority: "critical", reasons: { en: ["Exposed live wires are actively sparking.", "People are beside the immediate electrical danger."], hi: ["खुले लाइव तारों से चिंगारी निकल रही है।", "लोग तत्काल बिजली के खतरे के पास हैं।"], hinglish: ["Exposed live wires actively spark kar rahe hain.", "Log immediate electrical danger ke paas hain."] } },
      { family: "submission_medium", facts: "lightingMedium", category: "lighting", priority: "medium", reasons: { en: ["Three lights have failed for several nights.", "The residential route is dark but has no active electrical hazard."], hi: ["तीन लाइट कई रात से बंद हैं।", "रिहायशी रास्ता अंधेरा है, लेकिन सक्रिय बिजली खतरा नहीं है।"], hinglish: ["Teen lights several nights se fail hain.", "Residential route dark hai but active electrical hazard nahi hai."] } },
    ];

    for (const submission of submissionCases) {
      const issue = issueFor(issues[submission.facts], language, variant);
      const submissionCall = `call_submit_${submission.family}_${suffix}`;
      const caseBrief = brief({ issue, category: submission.category, priority: submission.priority, reasons: submission.reasons[language], messageId: sourceId, attachmentId });
      rows.push(makeRow({
        id: `${submission.family}_${suffix}`,
        language,
        scenario_family: `${submission.family}_and_final_recipient_message`,
        fact_fingerprint: `${String(submission.facts)}_${language}`,
        priority_label: submission.priority,
        known_source_message_ids: [sourceId],
        known_attachment_ids: [attachmentId],
        initial_state: baseState({ issueKnown: true, exactLocationKnown: true, acceptedAttachmentIds: [attachmentId], interpretationRecorded: true, explicitlyConfirmed: true }),
        confirmed_interpretation: { issue, category: submission.category },
        citizenMessage: user(language === "hi" ? "Confirm" : language === "hinglish" ? "Confirm, submit kar do." : "Confirm."),
        continuation: [
          call(submissionCall, "prepare_submission", caseBrief),
          result(submissionCall, "prepare_submission", `The pending submission is ready. Send this exact message to the citizen: ${copy.final}`),
          assistant(copy.final),
        ],
      }));
    }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};
const flattenStrings = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenStrings);
  if (isRecord(value)) return Object.entries(value).flatMap(([key, entry]) => [key, ...flattenStrings(entry)]);
  return [];
};

const impactMarkers = ["swerv", "fall", "casualt", "collision", "crash", "electrocut", "spark"] as const;

const validateToolArgs = (row: DatasetRow, name: ToolName, args: Record<string, unknown>, state: FixtureState): void => {
  if (name === "assess_staged_image") {
    const attachmentId = args.attachmentId;
    assert(typeof attachmentId === "string" && row.known_attachment_ids.includes(attachmentId), `${row.id}: assessment cites an unknown attachment`);
    assert(args.assessment === "satisfactory" || args.assessment === "insufficient", `${row.id}: invalid image assessment`);
    if (args.assessment === "satisfactory" && !state.acceptedAttachmentIds.includes(attachmentId)) state.acceptedAttachmentIds.push(attachmentId);
    return;
  }
  if (name === "record_report_interpretation") {
    assert(state.issueKnown && state.exactLocationKnown && state.acceptedAttachmentIds.length > 0, `${row.id}: interpretation recorded before the report is complete`);
    assert(typeof args.issue === "string" && args.issue.trim().length > 0 && args.issue.length <= 500, `${row.id}: invalid interpreted issue`);
    assert(typeof args.category === "string" && new Set<string>(issueCategories).has(args.category), `${row.id}: invalid category`);
    state.interpretationRecorded = true;
    return;
  }
  if (name === "ask_question") {
    assert(state.interpretationRecorded, `${row.id}: confirmation requested before recording interpretation`);
    assert(typeof args.prompt === "string" && !args.prompt.trim().startsWith("{"), `${row.id}: ask_question prompt must be plain text`);
    const options = args.options;
    assert(Array.isArray(options) && options.length === 2, `${row.id}: confirmation must have two options`);
    assert(isRecord(options[0]) && options[0].id === "confirm" && options[0].label === "Confirm", `${row.id}: invalid confirm option`);
    assert(isRecord(options[1]) && options[1].id === "edit" && options[1].label === "Edit", `${row.id}: invalid edit option`);
    return;
  }
  const parsed = caseBriefV1Schema.safeParse(args);
  assert(parsed.success, `${row.id}: prepare_submission arguments do not match caseBriefV1Schema`);
  assert(state.interpretationRecorded && state.explicitlyConfirmed && state.acceptedAttachmentIds.length > 0, `${row.id}: illegal submission transition`);
  for (const citation of parsed.data.citations) {
    if (citation.kind === "transcript_message") assert(row.known_source_message_ids.includes(citation.sourceMessageId), `${row.id}: invented transcript source ID`);
    else assert(state.acceptedAttachmentIds.includes(citation.attachmentId), `${row.id}: invented or unaccepted evidence ID`);
  }
  const groundedText = row.confirmed_interpretation?.issue.toLowerCase() ?? "";
  const claimText = `${parsed.data.summary} ${parsed.data.priority.reasons.join(" ")}`.toLowerCase();
  for (const marker of impactMarkers) {
    if (claimText.includes(marker)) assert(groundedText.includes(marker), `${row.id}: submission claims "${marker}" details that the confirmed interpretation does not contain`);
  }
  assert(parsed.data.priority.priority === row.priority_label, `${row.id}: priority label and submission disagree`);
};

const validateRow = (row: DatasetRow): void => {
  assert(row.messages[0]?.role === "system", `${row.id}: first message must be system`);
  assert(row.messages.some((message) => message.role === "assistant"), `${row.id}: row has no assistant target`);
  assert(new Set(row.known_source_message_ids).size === row.known_source_message_ids.length, `${row.id}: duplicate source ID`);
  assert(new Set(row.known_attachment_ids).size === row.known_attachment_ids.length, `${row.id}: duplicate attachment ID`);
  if (row.initial_state.explicitlyConfirmed) {
    assert(row.confirmed_interpretation !== null, `${row.id}: confirmed fixture is missing its persisted interpretation`);
    const systemContent = row.messages[0].content;
    assert(systemContent.includes(`confirmed_interpretation_issue=${row.confirmed_interpretation.issue}`), `${row.id}: confirmed issue is not model-visible`);
    assert(systemContent.includes(`confirmed_interpretation_category=${row.confirmed_interpretation.category}`), `${row.id}: confirmed category is not model-visible`);
  }
  const imagePaths = row.messages.flatMap((message) => typeof message.content === "string" ? [] : message.content.filter((part): part is ImagePart => part.type === "image").map((part) => part.image));
  assert(imagePaths.length <= 1, `${row.id}: more than one image in one training row`);
  for (const imagePath of imagePaths) {
    assert(!imagePath.startsWith("/") && !imagePath.includes("..") && imagePath.endsWith(".png"), `${row.id}: malformed image reference`);
    assert(existsSync(join(ROOT, imagePath)), `${row.id}: image does not exist: ${imagePath}`);
  }

  const forbiddenPatterns = [
    /https?:\/\//iu,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu,
    /(?:\+?91[- ]?)?[6-9]\d{9}/u,
    /-?\d{1,2}\.\d{3,}\s*[,/]\s*-?\d{1,3}\.\d{3,}/u,
  ];
  const safeStrings = flattenStrings({
    id: row.id,
    language: row.language,
    scenario_family: row.scenario_family,
    fact_fingerprint: row.fact_fingerprint,
    priority_label: row.priority_label,
    known_source_message_ids: row.known_source_message_ids,
    known_attachment_ids: row.known_attachment_ids,
    messages: row.messages,
  });
  for (const value of safeStrings) for (const pattern of forbiddenPatterns) assert(!pattern.test(value), `${row.id}: identifying or secret-like value rejected: ${value}`);

  const state: FixtureState = { ...row.initial_state, acceptedAttachmentIds: [...row.initial_state.acceptedAttachmentIds] };
  const pendingCalls = new Map<string, ToolName>();
  for (const message of row.messages) {
    if (message.role === "assistant" && message.tool_calls) {
      assert(message.content === "", `${row.id}: tool-call message contains narration`);
      for (const toolCall of message.tool_calls) {
        assert(!pendingCalls.has(toolCall.id), `${row.id}: duplicate tool call ID`);
        assert(TOOL_DEFINITIONS.some((tool) => tool.function.name === toolCall.function.name), `${row.id}: unknown tool`);
        validateToolArgs(row, toolCall.function.name, toolCall.function.arguments, state);
        pendingCalls.set(toolCall.id, toolCall.function.name);
      }
    }
    if (message.role === "tool") {
      assert(pendingCalls.get(message.tool_call_id) === message.name, `${row.id}: tool result does not match a prior call`);
      pendingCalls.delete(message.tool_call_id);
    }
  }
  assert(pendingCalls.size === 0 || [...pendingCalls.values()].every((name) => name === "ask_question"), `${row.id}: missing tool result`);
};

assert(rows.length === 792, `Expected 792 rows, got ${rows.length}`);
for (const row of rows) validateRow(row);

const priorityByFingerprint = new Map<string, Priority>();
for (const row of rows) {
  if (!row.priority_label) continue;
  const existing = priorityByFingerprint.get(row.fact_fingerprint);
  assert(existing === undefined || existing === row.priority_label, `${row.id}: same facts received inconsistent priorities`);
  priorityByFingerprint.set(row.fact_fingerprint, row.priority_label);
}
const roadPriorities = new Set(rows.filter((row) => row.scenario_family.startsWith("submission_") && row.messages.some((message) => message.role === "assistant" && message.tool_calls?.some((entry) => entry.function.name === "prepare_submission" && entry.function.arguments.category === "roads"))).map((row) => row.priority_label));
assert(roadPriorities.has("high") && roadPriorities.has("low") && roadPriorities.has("medium"), "Same-category road examples must include different justified priorities");
for (const priority of priorities) assert(rows.some((row) => row.priority_label === priority), `Missing priority coverage: ${priority}`);
for (const language of ["en", "hi", "hinglish"] as const) assert(rows.some((row) => row.language === language), `Missing language coverage: ${language}`);

mkdirSync(DATASET_DIR, { recursive: true });
const datasetPath = join(DATASET_DIR, "effi-training.jsonl");
const manifestPath = join(DATASET_DIR, "manifest.jsonl");
const datasetLines = rows.map((row) => JSON.stringify(row));
writeFileSync(datasetPath, `${datasetLines.join("\n")}\n`, "utf8");
const manifest = rows.map((row, index) => ({
  row_id: row.id,
  row_index: index,
  generator_version: GENERATOR_VERSION,
  source_category: row.source_category,
  language: row.language,
  scenario_family: row.scenario_family,
  model_revision: MODEL_REVISION,
  sanitization_status: "passed",
  image_count: row.messages.reduce((count, message) => count + (typeof message.content === "string" ? 0 : message.content.filter((part) => part.type === "image").length), 0),
  assistant_message_count: row.messages.filter((message) => message.role === "assistant").length,
  priority_label: row.priority_label,
  sha256: createHash("sha256").update(datasetLines[index] ?? "").digest("hex"),
}));
writeFileSync(manifestPath, `${manifest.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");

const summary = {
  rows: rows.length,
  languages: Object.fromEntries(["en", "hi", "hinglish"].map((language) => [language, rows.filter((row) => row.language === language).length])),
  scenario_families: Object.fromEntries([...new Set(rows.map((row) => row.scenario_family))].sort().map((family) => [family, rows.filter((row) => row.scenario_family === family).length])),
  priorities: Object.fromEntries(priorities.map((priority) => [priority, rows.filter((row) => row.priority_label === priority).length])),
  images: [...new Set(rows.flatMap((row) => row.messages.flatMap((message) => typeof message.content === "string" ? [] : message.content.filter((part): part is ImagePart => part.type === "image").map((part) => part.image))))],
  dataset: relative(REPO_ROOT, datasetPath),
  manifest: relative(REPO_ROOT, manifestPath),
};
writeFileSync(join(DATASET_DIR, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
