import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

type ErrorStateProps = {
  title?: string;
  description?: string;
  actionLabel?: string;
  onRetry?: () => void | Promise<void>;
  className?: string;
};

export default function ErrorState({
  title = 'Data belum bisa dimuat',
  description = 'Terjadi kendala saat mengambil data. Periksa koneksi internet, lalu coba lagi.',
  actionLabel = 'Coba lagi',
  onRetry,
  className = '',
}: ErrorStateProps) {
  const { t } = useLanguage();

  return (
    <div className={`rounded-2xl border border-amber-200 bg-amber-50/80 px-6 py-10 text-center text-amber-800 shadow-none ${className}`}>
      <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-600" />
      <p className="font-semibold text-amber-900">{t(title)}</p>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-amber-800/85">{t(description)}</p>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          className="mt-5 border-amber-300 bg-white/70 text-amber-900 hover:bg-amber-100"
          onClick={() => { void onRetry(); }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {t(actionLabel)}
        </Button>
      )}
    </div>
  );
}
