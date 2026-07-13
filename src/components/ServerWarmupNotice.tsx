import { Loader2, RefreshCw, ServerCrash } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useServerWarmup } from '@/hooks/use-server-warmup';

function formatCheckedTime(value: Date | null): string | null {
  if (!value) {
    return null;
  }

  return value.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ServerWarmupNotice() {
  const { status, lastCheckedAt, lastError, retry } = useServerWarmup();

  if (status === 'ready' || status === 'checking') {
    return null;
  }

  const isWaking = status === 'waking';
  const checkedTime = formatCheckedTime(lastCheckedAt);

  return (
    <div className="fixed left-1/2 top-4 z-[70] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 px-0 sm:top-5">
      <Alert className="border-amber-200 bg-amber-50 text-amber-950 shadow-lg">
        {isWaking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ServerCrash className="h-4 w-4" />
        )}
        <AlertTitle>{isWaking ? 'Server sedang disiapkan' : 'Server belum merespons'}</AlertTitle>
        <AlertDescription>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>
              {isWaking
                ? 'Backend gratis di Hugging Face bisa butuh waktu untuk bangun setelah lama tidak aktif. Mohon tunggu sebentar.'
                : `Koneksi ke backend belum berhasil${lastError ? ` (${lastError})` : ''}. Coba lagi dalam beberapa detik.`}
              {checkedTime ? ` Terakhir dicek ${checkedTime}.` : ''}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-amber-300 bg-white/80 text-amber-950 hover:bg-white"
              onClick={() => {
                void retry();
              }}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Cek ulang
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
