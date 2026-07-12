import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Coins,
  Flame,
  RefreshCw,
  Settings2,
  Sparkles,
  TimerReset,
  Zap,
} from 'lucide-react';
import {
  microBreakApi,
  type MicroBreakCompleteResponse,
  type MicroBreakDurationKey,
  type MicroBreakRewardInfo,
  type MicroBreakTask,
} from '@/api/microBreak';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api-error';

type MicroBreakOption = {
  key: MicroBreakDurationKey;
  label: string;
  subtitle: string;
};

type MicroBreakWidgetProps = {
  onRewarded?: (result: MicroBreakCompleteResponse) => void | Promise<void>;
};

const fallbackRewards: Record<MicroBreakDurationKey, MicroBreakRewardInfo> = {
  '5-10': { xp: 8, coins: 4 },
  '15-30': { xp: 15, coins: 8 },
  '30-60': { xp: 25, coins: 12 },
  relaxed: { xp: 12, coins: 6 },
};

const microBreakOptions: MicroBreakOption[] = [
  { key: '5-10', label: '5-10 menit', subtitle: 'Reset cepat' },
  { key: '15-30', label: '15-30 menit', subtitle: 'Jeda produktif' },
  { key: '30-60', label: '30-60 menit', subtitle: 'Recharge serius' },
  { key: 'relaxed', label: 'Santai', subtitle: 'Tanpa tekanan' },
];

function pickRandomTask(tasks: MicroBreakTask[], previousTaskId?: string): MicroBreakTask | null {
  if (tasks.length === 0) return null;
  const candidates = tasks.filter((task) => task.id !== previousTaskId);
  const pool = candidates.length > 0 ? candidates : tasks;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function MicroBreakWidget({ onRewarded }: MicroBreakWidgetProps) {
  const [selectedKey, setSelectedKey] = useState<MicroBreakDurationKey>('5-10');
  const [tasks, setTasks] = useState<MicroBreakTask[]>([]);
  const [currentTask, setCurrentTask] = useState<MicroBreakTask | null>(null);
  const [rewards, setRewards] = useState<Record<MicroBreakDurationKey, MicroBreakRewardInfo>>(fallbackRewards);
  const [streak, setStreak] = useState(0);
  const [dailyCompletions, setDailyCompletions] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(6);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [message, setMessage] = useState('Pilih durasi jeda, lalu sistem akan mengambil micro task acak dari data yang Anda input di halaman Produktivitas.');
  const [lastReward, setLastReward] = useState<MicroBreakCompleteResponse | null>(null);

  const selectedOption = useMemo(
    () => microBreakOptions.find((option) => option.key === selectedKey) ?? microBreakOptions[0],
    [selectedKey],
  );

  const selectedReward = rewards[selectedOption.key] ?? fallbackRewards[selectedOption.key];
  const isDailyLimitReached = dailyCompletions >= dailyLimit;

  const loadSummary = useCallback(async () => {
    setIsLoadingSummary(true);
    try {
      const summary = await microBreakApi.getSummary();
      setRewards({ ...fallbackRewards, ...summary.rewards });
      setStreak(summary.micro_break_streak);
      setDailyCompletions(summary.daily_completions);
      setDailyLimit(summary.daily_limit);
    } catch {
      setMessage('Widget siap dipakai. Ringkasan streak akan muncul setelah backend aktif.');
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    try {
      const taskList = await microBreakApi.getTasks(selectedKey);
      setTasks(taskList);
      setCurrentTask((previous) => {
        const stillAvailable = taskList.find((task) => task.id === previous?.id);
        return stillAvailable ?? pickRandomTask(taskList);
      });
      if (taskList.length === 0) {
        setMessage('Belum ada micro task untuk durasi ini. Tambahkan tugasnya di halaman Produktivitas > Micro Task.');
      }
    } catch (error) {
      setTasks([]);
      setCurrentTask(null);
      setMessage(getApiErrorMessage(error, 'Micro task belum bisa dimuat.'));
    } finally {
      setIsLoadingTasks(false);
    }
  }, [selectedKey]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const changeDuration = (option: MicroBreakOption) => {
    setSelectedKey(option.key);
    setLastReward(null);
    setMessage('Memuat daftar micro task untuk durasi yang dipilih.');
  };

  const shuffleTask = () => {
    const nextTask = pickRandomTask(tasks, currentTask?.id);
    setCurrentTask(nextTask);
    setLastReward(null);
    setMessage(nextTask ? 'Tugas diganti. Pilih yang paling realistis untuk kondisi sekarang.' : 'Belum ada tugas untuk diganti.');
  };

  const completeTask = async () => {
    if (!currentTask) {
      setMessage('Tambahkan micro task terlebih dahulu di halaman Produktivitas > Micro Task.');
      return;
    }

    if (isDailyLimitReached) {
      setMessage('Batas reward micro break hari ini sudah tercapai. Tetap boleh istirahat tanpa klaim reward.');
      return;
    }

    setIsCompleting(true);
    try {
      const result = await microBreakApi.complete({
        task_id: currentTask.id,
        task_title: currentTask.title,
        duration_key: currentTask.duration_key,
        category: currentTask.category,
      });

      setLastReward(result);
      setStreak(result.micro_break_streak);
      setDailyCompletions(result.daily_completions);
      setDailyLimit(result.daily_limit);
      setMessage(result.message);
      if (result.success) {
        await onRewarded?.(result);
      }
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'Reward micro break belum bisa disimpan.'));
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <section className="micro-break-card micro-break-card-compact" aria-label="Micro break widget">
      <div className="micro-break-glow" />
      <div className="micro-break-panel micro-break-combined-panel">
        <div className="micro-break-combined-header">
          <div className="min-w-0">
            <p className="micro-break-eyebrow">
              <TimerReset className="h-3.5 w-3.5" />
              Micro Break
            </p>
            <h2 className="mt-2 text-2xl font-black leading-tight tracking-[-0.04em] text-slate-900 dark:text-slate-50 md:text-3xl">
              Jeda kecil, tetap dapat progres.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-300">
              Jalankan micro break dari dashboard. Input dan pengelolaan daftar tugas tetap ada di halaman Produktivitas.
            </p>
          </div>

          <div className="micro-break-status-badges">
            <div className="micro-break-streak-badge" title="Streak micro break">
              <Flame className="h-4 w-4" />
              {isLoadingSummary ? '-' : streak}
            </div>
            <div className="micro-break-reward-box micro-break-reward-box-compact">
              <span>Reward</span>
              <strong>+{selectedReward.xp} XP</strong>
              <strong>+{selectedReward.coins} koin</strong>
              <small>{tasks.length} tugas</small>
            </div>
          </div>
        </div>

        <div className="micro-break-main-grid">
          <div className="micro-break-controls">
            <div className="micro-break-duration-grid">
              {microBreakOptions.map((option) => {
                const optionReward = rewards[option.key] ?? fallbackRewards[option.key];
                const active = option.key === selectedOption.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => changeDuration(option)}
                    className={`micro-break-duration ${active ? 'micro-break-duration-active' : ''}`}
                  >
                    <span className="block text-sm font-extrabold">{option.label}</span>
                    <span className="mt-0.5 block text-[0.68rem] font-semibold opacity-75">{option.subtitle}</span>
                    <span className="mt-2 inline-flex items-center gap-1 text-[0.68rem] font-black">
                      <Zap className="h-3 w-3" /> +{optionReward.xp} XP
                      <Coins className="ml-1 h-3 w-3" /> +{optionReward.coins}
                    </span>
                  </button>
                );
              })}
            </div>

            <Button asChild type="button" variant="outline" className="micro-break-button-secondary mt-3 w-full">
              <Link to="/productivity?tab=micro-tasks">
                <Settings2 className="mr-2 h-4 w-4" />
                Kelola micro task
              </Link>
            </Button>
          </div>

          <div className="micro-break-task-box">
            <p className="micro-break-chip">
              <Sparkles className="h-3.5 w-3.5" />
              {selectedOption.label} - {selectedOption.subtitle}
            </p>

            {isLoadingTasks ? (
              <h3 className="mt-3 text-xl font-black leading-tight text-slate-900 dark:text-slate-50 md:text-2xl">Memuat micro task...</h3>
            ) : currentTask ? (
              <>
                <h3 className="mt-3 text-xl font-black leading-tight text-slate-900 dark:text-slate-50 md:text-2xl">{currentTask.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">
                  {currentTask.hint || 'Tidak ada catatan tambahan. Kerjakan secukupnya sesuai durasi yang dipilih.'}
                </p>
              </>
            ) : (
              <>
                <h3 className="mt-3 text-xl font-black leading-tight text-slate-900 dark:text-slate-50 md:text-2xl">Belum ada micro task</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">
                  Buka halaman Produktivitas &gt; Micro Task untuk menambahkan daftar tugas kecil sesuai durasi.
                </p>
              </>
            )}

            <div className="micro-break-task-actions">
              <div className="micro-break-progress-line">
                <span>{dailyCompletions}/{dailyLimit} reward hari ini</span>
                <span>{isDailyLimitReached ? 'Limit tercapai' : 'Masih bisa klaim'}</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={shuffleTask}
                  disabled={isCompleting || isLoadingTasks || tasks.length === 0}
                  className="micro-break-button-secondary"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Ganti tugas
                </Button>
                <Button
                  type="button"
                  onClick={completeTask}
                  disabled={isCompleting || isDailyLimitReached || !currentTask}
                  className="micro-break-button-primary"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {isCompleting ? 'Menyimpan...' : 'Selesai'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="micro-break-message">
          {message}
          {lastReward?.success && (
            <span className="ml-1 text-blue-600 dark:text-sky-300">
              Saldo baru: Lv.{lastReward.new_level}, {lastReward.new_xp} XP, {lastReward.new_coins} koin.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
