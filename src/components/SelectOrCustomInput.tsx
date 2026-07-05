import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const CUSTOM_VALUE = '__custom__';
type SelectOption = string | { value: string; label: string };

type SelectOrCustomInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  customPlaceholder?: string;
  selectClassName?: string;
  inputClassName?: string;
  disabled?: boolean;
};

export default function SelectOrCustomInput({
  value,
  onValueChange,
  options,
  placeholder = 'Pilih opsi',
  customPlaceholder = 'Tulis opsi sendiri',
  selectClassName,
  inputClassName,
  disabled = false,
}: SelectOrCustomInputProps) {
  const normalizedOptions = useMemo(() => {
    const seen = new Set<string>();
    return options.reduce<{ value: string; label: string }[]>((items, option) => {
      const value = (typeof option === 'string' ? option : option.value).trim();
      const label = (typeof option === 'string' ? option : option.label).trim();
      if (!value || seen.has(value)) return items;
      seen.add(value);
      items.push({ value, label: label || value });
      return items;
    }, []);
  }, [options]);
  const [customMode, setCustomMode] = useState(false);
  const trimmedValue = value.trim();
  const valueRequiresCustomMode = Boolean(trimmedValue) && !normalizedOptions.some((option) => option.value === trimmedValue);
  const showCustomInput = customMode || valueRequiresCustomMode;

  if (showCustomInput) {
    return (
      <div className="space-y-2">
        <Input
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={customPlaceholder}
          disabled={disabled}
          className={inputClassName}
        />
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0 py-0 text-xs text-blue-600 hover:bg-transparent"
            onClick={() => {
              setCustomMode(false);
              onValueChange('');
            }}
          >
            Kembali ke daftar pilihan
          </Button>
        )}
      </div>
    );
  }

  return (
    <Select
      value={value || undefined}
      onValueChange={(nextValue) => {
        if (nextValue === CUSTOM_VALUE) {
          setCustomMode(true);
          onValueChange('');
          return;
        }
        setCustomMode(false);
        onValueChange(nextValue);
      }}
      disabled={disabled}
    >
      <SelectTrigger className={selectClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {normalizedOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
        <SelectItem value={CUSTOM_VALUE}>+ Isi sendiri</SelectItem>
      </SelectContent>
    </Select>
  );
}
