import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Clock3,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getMe } from "../api/axios";
import {
  getAuthAnalytics,
  type AnalyticsBucket,
  type AnalyticsDetailRow,
  type AuthAnalyticsResponse,
  type ServiceAnalyticsSeries,
} from "../api/analytics";

type ChartRow = {
  bucketStart: string;
  bucketEnd: string;
  count: number;
  details: AnalyticsDetailRow[];
  label: string;
  shortLabel: string;
  sourceBucketStarts: string[];
};

type BucketInsights = {
  uniqueUsers: number;
  uniqueIps: number;
  topUser: string | null;
};

type ChartMouseState = {
  activeCoordinate?: {
    x?: number;
  };
};

interface ModalFrameProps {
  children: ReactNode;
  maxWidthClassName?: string;
  onClose: () => void;
  title: string;
}

interface StatCardProps {
  icon: ReactNode;
  label: string;
  tone?: "brand" | "muted";
  value: number;
}

interface PresetButtonProps {
  isActive: boolean;
  isBusy: boolean;
  label: string;
  onClick: () => void;
}

interface DetailsTableProps {
  details: AnalyticsDetailRow[];
  emptyMessage: string;
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: ChartRow;
  }>;
  valueLabel?: string;
}

interface GlobalAccessChartProps {
  isBusy: boolean;
  onSelectBucket: (bucketStart: string) => void;
  rows: ChartRow[];
}

interface ServiceSparklineProps {
  muted?: boolean;
  rows: ChartRow[];
}

interface GlobalDetailsModalProps {
  bucket: ChartRow | null;
  onClose: () => void;
}

interface ServiceDetailsModalProps {
  service: ServiceAnalyticsSeries | null;
  onClose: () => void;
}

const PRESET_OPTIONS = [
  { hours: 24, label: "Ultimas 24 horas" },
  { hours: 72, label: "Ultimas 72 horas" },
  { hours: 168, label: "Ultimos 7 dias" },
  { hours: 720, label: "Ultimo mes" },
  { hours: 4320, label: "Ultimos 6 meses" },
] as const;

const FILTER_DEBOUNCE_MS = 650;
const MAX_CHART_NODES = 40;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateTimeLocalValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getDefaultRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

  return {
    start: toDateTimeLocalValue(start),
    end: toDateTimeLocalValue(end),
  };
}

function parseDateTimeLocalValue(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatBucketLabel(bucketStart: string) {
  const bucketDate = new Date(bucketStart);

  return bucketDate.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateLabel(bucketStart: string) {
  const bucketDate = new Date(bucketStart);

  return bucketDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatAxisLabel(bucketStart: string) {
  const bucketDate = new Date(bucketStart);

  return `${pad(bucketDate.getHours())}:${pad(bucketDate.getMinutes())}`;
}

function formatCountLabel(value: number) {
  return value.toLocaleString("pt-BR");
}

function formatRangeLabel(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  return `${startDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  })} ${formatAxisLabel(start)} - ${endDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  })} ${formatAxisLabel(end)}`;
}

function resolvePresetHours(rangeStart: string, rangeEnd: string) {
  const parsedStart = parseDateTimeLocalValue(rangeStart);
  const parsedEnd = parseDateTimeLocalValue(rangeEnd);

  if (!parsedStart || !parsedEnd) {
    return null;
  }

  const diffHours = Math.round(
    (parsedEnd.getTime() - parsedStart.getTime()) / (60 * 60 * 1000),
  );

  return PRESET_OPTIONS.some((preset) => preset.hours === diffHours)
    ? diffHours
    : null;
}

function findLatestBucketWithData(
  buckets: AnalyticsBucket[],
): AnalyticsBucket | null {
  return [...buckets].reverse().find((bucket) => bucket.count > 0) ?? null;
}

function aggregateDetailRows(details: AnalyticsDetailRow[]) {
  const groupedDetails = new Map<string, AnalyticsDetailRow>();

  details.forEach((detail) => {
    const key = `${detail.user_id}::${detail.user_name}::${detail.client_ip}`;
    const current = groupedDetails.get(key);

    if (current) {
      current.access_count += detail.access_count;
      return;
    }

    groupedDetails.set(key, { ...detail });
  });

  return [...groupedDetails.values()].sort((left, right) => {
    if (right.access_count !== left.access_count) {
      return right.access_count - left.access_count;
    }

    return left.user_id.localeCompare(right.user_id);
  });
}

function resolveAggregationHours(bucketCount: number) {
  if (bucketCount <= MAX_CHART_NODES) {
    return 1;
  }

  if (Math.ceil(bucketCount / 6) <= MAX_CHART_NODES) {
    return 6;
  }

  if (Math.ceil(bucketCount / 12) <= MAX_CHART_NODES) {
    return 12;
  }

  const rawStep = Math.ceil(bucketCount / MAX_CHART_NODES);
  return Math.max(24, Math.ceil(rawStep / 24) * 24);
}

function formatChartRowLabel(
  bucketStart: string,
  bucketEnd: string,
  aggregationHours: number,
) {
  if (aggregationHours === 1) {
    return formatBucketLabel(bucketStart);
  }

  if (aggregationHours < 24) {
    return `${formatBucketLabel(bucketStart)} - ${formatAxisLabel(bucketEnd)}`;
  }

  if (aggregationHours === 24) {
    return formatDateLabel(bucketStart);
  }

  return `${formatDateLabel(bucketStart)} - ${formatDateLabel(bucketEnd)}`;
}

function formatChartShortLabel(
  bucketStart: string,
  aggregationHours: number,
  totalBuckets: number,
) {
  const bucketDate = new Date(bucketStart);

  if (aggregationHours === 1 && totalBuckets <= 24) {
    return formatAxisLabel(bucketStart);
  }

  if (aggregationHours < 24) {
    return `${bucketDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    })} ${pad(bucketDate.getHours())}h`;
  }

  return bucketDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function buildChartRows(buckets: AnalyticsBucket[]) {
  const aggregationHours = resolveAggregationHours(buckets.length);
  const chartRows: ChartRow[] = [];

  for (let index = 0; index < buckets.length; index += aggregationHours) {
    const sourceBuckets = buckets.slice(index, index + aggregationHours);
    const bucketStart = sourceBuckets[0]?.bucket_start;

    if (!bucketStart) {
      continue;
    }

    const bucketEnd =
      sourceBuckets[sourceBuckets.length - 1]?.bucket_start ?? bucketStart;

    chartRows.push({
      bucketStart,
      bucketEnd,
      count: sourceBuckets.reduce((sum, bucket) => sum + bucket.count, 0),
      details: aggregateDetailRows(
        sourceBuckets.flatMap((bucket) => bucket.details),
      ),
      label: formatChartRowLabel(bucketStart, bucketEnd, aggregationHours),
      shortLabel: formatChartShortLabel(
        bucketStart,
        aggregationHours,
        buckets.length,
      ),
      sourceBucketStarts: sourceBuckets.map((bucket) => bucket.bucket_start),
    });
  }

  return chartRows;
}

function getBucketInsights(details: AnalyticsDetailRow[]): BucketInsights {
  const uniqueUsers = new Set(details.map((detail) => detail.user_id)).size;
  const uniqueIps = new Set(details.map((detail) => detail.client_ip)).size;
  const topEntry = [...details].sort(
    (left, right) => right.access_count - left.access_count,
  )[0];

  return {
    uniqueUsers,
    uniqueIps,
    topUser: topEntry?.user_name || topEntry?.user_id || null,
  };
}

function getGlobalModalBucket(
  rows: ChartRow[],
  selectedBucketStart: string | null,
) {
  if (!selectedBucketStart) {
    return null;
  }

  return rows.find((row) => row.bucketStart === selectedBucketStart) ?? null;
}

function getYAxisWidth(rows: ChartRow[]) {
  const maxValue = Math.max(...rows.map((row) => row.count), 0);
  const formattedLength = formatCountLabel(maxValue).length;

  return Math.max(40, formattedLength * 8 + 12);
}

function resolveTooltipReverseX(state: unknown, containerWidth: number) {
  const chartState = state as ChartMouseState | undefined;
  const coordinateX = chartState?.activeCoordinate?.x;

  if (typeof coordinateX !== "number" || containerWidth <= 0) {
    return null;
  }

  return coordinateX > containerWidth / 2;
}

function TrendTooltip({
  active,
  payload,
  valueLabel = "acessos",
}: TrendTooltipProps) {
  const row = payload?.[0]?.payload as ChartRow | undefined;

  if (!active || !row) {
    return null;
  }

  return (
    <div className="rounded-[18px] border border-[#d8e5e0] bg-white px-3 py-2 shadow-[0_14px_36px_rgba(31,77,76,0.14)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64807a]">
        {row.label}
      </p>
      <p className="mt-1 text-sm font-bold text-[#203735]">
        {row.count} {valueLabel}
      </p>
    </div>
  );
}

function ModalFrame({
  children,
  maxWidthClassName = "max-w-6xl",
  onClose,
  title,
}: ModalFrameProps) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0f172a]/55 p-4 backdrop-blur-sm">
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[30px] border border-[#d7e4de] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)] ${maxWidthClassName}`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#e3ede9] px-5 py-4 sm:px-6">
          <h2 className="font-dashboard-display text-[1.32rem] font-bold text-[#203735]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="appearance-none rounded-full border border-[#d7e4de] bg-[#f8fcfa] p-2 text-[#58726f] outline-none ring-0 transition-colors hover:border-[#2e7675]/30 hover:text-[#2e7675] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, tone = "brand", value }: StatCardProps) {
  const toneClassName =
    tone === "brand"
      ? "border-[#d7e4de] bg-white/92"
      : "border-[#dde8e3] bg-[#fbfdfc]";

  return (
    <div
      className={`flex h-full flex-col items-center justify-center rounded-[24px] border p-4 text-center shadow-[0_16px_40px_rgba(34,52,50,0.06)] ${toneClassName}`}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[#2e7675]/10 text-[#2e7675]">
          {icon}
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#617b77]">
          {label}
        </p>
      </div>
      <p className="mt-4 font-dashboard-display text-[1.9rem] font-bold leading-none text-[#203735]">
        {value}
      </p>
    </div>
  );
}

function PresetButton({
  isActive,
  isBusy,
  label,
  onClick,
}: PresetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isBusy}
      className={`appearance-none rounded-full border px-3.5 py-2 text-[11px] font-semibold outline-none ring-0 transition-colors focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0 ${
        isActive
          ? "border-[#2e7675]/25 bg-[#2e7675] text-white"
          : "border-[#d8e5e0] bg-[#f4faf7] text-[#315451] hover:border-[#2e7675]/30 hover:text-[#2e7675]"
      } disabled:cursor-not-allowed disabled:opacity-70`}
    >
      {label}
    </button>
  );
}

function DetailsTable({ details, emptyMessage }: DetailsTableProps) {
  if (!details.length) {
    return (
      <p className="rounded-[18px] border border-[#e2ece8] bg-[#f8fcfa] px-4 py-5 text-sm font-medium text-[#5a7572]">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#e1ebe7]">
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full border-collapse">
          <thead>
            <tr className="border-b border-[#e1ebe7] bg-[#f7fbf9] text-left text-[11px] font-bold uppercase tracking-[0.12em] text-[#58726f]">
              <th className="px-4 py-3">User ID</th>
              <th className="px-4 py-3">User name</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Acessos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ecf2ef] bg-white">
            {details.map((detail, index) => (
              <tr key={`${detail.user_id}-${detail.client_ip}-${index}`}>
                <td className="px-4 py-3 text-sm font-semibold text-[#29403e]">
                  {detail.user_id}
                </td>
                <td className="px-4 py-3 text-sm text-[#29403e]">
                  {detail.user_name}
                </td>
                <td className="font-dashboard-mono px-4 py-3 text-[13px] text-[#496764]">
                  {detail.client_ip}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-[#29403e]">
                  {detail.access_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GlobalAccessChart({
  isBusy,
  onSelectBucket,
  rows,
}: GlobalAccessChartProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [reverseTooltipX, setReverseTooltipX] = useState(false);
  const yAxisWidth = getYAxisWidth(rows);

  return (
    <div
      ref={chartContainerRef}
      className="relative h-[260px] w-full sm:h-[320px]"
    >
      {isBusy && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end">
          <div className="rounded-full border border-[#d7e4de] bg-white/92 px-3 py-1 text-[11px] font-semibold text-[#476361] shadow-sm">
            Atualizando...
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          accessibilityLayer={false}
          data={rows}
          barCategoryGap={rows.length > 24 ? 6 : 12}
          margin={{ top: 16, right: 8, left: 6, bottom: 0 }}
          onMouseMove={(state) => {
            const nextReverseX = resolveTooltipReverseX(
              state,
              chartContainerRef.current?.clientWidth ?? 0,
            );

            if (nextReverseX !== null) {
              setReverseTooltipX(nextReverseX);
            }
          }}
        >
          <CartesianGrid
            stroke="#d9e6e1"
            strokeDasharray="4 6"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="shortLabel"
            minTickGap={16}
            tick={{ fill: "#698480", fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickFormatter={formatCountLabel}
            tick={{ fill: "#698480", fontSize: 11 }}
            tickLine={false}
            width={yAxisWidth}
          />
          <Tooltip
            allowEscapeViewBox={{ x: false, y: false }}
            animationDuration={0}
            content={<TrendTooltip />}
            cursor={{ fill: "rgba(95, 122, 118, 0.06)" }}
            isAnimationActive={false}
            reverseDirection={{ x: reverseTooltipX, y: false }}
          />
          <Bar
            activeBar={false}
            dataKey="count"
            animationDuration={260}
            onClick={(value) => {
              const bucketStart =
                (value as { payload?: ChartRow } | undefined)?.payload
                  ?.bucketStart ?? null;

              if (bucketStart) {
                onSelectBucket(bucketStart);
              }
            }}
            radius={[10, 10, 4, 4]}
            focusable={false}
            stroke="none"
            tabIndex={-1}
          >
            {rows.map((row) => (
              <Cell
                key={row.bucketStart}
                cursor="pointer"
                fill="#5faf9f"
                focusable={false}
                stroke="none"
                tabIndex={-1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ServiceSparkline({ muted = false, rows }: ServiceSparklineProps) {
  const fillColor = muted ? "#c7d9d3" : "#63b2a1";
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [reverseTooltipX, setReverseTooltipX] = useState(false);

  return (
    <div ref={chartContainerRef} className="h-[88px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          accessibilityLayer={false}
          data={rows}
          barCategoryGap={rows.length > 16 ? 4 : 8}
          margin={{ top: 4, right: 0, left: 0, bottom: 2 }}
          onMouseMove={(state) => {
            const nextReverseX = resolveTooltipReverseX(
              state,
              chartContainerRef.current?.clientWidth ?? 0,
            );

            if (nextReverseX !== null) {
              setReverseTooltipX(nextReverseX);
            }
          }}
        >
          <Tooltip
            allowEscapeViewBox={{ x: false, y: false }}
            animationDuration={0}
            content={<TrendTooltip valueLabel="acessos" />}
            cursor={false}
            isAnimationActive={false}
            reverseDirection={{ x: reverseTooltipX, y: false }}
          />
          <Bar
            activeBar={false}
            dataKey="count"
            animationDuration={220}
            fill={fillColor}
            focusable={false}
            radius={[6, 6, 2, 2]}
            stroke="none"
            tabIndex={-1}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GlobalDetailsModal({ bucket, onClose }: GlobalDetailsModalProps) {
  if (!bucket) {
    return null;
  }

  const insights = getBucketInsights(bucket.details);

  return (
    <ModalFrame
      maxWidthClassName="max-w-5xl"
      onClose={onClose}
      title={bucket.label}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[#d9e7e2] bg-[#f4faf7] px-3 py-1.5 text-[11px] font-semibold text-[#476361]">
            Global
          </span>
          <span className="rounded-full border border-[#d9e7e2] bg-[#f4faf7] px-3 py-1.5 text-[11px] font-semibold text-[#476361]">
            {bucket.count} acessos
          </span>
          <span className="rounded-full border border-[#d9e7e2] bg-[#f4faf7] px-3 py-1.5 text-[11px] font-semibold text-[#476361]">
            {insights.uniqueUsers} usuarios
          </span>
          <span className="rounded-full border border-[#d9e7e2] bg-[#f4faf7] px-3 py-1.5 text-[11px] font-semibold text-[#476361]">
            {insights.uniqueIps} IPs
          </span>
          {insights.topUser && (
            <span className="rounded-full border border-[#d9e7e2] bg-[#f4faf7] px-3 py-1.5 text-[11px] font-semibold text-[#476361]">
              Top user: {insights.topUser}
            </span>
          )}
        </div>

        <DetailsTable
          details={bucket.details}
          emptyMessage="Nao ha detalhes de acesso para este horario."
        />
      </div>
    </ModalFrame>
  );
}

function ServiceDetailsModal({ service, onClose }: ServiceDetailsModalProps) {
  const chartRows = useMemo(
    () => buildChartRows(service?.buckets ?? []),
    [service],
  );
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const yAxisWidth = getYAxisWidth(chartRows);
  const defaultBucket = useMemo(() => {
    if (!service) {
      return null;
    }

    return (
      findLatestBucketWithData(service.buckets) ??
      service.buckets[service.buckets.length - 1] ??
      null
    );
  }, [service]);
  const defaultChartRow = useMemo(() => {
    if (!defaultBucket) {
      return chartRows[chartRows.length - 1] ?? null;
    }

    return (
      chartRows.find((row) =>
        row.sourceBucketStarts.includes(defaultBucket.bucket_start),
      ) ??
      chartRows[chartRows.length - 1] ??
      null
    );
  }, [chartRows, defaultBucket]);
  const [selectedBucketStart, setSelectedBucketStart] = useState<string | null>(
    defaultChartRow?.bucketStart ?? null,
  );
  const [reverseTooltipX, setReverseTooltipX] = useState(false);

  useEffect(() => {
    setSelectedBucketStart(defaultChartRow?.bucketStart ?? null);
  }, [defaultChartRow]);

  if (!service) {
    return null;
  }

  const selectedBucket =
    chartRows.find((row) => row.bucketStart === selectedBucketStart) ??
    defaultChartRow;
  const selectedInsights = getBucketInsights(selectedBucket?.details ?? []);

  return (
    <ModalFrame onClose={onClose} title={service.service_name}>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[#d9e7e2] bg-[#f4faf7] px-3 py-1.5 text-[11px] font-semibold text-[#476361]">
            ID {service.service_id}
          </span>
          <span className="rounded-full border border-[#d9e7e2] bg-[#f4faf7] px-3 py-1.5 text-[11px] font-semibold text-[#476361]">
            {service.total_count} acessos no intervalo
          </span>
          {selectedBucket && (
            <span className="rounded-full border border-[#d9e7e2] bg-[#f4faf7] px-3 py-1.5 text-[11px] font-semibold text-[#476361]">
              {selectedBucket.label}
            </span>
          )}
        </div>

        <div className="rounded-[24px] border border-[#e1ebe7] bg-[linear-gradient(180deg,#fbfdfc_0%,#f4faf7_100%)] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-[#5b7672]">
              Clique nas barras para trocar o horario exibido abaixo.
            </p>
            <div className="rounded-full border border-[#d9e7e2] bg-white px-3 py-1 text-[11px] font-semibold text-[#476361]">
              {chartRows.length} pontos
            </div>
          </div>

          <div ref={chartContainerRef} className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                accessibilityLayer={false}
                data={chartRows}
                margin={{ top: 8, right: 8, left: 6, bottom: 0 }}
                onMouseMove={(state) => {
                  const nextReverseX = resolveTooltipReverseX(
                    state,
                    chartContainerRef.current?.clientWidth ?? 0,
                  );

                  if (nextReverseX !== null) {
                    setReverseTooltipX(nextReverseX);
                  }
                }}
              >
                <CartesianGrid
                  stroke="#d9e6e1"
                  strokeDasharray="4 6"
                  vertical={false}
                />
                <XAxis
                  axisLine={false}
                  dataKey="shortLabel"
                  minTickGap={16}
                  tick={{ fill: "#698480", fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickFormatter={formatCountLabel}
                  tick={{ fill: "#698480", fontSize: 11 }}
                  tickLine={false}
                  width={yAxisWidth}
                />
                <Tooltip
                  allowEscapeViewBox={{ x: false, y: false }}
                  animationDuration={0}
                  content={<TrendTooltip />}
                  cursor={false}
                  isAnimationActive={false}
                  reverseDirection={{ x: reverseTooltipX, y: false }}
                />
                <Bar
                  activeBar={false}
                  dataKey="count"
                  onClick={(value) => {
                    const bucketStart =
                      (value as { payload?: ChartRow } | undefined)?.payload
                        ?.bucketStart ?? null;

                    if (bucketStart) {
                      setSelectedBucketStart(bucketStart);
                    }
                  }}
                  focusable={false}
                  radius={[10, 10, 4, 4]}
                  stroke="none"
                  tabIndex={-1}
                >
                  {chartRows.map((row) => (
                    <Cell
                      key={row.bucketStart}
                      cursor="pointer"
                      fill={
                        row.bucketStart === selectedBucket?.bucketStart
                          ? "#1f4d4c"
                          : row.count > 0
                            ? "#5faf9f"
                            : "#d6e2dd"
                      }
                      focusable={false}
                      stroke="none"
                      tabIndex={-1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <StatCard
            icon={<Clock3 className="h-4 w-4" />}
            label="Acessos no horario"
            tone="muted"
            value={selectedBucket?.count ?? 0}
          />
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Usuarios"
            tone="muted"
            value={selectedInsights.uniqueUsers}
          />
          <StatCard
            icon={<Activity className="h-4 w-4" />}
            label="IPs"
            tone="muted"
            value={selectedInsights.uniqueIps}
          />
          <div className="rounded-[24px] border border-[#dde8e3] bg-[#fbfdfc] p-4 shadow-[0_16px_40px_rgba(34,52,50,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#617b77]">
              Top user
            </p>
            <p className="mt-4 text-sm font-semibold text-[#203735]">
              {selectedInsights.topUser ?? "Sem registros"}
            </p>
          </div>
        </div>

        <DetailsTable
          details={selectedBucket?.details ?? []}
          emptyMessage="Nao ha detalhes de acesso para este horario."
        />
      </div>
    </ModalFrame>
  );
}

export default function AuthAnalyticsPage() {
  const navigate = useNavigate();
  const [defaultRange] = useState(() => getDefaultRange());

  const [rangeStart, setRangeStart] = useState(defaultRange.start);
  const [rangeEnd, setRangeEnd] = useState(defaultRange.end);
  const [analytics, setAnalytics] = useState<AuthAnalyticsResponse | null>(
    null,
  );
  const [selectedGlobalBucketStart, setSelectedGlobalBucketStart] = useState<
    string | null
  >(null);
  const [detailsServiceId, setDetailsServiceId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [userName, setUserName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [activePresetHours, setActivePresetHours] = useState<number | null>(
    24,
  );
  const latestRequestRef = useRef(0);
  const autoRefreshEnabledRef = useRef(false);
  const skipNextAutoRefreshRef = useRef(false);

  const serviceCharts = analytics?.services ?? [];
  const globalChartRows = useMemo(
    () => buildChartRows(analytics?.global.buckets ?? []),
    [analytics],
  );
  const selectedGlobalBucket = useMemo(
    () => getGlobalModalBucket(globalChartRows, selectedGlobalBucketStart),
    [globalChartRows, selectedGlobalBucketStart],
  );
  const detailsService =
    serviceCharts.find((service) => service.service_id === detailsServiceId) ??
    null;

  const loadAnalytics = async (
    nextStartValue: string,
    nextEndValue: string,
    options?: {
      initialLoad?: boolean;
    },
  ) => {
    const parsedStart = parseDateTimeLocalValue(nextStartValue);
    const parsedEnd = parseDateTimeLocalValue(nextEndValue);

    if (!parsedStart || !parsedEnd) {
      return;
    }

    if (parsedStart >= parsedEnd) {
      setErrorMessage("A data inicial precisa ser menor que a final.");
      if (options?.initialLoad) {
        setIsLoading(false);
      }
      return;
    }

    const currentRequest = latestRequestRef.current + 1;
    latestRequestRef.current = currentRequest;

    setErrorMessage("");

    if (options?.initialLoad) {
      setIsLoading(true);
    } else {
      setIsFetching(true);
    }

    try {
      const response = await getAuthAnalytics(
        parsedStart.toISOString(),
        parsedEnd.toISOString(),
      );

      if (latestRequestRef.current !== currentRequest) {
        return;
      }

      setAnalytics(response);
      setSelectedGlobalBucketStart((currentBucketStart) =>
        buildChartRows(response.global.buckets).some(
          (bucket) => bucket.bucketStart === currentBucketStart,
        )
          ? currentBucketStart
          : null,
      );
      setDetailsServiceId((currentServiceId) =>
        response.services.some(
          (service) => service.service_id === currentServiceId,
        )
          ? currentServiceId
          : null,
      );
      setActivePresetHours(resolvePresetHours(nextStartValue, nextEndValue));
    } catch (error) {
      if (latestRequestRef.current !== currentRequest) {
        return;
      }

      console.error("Error fetching auth analytics:", error);
      setErrorMessage("Nao foi possivel carregar os logs de acesso.");
    } finally {
      if (latestRequestRef.current === currentRequest) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  };

  const applyPresetRange = (hours: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    const nextStart = toDateTimeLocalValue(start);
    const nextEnd = toDateTimeLocalValue(end);

    skipNextAutoRefreshRef.current = true;
    setRangeStart(nextStart);
    setRangeEnd(nextEnd);
    setActivePresetHours(hours);
    void loadAnalytics(nextStart, nextEnd);
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const me = await getMe();

        if (!me.is_admin) {
          navigate("/", { replace: true });
          return;
        }

        setUserName(me.user_name);
        await loadAnalytics(defaultRange.start, defaultRange.end, {
          initialLoad: true,
        });
        autoRefreshEnabledRef.current = true;
      } catch (error) {
        console.error("Error loading analytics page:", error);
        navigate("/", { replace: true });
      }
    };

    void bootstrap();
  }, [defaultRange.end, defaultRange.start, navigate]);

  useEffect(() => {
    if (!autoRefreshEnabledRef.current) {
      return;
    }

    if (skipNextAutoRefreshRef.current) {
      skipNextAutoRefreshRef.current = false;
      return;
    }

    const parsedStart = parseDateTimeLocalValue(rangeStart);
    const parsedEnd = parseDateTimeLocalValue(rangeEnd);

    if (!parsedStart || !parsedEnd) {
      return;
    }

    if (parsedStart >= parsedEnd) {
      setErrorMessage("A data inicial precisa ser menor que a final.");
      return;
    }

    setErrorMessage("");
    setActivePresetHours(resolvePresetHours(rangeStart, rangeEnd));

    const timeoutId = window.setTimeout(() => {
      void loadAnalytics(rangeStart, rangeEnd);
    }, FILTER_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [rangeEnd, rangeStart]);

  return (
    <div className="font-dashboard-sans relative min-h-screen overflow-x-hidden bg-[#edf5f1] text-[#223432]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(181,225,202,0.26),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(46,118,117,0.12),transparent_24%),linear-gradient(180deg,#f8fcfa_0%,#edf5f1_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(46,118,117,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(46,118,117,0.04)_1px,transparent_1px)] bg-[size:34px_34px] opacity-60" />
      </div>

      <div className="relative mx-auto flex max-w-[1540px] flex-col gap-4 px-3 pb-8 pt-4 sm:px-4 lg:px-6">
        <nav className="rounded-[26px] border border-[#d7e4de] bg-white/88 px-3 py-3 shadow-[0_18px_50px_rgba(34,52,50,0.08)] backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3 px-1 py-1">
              <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-[#dce8e3] bg-[#f6fbf8]">
                <img
                  src="/logo-colored.webp"
                  alt="Analytics"
                  className="h-auto w-7 object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="dashboard-label text-[10px] text-[#2e7675]">
                  Hospital Samur
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-dashboard-display truncate text-[1.2rem] font-bold text-[#214f4e]">
                    Access analytics
                  </h1>
                  {analytics && (
                    <span className="rounded-full border border-[#d9e7e2] bg-[#f4faf7] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#476361]">
                      {formatRangeLabel(analytics.start, analytics.end)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d9e7e2] bg-[#f4faf7] px-4 py-2 text-[12px] font-semibold text-[#3e5d58]">
                <ShieldCheck className="h-4 w-4 text-[#2e7675]" />
                {userName || "Administrador"}
              </div>
              <button
                type="button"
                onClick={() => navigate("/", { replace: true })}
                className="inline-flex appearance-none items-center gap-2 rounded-full border border-[#d9e7e2] bg-white px-4 py-2 text-[12px] font-semibold text-[#385451] outline-none ring-0 transition-colors hover:border-[#2e7675]/30 hover:text-[#2e7675] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao painel
              </button>
            </div>
          </div>
        </nav>

        <section className="rounded-[28px] border border-[#d7e4de] bg-white/90 p-4 shadow-[0_18px_50px_rgba(34,52,50,0.08)] backdrop-blur sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-dashboard-display text-[1.45rem] font-bold text-[#203735]">
                Tendencia de acessos por hora
              </h2>
              <p className="mt-1 text-sm text-[#5b7672]">
                Clique em qualquer ponto do grafico para abrir os detalhes do
                horario.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {isFetching && (
                <span className="rounded-full border border-[#d9e7e2] bg-[#f4faf7] px-3 py-1.5 text-[11px] font-semibold text-[#476361]">
                  Atualizando filtro
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-[#e1ebe7] bg-[linear-gradient(180deg,#fbfdfc_0%,#f4faf7_100%)] px-3 py-3 sm:px-4">
            {isLoading ? (
              <div className="flex h-[260px] items-center justify-center text-sm font-medium text-[#526c69] sm:h-[320px]">
                Carregando analytics de acesso...
              </div>
            ) : (
              <GlobalAccessChart
                isBusy={isFetching}
                onSelectBucket={setSelectedGlobalBucketStart}
                rows={globalChartRows}
              />
            )}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(220px,0.7fr)_minmax(220px,0.7fr)]">
          <div className="rounded-[28px] border border-[#d7e4de] bg-white/90 p-4 shadow-[0_18px_50px_rgba(34,52,50,0.08)] backdrop-blur sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[#4c6663]">
                  Data inicial
                </span>
                <input
                  type="datetime-local"
                  value={rangeStart}
                  onChange={(event) => setRangeStart(event.target.value)}
                  className="h-11 w-full rounded-[16px] border border-[#d7e4de] bg-[#f8fcfa] px-4 text-[13px] font-medium text-[#203735] outline-none transition-colors focus:border-[#2e7675]/40 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[#4c6663]">
                  Data final
                </span>
                <input
                  type="datetime-local"
                  value={rangeEnd}
                  onChange={(event) => setRangeEnd(event.target.value)}
                  className="h-11 w-full rounded-[16px] border border-[#d7e4de] bg-[#f8fcfa] px-4 text-[13px] font-medium text-[#203735] outline-none transition-colors focus:border-[#2e7675]/40 focus:bg-white"
                />
              </label>
              <div className="flex items-end">
                <div className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[16px] border border-[#d8e5e0] bg-[#f4faf7] px-4 text-[12px] font-semibold text-[#355754]">
                  <RefreshCw
                    className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
                  />
                  {isFetching ? "Atualizando" : "Auto-apply"}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {PRESET_OPTIONS.map((preset) => (
                <PresetButton
                  key={preset.hours}
                  isActive={activePresetHours === preset.hours}
                  isBusy={isFetching}
                  label={preset.label}
                  onClick={() => applyPresetRange(preset.hours)}
                />
              ))}
            </div>

            {errorMessage && (
              <p className="mt-4 rounded-[18px] border border-[#f0d6d6] bg-[#fff5f5] px-4 py-3 text-sm font-medium text-[#b14949]">
                {errorMessage}
              </p>
            )}
          </div>

          <StatCard
            icon={<Activity className="h-4 w-4" />}
            label="Total de acessos"
            value={analytics?.global.total_count ?? 0}
          />
          <StatCard
            icon={<Server className="h-4 w-4" />}
            label="Servicos"
            value={serviceCharts.length}
          />
        </section>

        <section className="rounded-[28px] border border-[#d7e4de] bg-white/90 p-4 shadow-[0_18px_50px_rgba(34,52,50,0.08)] backdrop-blur sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-dashboard-display text-[1.35rem] font-bold text-[#203735]">
                Servicos
              </h2>
            </div>

            <span className="rounded-full border border-[#d9e7e2] bg-[#f4faf7] px-3 py-1.5 text-[11px] font-semibold text-[#476361]">
              {serviceCharts.length} servicos
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {serviceCharts.map((service) => {
              const rows = buildChartRows(service.buckets);
              const hasAccess = service.total_count > 0;

              return (
                <button
                  key={service.service_id}
                  type="button"
                  onClick={() => setDetailsServiceId(service.service_id)}
                  className={`appearance-none rounded-[24px] border p-4 text-left outline-none ring-0 transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(34,52,50,0.08)] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0 ${
                    hasAccess
                      ? "border-[#e2ece8] bg-[#fbfdfc] hover:border-[#cfe0da]"
                      : "border-[#e5eeea] bg-[#f8fbfa] text-[#607873] hover:border-[#d9e6e1]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-bold text-[#203735]">
                        {service.service_name}
                      </h3>
                      <p className="mt-1 text-[12px] font-medium text-[#5a7572]">
                        ID {service.service_id} - {service.total_count} acessos
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[20px] border border-[#e1ebe7] bg-[linear-gradient(180deg,#fbfdfc_0%,#f4faf7_100%)] px-3 py-2">
                    <ServiceSparkline muted={!hasAccess} rows={rows} />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[12px] font-medium text-[#5a7572]">
                    <span>{rows.length} pontos</span>
                    <span>{hasAccess ? "Com movimentacao" : "Sem acessos"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <GlobalDetailsModal
        bucket={selectedGlobalBucket}
        onClose={() => setSelectedGlobalBucketStart(null)}
      />

      <ServiceDetailsModal
        onClose={() => setDetailsServiceId(null)}
        service={detailsService}
      />
    </div>
  );
}
