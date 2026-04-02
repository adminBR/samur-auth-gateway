import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarRange,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";

import { getMe } from "../api/axios";
import {
  getAuthAnalytics,
  type AnalyticsBucket,
  type AuthAnalyticsResponse,
  type ServiceAnalyticsSeries,
} from "../api/analytics";

type SelectedBucket = {
  scope: "global";
  bucketStart: string;
};

interface SvgBarChartProps {
  buckets: AnalyticsBucket[];
  height?: number;
  selectedBucketStart?: string | null;
  onSelectBucket?: (bucketStart: string) => void;
  interactive?: boolean;
  showLabels?: boolean;
  showValues?: boolean;
  emphasizeMaxOnly?: boolean;
}

interface ServiceDetailsModalProps {
  service: ServiceAnalyticsSeries | null;
  onClose: () => void;
}

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
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatBucketLabel(bucketStart: string, compact = false) {
  const bucketDate = new Date(bucketStart);

  return bucketDate.toLocaleString("pt-BR", {
    day: compact ? undefined : "2-digit",
    month: compact ? undefined : "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAxisLabel(bucketStart: string) {
  const bucketDate = new Date(bucketStart);
  return `${pad(bucketDate.getHours())}:${pad(bucketDate.getMinutes())}`;
}

function findLatestBucketWithData(
  buckets: AnalyticsBucket[],
): AnalyticsBucket | null {
  return [...buckets].reverse().find((bucket) => bucket.count > 0) ?? null;
}

function findDefaultSelection(
  response: AuthAnalyticsResponse,
): SelectedBucket | null {
  const latestWithData =
    findLatestBucketWithData(response.global.buckets) ??
    [...response.global.buckets].reverse()[0] ??
    null;

  if (!latestWithData) {
    return null;
  }

  return {
    scope: "global",
    bucketStart: latestWithData.bucket_start,
  };
}

function SvgBarChart({
  buckets,
  height = 280,
  selectedBucketStart = null,
  onSelectBucket,
  interactive = false,
  showLabels = true,
  showValues = true,
  emphasizeMaxOnly = false,
}: SvgBarChartProps) {
  const width = 1000;
  const leftPadding = 46;
  const rightPadding = 12;
  const topPadding = 16;
  const bottomPadding = showLabels ? 34 : 12;
  const chartWidth = width - leftPadding - rightPadding;
  const chartHeight = height - topPadding - bottomPadding;
  const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 1);
  const bucketCount = Math.max(buckets.length, 1);
  const gap = Math.min(chartWidth * 0.01, 10);
  const rawBarWidth = chartWidth / bucketCount - gap;
  const barWidth = Math.max(rawBarWidth, 6);
  const labelStep = Math.max(1, Math.ceil(bucketCount / 8));
  const gridValues = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="block h-auto w-full"
      role="img"
      aria-label="Grafico de barras de acessos por hora"
    >
      <defs>
        <linearGradient id="analytics-bar-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#5faf9f" />
          <stop offset="100%" stopColor="#2e7675" />
        </linearGradient>
        <linearGradient
          id="analytics-selected-gradient"
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >
          <stop offset="0%" stopColor="#2e7675" />
          <stop offset="100%" stopColor="#1f4d4c" />
        </linearGradient>
      </defs>

      {gridValues.map((value) => {
        const y = topPadding + chartHeight - chartHeight * value;
        const labelValue = Math.round(maxCount * value);

        return (
          <g key={value}>
            <line
              x1={leftPadding}
              x2={width - rightPadding}
              y1={y}
              y2={y}
              stroke="#dce8e3"
              strokeDasharray="4 6"
            />
            <text
              x={leftPadding - 8}
              y={y + 4}
              fill="#698480"
              fontSize="11"
              textAnchor="end"
            >
              {labelValue}
            </text>
          </g>
        );
      })}

      <line
        x1={leftPadding}
        x2={width - rightPadding}
        y1={topPadding + chartHeight}
        y2={topPadding + chartHeight}
        stroke="#cfe0da"
      />

      {buckets.map((bucket, index) => {
        const x = leftPadding + index * (chartWidth / bucketCount) + gap / 2;
        const scaledHeight =
          bucket.count > 0 ? (bucket.count / maxCount) * chartHeight : 0;
        const barHeight = Math.max(scaledHeight, bucket.count > 0 ? 8 : 2);
        const y = topPadding + chartHeight - barHeight;
        const isSelected = bucket.bucket_start === selectedBucketStart;
        const labelVisible =
          showLabels &&
          (index % labelStep === 0 || index === buckets.length - 1);
        const shouldShowValue =
          showValues &&
          (!emphasizeMaxOnly || bucket.count === maxCount || isSelected);

        const content = (
          <g key={bucket.bucket_start}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="8"
              fill={
                isSelected
                  ? "url(#analytics-selected-gradient)"
                  : "url(#analytics-bar-gradient)"
              }
              opacity={interactive && !isSelected ? 0.86 : 1}
            />
            {isSelected && (
              <rect
                x={x - 1}
                y={y - 1}
                width={barWidth + 2}
                height={barHeight + 2}
                rx="9"
                fill="none"
                stroke="#163b3a"
                strokeWidth="2"
              />
            )}
            {shouldShowValue && (
              <text
                x={x + barWidth / 2}
                y={Math.max(y - 8, 12)}
                fill="#4e6865"
                fontSize="11"
                fontWeight="700"
                textAnchor="middle"
              >
                {bucket.count}
              </text>
            )}
            {labelVisible && (
              <text
                x={x + barWidth / 2}
                y={height - 12}
                fill="#617b77"
                fontSize="11"
                textAnchor="middle"
              >
                {formatAxisLabel(bucket.bucket_start)}
              </text>
            )}
          </g>
        );

        if (!interactive || !onSelectBucket) {
          return content;
        }

        return (
          <g
            key={bucket.bucket_start}
            onClick={() => onSelectBucket(bucket.bucket_start)}
            className="cursor-pointer"
          >
            <rect
              x={x - 4}
              y={topPadding}
              width={barWidth + 8}
              height={chartHeight + bottomPadding}
              fill="transparent"
            />
            {content}
          </g>
        );
      })}
    </svg>
  );
}

function ServiceDetailsModal({ service, onClose }: ServiceDetailsModalProps) {
  const defaultBucket = useMemo(
    () => (service ? findLatestBucketWithData(service.buckets) : null),
    [service],
  );
  const [selectedBucketStart, setSelectedBucketStart] = useState<string | null>(
    defaultBucket?.bucket_start ?? null,
  );

  useEffect(() => {
    setSelectedBucketStart(defaultBucket?.bucket_start ?? null);
  }, [defaultBucket]);

  if (!service) {
    return null;
  }

  const selectedBucket =
    service.buckets.find(
      (bucket) => bucket.bucket_start === selectedBucketStart,
    ) ?? defaultBucket;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0f172a]/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border border-[#d7e4de] bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#e3ede9] px-5 py-4 sm:px-6">
          <div>
            <p className="dashboard-label text-[10px] text-[#2e7675]">
              Detalhes do servico
            </p>
            <h2 className="font-dashboard-display mt-2 text-[1.55rem] font-bold text-[#203735]">
              {service.service_name}
            </h2>
            <p className="mt-2 text-sm text-[#5b7672]">
              ID {service.service_id} - {service.total_count} acessos no
              intervalo atual
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#d7e4de] bg-[#f8fcfa] p-2 text-[#58726f] transition-colors hover:border-[#2e7675]/30 hover:text-[#2e7675]"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="rounded-[26px] border border-[#e1ebe7] bg-[linear-gradient(180deg,#fbfdfc_0%,#f4faf7_100%)] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#5b7672]">
                  Clique em uma barra para trocar o horario exibido abaixo.
                </p>
              </div>
              <div className="rounded-full border border-[#d9e7e2] bg-white px-3 py-1 text-[11px] font-semibold text-[#476361]">
                {service.buckets.length} horas
              </div>
            </div>

            <SvgBarChart
              buckets={service.buckets}
              height={300}
              selectedBucketStart={selectedBucket?.bucket_start ?? null}
              onSelectBucket={setSelectedBucketStart}
              interactive
            />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-dashboard-display mt-2 text-[1.35rem] font-bold text-[#203735]">
                {selectedBucket
                  ? formatBucketLabel(selectedBucket.bucket_start)
                  : "Nenhum horario selecionado"}
              </h3>
            </div>
            <div className="rounded-full border border-[#d9e7e2] bg-[#f4faf7] px-4 py-2 text-[12px] font-semibold text-[#476361]">
              {selectedBucket?.count ?? 0} acessos
            </div>
          </div>

          {selectedBucket?.details.length ? (
            <div className="mt-4 overflow-hidden rounded-[22px] border border-[#e1ebe7]">
              <div className="grid grid-cols-[minmax(100px,0.8fr)_minmax(150px,1.2fr)_minmax(150px,1.1fr)_100px] gap-3 border-b border-[#e1ebe7] bg-[#f7fbf9] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#58726f]">
                <span>User ID</span>
                <span>User name</span>
                <span>IP</span>
                <span>Acessos</span>
              </div>

              <div className="divide-y divide-[#ecf2ef]">
                {selectedBucket.details.map((detail, index) => (
                  <div
                    key={`${detail.user_id}-${detail.client_ip}-${index}`}
                    className="grid grid-cols-[minmax(100px,0.8fr)_minmax(150px,1.2fr)_minmax(150px,1.1fr)_100px] gap-3 px-4 py-3 text-sm text-[#29403e]"
                  >
                    <span className="font-semibold">{detail.user_id}</span>
                    <span>{detail.user_name}</span>
                    <span className="font-dashboard-mono text-[13px] text-[#496764]">
                      {detail.client_ip}
                    </span>
                    <span className="font-semibold">{detail.access_count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-[20px] border border-[#e2ece8] bg-[#f8fcfa] px-4 py-5 text-sm font-medium text-[#5a7572]">
              Nao ha detalhes de acesso para este horario.
            </p>
          )}
        </div>
      </div>
    </div>
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
  const [selectedBucket, setSelectedBucket] = useState<SelectedBucket | null>(
    null,
  );
  const [detailsServiceId, setDetailsServiceId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [userName, setUserName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const serviceCharts = analytics?.services ?? [];
  const detailsService =
    serviceCharts.find((service) => service.service_id === detailsServiceId) ??
    null;

  const selectedGlobalBucket = useMemo(() => {
    if (!analytics || selectedBucket?.scope !== "global") {
      return null;
    }

    return (
      analytics.global.buckets.find(
        (bucket) => bucket.bucket_start === selectedBucket.bucketStart,
      ) ?? null
    );
  }, [analytics, selectedBucket]);

  const loadAnalytics = async (
    nextStartValue: string,
    nextEndValue: string,
  ) => {
    const parsedStart = parseDateTimeLocalValue(nextStartValue);
    const parsedEnd = parseDateTimeLocalValue(nextEndValue);

    if (!parsedStart || !parsedEnd) {
      setErrorMessage("Informe um intervalo de datas valido.");
      return;
    }

    if (parsedStart >= parsedEnd) {
      setErrorMessage("A data inicial precisa ser menor que a final.");
      return;
    }

    setErrorMessage("");
    setIsFetching(true);

    try {
      const response = await getAuthAnalytics(
        parsedStart.toISOString(),
        parsedEnd.toISOString(),
      );

      setAnalytics(response);
      setSelectedBucket(findDefaultSelection(response));
      setDetailsServiceId((currentServiceId) =>
        response.services.some(
          (service) => service.service_id === currentServiceId,
        )
          ? currentServiceId
          : null,
      );
    } catch (error) {
      console.error("Error fetching auth analytics:", error);
      setErrorMessage("Nao foi possivel carregar os logs de acesso.");
    } finally {
      setIsFetching(false);
      setIsLoading(false);
    }
  };

  const applyPresetRange = async (hours: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    const nextStart = toDateTimeLocalValue(start);
    const nextEnd = toDateTimeLocalValue(end);

    setRangeStart(nextStart);
    setRangeEnd(nextEnd);
    await loadAnalytics(nextStart, nextEnd);
  };

  const handleApplyRange = async () => {
    await loadAnalytics(rangeStart, rangeEnd);
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
        await loadAnalytics(defaultRange.start, defaultRange.end);
      } catch (error) {
        console.error("Error loading analytics page:", error);
        navigate("/", { replace: true });
      }
    };

    void bootstrap();
  }, [defaultRange.end, defaultRange.start, navigate]);

  return (
    <div className="font-dashboard-sans relative min-h-screen overflow-x-hidden bg-[#edf5f1] text-[#223432]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(181,225,202,0.26),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(46,118,117,0.12),transparent_24%),linear-gradient(180deg,#f8fcfa_0%,#edf5f1_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(46,118,117,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(46,118,117,0.04)_1px,transparent_1px)] bg-[size:34px_34px] opacity-60" />
      </div>

      <div className="relative mx-auto max-w-[1640px] px-3 pb-10 pt-5 sm:px-4 lg:px-6">
        <header className="rounded-[32px] border border-[#d7e4de] bg-white/88 p-5 shadow-[0_18px_50px_rgba(34,52,50,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-[#dce8e3] bg-[#f6fbf8]">
                <img
                  src="/logo-colored.webp"
                  alt="Analytics"
                  className="h-auto w-8 object-contain"
                />
              </div>
              <div className="flex min-h-14 items-center">
                <h1 className="font-dashboard-display text-[1.85rem] font-bold text-[#203735]">
                  Logs de acesso
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d9e7e2] bg-[#f4faf7] px-4 py-2 text-[12px] font-semibold text-[#3e5d58]">
                <ShieldCheck className="h-4 w-4 text-[#2e7675]" />
                {userName || "Administrador"}
              </div>
              <button
                type="button"
                onClick={() => navigate("/", { replace: true })}
                className="inline-flex items-center gap-2 rounded-full border border-[#d9e7e2] bg-white px-4 py-2 text-[12px] font-semibold text-[#385451] transition-colors hover:border-[#2e7675]/30 hover:text-[#2e7675]"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao painel
              </button>
            </div>
          </div>
        </header>

        <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(280px,0.85fr)] xl:items-stretch">
          <div className="flex h-full flex-col rounded-[28px] border border-[#d7e4de] bg-white/90 p-5 shadow-[0_18px_50px_rgba(34,52,50,0.08)] backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#2e7675]/10 text-[#2e7675]">
                <CalendarRange className="h-5 w-5" />
              </div>
              <div className="flex min-h-[40px] items-center">
                <h2 className="font-dashboard-display text-[1.35rem] font-bold text-[#203735]">
                  Filtro de tempo
                </h2>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[#4c6663]">
                  Data inicial
                </span>
                <input
                  type="datetime-local"
                  value={rangeStart}
                  onChange={(event) => setRangeStart(event.target.value)}
                  className="h-12 w-full rounded-[18px] border border-[#d7e4de] bg-[#f8fcfa] px-4 text-[13px] font-medium text-[#203735] outline-none transition-colors focus:border-[#2e7675]/40 focus:bg-white"
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
                  className="h-12 w-full rounded-[18px] border border-[#d7e4de] bg-[#f8fcfa] px-4 text-[13px] font-medium text-[#203735] outline-none transition-colors focus:border-[#2e7675]/40 focus:bg-white"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => void handleApplyRange()}
                  disabled={isFetching}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-[#2e7675] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#285f5f] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
                  />
                  Aplicar filtro
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void applyPresetRange(24)}
                className="rounded-full border border-[#d8e5e0] bg-[#f4faf7] px-4 py-2 text-[12px] font-semibold text-[#305452] transition-colors hover:border-[#2e7675]/30 hover:text-[#2e7675]"
              >
                Ultimas 24 horas
              </button>
              <button
                type="button"
                onClick={() => void applyPresetRange(72)}
                className="rounded-full border border-[#d8e5e0] bg-[#f4faf7] px-4 py-2 text-[12px] font-semibold text-[#305452] transition-colors hover:border-[#2e7675]/30 hover:text-[#2e7675]"
              >
                Ultimas 72 horas
              </button>
              <button
                type="button"
                onClick={() => void applyPresetRange(168)}
                className="rounded-full border border-[#d8e5e0] bg-[#f4faf7] px-4 py-2 text-[12px] font-semibold text-[#305452] transition-colors hover:border-[#2e7675]/30 hover:text-[#2e7675]"
              >
                Ultimos 7 dias
              </button>
            </div>

            {errorMessage && (
              <p className="mt-4 rounded-[18px] border border-[#f0d6d6] bg-[#fff5f5] px-4 py-3 text-sm font-medium text-[#b14949]">
                {errorMessage}
              </p>
            )}
          </div>

          <div className="grid h-full gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div className="flex h-full flex-col justify-between rounded-[28px] border border-[#d7e4de] bg-white/90 p-5 shadow-[0_18px_50px_rgba(34,52,50,0.08)] backdrop-blur">
              <p className="flex min-h-[18px] items-center text-[12px] font-semibold uppercase tracking-[0.12em] text-[#617b77]">
                Total de acessos
              </p>
              <p className="mt-3 font-dashboard-display text-[2rem] font-bold text-[#203735]">
                {analytics?.global.total_count ?? 0}
              </p>
            </div>

            <div className="flex h-full flex-col justify-between rounded-[28px] border border-[#d7e4de] bg-white/90 p-5 shadow-[0_18px_50px_rgba(34,52,50,0.08)] backdrop-blur">
              <p className="flex min-h-[18px] items-center text-[12px] font-semibold uppercase tracking-[0.12em] text-[#617b77]">
                Servicos monitorados
              </p>
              <p className="mt-3 font-dashboard-display text-[2rem] font-bold text-[#203735]">
                {serviceCharts.length}
              </p>
            </div>
          </div>
        </section>

        <div className="mt-5 space-y-5">
          {isLoading ? (
            <section className="rounded-[28px] border border-[#d7e4de] bg-white/90 p-8 text-sm font-medium text-[#526c69] shadow-[0_18px_50px_rgba(34,52,50,0.08)]">
              Carregando analytics de acesso...
            </section>
          ) : (
            <>
              <section className="rounded-[28px] border border-[#d7e4de] bg-white/90 p-5 shadow-[0_18px_50px_rgba(34,52,50,0.08)] backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-dashboard-display text-[1.55rem] font-bold text-[#203735]">
                      Acessos globais por hora
                    </h2>
                  </div>
                  <div className="rounded-full border border-[#d9e7e2] bg-[#f4faf7] px-3 py-1 text-[11px] font-semibold text-[#476361]">
                    {analytics?.global.buckets.length ?? 0} horas
                  </div>
                </div>

                <div className="mt-5 rounded-[26px] border border-[#e1ebe7] bg-[linear-gradient(180deg,#fbfdfc_0%,#f4faf7_100%)] p-4">
                  <SvgBarChart
                    buckets={analytics?.global.buckets ?? []}
                    selectedBucketStart={
                      selectedBucket?.scope === "global"
                        ? selectedBucket.bucketStart
                        : null
                    }
                    onSelectBucket={(bucketStart) =>
                      setSelectedBucket({ scope: "global", bucketStart })
                    }
                    interactive
                  />
                </div>
              </section>

              <section className="rounded-[28px] border border-[#d7e4de] bg-white/90 p-5 shadow-[0_18px_50px_rgba(34,52,50,0.08)] backdrop-blur">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="font-dashboard-display text-[1.4rem] font-bold text-[#203735]">
                      {selectedGlobalBucket
                        ? formatBucketLabel(selectedGlobalBucket.bucket_start)
                        : "Selecione uma barra do grafico principal"}
                    </h2>
                  </div>
                  <div className="rounded-full border border-[#d9e7e2] bg-[#f4faf7] px-4 py-2 text-[12px] font-semibold text-[#476361]">
                    {selectedGlobalBucket?.count ?? 0} acessos
                  </div>
                </div>

                {selectedGlobalBucket?.details.length ? (
                  <div className="mt-5 overflow-hidden rounded-[22px] border border-[#e1ebe7]">
                    <div className="grid grid-cols-[minmax(100px,0.8fr)_minmax(150px,1.2fr)_minmax(150px,1.1fr)_100px] gap-3 border-b border-[#e1ebe7] bg-[#f7fbf9] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#58726f]">
                      <span>User ID</span>
                      <span>User name</span>
                      <span>IP</span>
                      <span>Acessos</span>
                    </div>
                    <div className="divide-y divide-[#ecf2ef]">
                      {selectedGlobalBucket.details.map((detail, index) => (
                        <div
                          key={`${detail.user_id}-${detail.client_ip}-${index}`}
                          className="grid grid-cols-[minmax(100px,0.8fr)_minmax(150px,1.2fr)_minmax(150px,1.1fr)_100px] gap-3 px-4 py-3 text-sm text-[#29403e]"
                        >
                          <span className="font-semibold">
                            {detail.user_id}
                          </span>
                          <span>{detail.user_name}</span>
                          <span className="font-dashboard-mono text-[13px] text-[#496764]">
                            {detail.client_ip}
                          </span>
                          <span className="font-semibold">
                            {detail.access_count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-5 rounded-[20px] border border-[#e2ece8] bg-[#f8fcfa] px-4 py-5 text-sm font-medium text-[#5a7572]">
                    Selecione uma barra com acessos para ver os detalhes.
                  </p>
                )}
              </section>

              <section className="rounded-[28px] border border-[#d7e4de] bg-white/90 p-5 shadow-[0_18px_50px_rgba(34,52,50,0.08)] backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-dashboard-display text-[1.45rem] font-bold text-[#203735]">
                      Acessos por servico
                    </h2>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {serviceCharts.map((service) => (
                    <article
                      key={service.service_id}
                      className="rounded-[24px] border border-[#e2ece8] bg-[#fbfdfc] p-4 transition-colors hover:border-[#cfe0da]"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-[15px] font-bold text-[#203735]">
                            {service.service_name}
                          </h3>
                          <p className="mt-1 text-[12px] font-medium text-[#5a7572]">
                            ID {service.service_id} - {service.total_count}{" "}
                            acessos
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setDetailsServiceId(service.service_id)
                          }
                          className="shrink-0 rounded-full border border-[#d8e5e0] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#355754] transition-colors hover:border-[#2e7675]/30 hover:text-[#2e7675]"
                        >
                          Ver detalhes
                        </button>
                      </div>

                      <div className="rounded-[20px] border border-[#e1ebe7] bg-[linear-gradient(180deg,#fbfdfc_0%,#f4faf7_100%)] px-3 py-3">
                        <SvgBarChart
                          buckets={service.buckets}
                          height={190}
                          showLabels={false}
                          showValues={false}
                          emphasizeMaxOnly
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      <ServiceDetailsModal
        service={detailsService}
        onClose={() => setDetailsServiceId(null)}
      />
    </div>
  );
}
