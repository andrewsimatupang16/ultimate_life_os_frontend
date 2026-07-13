import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

type LoadingStateProps = {
  label?: string;
};

const SLOW_LOADING_NOTICE_MS = 4000;

export default function LoadingState({ label = 'Memuat data...' }: LoadingStateProps) {
  const { t } = useLanguage();
  const [showSlowNotice, setShowSlowNotice] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setShowSlowNotice(true), SLOW_LOADING_NOTICE_MS);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-center text-slate-500 shadow-none">
      <div className="flex max-w-md flex-col items-center gap-2 text-sm">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        <span>{t(label)}</span>
        {showSlowNotice && (
          <p className="text-xs leading-5 text-slate-400">
            {t('Jika ini terjadi saat pertama membuka aplikasi, backend gratis kemungkinan sedang bangun. Halaman akan berhenti loading otomatis jika server belum merespons.')}
          </p>
        )}
      </div>
    </div>
  );
}
