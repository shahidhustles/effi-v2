"use client";

import { useConvexAuth, useQuery_experimental } from "convex/react";
import { makeFunctionReference } from "convex/server";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleGauge,
  Clock3,
  MapPinned,
  Minus,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { OfficerShell } from "./officer-shell";
import {
  analyticsCategories,
  analyticsChannels,
  analyticsPriorities,
  analyticsStatuses,
  buildOperationalAnalytics,
  type AnalyticsCase,
  type AnalyticsCategoryFilter,
  type AnalyticsPeriod,
  type AnalyticsPriority,
  type AnalyticsStatus,
  type AttentionCase,
  type SlaState,
} from "./analytics-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const getOperationalAnalytics = makeFunctionReference<"query", Record<string, never>, AnalyticsCase[]>("analytics:getOperationalAnalytics");

const categoryLabels: Record<AnalyticsCase["category"], string> = {
  roads: "Roads",
  sanitation: "Sanitation",
  water: "Water",
  lighting: "Lighting",
  drainage: "Drainage",
  other: "Other",
};

const priorityLabels: Record<AnalyticsPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const statusLabels: Record<AnalyticsStatus, string> = {
  new: "New",
  assigned: "Assigned",
  under_inspection: "Under inspection",
  work_in_progress: "Work in progress",
  resolved: "Resolved",
};

const channelLabels: Record<AnalyticsCase["channel"], string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  app: "Citizen app",
};

const riskLabels: Record<Extract<SlaState, { kind: "tracked" }>["risk"], string> = {
  healthy: "On track",
  at_risk: "At risk",
  breached: "Breached",
  escalate: "Escalate",
};

const intakeChartConfig = { cases: { label: "Cases", color: "var(--chart-1)" } } satisfies ChartConfig;
const flowChartConfig = { count: { label: "Cases", color: "var(--chart-2)" } } satisfies ChartConfig;
const priorityChartConfig = {
  unchanged: { label: "Unchanged", color: "var(--chart-1)" },
  raised: { label: "Raised", color: "var(--chart-3)" },
  lowered: { label: "Lowered", color: "var(--chart-4)" },
} satisfies ChartConfig;

const isCategory = (value: string): value is AnalyticsCase["category"] => analyticsCategories.some((entry) => entry === value);
const isPriority = (value: string): value is AnalyticsPriority => analyticsPriorities.some((entry) => entry === value);
const isStatus = (value: string): value is AnalyticsStatus => analyticsStatuses.some((entry) => entry === value);
const isChannel = (value: string): value is AnalyticsCase["channel"] => analyticsChannels.some((entry) => entry === value);

const formatDuration = (milliseconds: number | null): string => {
  if (milliseconds === null) return "Not enough data";
  const hours = milliseconds / (60 * 60 * 1000);
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 24) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} hr`;
  const days = hours / 24;
  return `${days < 10 ? days.toFixed(1) : Math.round(days)} days`;
};

const formatRemaining = (milliseconds: number): string => {
  const absoluteHours = Math.abs(milliseconds) / (60 * 60 * 1000);
  const duration = absoluteHours < 24
    ? `${Math.max(1, Math.round(absoluteHours))} hr`
    : `${Math.max(1, Math.round(absoluteHours / 24))} days`;
  return milliseconds >= 0 ? `${duration} left` : `${duration} overdue`;
};

const formatDay = (day: string): string => {
  const [year, month, date] = day.split("-").map(Number);
  if (year === undefined || month === undefined || date === undefined) return day;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(year, month - 1, date));
};

function MetricCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <Card className="gap-4 rounded-[10px] border-line bg-surface py-5 shadow-none">
      <CardHeader className="gap-3 px-5">
        <div className="flex items-center justify-between gap-3">
          <CardDescription className="text-xs font-semibold text-graphite">{title}</CardDescription>
          <span className="grid size-8 place-items-center rounded-full bg-lavender text-action">{icon}</span>
        </div>
        <CardTitle className="font-display text-[2rem] font-medium tracking-[-0.04em] text-ink tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 text-xs leading-relaxed text-muted">{detail}</CardContent>
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-muted">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="min-w-[142px] border-line bg-surface text-ink shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-line bg-surface text-ink">
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

const riskBadgeClass = (risk: AttentionCase["sla"]["risk"]): string => {
  switch (risk) {
    case "healthy": return "border-[#c8dec8] bg-mint text-[#346538]";
    case "at_risk": return "border-[#ebd9a8] bg-[#fbf3db] text-[#7e5900]";
    case "breached": return "border-[#efc7c8] bg-[#fdebec] text-[#8a2d2b]";
    case "escalate": return "border-ink bg-ink text-white";
    default: {
      const unhandled: never = risk;
      return unhandled;
    }
  }
};

const attentionReason = (entry: AttentionCase): string => {
  const reasons: string[] = [];
  if (!entry.assignedOfficerName) reasons.push("No owner");
  if (entry.repostCount > 0) reasons.push(`${entry.repostCount} citizen ${entry.repostCount === 1 ? "repost" : "reposts"}`);
  if (entry.sla.risk === "escalate") reasons.push("Past twice the target");
  else if (entry.sla.risk === "breached") reasons.push("Target missed");
  else if (entry.sla.risk === "at_risk") reasons.push("75% of target used");
  return reasons.join(" · ") || "Priority and elapsed time";
};

function AttentionTable({ cases }: { cases: readonly AttentionCase[] }) {
  if (cases.length === 0) {
    return (
      <div className="grid min-h-56 place-items-center px-6 text-center">
        <div>
          <CheckCircle2 className="mx-auto size-7 text-[#4d7a52]" />
          <h3 className="mt-4 font-display text-2xl font-medium text-ink">No tracked cases need attention</h3>
          <p className="mt-2 text-sm text-muted">Try a wider period or another service category.</p>
        </div>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader className="bg-fog/70">
        <TableRow className="border-line hover:bg-fog/70">
          <TableHead className="min-w-[270px] px-5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted">Case</TableHead>
          <TableHead className="min-w-[210px] text-[10px] font-bold uppercase tracking-[0.06em] text-muted">SLA</TableHead>
          <TableHead className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">Owner</TableHead>
          <TableHead className="w-12"><span className="sr-only">Open</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cases.map((entry) => (
          <TableRow className="border-line hover:bg-[#fafaf8]" key={entry.caseId}>
            <TableCell className="px-5 py-4 whitespace-normal">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={riskBadgeClass(entry.sla.risk)}>{riskLabels[entry.sla.risk]}</Badge>
                <span className="text-[11px] text-muted">{entry.reportNumber}</span>
              </div>
              <Link href={`/cases/${entry.caseId}`} className="mt-2 block max-w-[48ch] font-display text-[15px] font-semibold leading-snug text-ink hover:underline hover:underline-offset-4">
                {entry.summary}
              </Link>
              <p className="mt-1.5 text-xs text-muted">{categoryLabels[entry.category]} · {priorityLabels[entry.currentPriority]} · {attentionReason(entry)}</p>
            </TableCell>
            <TableCell className="py-4">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-ink">{formatRemaining(entry.sla.remainingMs)}</span>
                <span className="text-muted tabular-nums">{entry.sla.consumedPercent}%</span>
              </div>
              <Progress
                aria-label={`${entry.sla.consumedPercent} percent of SLA target consumed`}
                value={Math.min(100, entry.sla.consumedPercent)}
                className="mt-2.5 h-1.5 bg-fog [&_[data-slot=progress-indicator]]:bg-action"
              />
              <p className="mt-2 text-[11px] text-muted">Demo target: {entry.sla.targetLabel}</p>
            </TableCell>
            <TableCell className="py-4 text-sm text-graphite">{entry.assignedOfficerName ?? "Unassigned"}</TableCell>
            <TableCell className="pr-5">
              <Button variant="ghost" size="icon-sm" asChild aria-label={`Open ${entry.reportNumber}`}>
                <Link href={`/cases/${entry.caseId}`}><ArrowRight /></Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 py-6" aria-label="Loading analytics" role="status">
      <Skeleton className="h-24 rounded-[10px] bg-[#e9e8e3]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-40 rounded-[10px] bg-[#e9e8e3]" />)}
      </div>
      <Skeleton className="h-[420px] rounded-[10px] bg-[#e9e8e3]" />
      <span className="sr-only">Loading operational analytics</span>
    </div>
  );
}

function AnalyticsError({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="mt-6 border-[#efc7c8] bg-[#fdf5f5] text-danger">
      <AlertTriangle />
      <AlertTitle>Analytics could not be loaded</AlertTitle>
      <AlertDescription><p>{message}</p></AlertDescription>
    </Alert>
  );
}

function AnalyticsContent({ cases }: { cases: readonly AnalyticsCase[] }) {
  const [period, setPeriod] = useState<AnalyticsPeriod>(30);
  const [category, setCategory] = useState<AnalyticsCategoryFilter>("all");
  const [priority, setPriority] = useState<AnalyticsPriority | "all">("all");
  const [status, setStatus] = useState<AnalyticsStatus | "all">("all");
  const [channel, setChannel] = useState<AnalyticsCase["channel"] | "all">("all");
  const [officer, setOfficer] = useState<string>("all");
  const [now] = useState(() => Date.now());

  const officers = useMemo(() => [...new Set(cases.flatMap((entry) => entry.assignedOfficerName ? [entry.assignedOfficerName] : []))].sort(), [cases]);
  const scopedCases = useMemo(() => cases.filter((entry) =>
    (priority === "all" || entry.currentPriority === priority)
    && (status === "all" || entry.status === status)
    && (channel === "all" || entry.channel === channel)
    && (officer === "all" || (officer === "unassigned" ? !entry.assignedOfficerName : entry.assignedOfficerName === officer)),
  ), [cases, channel, officer, priority, status]);
  const analytics = useMemo(() => buildOperationalAnalytics({ cases: scopedCases, now, period, category }), [category, now, period, scopedCases]);
  const resolvedCases = analytics.filteredCases.length - analytics.openCases;
  const priorityTotal = analytics.priorityAgreement.unchanged + analytics.priorityAgreement.raised + analytics.priorityAgreement.lowered;
  const priorityData = [
    { label: "Unchanged", value: analytics.priorityAgreement.unchanged, fill: "var(--color-unchanged)" },
    { label: "Raised", value: analytics.priorityAgreement.raised, fill: "var(--color-raised)" },
    { label: "Lowered", value: analytics.priorityAgreement.lowered, fill: "var(--color-lowered)" },
  ];

  return (
    <TooltipProvider>
      <div className="py-6 lg:py-8">
        <header className="flex flex-col justify-between gap-5 border-b border-line pb-6 xl:flex-row xl:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-graphite">Operations intelligence</p>
            <h1 className="mt-2 font-display text-[2.75rem] font-medium leading-none tracking-[-0.045em] text-ink">Service command center</h1>
            <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-graphite">See where service is slowing down, which cases need intervention, and where repeated failures are forming.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <FilterSelect label="Period" value={`${period}`} onValueChange={(value) => setPeriod(Number(value) === 7 ? 7 : Number(value) === 90 ? 90 : 30)} options={[
              { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" },
            ]} />
            <FilterSelect label="Service" value={category} onValueChange={(value) => setCategory(value === "all" || isCategory(value) ? value : "all")} options={[
              { value: "all", label: "All services" }, ...analyticsCategories.map((entry) => ({ value: entry, label: categoryLabels[entry] })),
            ]} />
          </div>
        </header>

        <section className="mt-4 flex flex-wrap gap-3 rounded-[10px] border border-line bg-surface p-4" aria-label="Analytics filters">
          <FilterSelect label="Priority" value={priority} onValueChange={(value) => setPriority(value === "all" || isPriority(value) ? value : "all")} options={[
            { value: "all", label: "All priorities" }, ...analyticsPriorities.map((entry) => ({ value: entry, label: priorityLabels[entry] })),
          ]} />
          <FilterSelect label="Status" value={status} onValueChange={(value) => setStatus(value === "all" || isStatus(value) ? value : "all")} options={[
            { value: "all", label: "All statuses" }, ...analyticsStatuses.map((entry) => ({ value: entry, label: statusLabels[entry] })),
          ]} />
          <FilterSelect label="Channel" value={channel} onValueChange={(value) => setChannel(value === "all" || isChannel(value) ? value : "all")} options={[
            { value: "all", label: "All channels" }, ...analyticsChannels.map((entry) => ({ value: entry, label: channelLabels[entry] })),
          ]} />
          <FilterSelect label="Officer" value={officer} onValueChange={setOfficer} options={[
            { value: "all", label: "All officers" }, { value: "unassigned", label: "Unassigned" }, ...officers.map((entry) => ({ value: entry, label: entry })),
          ]} />
          <div className="ml-auto flex items-end">
            <Button variant="ghost" onClick={() => { setCategory("all"); setPriority("all"); setStatus("all"); setChannel("all"); setOfficer("all"); }}>Reset filters</Button>
          </div>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Service health">
          <MetricCard title="Open cases" value={`${analytics.openCases}`} detail={`${resolvedCases} resolved in this view`} icon={<CircleGauge className="size-4" />} />
          <MetricCard title="SLA compliance" value={analytics.slaCompliancePercent === null ? "—" : `${analytics.slaCompliancePercent}%`} detail={analytics.slaCompliancePercent === null ? "No resolved cases with demo targets" : "Resolved within the applicable demo target"} icon={<ShieldCheck className="size-4" />} />
          <MetricCard title="Median assignment" value={formatDuration(analytics.medianAssignmentMs)} detail="From registration to first assignment" icon={<UsersRound className="size-4" />} />
          <MetricCard title="Median resolution" value={formatDuration(analytics.medianResolutionMs)} detail="From registration to recorded resolution" icon={<Clock3 className="size-4" />} />
        </section>

        <section className="mt-4 overflow-hidden rounded-[10px] border border-line bg-surface" aria-labelledby="attention-title">
          <div className="flex flex-col justify-between gap-3 border-b border-line px-5 py-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-graphite">Intervention queue</p>
              <h2 id="attention-title" className="mt-1 font-display text-[1.75rem] font-medium tracking-[-0.025em] text-ink">Needs attention</h2>
              <p className="mt-1 text-sm text-muted">Ranked by elapsed target time, priority, citizen reposts, and ownership.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="size-2 rounded-full bg-[#d69d29]" /> {analytics.trackedOpenCases} tracked open {analytics.trackedOpenCases === 1 ? "case" : "cases"}
            </div>
          </div>
          <AttentionTable cases={analytics.attentionCases} />
        </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
          <Card className="rounded-[10px] border-line bg-surface shadow-none">
            <CardHeader className="border-b border-line">
              <CardTitle className="font-display text-2xl font-medium text-ink">Demand over time</CardTitle>
              <CardDescription>New cases registered during the selected period.</CardDescription>
              <CardAction><Badge variant="outline" className="border-line text-graphite">{analytics.filteredCases.length} total</Badge></CardAction>
            </CardHeader>
            <CardContent>
              {analytics.filteredCases.length === 0 ? <div className="grid h-[280px] place-items-center text-sm text-muted">No cases match these filters.</div> : (
                <ChartContainer config={intakeChartConfig} className="h-[280px] w-full aspect-auto">
                  <AreaChart data={analytics.dailyIntake} margin={{ left: 2, right: 10, top: 16 }} accessibilityLayer>
                    <defs><linearGradient id="intake-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-cases)" stopOpacity={0.28} /><stop offset="95%" stopColor="var(--color-cases)" stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid vertical={false} stroke="var(--color-line)" />
                    <XAxis dataKey="day" tickFormatter={formatDay} tickLine={false} axisLine={false} minTickGap={34} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} />
                    <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => typeof value === "string" ? formatDay(value) : value} />} />
                    <Area dataKey="cases" type="monotone" fill="url(#intake-fill)" stroke="var(--color-cases)" strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
              )}
              <div className="mt-4 grid grid-cols-3 divide-x divide-line border-t border-line pt-4">
                {analytics.channelCounts.map((entry) => <div className="px-4 first:pl-0" key={entry.channel}><strong className="block font-display text-xl font-medium text-ink tabular-nums">{entry.cases}</strong><span className="text-xs text-muted">{channelLabels[entry.channel]}</span></div>)}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[10px] border-line bg-surface shadow-none">
            <CardHeader className="border-b border-line">
              <CardTitle className="font-display text-2xl font-medium text-ink">Case flow</CardTitle>
              <CardDescription>How far cases reached and the median time between stages.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={flowChartConfig} className="h-[220px] w-full aspect-auto">
                <BarChart data={analytics.flow} layout="vertical" margin={{ left: 8, right: 16 }} accessibilityLayer>
                  <CartesianGrid horizontal={false} stroke="var(--color-line)" />
                  <XAxis type="number" allowDecimals={false} hide />
                  <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={82} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
              <ol className="mt-3 divide-y divide-line border-t border-line">
                {analytics.flow.slice(1).map((stage) => <li className="flex items-center justify-between gap-4 py-2.5 text-xs" key={stage.key}><span className="text-graphite">To {stage.label.toLowerCase()}</span><strong className="font-semibold text-ink">{formatDuration(stage.medianFromPreviousMs)}</strong></li>)}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="rounded-[10px] border-line bg-surface shadow-none">
            <CardHeader className="border-b border-line">
              <CardTitle className="font-display text-2xl font-medium text-ink">Emerging clusters</CardTitle>
              <CardDescription>Same-service cases connected within 500 metres during this period.</CardDescription>
              <CardAction><MapPinned className="size-5 text-action" /></CardAction>
            </CardHeader>
            <CardContent className="px-0">
              {analytics.recurrenceClusters.length === 0 ? <div className="grid min-h-60 place-items-center px-6 text-center text-sm text-muted">No repeated-location clusters appear in this view.</div> : (
                <ol className="divide-y divide-line">
                  {analytics.recurrenceClusters.map((cluster, index) => (
                    <li className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 px-6 py-4" key={cluster.id}>
                      <span className="grid size-8 place-items-center rounded-full bg-lavender font-display text-sm font-semibold text-action">{index + 1}</span>
                      <div className="min-w-0"><strong className="block truncate font-display text-[15px] text-ink">{cluster.label}</strong><span className="mt-1 block text-xs text-muted">{categoryLabels[cluster.category]} · {cluster.repostCount} citizen {cluster.repostCount === 1 ? "repost" : "reposts"}</span></div>
                      <Badge variant="outline" className="border-line bg-fog text-graphite">{cluster.caseCount} cases</Badge>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[10px] border-line bg-surface shadow-none">
            <CardHeader className="border-b border-line">
              <CardTitle className="font-display text-2xl font-medium text-ink">Priority agreement</CardTitle>
              <CardDescription>How current officer priorities compare with Effi’s initial recommendation.</CardDescription>
              <CardAction>
                <Tooltip><TooltipTrigger asChild><button className="grid size-8 place-items-center rounded-full bg-lavender text-action" type="button" aria-label="About priority agreement"><Sparkles className="size-4" /></button></TooltipTrigger><TooltipContent side="left">Agreement is not a measure of objective AI accuracy.</TooltipContent></Tooltip>
              </CardAction>
            </CardHeader>
            <CardContent>
              <ChartContainer config={priorityChartConfig} className="h-[190px] w-full aspect-auto">
                <BarChart data={priorityData} margin={{ left: 2, right: 2, top: 16 }} accessibilityLayer>
                  <CartesianGrid vertical={false} stroke="var(--color-line)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
              <div className="grid grid-cols-3 gap-2 border-t border-line pt-4">
                <div><Minus className="size-4 text-action" /><strong className="mt-2 block font-display text-xl text-ink">{priorityTotal === 0 ? "—" : `${Math.round((analytics.priorityAgreement.unchanged / priorityTotal) * 100)}%`}</strong><span className="text-xs text-muted">Unchanged</span></div>
                <div><ArrowUpRight className="size-4 text-[#9b5b23]" /><strong className="mt-2 block font-display text-xl text-ink">{analytics.priorityAgreement.raised}</strong><span className="text-xs text-muted">Raised</span></div>
                <div><ArrowDownRight className="size-4 text-[#527b75]" /><strong className="mt-2 block font-display text-xl text-ink">{analytics.priorityAgreement.lowered}</strong><span className="text-xs text-muted">Lowered</span></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Alert className="mt-4 border-line bg-fog/70 text-graphite">
          <AlertTriangle className="text-action" />
          <AlertTitle className="text-ink">About the service targets</AlertTitle>
          <AlertDescription><p>These are demonstration targets from the Effi municipal operations manual. Critical uses its emergency target. Sanitation and lighting cases without a structured subtype, plus water, drainage, and other cases, remain visible but are excluded when no exact target can be selected honestly.</p></AlertDescription>
        </Alert>
      </div>
    </TooltipProvider>
  );
}

export function AnalyticsDashboard() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const result = useQuery_experimental({ query: getOperationalAnalytics, args: isAuthenticated && !isLoading ? {} : "skip" });

  let body: ReactNode;
  if (!isLoading && !isAuthenticated) body = <AnalyticsError message="Your officer session could not be verified. Sign in again and return to analytics." />;
  else if (result.status === "error") body = <AnalyticsError message={result.error.message} />;
  else if (result.status !== "success") body = <DashboardSkeleton />;
  else body = <AnalyticsContent cases={result.data} />;

  return <OfficerShell activeNav="analytics">{body}</OfficerShell>;
}
