import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Coins,
  RefreshCw,
  ShieldCheck,
  Target,
  Wallet,
  Zap,
} from 'lucide-react';
import { analyticsApi } from '@/api/analytics';
import { useAuth } from '@/context/useAuth';
import type { DashboardSummary, MonthlyComparisonSummary } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage } from '@/lib/api-error';

const cardClass = 'border-slate-200 bg-[#F8FAFC]/85';
const panelClass = 'rounded-xl border border-slate-200 bg-white/70 p-3';
const PRODUCTIVE_SCORE = 75;
const STABLE_SCORE = 55;
const CHART_WIDTH = 640;
const CHART_HEIGHT = 240;
const CHART_TOP = 18;
const CHART_RIGHT = 24;
const CHART_BOTTOM = 38;
const CHART_LEFT = 46;
const CHART_INNER_WIDTH = CHART_WIDTH - CHART_LEFT - CHART_RIGHT;
const CHART_INNER_HEIGHT = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;

function clampScore(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return 0;
  return Math.max(0, Math.min(100, Number(value)));
}

function formatCurrency(value: number) {
  return `Rp ${Math.round(value || 0).toLocaleString('id-ID')}`;
}

function formatShortCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)}jt`;
  if (Math.abs(value) >= 1_000) return `Rp${Math.round(value / 1_000)}rb`;
  return `Rp${Math.round(value || 0)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

function formatWeekday(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('id-ID', { weekday: 'short' });
}

function getProductivityLabel(score: number) {
  if (score >= PRODUCTIVE_SCORE) return 'Produktif';
  if (score >= STABLE_SCORE) return 'Cukup stabil';
  return 'Perlu fokus ulang';
}

function getProductivityCopy(score: number, overdueTasks: number, dueTodayTasks: number) {
  if (overdueTasks > 0) {
    return `${overdueTasks} tugas terlambat perlu dibereskan dulu agar progres tidak menumpuk.`;
  }
  if (score >= PRODUCTIVE_SCORE) {
    return 'Ritme hari ini sehat. Pertahankan fokus di task yang paling dekat dengan goal utama.';
  }
  if (dueTodayTasks > 0) {
    return `${dueTodayTasks} tugas jatuh tempo hari ini. Ambil 1 tugas penting dulu sebelum pindah ke yang lain.`;
  }
  return 'Belum cukup data produktivitas hari ini. Mulai dari satu task kecil yang terhubung ke goal.';
}

function EmptyChart({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white/55 px-5 text-center">
      <Target className="mb-3 h-8 w-8 text-slate-400" />
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function ChartFrame({ children }: { children: ReactNode }) {
  return (
    <div className="h-60 overflow-hidden rounded-xl border border-slate-200 bg-white/65 px-2 py-3">
      {children}
    </div>
  );
}

function yForValue(value: number, maxValue: number) {
  if (maxValue <= 0) return CHART_TOP + CHART_INNER_HEIGHT;
  return CHART_TOP + CHART_INNER_HEIGHT - (value / maxValue) * CHART_INNER_HEIGHT;
}

function niceMax(values: number[], minMax = 1) {
  const maxValue = Math.max(minMax, ...values.map((value) => Math.abs(value || 0)));
  const magnitude = 10 ** Math.floor(Math.log10(maxValue));
  return Math.ceil(maxValue / magnitude) * magnitude;
}

function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-3 px-1">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function TaskBarChart({ data }: { data: { period: string; selesai: number; total: number }[] }) {
  const maxValue = niceMax(data.flatMap((item) => [item.total, item.selesai]));
  const groupWidth = CHART_INNER_WIDTH / Math.max(1, data.length);
  const barWidth = Math.min(28, Math.max(10, groupWidth * 0.28));

  return (
    <ChartFrame>
      <ChartLegend items={[{ label: 'Total task', color: '#bfdbfe' }, { label: 'Selesai', color: '#2563eb' }]} />
      <svg className="h-[calc(100%-1.5rem)] w-full" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="Grafik produktivitas">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = CHART_TOP + CHART_INNER_HEIGHT * ratio;
          const label = Math.round(maxValue * (1 - ratio));
          return (
            <g key={ratio}>
              <line x1={CHART_LEFT} x2={CHART_WIDTH - CHART_RIGHT} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
              <text x={CHART_LEFT - 10} y={y + 4} textAnchor="end" className="fill-slate-400 text-[11px] font-semibold">
                {label}
              </text>
            </g>
          );
        })}
        {data.map((item, index) => {
          const x = CHART_LEFT + groupWidth * index + groupWidth / 2;
          const totalHeight = CHART_TOP + CHART_INNER_HEIGHT - yForValue(item.total, maxValue);
          const doneHeight = CHART_TOP + CHART_INNER_HEIGHT - yForValue(item.selesai, maxValue);
          return (
            <g key={`${item.period}-${index}`}>
              <rect x={x - barWidth - 2} y={yForValue(item.total, maxValue)} width={barWidth} height={totalHeight} rx="7" fill="#bfdbfe" />
              <rect x={x + 2} y={yForValue(item.selesai, maxValue)} width={barWidth} height={doneHeight} rx="7" fill="#2563eb" />
              <text x={x} y={CHART_TOP + CHART_INNER_HEIGHT + 24} textAnchor="middle" className="fill-slate-500 text-[12px] font-bold">
                {item.period}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

function buildLinePath(points: { x: number; y: number }[]) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
}

function buildAreaPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return '';
  const baseline = CHART_TOP + CHART_INNER_HEIGHT;
  return `${buildLinePath(points)} L ${points[points.length - 1].x.toFixed(2)} ${baseline} L ${points[0].x.toFixed(2)} ${baseline} Z`;
}

function LineSvgChart({
  data,
  labels,
  series,
  valueFormatter,
}: {
  data: Record<string, string | number>[];
  labels: string[];
  series: { key: string; label: string; color: string; fill?: string }[];
  valueFormatter?: (value: number) => string;
}) {
  const maxValue = niceMax(data.flatMap((item) => series.map((serie) => Number(item[serie.key] || 0))), 100);
  const step = data.length > 1 ? CHART_INNER_WIDTH / (data.length - 1) : CHART_INNER_WIDTH;
  const pointsFor = (key: string) => data.map((item, index) => ({
    x: CHART_LEFT + step * index,
    y: yForValue(Number(item[key] || 0), maxValue),
  }));

  return (
    <ChartFrame>
      <ChartLegend items={series.map((serie) => ({ label: serie.label, color: serie.color }))} />
      <svg className="h-[calc(100%-1.5rem)] w-full" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="Grafik tren">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = CHART_TOP + CHART_INNER_HEIGHT * ratio;
          const label = maxValue * (1 - ratio);
          return (
            <g key={ratio}>
              <line x1={CHART_LEFT} x2={CHART_WIDTH - CHART_RIGHT} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
              <text x={CHART_LEFT - 10} y={y + 4} textAnchor="end" className="fill-slate-400 text-[11px] font-semibold">
                {valueFormatter ? valueFormatter(label) : Math.round(label)}
              </text>
            </g>
          );
        })}
        {series.map((serie) => {
          const points = pointsFor(serie.key);
          return (
            <g key={serie.key}>
              {serie.fill && <path d={buildAreaPath(points)} fill={serie.fill} opacity="0.38" />}
              <path d={buildLinePath(points)} fill="none" stroke={serie.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((point, index) => (
                <circle key={`${serie.key}-${index}`} cx={point.x} cy={point.y} r="4" fill="#fff" stroke={serie.color} strokeWidth="3" />
              ))}
            </g>
          );
        })}
        {data.map((item, index) => {
          const x = CHART_LEFT + step * index;
          return (
            <text key={`${labels[index]}-${index}`} x={x} y={CHART_TOP + CHART_INNER_HEIGHT + 24} textAnchor="middle" className="fill-slate-500 text-[12px] font-bold">
              {labels[index] ?? item.label ?? ''}
            </text>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

function MiniStat({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string | number;
  helper: string;
  tone: string;
}) {
  return (
    <div className={`${panelClass} min-h-[5.8rem]`}>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black leading-none ${tone}`}>{value}</p>
      <p className="mt-1.5 text-[0.72rem] leading-4 text-slate-500">{helper}</p>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<MonthlyComparisonSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const displayName = user?.full_name?.trim() || 'Pengguna';

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const [summary, monthlyResult] = await Promise.all([
        analyticsApi.getDashboard(),
        analyticsApi.getMonthlySummary(6).catch(() => null),
      ]);
      setData(summary);
      setMonthlySummary(monthlyResult);
    } catch (error) {
      setData(null);
      setMonthlySummary(null);
      setErrorMessage(getApiErrorMessage(error, 'Dashboard belum bisa dimuat.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDashboard]);

  const dailyTaskChart = useMemo(() => {
    return data?.daily_task_trend?.map((item) => ({
      period: formatWeekday(item.date),
      selesai: item.completed,
      total: item.total,
      rate: Math.round(item.completion_rate || 0),
    })) ?? [];
  }, [data]);

  const cashflowChart = useMemo(() => {
    return data?.weekly_cashflow?.map((item) => ({
      day: formatDate(item.date),
      income: item.income,
      expense: item.expense,
      net: item.income - item.expense,
    })) ?? [];
  }, [data]);

  const monthlyScoreChart = useMemo(() => {
    return monthlySummary?.items?.map((item) => ({
      month: item.label,
      productivity: Math.round(item.productivity.score || 0),
      finance: Math.round(item.finance.score || 0),
    })) ?? [];
  }, [monthlySummary]);

  const monthlyFinanceChart = useMemo(() => {
    return monthlySummary?.items?.map((item) => ({
      month: item.label,
      income: item.finance.income,
      expense: item.finance.expense,
      net: item.finance.net,
    })) ?? [];
  }, [monthlySummary]);

  if (loading) {
    return (
      <div className="page-shell">
        <Skeleton className="h-52 rounded-[28px] bg-slate-200/70" />
        <div className="modern-grid">
          {[...Array(4)].map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-[28px] bg-slate-200/70" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-[28px] bg-slate-200/70" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-shell">
        <Card className={cardClass}>
          <CardContent className="flex min-h-[20rem] flex-col items-center justify-center p-6 text-center">
            <AlertTriangle className="mb-4 h-10 w-10 text-amber-600" />
            <h1 className="text-xl font-semibold text-slate-800">Dashboard belum bisa dimuat</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{errorMessage}</p>
            <Button onClick={loadDashboard} className="mt-5 bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="mr-2 h-4 w-4" />
              Muat ulang
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const productivityScore = clampScore(data.productivity_score);
  const financeScore = clampScore(data.finance_score);
  const lifeScore = clampScore(data.life_score);
  const weeklyMetrics = data.weekly_task_metrics;
  const overdueTasks = weeklyMetrics.overdue ?? 0;
  const dueTodayTasks = weeklyMetrics.due_today ?? 0;
  const completedThisWeek = weeklyMetrics.completed_this_week ?? weeklyMetrics.completed;
  const dueThisWeek = weeklyMetrics.due_total ?? weeklyMetrics.total;
  const completionRate = clampScore(weeklyMetrics.completion_rate);
  const xpProgress = data.xp_needed_for_next_level > 0
    ? clampScore((data.xp_balance / data.xp_needed_for_next_level) * 100)
    : 0;
  const activeGoal = (data.numeric_goal_progress ?? []).find((goal) => clampScore(goal.progress_rate) < 100);
  const monthlyNet = data.total_income_month - data.total_expense_month;
  const productivityChart = dailyTaskChart.some((item) => item.total > 0 || item.selesai > 0)
    ? dailyTaskChart
    : [
        {
          period: 'Semua',
          selesai: data.completed_tasks,
          total: data.total_tasks,
          rate: data.total_tasks > 0 ? Math.round((data.completed_tasks / data.total_tasks) * 100) : 0,
        },
        {
          period: 'Pekan',
          selesai: completedThisWeek,
          total: Math.max(dueThisWeek, weeklyMetrics.created_this_week ?? 0, completedThisWeek),
          rate: completionRate,
        },
      ];
  const hasTaskChart = productivityChart.some((item) => item.total > 0 || item.selesai > 0);
  const hasCashflowChart = cashflowChart.some((item) => item.income > 0 || item.expense > 0);
  const hasScoreChart = monthlyScoreChart.length > 0 && monthlyScoreChart.some((item) => item.productivity > 0 || item.finance > 0);
  const hasFinanceChart = monthlyFinanceChart.length > 0 && monthlyFinanceChart.some((item) => item.income > 0 || item.expense > 0);

  return (
    <div className="page-shell">
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className={`${cardClass} overflow-hidden`}>
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-blue-600">Fokus hari ini</p>
                <h1 className="mt-1.5 text-2xl font-black leading-tight tracking-[-0.03em] text-slate-900 md:text-3xl">
                  Halo, {displayName}. Hari ini kamu {getProductivityLabel(productivityScore).toLowerCase()}.
                </h1>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
                  {getProductivityCopy(productivityScore, overdueTasks, dueTodayTasks)}
                </p>
              </div>
              <div className="min-w-[8.5rem] shrink-0 rounded-xl border border-blue-100 bg-blue-50/80 px-5 py-4 text-center">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-blue-700">Skor</p>
                <p className="mt-1 whitespace-nowrap text-4xl font-black leading-none text-blue-700">{Math.round(productivityScore)}</p>
                <p className="text-[0.68rem] font-semibold text-blue-700/70">/ 100</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
              <Button onClick={() => navigate('/productivity?tab=tasks&status=open')} className="h-auto justify-between rounded-xl bg-blue-600 px-3.5 py-2.5 text-left hover:bg-blue-700">
                <span>
                  <span className="block text-sm font-semibold">Kerjakan task</span>
                  <span className="block text-xs text-blue-100">{dueTodayTasks} jatuh tempo hari ini</span>
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button onClick={() => navigate('/productivity?tab=goals')} variant="outline" className="h-auto justify-between rounded-xl bg-white/70 px-3.5 py-2.5 text-left">
                <span>
                  <span className="block text-sm font-semibold">Cek goal</span>
                  <span className="block text-xs text-slate-500">{activeGoal ? `${Math.round(activeGoal.progress_rate)}% berjalan` : 'Buat fokus utama'}</span>
                </span>
                <Target className="h-4 w-4" />
              </Button>
              <Button onClick={() => navigate('/productivity?tab=rewards')} variant="outline" className="h-auto justify-between rounded-xl bg-white/70 px-3.5 py-2.5 text-left">
                <span>
                  <span className="block text-sm font-semibold">Reward shop</span>
                  <span className="block text-xs text-slate-500">{data.coin_balance} koin tersedia</span>
                </span>
                <Coins className="h-4 w-4" />
              </Button>
            </div>

          </CardContent>
        </Card>

        <Card className={cardClass}>
          <CardContent className="space-y-4 p-4">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800">Goal aktif</p>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                  {data.completed_goals}/{data.total_goals} selesai
                </span>
              </div>
              {activeGoal ? (
                <button
                  type="button"
                  onClick={() => navigate(`/productivity?tab=goals&highlight=${activeGoal.id}`)}
                  className="w-full rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <p className="text-sm font-semibold text-slate-900">{activeGoal.title}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <Progress value={clampScore(activeGoal.progress_rate)} className="h-2 bg-white" />
                    <span className="shrink-0 text-xs font-semibold text-blue-700">{Math.round(activeGoal.progress_rate)}%</span>
                  </div>
                </button>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white/60 p-3">
                  <p className="text-sm font-semibold text-slate-800">Belum ada goal aktif</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Buat goal pertama agar task harian punya arah yang jelas.</p>
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800">RPG progress</p>
                <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Lv.{data.level}</span>
              </div>
              <Progress value={xpProgress} className="h-2 bg-slate-200" />
              <p className="mt-2 text-xs text-slate-500">
                {data.xp_balance} / {data.xp_needed_for_next_level} XP menuju level berikutnya.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {data.is_fallback && (
        <Card className="border-amber-200 bg-amber-50/90">
          <CardContent className="flex gap-3 p-4 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{data.warning || 'Dashboard memakai data cadangan. Angka perlu dicek ulang setelah data diperbarui.'}</p>
          </CardContent>
        </Card>
      )}

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_0.9fr]">
        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-slate-800">
              <Zap className="h-4 w-4 text-blue-600" />
              Grafik produktivitas minggu ini
            </CardTitle>
            <p className="text-sm leading-6 text-slate-500">
              Dihitung dari Senin sampai Minggu berdasarkan due date task. Ini evaluasi minggu berjalan, bukan 7 hari ke depan.
            </p>
          </CardHeader>
          <CardContent>
            {hasTaskChart ? (
              <TaskBarChart data={productivityChart} />
            ) : (
              <EmptyChart title="Grafik produktivitas masih kosong" description="Tambahkan task, lalu tandai selesai agar grafik mulai menampilkan progres." />
            )}
          </CardContent>
        </Card>

        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-slate-800">
              <Wallet className="h-4 w-4 text-emerald-600" />
              Grafik keuangan 7 hari
            </CardTitle>
            <p className="text-sm leading-6 text-slate-500">
              Ini memakai 7 hari terakhir agar pemasukan dan pengeluaran terbaru langsung terlihat.
            </p>
          </CardHeader>
          <CardContent>
            {hasCashflowChart ? (
              <LineSvgChart
                data={cashflowChart}
                labels={cashflowChart.map((item) => item.day)}
                series={[
                  { key: 'income', label: 'Pemasukan', color: '#059669', fill: '#bbf7d0' },
                  { key: 'expense', label: 'Pengeluaran', color: '#dc2626', fill: '#fecaca' },
                ]}
                valueFormatter={formatShortCurrency}
              />
            ) : (
              <EmptyChart title="Grafik keuangan masih kosong" description="Catat pemasukan atau pengeluaran agar tren 7 hari bisa dievaluasi." />
            )}
          </CardContent>
        </Card>
      </section>

      <div className="modern-grid">
        <MiniStat
          label="Task minggu ini"
          value={`${completedThisWeek}/${dueThisWeek}`}
          helper={`${Math.round(completionRate)}% tugas selesai. Idealnya stabil di atas ${PRODUCTIVE_SCORE}%.`}
          tone="text-emerald-600"
        />
        <MiniStat
          label="Skor gabungan"
          value={Math.round(lifeScore)}
          helper="Gabungan produktivitas dan disiplin keuangan."
          tone="text-blue-600"
        />
        <MiniStat
          label="Disiplin keuangan"
          value={Math.round(financeScore)}
          helper={`Bulan ini ${monthlyNet >= 0 ? 'surplus' : 'defisit'} ${formatCurrency(Math.abs(monthlyNet))}.`}
          tone={monthlyNet >= 0 ? 'text-emerald-600' : 'text-red-600'}
        />
        <MiniStat
          label="Koin reward"
          value={data.coin_balance}
          helper="Gunakan untuk reward yang kamu buat sendiri."
          tone="text-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_0.85fr]">
        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-slate-800">
              <Zap className="h-4 w-4 text-blue-600" />
              Produktivitas vs target task
            </CardTitle>
            <p className="text-sm leading-6 text-slate-500">Ringkasan task minggu ini: total task yang jatuh tempo dibanding yang selesai.</p>
          </CardHeader>
          <CardContent>
            {hasTaskChart ? (
              <TaskBarChart data={productivityChart} />
            ) : (
              <EmptyChart title="Belum ada tren task" description="Buat task dan selesaikan beberapa item agar grafik produktivitas mulai terbaca." />
            )}
          </CardContent>
        </Card>

        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-slate-800">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Disiplin bulanan
            </CardTitle>
            <p className="text-sm leading-6 text-slate-500">Cukup dua garis: produktivitas dan keuangan.</p>
          </CardHeader>
          <CardContent>
            {hasScoreChart ? (
              <LineSvgChart
                data={monthlyScoreChart}
                labels={monthlyScoreChart.map((item) => item.month)}
                series={[
                  { key: 'productivity', label: 'Produktivitas', color: '#2563eb' },
                  { key: 'finance', label: 'Keuangan', color: '#059669' },
                ]}
              />
            ) : (
              <EmptyChart title="Belum ada skor bulanan" description="Data bulanan akan muncul setelah ada task, habit, dan transaksi yang cukup." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[0.85fr_1fr]">
        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-slate-800">
              <Wallet className="h-4 w-4 text-emerald-600" />
              Kontrol keuangan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={panelClass}>
              <p className="text-xs text-slate-500">Pemasukan bulan ini</p>
              <p className="mt-1 text-xl font-bold text-emerald-600">{formatCurrency(data.total_income_month)}</p>
            </div>
            <div className={panelClass}>
              <p className="text-xs text-slate-500">Pengeluaran bulan ini</p>
              <p className="mt-1 text-xl font-bold text-red-600">{formatCurrency(data.total_expense_month)}</p>
            </div>
            <Button onClick={() => navigate('/finance?tab=budgets')} variant="outline" className="w-full justify-between rounded-2xl bg-white/70">
              Atur budget
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="text-base text-slate-800">Tren arus kas</CardTitle>
            <p className="text-sm leading-6 text-slate-500">Dipakai untuk melihat apakah disiplin uang membaik, bukan untuk akuntansi rumit.</p>
          </CardHeader>
          <CardContent>
            {hasFinanceChart ? (
              <LineSvgChart
                data={monthlyFinanceChart}
                labels={monthlyFinanceChart.map((item) => item.month)}
                series={[
                  { key: 'income', label: 'Pemasukan', color: '#059669', fill: '#bbf7d0' },
                  { key: 'expense', label: 'Pengeluaran', color: '#dc2626', fill: '#fecaca' },
                ]}
                valueFormatter={formatShortCurrency}
              />
            ) : (
              <EmptyChart title="Belum ada tren keuangan" description="Catat pemasukan, pengeluaran, dan budget agar tren disiplin keuangan terlihat." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="text-base text-slate-800">Yang perlu dilihat hari ini</CardTitle>
          <p className="text-sm leading-6 text-slate-500">Daftar pendek saja supaya tidak terasa seperti mengurus admin hidup.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {(data.upcoming_deadlines ?? []).slice(0, 3).map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              onClick={() => navigate(item.type === 'bill' ? `/finance?tab=bills&highlight=${item.id}` : `/productivity?tab=tasks&highlight=${item.id}`)}
              className={`${panelClass} text-left transition hover:border-blue-200 hover:bg-blue-50/50`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(item.due_date)} - {item.days_left} hari lagi</p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-slate-400" />
              </div>
            </button>
          ))}
          {(data.upcoming_deadlines ?? []).length === 0 && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 lg:col-span-3">
              <p className="text-sm font-semibold text-emerald-800">Tidak ada deadline mendesak.</p>
              <p className="mt-1 text-xs leading-5 text-emerald-700">Gunakan waktu untuk task yang paling dekat dengan goal aktif.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
