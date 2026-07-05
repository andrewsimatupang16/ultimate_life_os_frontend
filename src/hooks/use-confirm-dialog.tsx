import { useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
};

export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const dialog = (
    <ConfirmDialog
      open={Boolean(options)}
      title={options?.title || ''}
      description={options?.description || ''}
      confirmLabel={options?.confirmLabel}
      onOpenChange={(open) => {
        if (!open) setOptions(null);
      }}
      onConfirm={() => {
        void options?.onConfirm();
        setOptions(null);
      }}
    />
  );

  return {
    confirm: setOptions,
    dialog,
  };
}
