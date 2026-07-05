import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { billReminderApi, walletApi } from '@/api/finance';
import type { BillReminder, Wallet } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SelectOrCustomInput from '@/components/SelectOrCustomInput';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, CalendarClock, CheckCircle2, Pencil, Undo2 } from 'lucide-react';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import { getApiErrorMessage } from '@/lib/api-error';
import { fromDateTimeLocal } from '@/lib/format';
import { isBlank, parseNonNegativeNumber } from '@/lib/form-validation';
import { FINANCE_CATEGORIES, compactCardClass, compactContentClass, compactGridClass, toDateTimeLocal } from './finance-utils';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { dashboardTargetId, useDashboardTargetHighlight } from '@/hooks/use-dashboard-target-highlight';

export default function BillsTab() {
  const { toast } = useToast();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { highlightClassName } = useDashboardTargetHighlight();
  const [searchParams] = useSearchParams();
  const [bills, setBills] = useState<BillReminder[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newBillTitle, setNewBillTitle] = useState('');
  const [newBillCategory, setNewBillCategory] = useState('Tagihan');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [newBillDueDate, setNewBillDueDate] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<BillReminder | null>(null);
  const [editBillTitle, setEditBillTitle] = useState('');
  const [editBillCategory, setEditBillCategory] = useState('Tagihan');
  const [editBillAmount, setEditBillAmount] = useState('');
  const [editBillDueDate, setEditBillDueDate] = useState('');
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [billToPay, setBillToPay] = useState<BillReminder | null>(null);
  const [payWalletId, setPayWalletId] = useState('');
  const [billSearch, setBillSearch] = useState('');
  const [billStatusFilter, setBillStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'overdue'>('all');

  useEffect(() => {
    const requestedStatus = searchParams.get('status');
    if (requestedStatus === 'all' || requestedStatus === 'paid' || requestedStatus === 'unpaid' || requestedStatus === 'overdue') {
      setBillStatusFilter(requestedStatus);
    }
  }, [searchParams]);

  const loadPageData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [billData, walletData] = await Promise.all([
        billReminderApi.getAll(),
        walletApi.getAll(),
      ]);
      setBills(billData);
      setWallets(walletData);
    } catch (error) {
      console.error(error);
      setBills([]);
      setWallets([]);
      setLoadError(getApiErrorMessage(error, 'Gagal memuat data tagihan dan dompet.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadPageData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadPageData]);

  const createBill = async () => {
    if (isBlank(newBillTitle)) {
      toast({ title: 'Judul tagihan wajib diisi', variant: 'destructive' });
      return;
    }
    if (isBlank(newBillCategory)) {
      toast({ title: 'Kategori tagihan wajib diisi', variant: 'destructive' });
      return;
    }
    if (!newBillDueDate) {
      toast({ title: 'Tanggal jatuh tempo wajib diisi', variant: 'destructive' });
      return;
    }
    if (newBillAmount) {
      const amount = parseNonNegativeNumber(newBillAmount, 'Nominal tagihan');
      if (!amount.ok) {
        toast({ title: amount.message, variant: 'destructive' });
        return;
      }
    }
    try {
      await billReminderApi.create({
        title: newBillTitle,
        category: newBillCategory,
        amount: newBillAmount ? Number(newBillAmount) : null,
        due_date: fromDateTimeLocal(newBillDueDate),
      });
      setNewBillTitle('');
      setNewBillAmount('');
      setNewBillDueDate('');
      setDialogOpen(false);
      await loadPageData();
      toast({ title: 'Tagihan berhasil dibuat' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal membuat tagihan'), variant: 'destructive' });
    }
  };

  const openPayBill = (bill: BillReminder) => {
    const billAmount = bill.amount ?? 0;
    if (billAmount > 0) {
      if (wallets.length === 0) {
        toast({ title: 'Buat dompet terlebih dahulu sebelum membayar tagihan bernominal', variant: 'destructive' });
        return;
      }
      setBillToPay(bill);
      setPayWalletId(wallets[0].id);
      setPayDialogOpen(true);
      return;
    }

    void markPaid(bill.id);
  };

  const markPaid = async (id: string, walletId?: string) => {
    try {
      await billReminderApi.markPaid(id, walletId);
      await loadPageData();
      toast({ title: 'Tagihan ditandai sudah dibayar' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal menandai tagihan sebagai dibayar'), variant: 'destructive' });
    }
  };

  const markUnpaid = async (bill: BillReminder) => {
    try {
      await billReminderApi.markUnpaid(bill.id);
      await loadPageData();
      toast({
        title: 'Tagihan ditandai belum dibayar',
        description: bill.paid_transaction_id
          ? 'Transaksi pembayaran dibatalkan dan saldo dompet dikembalikan.'
          : undefined,
      });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal membatalkan status pembayaran'), variant: 'destructive' });
    }
  };

  const confirmBillPayment = async () => {
    if (!billToPay) return;
    if ((billToPay.amount ?? 0) > 0 && !payWalletId) {
      toast({ title: 'Pilih dompet pembayaran', variant: 'destructive' });
      return;
    }
    await markPaid(billToPay.id, payWalletId || undefined);
    setPayDialogOpen(false);
    setBillToPay(null);
    setPayWalletId('');
  };

  const deleteBill = async (id: string) => {
    try {
      await billReminderApi.delete(id);
      await loadPageData();
      toast({ title: 'Tagihan berhasil dihapus' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal menghapus tagihan'), variant: 'destructive' });
    }
  };

  const openEditBill = (bill: BillReminder) => {
    setEditingBill(bill);
    setEditBillTitle(bill.title);
    setEditBillCategory(bill.category);
    setEditBillAmount(bill.amount !== null ? String(bill.amount) : '');
    setEditBillDueDate(toDateTimeLocal(bill.due_date));
    setEditDialogOpen(true);
  };

  const updateBill = async () => {
    if (!editingBill) return;
    if (isBlank(editBillTitle)) {
      toast({ title: 'Judul tagihan wajib diisi', variant: 'destructive' });
      return;
    }
    if (isBlank(editBillCategory)) {
      toast({ title: 'Kategori tagihan wajib diisi', variant: 'destructive' });
      return;
    }
    if (!editBillDueDate) {
      toast({ title: 'Tanggal jatuh tempo wajib diisi', variant: 'destructive' });
      return;
    }
    if (editBillAmount) {
      const amount = parseNonNegativeNumber(editBillAmount, 'Nominal tagihan');
      if (!amount.ok) {
        toast({ title: amount.message, variant: 'destructive' });
        return;
      }
    }
    try {
      const payload = {
        title: editBillTitle,
        due_date: fromDateTimeLocal(editBillDueDate),
        ...(!editingBill.is_paid ? {
          category: editBillCategory,
          amount: editBillAmount ? Number(editBillAmount) : null,
        } : {}),
      };
      await billReminderApi.update(editingBill.id, payload);
      setEditDialogOpen(false);
      setEditingBill(null);
      await loadPageData();
      toast({ title: 'Tagihan berhasil diperbarui' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal memperbarui tagihan'), variant: 'destructive' });
    }
  };

  if (loading) return <LoadingState label="Memuat data..." />;
  if (loadError) {
    return (
      <ErrorState
        title="Tagihan belum bisa dimuat"
        description={loadError}
        onRetry={() => void loadPageData()}
      />
    );
  }

  const availableCategories = Array.from(new Set([
    ...FINANCE_CATEGORIES,
    ...bills.map((bill) => bill.category).filter(Boolean),
  ]));

  const filteredBills = bills.filter((bill) => {
    const normalizedSearch = billSearch.trim().toLowerCase();
    const isOverdue = !bill.is_paid && new Date(bill.due_date).getTime() < Date.now();
    const matchesSearch = !normalizedSearch
      || bill.title.toLowerCase().includes(normalizedSearch)
      || bill.category.toLowerCase().includes(normalizedSearch);
    const matchesStatus =
      billStatusFilter === 'all'
      || (billStatusFilter === 'paid' && bill.is_paid)
      || (billStatusFilter === 'unpaid' && !bill.is_paid)
      || (billStatusFilter === 'overdue' && isOverdue);

    return matchesSearch && matchesStatus;
  });

  return (
    <>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-800">Daftar Tagihan</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-1" /> Tambah Tagihan
            </Button>
          </DialogTrigger>
          <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800">
            <DialogHeader>
              <DialogTitle>Buat Tagihan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Judul</Label>
                <Input
                  value={newBillTitle}
                  onChange={(e) => setNewBillTitle(e.target.value)}
                  placeholder="e.g., Listrik, Internet, SPP"
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <Label>Kategori</Label>
                <SelectOrCustomInput
                  value={newBillCategory}
                  onValueChange={setNewBillCategory}
                  options={availableCategories}
                  placeholder="Pilih kategori"
                  customPlaceholder="Tulis kategori tagihan"
                  selectClassName="bg-white/70 border-slate-200 text-slate-800"
                  inputClassName="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <Label>Jatuh tempo</Label>
                <Input
                  type="datetime-local"
                  value={newBillDueDate}
                  onChange={(e) => setNewBillDueDate(e.target.value)}
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <details className="quick-form-advanced">
                <summary>Detail lanjutan</summary>
                <div className="quick-form-advanced-content">
                  <Label>Nominal (opsional)</Label>
                  <Input
                    type="number"
                    value={newBillAmount}
                    onChange={(e) => setNewBillAmount(e.target.value)}
                    placeholder="0"
                    className="bg-white/70 border-slate-200 text-slate-800"
                  />
                </div>
              </details>
              <Button onClick={createBill} className="w-full bg-blue-600 hover:bg-blue-700">
                Buat Tagihan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800">
            <DialogHeader>
              <DialogTitle>Edit Tagihan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Judul</Label>
                <Input
                  value={editBillTitle}
                  onChange={(e) => setEditBillTitle(e.target.value)}
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <Label>Kategori</Label>
                <SelectOrCustomInput
                  value={editBillCategory}
                  onValueChange={setEditBillCategory}
                  options={availableCategories}
                  placeholder="Pilih kategori"
                  customPlaceholder="Tulis kategori tagihan"
                  selectClassName="bg-white/70 border-slate-200 text-slate-800"
                  inputClassName="bg-white/70 border-slate-200 text-slate-800"
                  disabled={editingBill?.is_paid}
                />
              </div>
              <div>
                <Label>Jatuh tempo</Label>
                <Input
                  type="datetime-local"
                  value={editBillDueDate}
                  onChange={(e) => setEditBillDueDate(e.target.value)}
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <details className="quick-form-advanced">
                <summary>Detail lanjutan</summary>
                <div className="quick-form-advanced-content">
                  <Label>Nominal</Label>
                  <Input
                    type="number"
                    value={editBillAmount}
                    onChange={(e) => setEditBillAmount(e.target.value)}
                    disabled={editingBill?.is_paid}
                    className="bg-white/70 border-slate-200 text-slate-800"
                  />
                </div>
              </details>
              {editingBill?.is_paid && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Tagihan yang sudah dibayar tidak bisa diubah nominal atau kategorinya. Gunakan tombol Batalkan Pembayaran jika perlu mengembalikan saldo dompet.
                </p>
              )}
              <Button onClick={updateBill} className="w-full bg-blue-600 hover:bg-blue-700">
                Simpan Tagihan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
          <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800">
            <DialogHeader>
              <DialogTitle>Pilih Dompet Pembayaran</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg bg-white/70 p-3 text-sm text-slate-600">
                <p className="font-medium text-slate-800">{billToPay?.title}</p>
                <p>Nominal: Rp {(billToPay?.amount ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <Label>Dompet</Label>
                <Select value={payWalletId} onValueChange={setPayWalletId}>
                  <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                    <SelectValue placeholder="Pilih dompet" />
                  </SelectTrigger>
                  <SelectContent className="bg-white/70 border-slate-200">
                    {wallets.map((wallet) => (
                      <SelectItem key={wallet.id} value={wallet.id}>
                        {wallet.name} · Rp {wallet.balance.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={confirmBillPayment} className="w-full bg-emerald-600 hover:bg-emerald-700">
                Bayar dan Catat Transaksi
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px]">
        <Input
          value={billSearch}
          onChange={(event) => setBillSearch(event.target.value)}
          placeholder="Cari judul atau kategori..."
        />
        <Select value={billStatusFilter} onValueChange={(value: 'all' | 'paid' | 'unpaid' | 'overdue') => setBillStatusFilter(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="unpaid">Belum dibayar</SelectItem>
            <SelectItem value="paid">Sudah dibayar</SelectItem>
            <SelectItem value="overdue">Terlambat</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={compactGridClass}>
        {filteredBills.map((bill) => {
          const dueDate = new Date(bill.due_date);
          const daysLeft = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return (
            <Card id={dashboardTargetId(bill.id)} key={bill.id} className={`${compactCardClass} ${highlightClassName(bill.id)}`}>
              <CardContent className={compactContentClass}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`app-list-icon ${bill.is_paid ? 'bg-emerald-50 text-emerald-600' : daysLeft <= 3 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                      <CalendarClock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className={`truncate text-sm font-semibold ${bill.is_paid ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                        {bill.title}
                      </h4>
                      <p className="mt-0.5 truncate text-xs text-slate-500">Jatuh tempo {dueDate.toLocaleString('id-ID')}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="h-6 px-2 text-[11px] text-slate-600 border-slate-200">{bill.category}</Badge>
                        <Badge variant="outline" className={`h-6 px-2 text-[11px] ${bill.is_paid ? 'text-emerald-600 border-emerald-500/40' : daysLeft <= 3 ? 'text-red-600 border-red-500/40' : 'text-blue-600 border-blue-500/40'}`}>
                          {bill.is_paid ? 'Sudah dibayar' : daysLeft < 0 ? 'Terlambat' : `${daysLeft} hari lagi`}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {bill.is_paid ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => confirm({
                          title: 'Batalkan pembayaran?',
                          description: bill.paid_transaction_id
                            ? 'Transaksi pembayaran tagihan akan dibatalkan dan saldo dompet dikembalikan.'
                            : 'Status pembayaran akan dibatalkan tanpa perubahan saldo dompet.',
                          confirmLabel: 'Batalkan Pembayaran',
                          onConfirm: () => markUnpaid(bill),
                        })}
                        className="h-9 w-9 p-0 text-amber-600 shadow-sm hover:text-amber-700"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => openPayBill(bill)} className="h-9 w-9 p-0 text-emerald-600 shadow-sm hover:text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openEditBill(bill)} className="h-9 w-9 p-0 shadow-sm">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => confirm({
                        title: 'Hapus tagihan?',
                        description: bill.is_paid && bill.paid_transaction_id
                          ? 'Tagihan sudah dibayar. Saat dihapus, transaksi pembayaran akan dibatalkan dan saldo dompet dikembalikan.'
                          : 'Tagihan ini akan dihapus dari daftar.',
                        onConfirm: () => deleteBill(bill.id),
                      })}
                      className="h-9 w-9 p-0 text-red-600 shadow-sm hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {bill.amount !== null && (
                  <div className={`app-list-highlight ${bill.is_paid ? 'bg-emerald-50 text-emerald-600' : daysLeft <= 3 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                    Rp {bill.amount.toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {bills.length === 0 && (
          <EmptyState
            icon={CalendarClock}
            title="Belum ada tagihan"
            description="Tambahkan tagihan atau batas waktu pembayaran yang ingin dipantau."
            className="md:col-span-2 xl:col-span-3"
          />
        )}
        {bills.length > 0 && filteredBills.length === 0 && (
          <EmptyState
            icon={CalendarClock}
            title="Tagihan tidak ditemukan"
            description="Coba ubah kata kunci atau filter status."
            className="md:col-span-2 xl:col-span-3"
          />
        )}
      </div>
    </div>
    {confirmDialog}
    </>
  );
}
