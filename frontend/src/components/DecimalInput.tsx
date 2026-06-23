interface DecimalInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

export function DecimalInput({ value, onChange, placeholder, id }: DecimalInputProps) {
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      className="decimal-input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function parseDecimalInput(value: string, fallback = 0): number {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}
