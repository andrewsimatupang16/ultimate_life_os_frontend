import { useCallback, useEffect, useState } from 'react';
import { partnerApi } from '@/api/partner';
import { profileApi } from '@/api/profile';
import { useAuth } from '@/context/useAuth';
import type { AccountabilityConnection, BillReminder, Budget, DashboardSummary, Goal, Habit, PartnerSharingScope, PartnerSharingScopeItem, SubGoal, Task, Transaction, UserPublicProfile, Wallet } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import LoadingState from '@/components/LoadingState';
import { useToast } from '@/hooks/use-toast';
import {
  Users, UserPlus, CheckCircle2, XCircle, Trophy, Coins, Star,
  Target, Zap, Loader2, ShieldCheck, Clock, Unlink2,
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { useLanguage } from '@/context/LanguageContext';

const compactGridClass = "modern-grid";

const defaultSharingScope: PartnerSharingScope = {
  consent_required: true,
  visibility_note: 'Koneksi partner bersifat dua arah. Setelah diterima, kedua pengguna dapat saling melihat dashboard partner sampai salah satu memutus koneksi.',
  shared_data: [
    {
      key: 'profile',
      label: 'Profil growth',
      description: 'Nama, foto profil, level, XP, koin, dan ringkasan perkembangan.',
    },
    {
      key: 'productivity',
      label: 'Progres produktivitas',
      description: 'Goal, habit, dan task yang tidak ditandai privat untuk saling memantau progres.',
    },
    {
      key: 'finance',
      label: 'Ringkasan keuangan',
      description: 'Ringkasan budget dan transaksi non-privat untuk melihat disiplin, bukan detail sosial.',
    },
  ],
};

const formatConnectionDate = (value: string, language: 'id' | 'en' = 'id') => new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value));

const normalizeFriendCodeInput = (value: string) => value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 12);

function getPartnerRequestErrorMessage(error: unknown) {
  const message = getApiErrorMessage(error, 'Gagal mengirim permintaan partner');

  if (message === 'Friend code not found' || message === 'User not found') {
    return 'Kode teman tidak ditemukan. Periksa kembali kode 12 karakter yang diberikan partner.';
  }
  if (message === 'You cannot connect with yourself') {
    return 'Anda tidak bisa mengirim permintaan ke kode teman milik sendiri.';
  }
  if (message === 'Partner sharing consent is required') {
    return 'Tekan kotak persetujuan berbagi dashboard terlebih dahulu';
  }
  if (message.startsWith('Connection already exists with status:')) {
    const parts = message.split(':');
    const status = parts[parts.length - 1]?.trim();
    if (status === 'pending') return 'Permintaan ke partner ini sudah terkirim dan masih menunggu persetujuan.';
    if (status === 'accepted') return 'Anda sudah terhubung dengan partner ini.';
    if (status === 'rejected') return 'Permintaan sebelumnya ditolak. Hapus status lama di tab Status sebelum mengirim ulang.';
    return 'Koneksi dengan partner ini sudah ada.';
  }

  return message;
}

type PartnerProductivityView = {
  goals?: Goal[];
  habits?: Habit[];
  tasks?: Task[];
};

type PartnerFinanceView = {
  wallets?: Wallet[];
  transactions?: Transaction[];
  budgets?: Budget[];
  bills?: BillReminder[];
  summary?: {
    total_income?: number;
    total_expense?: number;
    net?: number;
    total_balance?: number;
  };
};

type PartnerDataView = {
  profile?: UserPublicProfile;
  productivity?: PartnerProductivityView;
  finance?: PartnerFinanceView;
  analytics?: DashboardSummary;
};

function clampPercent(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return 0;
  return Math.min(100, Math.max(0, Number(value)));
}

function formatPartnerCurrency(value: number | null | undefined) {
  return `Rp ${(value || 0).toLocaleString('id-ID')}`;
}

function formatPartnerDate(value: string | null | undefined, language: 'id' | 'en') {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(language === 'en' ? 'en-US' : 'id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getBudgetUsageRate(budget: Budget) {
  if (!budget.limit_amount || budget.limit_amount <= 0) return 0;
  return clampPercent((budget.current_spent / budget.limit_amount) * 100);
}

function getStandaloneTasks(tasks: Task[] | undefined) {
  return (tasks ?? []).filter((task) => !task.sub_goal_id);
}

function getPartnerChartMax(values: number[]) {
  return Math.max(1, ...values.map((value) => Math.abs(value || 0)));
}

function getPartnerBarHeight(value: number, maxValue: number) {
  return `${Math.max(4, (Math.abs(value || 0) / maxValue) * 100)}%`;
}

export default function Partner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [connections, setConnections] = useState<AccountabilityConnection[]>([]);
  const [sharingScope, setSharingScope] = useState<PartnerSharingScope>(defaultSharingScope);
  const [loading, setLoading] = useState(true);
  const [friendCode, setFriendCode] = useState('');
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('connections');

  const loadConnections = useCallback(async () => {
    try {
      const [connectionData, scopeData] = await Promise.all([
        partnerApi.getConnections(),
        partnerApi.getSharingScope(),
      ]);
      setConnections(connectionData);
      setSharingScope(scopeData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadConnections();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadConnections]);

  const sendRequest = async () => {
    const normalizedFriendCode = normalizeFriendCodeInput(friendCode);
    setFriendCode(normalizedFriendCode);

    if (!normalizedFriendCode || normalizedFriendCode.length !== 12) {
      toast({ title: t('Masukkan kode teman 12 karakter'), variant: 'destructive' });
      return;
    }

    if (!consentAcknowledged) {
      toast({ title: t('Tekan kotak persetujuan berbagi dashboard terlebih dahulu'), variant: 'destructive' });
      return;
    }

    if (user?.friend_code && normalizedFriendCode === normalizeFriendCodeInput(user.friend_code)) {
      toast({ title: t('Anda tidak bisa mengirim permintaan ke kode teman milik sendiri.'), variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      await profileApi.findByFriendCode(normalizedFriendCode);
      await partnerApi.sendRequest(normalizedFriendCode, consentAcknowledged);
      setFriendCode('');
      setConsentAcknowledged(false);
      await loadConnections();
      setActiveTab('status');
      toast({ title: t('Permintaan partner terkirim') });
    } catch (error) {
      toast({ title: t(getPartnerRequestErrorMessage(error)), variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const acceptRequest = async (id: string) => {
    try {
      await partnerApi.acceptRequest(id, true);
      void loadConnections();
      toast({ title: t('Permintaan partner diterima') });
    } catch (error) {
      toast({ title: t(getApiErrorMessage(error, 'Gagal menerima permintaan partner')), variant: 'destructive' });
    }
  };

  const rejectRequest = async (id: string) => {
    try {
      await partnerApi.rejectRequest(id);
      void loadConnections();
      toast({ title: t('Permintaan partner ditolak') });
    } catch (error) {
      toast({ title: t(getApiErrorMessage(error, 'Gagal menolak permintaan partner')), variant: 'destructive' });
    }
  };

  const disconnect = async (id: string) => {
    try {
      await partnerApi.disconnect(id);
      void loadConnections();
      toast({ title: t('Koneksi partner diputus') });
    } catch (error) {
      toast({ title: t(getApiErrorMessage(error, 'Gagal memutus koneksi partner')), variant: 'destructive' });
    }
  };

  const pendingReceived = connections.filter(c => c.status === 'pending' && c.receiver_id === user?.id);
  const pendingSent = connections.filter(c => c.status === 'pending' && c.requester_id === user?.id);
  const acceptedConnections = connections.filter(c => c.status === 'accepted');
  const rejectedConnections = connections.filter(c => c.status === 'rejected');

  if (loading) return <LoadingState label="Memuat partner..." />;

  return (
    <div className="page-shell">
      <div className="page-hero">
        <p className="page-hero-eyebrow">Growth Partner</p>
        <h1 className="page-hero-title">Grow bareng tanpa fitur sosial yang ribet</h1>
        <p className="page-hero-copy">Hubungkan akun untuk saling melihat progres, goal, habit, dan ringkasan disiplin. Fokusnya memantau perkembangan, bukan chat atau feed.</p>
      </div>

      {/* Send Request */}
      <Card className="border-slate-200 bg-[#F8FAFC]">
        <CardContent className="space-y-4 p-4">
          <div className="partner-sharing-panel rounded-xl border border-blue-100 bg-blue-50/70 p-3">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <div className="space-y-2">
                <div>
                  <p className="partner-sharing-title text-sm font-semibold text-slate-800">
                    {t('Persetujuan berbagi dashboard partner')}
                  </p>
                  <p className="partner-sharing-copy text-xs leading-5 text-slate-600">{t(sharingScope.visibility_note)}</p>
                </div>
                <SharedDataList items={sharingScope.shared_data} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatusSummary label="Aktif" value={acceptedConnections.length} className="text-emerald-700" />
            <StatusSummary label="Menunggu Anda" value={pendingReceived.length} className="text-amber-700" />
            <StatusSummary label="Terkirim" value={pendingSent.length} className="text-blue-700" />
            <StatusSummary label="Ditolak" value={rejectedConnections.length} className="text-red-700" />
          </div>

          <label
            htmlFor="partner-consent"
            className={`partner-consent-box flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
              consentAcknowledged
                ? 'border-blue-300 bg-blue-50/80'
                : 'border-slate-200 bg-white/70 hover:border-blue-300 hover:bg-blue-50/60'
            }`}
          >
            <Checkbox
              id="partner-consent"
              checked={consentAcknowledged}
              onCheckedChange={(checked) => setConsentAcknowledged(checked === true)}
              className="partner-consent-checkbox mt-0.5 h-5 w-5 rounded-md border-2"
            />
            <span className="block min-w-0">
              <span className="partner-consent-title block text-xs font-semibold text-slate-800">
                {t('Saya menyetujui berbagi dashboard dengan partner')}
              </span>
              <span className="partner-consent-copy mt-1 block text-xs leading-5 text-slate-600">
                {t('Ketika koneksi diterima, partner dapat melihat profil, produktivitas, dan dashboard keuangan saya sesuai daftar di atas. Saya juga dapat melihat dashboard partner sampai salah satu pihak memutus koneksi.')}
              </span>
            </span>
          </label>

          <form onSubmit={(event) => { event.preventDefault(); void sendRequest(); }} className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={friendCode}
              onChange={(e) => setFriendCode(normalizeFriendCodeInput(e.target.value))}
              placeholder="Masukkan kode teman 12 karakter"
              maxLength={32}
              className="bg-white/70 border-slate-200 text-slate-800 uppercase"
            />
            <Button
              type="submit"
              disabled={sending}
              className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4 mr-1" /> {t('Kirim Permintaan')}</>}
            </Button>
          </form>
          <p className="text-xs leading-5 text-slate-500">
            {t('Tekan persetujuan, masukkan kode teman, lalu gunakan halaman ini sebagai cermin progres bersama.')}
          </p>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="border border-slate-200 bg-[#F8FAFC]/85">
          <TabsTrigger value="connections" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            {t('Partner Saya')} ({acceptedConnections.length})
          </TabsTrigger>
          <TabsTrigger value="requests" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            {t('Permintaan')} {pendingReceived.length > 0 && `(${pendingReceived.length})`}
          </TabsTrigger>
          <TabsTrigger value="status" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            {t('Status')} ({pendingSent.length + rejectedConnections.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className={compactGridClass}>
          {acceptedConnections.length === 0 ? (
            <div className="text-center py-12 text-slate-500 md:col-span-2 xl:col-span-3">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Belum ada partner. Kirim permintaan menggunakan kode teman mereka.</p>
            </div>
          ) : (
            acceptedConnections.map((conn) => {
              const partner = conn.requester_id === user?.id ? conn.receiver : conn.requester;
              if (!partner) return null;
              return (
                <PartnerCard
                  key={conn.id}
                  partner={partner}
                  sharingScope={sharingScope}
                  onDisconnect={() => confirm({
                    title: 'Putuskan koneksi?',
                    description: 'Setelah koneksi diputus, Anda dan partner tidak bisa saling melihat dashboard partner lagi. Koneksi dapat dibuat ulang dengan kode teman jika diperlukan.',
                    confirmLabel: 'Putuskan Koneksi',
                    onConfirm: () => disconnect(conn.id),
                  })}
                />
              );
            })
          )}
        </TabsContent>

        <TabsContent value="requests" className={compactGridClass}>
          {pendingReceived.length === 0 ? (
            <div className="text-center py-12 text-slate-500 md:col-span-2 xl:col-span-3">
              <p>Belum ada permintaan masuk</p>
            </div>
          ) : (
            pendingReceived.map((conn) => {
              const requester = conn.requester;
              if (!requester) return null;
              return (
                <Card key={conn.id} className="border-slate-200 bg-[#F8FAFC] py-0 gap-0 rounded-2xl">
                  <CardContent className="px-2 py-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar className="h-9 w-9 shrink-0 border border-slate-200">
                        <AvatarImage src={requester.avatar_url || ''} />
                        <AvatarFallback className="bg-white/60 text-slate-700">
                          {requester.full_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-800">{requester.full_name || 'Pengguna'}</p>
                        <p className="truncate text-xs text-slate-500">{t('Kode teman')}: {requester.friend_code}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        onClick={() => confirm({
                          title: 'Terima koneksi partner?',
                          description: `${requester.full_name || t('Pengguna')} ${t('akan dapat melihat profil, produktivitas, dan dashboard keuangan Anda. Anda juga dapat melihat dashboard mereka. Akses berlaku sampai salah satu pihak memutus koneksi.')}`,
                          confirmLabel: 'Terima dan Bagikan',
                          onConfirm: () => acceptRequest(conn.id),
                        })}
                        className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {t('Terima')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => rejectRequest(conn.id)} className="h-7 px-2 text-xs text-red-600 hover:text-red-700">
                        <XCircle className="w-3.5 h-3.5 mr-1" /> {t('Tolak')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="status" className={compactGridClass}>
          {pendingSent.length + rejectedConnections.length === 0 ? (
            <div className="text-center py-12 text-slate-500 md:col-span-2 xl:col-span-3">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Belum ada permintaan terkirim atau permintaan yang ditolak.</p>
            </div>
          ) : (
            [...pendingSent, ...rejectedConnections].map((conn) => {
              const partner = conn.requester_id === user?.id ? conn.receiver : conn.requester;
              if (!partner) return null;
              return (
                <ConnectionStatusCard
                  key={conn.id}
                  connection={conn}
                  partner={partner}
                  currentUserId={user?.id}
                  onDisconnect={() => confirm({
                    title: conn.status === 'pending' ? 'Batalkan permintaan partner?' : 'Hapus status koneksi?',
                    description: 'Item ini akan dihapus dari daftar koneksi Anda. Jika ingin mencoba lagi, gunakan kode teman partner untuk membuat permintaan baru.',
                    confirmLabel: conn.status === 'pending' ? 'Batalkan' : 'Hapus',
                    onConfirm: () => disconnect(conn.id),
                  })}
                />
              );
            })
          )}
        </TabsContent>
      </Tabs>
      {confirmDialog}
    </div>
  );
}

function StatusSummary({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  const { t } = useLanguage();

  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
      <p className={`text-lg font-bold ${className || 'text-slate-800'}`}>{value}</p>
      <p className="text-xs text-slate-500">{t(label)}</p>
    </div>
  );
}

function SharedDataList({
  items,
  compact = false,
}: {
  items: PartnerSharingScopeItem[];
  compact?: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div className={compact ? 'mt-2 flex flex-wrap gap-2' : 'grid gap-2 sm:grid-cols-3'}>
      {items.map((item) => (
        <div key={item.key} className={compact ? 'partner-sharing-chip rounded-full bg-white/80 px-2 py-1 text-xs text-slate-600' : 'partner-sharing-item rounded-lg bg-white/80 p-2'}>
          <p className={compact ? 'font-medium' : 'partner-sharing-item-title text-xs font-semibold text-slate-700'}>{t(item.label)}</p>
          {!compact && <p className="partner-sharing-item-copy mt-1 text-xs leading-5 text-slate-500">{t(item.description)}</p>}
        </div>
      ))}
    </div>
  );
}

function ConnectionStatusCard({
  connection,
  partner,
  currentUserId,
  onDisconnect,
}: {
  connection: AccountabilityConnection;
  partner: UserPublicProfile;
  currentUserId?: string;
  onDisconnect: () => void;
}) {
  const { language, t } = useLanguage();
  const isSentByCurrentUser = connection.requester_id === currentUserId;
  const isPending = connection.status === 'pending';
  const statusLabel = isPending
    ? isSentByCurrentUser ? 'Menunggu partner menerima' : 'Menunggu persetujuan Anda'
    : 'Ditolak';
  const statusClass = isPending ? 'bg-amber-50 text-amber-700 hover:bg-amber-50' : 'bg-red-50 text-red-700 hover:bg-red-50';

  return (
    <Card className="border-slate-200 bg-[#F8FAFC] py-0 gap-0 rounded-2xl">
      <CardContent className="space-y-3 px-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="h-9 w-9 shrink-0 border border-slate-200">
              <AvatarImage src={partner.avatar_url || ''} />
              <AvatarFallback className="bg-white/60 text-slate-700">
                {partner.full_name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-800">{partner.full_name || t('Pengguna')}</p>
              <p className="text-xs text-slate-500">
                {t(isSentByCurrentUser ? 'Permintaan dikirim' : 'Permintaan diterima')}: {formatConnectionDate(connection.created_at, language)}
              </p>
            </div>
          </div>
          <Badge className={statusClass}>{t(statusLabel)}</Badge>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs leading-5 text-slate-500">
            {t(isPending
              ? 'Dashboard belum terbuka sampai permintaan diterima.'
              : 'Dashboard tidak terbuka karena permintaan ini ditolak.')}
          </p>
          <Button size="sm" variant="ghost" onClick={onDisconnect} className="h-7 px-2 text-xs text-red-600 hover:text-red-700">
            <XCircle className="mr-1 h-3.5 w-3.5" /> {t(isPending ? 'Batalkan' : 'Hapus')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Partner Card with View Dialog
function PartnerCard({
  partner,
  sharingScope,
  onDisconnect,
}: {
  partner: UserPublicProfile;
  sharingScope: PartnerSharingScope;
  onDisconnect: () => void;
}) {
  const { language, t } = useLanguage();
  const [viewOpen, setViewOpen] = useState(false);
  const [partnerData, setPartnerData] = useState<PartnerDataView | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewTab, setViewTab] = useState('profile');

  const loadPartnerData = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await partnerApi.getPartnerProfile(partner.id);
      setPartnerData({ profile });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [partner.id]);

  const viewProductivity = async () => {
    setLoading(true);
    try {
      const data = await partnerApi.getPartnerProductivity(partner.id);
      setPartnerData((prev) => ({ ...(prev ?? {}), productivity: data }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const viewFinance = async () => {
    setLoading(true);
    try {
      const data = await partnerApi.getPartnerFinance(partner.id);
      setPartnerData((prev) => ({ ...(prev ?? {}), finance: data }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const viewAnalytics = async () => {
    setLoading(true);
    try {
      const data = await partnerApi.getPartnerAnalytics(partner.id);
      setPartnerData((prev) => ({ ...(prev ?? {}), analytics: data }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!viewOpen) return;

    const timeoutId = window.setTimeout(() => {
      void loadPartnerData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadPartnerData, viewOpen]);

  return (
    <>
      <Card className="border-slate-200 bg-[#F8FAFC] py-0 gap-0 rounded-2xl">
        <CardContent className="px-2 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="h-10 w-10 shrink-0 border-2 border-blue-500">
                <AvatarImage src={partner.avatar_url || ''} />
                <AvatarFallback className="bg-white/60 text-slate-700">
                  {partner.full_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-xs font-semibold text-slate-800">{partner.full_name || t('Pengguna')}</p>
                  <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">{t('Aktif')}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-amber-600" /> Lv.{partner.level}</span>
                  <span className="flex items-center gap-1"><Star className="w-3 h-3 text-purple-600" /> {partner.xp_balance} XP</span>
                  <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-amber-600" /> {partner.coin_balance}</span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1">
              <Button size="sm" variant="outline" onClick={() => setViewOpen(true)} className="h-7 px-2 text-xs border-blue-500 text-blue-600 hover:bg-blue-50">
                <Target className="w-3.5 h-3.5 mr-1" /> {t('Lihat progress')}
              </Button>
              <Button size="sm" variant="ghost" onClick={onDisconnect} className="h-7 px-2 text-xs text-red-600 hover:text-red-700">
                <Unlink2 className="w-3.5 h-3.5 mr-1" /> {t('Putuskan')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Partner Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={partner.avatar_url || ''} />
                <AvatarFallback>{partner.full_name?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              {t('Progress Partner')}: {partner.full_name || t('Pengguna')}
            </DialogTitle>
          </DialogHeader>

          <div className="partner-sharing-panel rounded-xl border border-blue-100 bg-blue-50/70 p-3">
            <p className="partner-sharing-title text-xs font-semibold text-slate-800">{t('Data yang sedang dibagikan dalam koneksi ini')}</p>
            <SharedDataList items={sharingScope.shared_data} compact />
            <p className="partner-sharing-copy mt-2 text-xs leading-5 text-slate-600">
              {t('Akses dua arah ini berhenti ketika salah satu pihak menekan Putuskan.')}
            </p>
          </div>

          <Tabs value={viewTab} onValueChange={(v) => {
            setViewTab(v);
            if (v === 'productivity' && !partnerData?.productivity) viewProductivity();
            if (v === 'finance' && !partnerData?.finance) viewFinance();
            if (v === 'analytics' && !partnerData?.analytics) viewAnalytics();
          }}>
            <TabsList className="bg-white/60">
              <TabsTrigger value="profile" className="data-[state=active]:bg-blue-600">{t('Growth')}</TabsTrigger>
              <TabsTrigger value="productivity" className="data-[state=active]:bg-blue-600">{t('Produktivitas')}</TabsTrigger>
              <TabsTrigger value="finance" className="data-[state=active]:bg-blue-600">{t('Keuangan')}</TabsTrigger>
              <TabsTrigger value="analytics" className="data-[state=active]:bg-blue-600">{t('Grafik')}</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4">
              {partnerData?.profile && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Card className="bg-white/70 border-slate-200">
                    <CardContent className="p-4 text-center">
                      <Trophy className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-slate-800">{partnerData.profile.level}</p>
                      <p className="text-sm text-slate-500">{t('Level')}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/70 border-slate-200">
                    <CardContent className="p-4 text-center">
                      <Star className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-slate-800">{partnerData.profile.xp_balance}</p>
                      <p className="text-sm text-slate-500">{t('Saldo XP')}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/70 border-slate-200">
                    <CardContent className="p-4 text-center">
                      <Coins className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-slate-800">{partnerData.profile.coin_balance}</p>
                      <p className="text-sm text-slate-500">{t('Koin')}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/70 border-slate-200">
                    <CardContent className="p-4 text-center">
                      <Zap className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-slate-800">{partnerData.profile.total_xp_earned}</p>
                      <p className="text-sm text-slate-500">{t('Total XP diperoleh')}</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="productivity">
              {loading ? <p className="text-slate-500 text-center py-4">{t('Memuat data...')}</p> :
                partnerData?.productivity ? (
                  <PartnerProductivityPanel productivity={partnerData.productivity} />
                ) : <p className="text-slate-500">{t('Belum ada data yang bisa ditampilkan')}</p>
              }
            </TabsContent>

            <TabsContent value="finance">
              {loading ? <p className="text-slate-500 text-center py-4">{t('Memuat data...')}</p> :
                partnerData?.finance ? (
                  <PartnerFinancePanel finance={partnerData.finance} language={language} />
                ) : <p className="text-slate-500">{t('Belum ada data yang bisa ditampilkan')}</p>
              }
            </TabsContent>

            <TabsContent value="analytics">
              {loading ? <p className="text-slate-500 text-center py-4">{t('Memuat grafik...')}</p> :
                partnerData?.analytics ? (
                  <PartnerAnalyticsPanel analytics={partnerData.analytics} language={language} />
                ) : <p className="text-slate-500">{t('Belum ada grafik yang bisa ditampilkan')}</p>
              }
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PartnerProductivityPanel({ productivity }: { productivity: PartnerProductivityView }) {
  const { t } = useLanguage();
  const goals = productivity.goals ?? [];
  const habits = productivity.habits ?? [];
  const standaloneTasks = getStandaloneTasks(productivity.tasks);
  const totalSubGoals = goals.reduce((total, goal) => total + (goal.sub_goals?.length ?? 0), 0);
  const nestedTasks = goals.reduce((total, goal) => total + (goal.sub_goals ?? []).reduce((taskTotal, subGoal) => taskTotal + (subGoal.tasks?.length ?? 0), 0), 0);
  const totalTasks = productivity.tasks?.length ?? nestedTasks;
  const completedTasks = (productivity.tasks ?? []).filter((task) => task.is_completed).length;
  const taskRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const activeGoal = [...goals]
    .filter((goal) => !goal.is_completed)
    .sort((a, b) => new Date(a.target_date || a.created_at).getTime() - new Date(b.target_date || b.created_at).getTime())[0];
  const habitStreakTotal = habits.reduce((total, habit) => total + (habit.current_streak || 0), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{t('Fokus partner sekarang')}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-900">{activeGoal?.title || t('Belum ada goal aktif')}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {activeGoal ? `${t('Progress')} ${clampPercent(activeGoal.progress_rate).toFixed(0)}%` : t('Partner belum membagikan goal yang sedang berjalan.')}
            </p>
          </div>
          {activeGoal && <Badge className="bg-blue-600 text-white hover:bg-blue-600">{clampPercent(activeGoal.progress_rate).toFixed(0)}%</Badge>}
        </div>
        {activeGoal && <Progress value={clampPercent(activeGoal.progress_rate)} className="mt-3 h-2 bg-white/80" />}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <PartnerMiniStat label="Goal" value={goals.length} />
        <PartnerMiniStat label="Detail goal" value={totalSubGoals} />
        <PartnerMiniStat label="Task selesai" value={`${taskRate}%`} />
        <PartnerMiniStat label="Total streak" value={habitStreakTotal} />
      </div>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-700">{t('Target')}</h4>
        {goals.length === 0 ? (
          <p className="rounded-xl bg-white/60 p-3 text-sm text-slate-500">{t('Belum ada target yang dibagikan')}</p>
        ) : (
          goals.map((goal) => <PartnerGoalItem key={goal.id} goal={goal} />)
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-700">{t('Tugas Mandiri')}</h4>
        {standaloneTasks.length === 0 ? (
          <p className="rounded-xl bg-white/60 p-3 text-sm text-slate-500">{t('Belum ada tugas mandiri yang dibagikan')}</p>
        ) : (
          standaloneTasks.map((task) => <PartnerTaskRow key={task.id} task={task} />)
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-700">{t('Kebiasaan')}</h4>
        {habits.length === 0 ? (
          <p className="rounded-xl bg-white/60 p-3 text-sm text-slate-500">{t('Belum ada kebiasaan yang dibagikan')}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {habits.map((habit) => (
              <div key={habit.id} className="rounded-xl bg-white/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{habit.title}</p>
                  <Badge className={habit.habit_type === 'good' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50' : 'bg-red-50 text-red-700 hover:bg-red-50'}>
                    {habit.habit_type === 'good' ? t('Baik') : t('Buruk')}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500">
                  <span>{t('Rangkaian')}: {habit.current_streak}</span>
                  <span>{t('Terbaik')}: {habit.best_streak}</span>
                  <span>{t('Total')}: {habit.total_completions}</span>
                </div>
                {habit.reminder_time && <p className="mt-2 text-xs text-slate-500">{t('Pengingat')}: {habit.reminder_time}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PartnerGoalItem({ goal }: { goal: Goal }) {
  const { t } = useLanguage();
  const subGoals = goal.sub_goals ?? [];
  const progress = clampPercent(goal.progress_rate);

  return (
    <div className="rounded-xl bg-white/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{goal.title}</p>
          {goal.description && <p className="mt-1 text-xs leading-5 text-slate-500">{goal.description}</p>}
          <p className="mt-1 text-xs text-slate-500">
            {goal.target_value ? `${t('Target')}: ${goal.current_value || 0} / ${goal.target_value}${goal.target_unit ? ` ${goal.target_unit}` : ''}` : t('Target angka tidak diisi')}
          </p>
        </div>
        <Badge className={goal.is_completed ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50' : 'bg-blue-50 text-blue-700 hover:bg-blue-50'}>
          {goal.is_completed ? t('Selesai') : `${progress.toFixed(0)}%`}
        </Badge>
      </div>
      <Progress value={progress} className="mt-3 h-1.5 bg-slate-200" />

      <div className="mt-3 space-y-2">
        {subGoals.length === 0 ? (
          <p className="text-xs text-slate-500">{t('Belum ada target turunan yang dibagikan')}</p>
        ) : (
          subGoals.map((subGoal) => <PartnerSubGoalItem key={subGoal.id} subGoal={subGoal} />)
        )}
      </div>
    </div>
  );
}

function PartnerSubGoalItem({ subGoal }: { subGoal: SubGoal }) {
  const { t } = useLanguage();
  const progress = clampPercent(subGoal.progress_rate);
  const tasks = subGoal.tasks ?? [];

  return (
    <div className="rounded-lg border border-slate-200 bg-white/70 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-800">{subGoal.title}</p>
        <span className="text-xs text-slate-500">{t('Bobot')}: {subGoal.weight || 1}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>{progress.toFixed(0)}%</span>
        {subGoal.target_value ? <span>{subGoal.current_value || 0} / {subGoal.target_value}</span> : null}
        {subGoal.is_locked && <span>{t('Terkunci')}</span>}
        {subGoal.is_completed && <span>{t('Selesai')}</span>}
      </div>
      <Progress value={progress} className="mt-2 h-1 bg-slate-200" />
      <div className="mt-2 space-y-1">
        {tasks.length === 0 ? (
          <p className="text-xs text-slate-400">{t('Belum ada tugas pada target turunan ini')}</p>
        ) : (
          tasks.map((task) => <PartnerTaskRow key={task.id} task={task} compact />)
        )}
      </div>
    </div>
  );
}

function PartnerTaskRow({ task, compact = false }: { task: Task; compact?: boolean }) {
  const { language, t } = useLanguage();

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 ${compact ? 'px-2 py-1.5' : 'p-2'}`}>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-800">{task.title}</p>
        <p className="text-xs text-slate-500">
          {t('Kesulitan')}: {t(task.difficulty)} {task.due_date ? `- ${t('Jatuh tempo')}: ${formatPartnerDate(task.due_date, language)}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {task.is_daily && <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">{t('Harian')}</Badge>}
        <Badge className={task.is_completed ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50' : 'bg-slate-100 text-slate-600 hover:bg-slate-100'}>
          {task.is_completed ? t('Selesai') : t('Belum selesai')}
        </Badge>
      </div>
    </div>
  );
}

function PartnerFinancePanel({ finance, language }: { finance: PartnerFinanceView; language: 'id' | 'en' }) {
  const { t } = useLanguage();
  const wallets = finance.wallets ?? [];
  const transactions = finance.transactions ?? wallets.flatMap((wallet) => wallet.transactions ?? []);
  const budgets = finance.budgets ?? [];
  const bills = finance.bills ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <PartnerMiniStat label="Total saldo" value={formatPartnerCurrency(finance.summary?.total_balance)} />
        <PartnerMiniStat label="Pemasukan" value={formatPartnerCurrency(finance.summary?.total_income)} />
        <PartnerMiniStat label="Pengeluaran" value={formatPartnerCurrency(finance.summary?.total_expense)} />
        <PartnerMiniStat label="Saldo bersih" value={formatPartnerCurrency(finance.summary?.net)} />
      </div>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-700">{t('Dompet')}</h4>
        {wallets.length === 0 ? (
          <p className="rounded-xl bg-white/60 p-3 text-sm text-slate-500">{t('Belum ada dompet yang dibagikan')}</p>
        ) : (
          wallets.map((wallet) => (
            <div key={wallet.id} className="rounded-xl bg-white/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{wallet.name}</p>
                <p className="text-sm font-semibold text-amber-600">{formatPartnerCurrency(wallet.balance)}</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">{t('Jenis')}: {t(wallet.wallet_type)}</p>
              <p className="mt-2 text-xs font-medium text-slate-600">{t('Transaksi di dompet ini')}: {wallet.transactions?.length ?? 0}</p>
            </div>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-700">{t('Transaksi')}</h4>
        {transactions.length === 0 ? (
          <p className="rounded-xl bg-white/60 p-3 text-sm text-slate-500">{t('Belum ada transaksi yang dibagikan')}</p>
        ) : (
          transactions.map((transaction) => (
            <div key={transaction.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/60 p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">{transaction.category}</p>
                <p className="text-xs text-slate-500">{formatPartnerDate(transaction.transaction_date, language)}{transaction.description ? ` - ${transaction.description}` : ''}</p>
              </div>
              <p className={`text-sm font-semibold ${transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                {transaction.type === 'income' ? '+' : '-'} {formatPartnerCurrency(transaction.amount)}
              </p>
            </div>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-700">{t('Anggaran')}</h4>
        {budgets.length === 0 ? (
          <p className="rounded-xl bg-white/60 p-3 text-sm text-slate-500">{t('Belum ada anggaran yang dibagikan')}</p>
        ) : (
          budgets.map((budget) => {
            const usage = getBudgetUsageRate(budget);
            return (
              <div key={budget.id} className="rounded-xl bg-white/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{budget.category}</p>
                  <span className="text-xs font-semibold text-slate-600">{usage.toFixed(0)}%</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {formatPartnerCurrency(budget.current_spent)} / {formatPartnerCurrency(budget.limit_amount)} - {t(budget.period)}
                </p>
                <Progress value={usage} className="mt-2 h-1.5 bg-slate-200" />
              </div>
            );
          })
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-700">{t('Tagihan')}</h4>
        {bills.length === 0 ? (
          <p className="rounded-xl bg-white/60 p-3 text-sm text-slate-500">{t('Belum ada tagihan yang dibagikan')}</p>
        ) : (
          bills.map((bill) => (
            <div key={bill.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/60 p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">{bill.title}</p>
                <p className="text-xs text-slate-500">{bill.category} - {t('Jatuh tempo')}: {formatPartnerDate(bill.due_date, language)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-800">{formatPartnerCurrency(bill.amount)}</p>
                <Badge className={bill.is_paid ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50' : 'bg-amber-50 text-amber-700 hover:bg-amber-50'}>
                  {bill.is_paid ? t('Sudah dibayar') : t('Belum dibayar')}
                </Badge>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function PartnerAnalyticsPanel({ analytics, language }: { analytics: DashboardSummary; language: 'id' | 'en' }) {
  const { t } = useLanguage();
  const taskRate = analytics.weekly_task_metrics?.completion_rate ?? 0;
  const cashflowMax = getPartnerChartMax((analytics.weekly_cashflow ?? []).flatMap((item) => [item.income, item.expense]));
  const taskMax = getPartnerChartMax((analytics.daily_task_trend ?? []).flatMap((item) => [item.total, item.completed]));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <PartnerMiniStat label="Life score" value={`${Math.round(analytics.life_score || 0)}%`} />
        <PartnerMiniStat label="Produktivitas" value={`${Math.round(analytics.productivity_score || 0)}%`} />
        <PartnerMiniStat label="Keuangan" value={`${Math.round(analytics.finance_score || 0)}%`} />
        <PartnerMiniStat label="Task selesai" value={`${Math.round(taskRate)}%`} />
      </div>

      <section className="rounded-xl bg-white/70 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-700">{t('Grafik Cashflow Mingguan')}</h4>
          <span className="text-xs text-slate-500">
            {formatPartnerCurrency(analytics.total_income_month)} / {formatPartnerCurrency(analytics.total_expense_month)}
          </span>
        </div>
        <div className="flex h-44 items-end gap-2">
          {(analytics.weekly_cashflow ?? []).map((item) => (
            <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex h-32 w-full items-end justify-center gap-1 rounded-lg bg-slate-50 px-1 pb-1">
                <span className="w-2 rounded-t bg-emerald-500" style={{ height: getPartnerBarHeight(item.income, cashflowMax) }} title={`Income ${formatPartnerCurrency(item.income)}`} />
                <span className="w-2 rounded-t bg-red-500" style={{ height: getPartnerBarHeight(item.expense, cashflowMax) }} title={`Expense ${formatPartnerCurrency(item.expense)}`} />
              </div>
              <span className="truncate text-[10px] text-slate-500">
                {new Date(`${item.date}T12:00:00`).toLocaleDateString(language === 'en' ? 'en-US' : 'id-ID', { weekday: 'short' })}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Income</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Expense</span>
        </div>
      </section>

      <section className="rounded-xl bg-white/70 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-700">{t('Grafik Task Harian')}</h4>
          <span className="text-xs text-slate-500">
            {analytics.completed_tasks}/{analytics.total_tasks} {t('selesai')}
          </span>
        </div>
        <div className="flex h-44 items-end gap-2">
          {(analytics.daily_task_trend ?? []).map((item) => (
            <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex h-32 w-full items-end justify-center gap-1 rounded-lg bg-slate-50 px-1 pb-1">
                <span className="w-2 rounded-t bg-blue-200" style={{ height: getPartnerBarHeight(item.total, taskMax) }} title={`Total ${item.total}`} />
                <span className="w-2 rounded-t bg-blue-600" style={{ height: getPartnerBarHeight(item.completed, taskMax) }} title={`Selesai ${item.completed}`} />
              </div>
              <span className="truncate text-[10px] text-slate-500">
                {new Date(`${item.date}T12:00:00`).toLocaleDateString(language === 'en' ? 'en-US' : 'id-ID', { weekday: 'short' })}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-200" /> Total</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-600" /> Selesai</span>
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-700">{t('Progress Goal Partner')}</h4>
        {(analytics.numeric_goal_progress ?? []).length === 0 ? (
          <p className="rounded-xl bg-white/60 p-3 text-sm text-slate-500">{t('Belum ada goal untuk ditampilkan sebagai grafik')}</p>
        ) : (
          analytics.numeric_goal_progress.map((goal) => (
            <div key={goal.id} className="rounded-xl bg-white/70 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{goal.title}</p>
                <span className="text-xs font-semibold text-blue-700">{Math.round(goal.progress_rate)}%</span>
              </div>
              <Progress value={clampPercent(goal.progress_rate)} className="h-2 bg-slate-200" />
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function PartnerMiniStat({ label, value }: { label: string; value: number | string }) {
  const { t } = useLanguage();

  return (
    <div className="rounded-xl bg-white/70 p-3">
      <p className="truncate text-sm font-bold text-slate-800">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{t(label)}</p>
    </div>
  );
}
