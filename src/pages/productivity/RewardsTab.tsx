import { useCallback, useEffect, useMemo, useState } from 'react';
import { rewardsApi } from '@/api/rewards';
import type { GamificationConfig, Reward } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Gift, Coins } from 'lucide-react';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import { getApiErrorMessage } from '@/lib/api-error';
import { isBlank, parsePositiveNumber } from '@/lib/form-validation';
import { compactCardClass, compactContentClass, compactGridClass, compactIconButtonClass, compactIconClass, compactTitleClass } from './productivity-utils';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { useAuth } from '@/context/useAuth';

const DEFAULT_NORMAL_DAILY_COINS = 40;

const REWARD_PRICE_PRESETS = [
  {
    label: 'Reward mikro',
    price: 15,
    description: 'Snack kecil, istirahat singkat, atau scroll 10-15 menit.',
  },
  {
    label: '30 menit sosmed',
    price: 30,
    description: 'Reward harian ringan, cocok setelah hari yang cukup produktif.',
  },
  {
    label: '1 episode / 1 jam game',
    price: 60,
    description: 'Reward harian sedang, butuh beberapa tugas atau habit selesai.',
  },
  {
    label: 'Nonton film',
    price: 85,
    description: 'Reward harian besar, sebaiknya ditebus setelah hari produktif penuh.',
  },
  {
    label: 'Reward mingguan',
    price: 250,
    description: 'Makan enak, beli item kecil, atau hadiah akhir pekan.',
  },
];

function estimateDailyCoins(config: GamificationConfig | null) {
  if (!config) {
    return {
      light: 25,
      normal: DEFAULT_NORMAL_DAILY_COINS,
      productive: 90,
    };
  }

  const easyTask = config.task_easy_coins + config.task_easy_on_time_bonus_coins;
  const mediumTask = config.task_medium_coins + config.task_medium_on_time_bonus_coins;
  const hardTask = config.task_hard_coins + config.task_hard_on_time_bonus_coins;
  const habit = config.good_habit_daily_coins;

  return {
    light: easyTask + habit,
    normal: mediumTask + (habit * 2),
    productive: hardTask + mediumTask + (habit * 3),
  };
}

function estimateDays(price: number, dailyCoins: number) {
  return Math.max(1, Math.ceil(price / Math.max(1, dailyCoins)));
}

function getRewardPriceCategory(price: number) {
  if (price <= 20) return 'Reward mikro';
  if (price <= 40) return 'Reward harian ringan';
  if (price <= 70) return 'Reward harian sedang';
  if (price <= 100) return 'Reward harian besar';
  if (price <= 350) return 'Reward mingguan';
  return 'Reward besar';
}

export default function RewardsTab() {
  const { toast } = useToast();
  const { refreshUser, user } = useAuth();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardConfig, setRewardConfig] = useState<GamificationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [newRewardTitle, setNewRewardTitle] = useState('');
  const [newRewardDesc, setNewRewardDesc] = useState('');
  const [newRewardPrice, setNewRewardPrice] = useState(35);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rewardSearch, setRewardSearch] = useState('');
  const [purchasingRewardId, setPurchasingRewardId] = useState<string | null>(null);

  const loadRewards = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [data, config] = await Promise.all([
        rewardsApi.getMyRewards(),
        rewardsApi.getConfig(),
      ]);
      setRewards(data);
      setRewardConfig(config);
    } catch (error) {
      console.error(error);
      setRewards([]);
      setRewardConfig(null);
      setLoadError(getApiErrorMessage(error, 'Gagal memuat data hadiah.'));
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadRewards();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadRewards]);

  const createReward = async () => {
    if (isBlank(newRewardTitle)) {
      toast({ title: 'Judul hadiah wajib diisi', variant: 'destructive' });
      return;
    }
    const price = parsePositiveNumber(String(newRewardPrice), 'Harga hadiah');
    if (!price.ok) {
      toast({ title: price.message, variant: 'destructive' });
      return;
    }
    try {
      await rewardsApi.create({
        title: newRewardTitle,
        description: newRewardDesc,
        price: price.value,
      });
      setNewRewardTitle('');
      setNewRewardDesc('');
      setNewRewardPrice(35);
      setDialogOpen(false);
      await loadRewards();
      toast({ title: 'Hadiah berhasil dibuat' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal membuat hadiah'), variant: 'destructive' });
    }
  };

  const refreshRewardState = useCallback(async () => {
    const results = await Promise.allSettled([
      loadRewards(),
      refreshUser(),
    ]);

    const hasRejectedRefresh = results.some((result) => result.status === 'rejected');
    if (hasRejectedRefresh) {
      toast({
        title: 'Hadiah diproses, tetapi sebagian data belum bisa diperbarui.',
        description: 'Muat ulang halaman jika saldo koin belum berubah.',
      });
    }
  }, [loadRewards, refreshUser, toast]);

  const purchaseReward = async (reward: Reward) => {
    if (purchasingRewardId) return;

    setPurchasingRewardId(reward.id);
    try {
      const result = await rewardsApi.purchase(reward.id);
      await refreshRewardState();

      if (result.success) {
        toast({
          title: result.message || 'Hadiah berhasil ditukar',
          description: `Sisa koin: ${result.remaining_coins}`,
        });
      } else {
        toast({ title: result.message || 'Hadiah belum bisa ditukar', variant: 'destructive' });
      }
    } catch (error) {
      await refreshRewardState();
      toast({ title: getApiErrorMessage(error, 'Gagal menukar hadiah'), variant: 'destructive' });
    } finally {
      setPurchasingRewardId(null);
    }
  };

  const confirmPurchaseReward = (reward: Reward) => {
    const currentCoins = user?.coin_balance ?? 0;
    const remainingCoins = currentCoins - reward.price;

    confirm({
      title: 'Tukar hadiah?',
      description: `Tukar ${reward.price} koin untuk hadiah "${reward.title}"? ${remainingCoins >= 0 ? `Sisa koin setelah penukaran: ${remainingCoins}.` : 'Koin Anda belum cukup untuk hadiah ini.'}`,
      confirmLabel: 'Tukar',
      onConfirm: () => purchaseReward(reward),
    });
  };

  const deleteReward = async (id: string) => {
    try {
      await rewardsApi.delete(id);
      await loadRewards();
      await refreshUser();
      toast({ title: 'Hadiah berhasil dihapus' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal menghapus hadiah'), variant: 'destructive' });
    }
  };

  const filteredRewards = useMemo(() => {
    const normalizedSearch = rewardSearch.trim().toLowerCase();

    return rewards.filter((reward) => !normalizedSearch
      || reward.title.toLowerCase().includes(normalizedSearch)
      || (reward.description || '').toLowerCase().includes(normalizedSearch));
  }, [rewardSearch, rewards]);
  const dailyCoinEstimate = estimateDailyCoins(rewardConfig);
  const estimatedRewardDays = estimateDays(Number(newRewardPrice || 0), dailyCoinEstimate.normal);

  if (loading) return <LoadingState label="Memuat hadiah..." />;
  if (loadError) {
    return (
      <ErrorState
        title="Hadiah belum bisa dimuat"
        description={loadError}
        onRetry={() => void loadRewards()}
      />
    );
  }

  return (
    <>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Toko Hadiah</h3>
            <p className="text-sm text-slate-500">Tukar hadiah dengan koin yang Anda kumpulkan.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-1" /> Tambah Hadiah
            </Button>
          </DialogTrigger>
          <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800">
            <DialogHeader>
              <DialogTitle>Buat Hadiah</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Judul</Label>
                <Input
                  value={newRewardTitle}
                  onChange={(e) => setNewRewardTitle(e.target.value)}
                  placeholder="Contoh: Nonton film"
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <Label>Harga (koin)</Label>
                <Input
                  type="number"
                  value={newRewardPrice}
                  onChange={(e) => setNewRewardPrice(Number(e.target.value))}
                  min={1}
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {getRewardPriceCategory(Number(newRewardPrice || 0))}. Saran: 30 menit sosmed 25-35 koin, nonton film 70-90 koin, reward mingguan 180-350 koin.
                </p>
              </div>
              <details className="quick-form-advanced">
                <summary>Detail lanjutan</summary>
                <div className="quick-form-advanced-content space-y-4">
                  <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-3 text-xs leading-5 text-amber-900">
                    <p className="font-semibold">Referensi harga reward</p>
                    <p className="mt-1">
                      Estimasi pemasukan normal: sekitar {dailyCoinEstimate.normal} koin/hari. Harga {newRewardPrice || 0} koin kira-kira butuh {estimatedRewardDays} hari produktif.
                    </p>
                  </div>
                  <div>
                    <Label>Deskripsi</Label>
                    <Input
                      value={newRewardDesc}
                      onChange={(e) => setNewRewardDesc(e.target.value)}
                      placeholder="Deskripsi singkat..."
                      className="bg-white/70 border-slate-200 text-slate-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-700">Pilih harga cepat</p>
                    <div className="grid grid-cols-1 gap-2">
                      {REWARD_PRICE_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setNewRewardPrice(preset.price)}
                          className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                            newRewardPrice === preset.price
                              ? 'border-blue-300 bg-blue-50 text-blue-800'
                              : 'border-slate-200 bg-white/70 text-slate-600 hover:border-blue-200 hover:bg-blue-50/50'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span className="font-semibold">{preset.label}</span>
                            <span>{preset.price} koin</span>
                          </span>
                          <span className="mt-1 block leading-5">{preset.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
              <Button onClick={createReward} className="w-full bg-blue-600 hover:bg-blue-700">
                Buat Hadiah
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Input
        value={rewardSearch}
        onChange={(event) => setRewardSearch(event.target.value)}
        placeholder="Cari reward atau deskripsi..."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white/60 p-4">
          <p className="text-xs text-slate-500">Hari ringan</p>
          <p className="mt-1 text-lg font-bold text-slate-800">~{dailyCoinEstimate.light} koin</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">1 tugas mudah tepat waktu + 1 habit baik.</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
          <p className="text-xs text-blue-700">Hari normal</p>
          <p className="mt-1 text-lg font-bold text-blue-800">~{dailyCoinEstimate.normal} koin</p>
          <p className="mt-1 text-xs leading-5 text-blue-700">1 tugas sedang tepat waktu + 2 habit baik.</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
          <p className="text-xs text-emerald-700">Hari produktif</p>
          <p className="mt-1 text-lg font-bold text-emerald-800">~{dailyCoinEstimate.productive} koin</p>
          <p className="mt-1 text-xs leading-5 text-emerald-700">Tugas sulit + tugas sedang + 3 habit baik.</p>
        </div>
      </div>

      <div className={compactGridClass}>
        {filteredRewards.map((reward) => {
          const currentCoins = user?.coin_balance ?? 0;
          const missingCoins = Math.max(0, reward.price - currentCoins);
          const daysToAfford = estimateDays(missingCoins || reward.price, dailyCoinEstimate.normal);

          return (
            <Card key={reward.id} className={compactCardClass}>
              <CardContent className={compactContentClass}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="app-list-icon bg-amber-50 text-amber-600">
                      <Gift className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className={`${compactTitleClass} text-slate-800`}>{reward.title}</h4>
                      {reward.description && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{reward.description}</p>}
                      {reward.times_purchased > 0 && (
                        <p className="mt-1 text-xs text-slate-500">Ditukar {reward.times_purchased}x</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      disabled={currentCoins < reward.price || purchasingRewardId === reward.id}
                      onClick={() => confirmPurchaseReward(reward)}
                      className="h-9 px-3 bg-amber-600 text-xs hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Gift className="mr-1 h-4 w-4" />
                      {purchasingRewardId === reward.id ? 'Memproses...' : 'Tukar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => confirm({
                        title: 'Hapus hadiah?',
                        description: 'Hadiah ini akan dihapus dari daftar.',
                        onConfirm: () => deleteReward(reward.id),
                      })}
                      className={`${compactIconButtonClass} text-red-600 hover:text-red-700`}
                    >
                      <Trash2 className={compactIconClass} />
                    </Button>
                  </div>
                </div>
                <div className="app-list-highlight flex items-center gap-2 bg-amber-50 text-amber-600">
                  <Coins className="h-4 w-4" />
                  {reward.price} koin · {getRewardPriceCategory(reward.price)}
                </div>
                {currentCoins < reward.price ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Kurang {missingCoins} koin. Dengan hari normal, kira-kira perlu {daysToAfford} hari produktif lagi.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    Koin cukup. Harga ini setara sekitar {estimateDays(reward.price, dailyCoinEstimate.normal)} hari produktif normal.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {rewards.length === 0 && (
        <EmptyState
          icon={Gift}
          title="Belum ada hadiah"
          description="Buat hadiah pertama agar koin punya tujuan yang menyenangkan."
        />
      )}
      {rewards.length > 0 && filteredRewards.length === 0 && (
        <EmptyState
          icon={Gift}
          title="Hadiah tidak ditemukan"
          description="Coba ubah kata kunci pencarian."
        />
      )}
    </div>
    {confirmDialog}
    </>
  );
}
