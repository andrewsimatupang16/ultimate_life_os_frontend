import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/useAuth';
import { profileApi } from '@/api/profile';
import { rewardsApi } from '@/api/rewards';
import type { GamificationConfig, CoinLedger, UserUpdate } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Trophy, Coins, Star, Copy,
  Shield, Zap, Target, Gift, Loader2,
  TrendingUp, TrendingDown,
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<GamificationConfig | null>(null);
  const [coinHistory, setCoinHistory] = useState<CoinLedger[]>([]);
  const [, setLoading] = useState(true);

  // Edit states
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [configData, historyData] = await Promise.all([
        rewardsApi.getConfig(),
        profileApi.getCoinHistory(20),
      ]);
      setConfig(configData);
      setCoinHistory(historyData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  useEffect(() => {
    if (!user) return;

    const timeoutId = window.setTimeout(() => {
      setFullName(user.full_name || '');
      setEmail(user.email || '');
      setAvatarUrl(user.avatar_url || '');
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [user]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updateData: UserUpdate = {};
      if (fullName !== user?.full_name) updateData.full_name = fullName;
      if (email !== user?.email) updateData.email = email;
      if (avatarUrl !== user?.avatar_url) updateData.avatar_url = avatarUrl;
      if (password.trim()) updateData.password = password;

      if (Object.keys(updateData).length === 0) {
        toast({ title: 'Tidak ada perubahan untuk disimpan' });
        setSaving(false);
        return;
      }

      await profileApi.update(updateData);
      await refreshUser();
      setPassword('');
      toast({ title: 'Profil berhasil diperbarui' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal memperbarui profil'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const copyFriendCode = () => {
    if (user?.friend_code) {
      navigator.clipboard.writeText(user.friend_code);
      toast({ title: 'Kode teman disalin' });
    }
  };

  if (!user) return null;

  const xpProgress = Math.min(100, (user.xp_balance / (100 * (user.level ** 2))) * 100);

  return (
    <div className="page-shell">
      <div className="page-hero">
        <p className="page-hero-eyebrow">Profil</p>
        <h1 className="page-hero-title">Kelola profil dan statistik akun</h1>
        <p className="page-hero-copy">Ubah identitas, cek kode teman, lihat aturan hadiah, dan riwayat koin.</p>
      </div>

      {/* User Card */}
      <Card className="border-slate-200 bg-[#F8FAFC]">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24 border-4 border-blue-500">
                <AvatarImage src={avatarUrl || user.avatar_url || ''} />
                <AvatarFallback className="bg-white/60 text-slate-700 text-3xl">
                  {user.full_name?.[0] || user.email[0]}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full">
                Lv.{user.level}
              </div>
            </div>
            <div className="text-center sm:text-left flex-1">
              <h3 className="text-xl font-bold text-slate-800">{user.full_name || 'Belum ada nama'}</h3>
              <p className="text-slate-500">{user.email}</p>
              <div className="flex items-center justify-center sm:justify-start gap-4 mt-3">
                <div className="flex items-center gap-1 text-amber-600">
                  <Coins className="w-4 h-4" />
                  <span className="font-semibold">{user.coin_balance}</span>
                </div>
                <div className="flex items-center gap-1 text-purple-600">
                  <Star className="w-4 h-4" />
                  <span className="font-semibold">{user.xp_balance} XP</span>
                </div>
              </div>
              <div className="mt-3 max-w-xs">
                <Progress value={xpProgress} className="h-2 bg-white/60" />
                <p className="text-xs text-slate-500 mt-1">
                  {user.xp_balance} / {100 * (user.level ** 2)} XP menuju level berikutnya
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Friend Code */}
      <Card className="border-slate-200 bg-[#F8FAFC]">
        <CardHeader>
          <CardTitle className="text-slate-800 text-base flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Kode Teman
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-3">
            Bagikan kode 12 digit ini ke teman Anda untuk mengajukan koneksi partner:
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <code className="min-w-0 flex-1 bg-white/60 border border-slate-200 rounded-lg px-4 py-3 text-center text-xl font-mono font-bold text-blue-600 tracking-widest sm:text-2xl">
              {user.friend_code}
            </code>
            <Button onClick={copyFriendCode} variant="outline" className="border-slate-200 text-slate-600 hover:bg-white/60">
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="edit" className="space-y-4">
        <TabsList className="border border-slate-200 bg-[#F8FAFC]/85">
          <TabsTrigger value="edit" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Edit Profil</TabsTrigger>
          <TabsTrigger value="gamification" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Aturan Hadiah</TabsTrigger>
          <TabsTrigger value="coins" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Riwayat Koin</TabsTrigger>
        </TabsList>

        {/* Edit Profile */}
        <TabsContent value="edit">
          <Card className="border-slate-200 bg-[#F8FAFC]">
            <CardContent className="p-4">
              <form onSubmit={(event) => { event.preventDefault(); void saveProfile(); }} className="space-y-4">
              <div>
                <Label className="text-slate-700">Nama lengkap</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <Label className="text-slate-700">Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <Label className="text-slate-700">Link foto profil</Label>
                <Input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
                <p className="text-xs text-slate-500 mt-1">Masukkan link gambar yang bisa diakses publik.</p>
              </div>
              <Separator className="bg-white/60" />
              <div>
                <Label className="text-slate-700">Password baru (kosongkan jika tidak ingin mengubah)</Label>
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="******"
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <Button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Simpan Perubahan
              </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gamification Config */}
        <TabsContent value="gamification">
          <Card className="border-slate-200 bg-[#F8FAFC]">
            <CardHeader>
              <CardTitle className="text-slate-800 text-base flex items-center gap-2">
                <Gift className="w-5 h-5 text-purple-600" />
                Aturan Hadiah
              </CardTitle>
            </CardHeader>
            <CardContent>
              {config && (
                <div className="space-y-6">
                  {/* Task Rewards */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-600 mb-3 flex items-center gap-1">
                      <Target className="w-4 h-4 text-blue-600" /> Hadiah Penyelesaian Tugas
                    </h4>
                    <div className="modern-grid">
                      <div className="p-3 bg-white/60 rounded-lg text-center">
                        <Badge className="bg-green-50 text-green-600 border-green-200 mb-2">Mudah</Badge>
                        <p className="text-lg font-bold text-slate-800">+{config.task_easy_xp} XP</p>
                        <p className="text-sm text-amber-600">+{config.task_easy_coins} koin</p>
                      </div>
                      <div className="p-3 bg-white/60 rounded-lg text-center">
                        <Badge className="bg-yellow-50 text-yellow-600 border-yellow-200 mb-2">Sedang</Badge>
                        <p className="text-lg font-bold text-slate-800">+{config.task_medium_xp} XP</p>
                        <p className="text-sm text-amber-600">+{config.task_medium_coins} koin</p>
                      </div>
                      <div className="p-3 bg-white/60 rounded-lg text-center">
                        <Badge className="bg-red-50 text-red-600 border-red-200 mb-2">Sulit</Badge>
                        <p className="text-lg font-bold text-slate-800">+{config.task_hard_xp} XP</p>
                        <p className="text-sm text-amber-600">+{config.task_hard_coins} koin</p>
                      </div>
                    </div>
                  </div>

                  {/* Goal & SubGoal */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-600 mb-3 flex items-center gap-1">
                      <Trophy className="w-4 h-4 text-amber-600" /> Hadiah Target dan Target Turunan
                    </h4>
                    <div className="modern-grid">
                      <div className="p-3 bg-white/60 rounded-lg text-center">
                        <p className="text-sm text-slate-500">Target selesai</p>
                        <p className="text-lg font-bold text-slate-800">+{config.goal_complete_xp} XP</p>
                        <p className="text-sm text-amber-600">+{config.goal_complete_coins} koin</p>
                      </div>
                      <div className="p-3 bg-white/60 rounded-lg text-center">
                        <p className="text-sm text-slate-500">Target turunan selesai</p>
                        <p className="text-lg font-bold text-slate-800">+{config.subgoal_complete_xp} XP</p>
                        <p className="text-sm text-amber-600">+{config.subgoal_complete_coins} koin</p>
                      </div>
                    </div>
                  </div>

                  {/* Habits */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-600 mb-3 flex items-center gap-1">
                      <Zap className="w-4 h-4 text-emerald-600" /> Hadiah Kebiasaan
                    </h4>
                    <div className="modern-grid">
                      <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <p className="text-sm text-emerald-600 font-medium">Kebiasaan baik harian</p>
                        <p className="text-slate-800">+{config.good_habit_daily_xp} XP, +{config.good_habit_daily_coins} koin</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Bonus rangkaian: +{(config.good_habit_streak_bonus_multiplier * 100).toFixed(0)}% untuk setiap rangkaian
                        </p>
                      </div>
                      <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                        <p className="text-sm text-red-600 font-medium">Kebiasaan buruk</p>
                        <p className="text-slate-800">-{config.bad_habit_penalty_coins} koin</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Penalti naik {config.bad_habit_penalty_multiplier}x setelah {config.bad_habit_penalty_threshold} kali dalam {config.bad_habit_penalty_window_days} hari
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Level Formula */}
                  <div className="p-3 bg-white/60 rounded-lg">
                    <p className="text-sm text-slate-500">
                      Kebutuhan naik level: <span className="text-slate-800 font-mono">{config.level_up_formula_base} x (level ^ 2)</span> XP
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coin History */}
        <TabsContent value="coins">
          <Card className="border-slate-200 bg-[#F8FAFC]">
            <CardHeader>
              <CardTitle className="text-slate-800 text-base flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-600" />
                Riwayat Transaksi Koin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="modern-grid max-h-[400px] overflow-y-auto pr-1">
                {coinHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/60 px-2 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${
                        entry.transaction_type === 'earned'
                          ? 'bg-emerald-50 text-emerald-600'
                          : entry.transaction_type === 'spent'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-red-50 text-red-600'
                      }`}>
                        {entry.transaction_type === 'earned' ? <TrendingUp className="w-4 h-4" /> :
                         entry.transaction_type === 'spent' ? <Coins className="w-4 h-4" /> :
                         <TrendingDown className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs text-slate-800">{entry.source_description}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(entry.created_at).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 text-xs font-semibold ${
                      entry.transaction_type === 'earned'
                        ? 'text-emerald-600'
                        : entry.transaction_type === 'spent'
                        ? 'text-amber-600'
                        : 'text-red-600'
                    }`}>
                      {entry.transaction_type === 'earned' ? '+' : '-'}{entry.amount}
                    </span>
                  </div>
                ))}
                {coinHistory.length === 0 && (
                  <p className="text-slate-500 text-center py-8 md:col-span-2 xl:col-span-3">Belum ada transaksi koin</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
