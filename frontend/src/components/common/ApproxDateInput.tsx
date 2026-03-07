import { useMemo, useState, useRef, useEffect } from 'react';
import { Info, ChevronDown } from 'lucide-react';
import type { LookupType } from '../../types/models';

type ParsedApprox = {
  prefix: string;
  input: string;
};

const parseApproxDate = (value: string | undefined, prefixes: string[]): ParsedApprox => {
  if (!value) return { prefix: '', input: '' };

  const trimmed = value.trim();
  if (!trimmed) return { prefix: '', input: '' };

  if (prefixes.includes('BET')) {
    const betMatch = trimmed.match(/^BET\s+(.+?)\s+AND\s+(.+)$/i);
    if (betMatch) {
      return { prefix: 'BET', input: `${betMatch[1]} ${betMatch[2]}` };
    }
  }

  if (prefixes.includes('FROM')) {
    const fromMatch = trimmed.match(/^FROM\s+(.+?)\s+TO\s+(.+)$/i);
    if (fromMatch) {
      return { prefix: 'FROM', input: `${fromMatch[1]} ${fromMatch[2]}` };
    }
  }

  const prefixPattern = prefixes.join('|');
  if (prefixPattern) {
    const prefixMatch = trimmed.match(new RegExp(`^(${prefixPattern})(?:\\s+(.*))?$`, 'i'));
    if (prefixMatch) {
      const prefix = prefixMatch[1].toUpperCase();
      const inputPart = (prefixMatch[2] ?? '').trim();
      return { prefix, input: inputPart };
    }
  }

  return { prefix: '', input: trimmed };
};

const buildApproxDate = (prefix: string, input: string): string => {
  const cleaned = input.trim();
  if (!prefix) return cleaned;
  if (!cleaned) return prefix ? `${prefix} ` : '';

  if (prefix === 'BET' || prefix === 'FROM') {
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 2) {
      const first = parts[0];
      const second = parts.slice(1).join(' ');
      return prefix === 'BET'
        ? `BET ${first} AND ${second}`
        : `FROM ${first} TO ${second}`;
    }
  }

  return `${prefix} ${cleaned}`;
};

const InfoPopover = ({ options }: { options: LookupType[] }) => (
  <div className="absolute z-20 hidden group-hover:block left-0 top-6 w-64 rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-lg">
    <div className="font-medium text-gray-800 mb-2">GEDCOM 5.5.1 Date Prefixes</div>
    {options.length === 0 ? (
      <div className="text-gray-500">Loading types ...</div>
    ) : (
      <>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {options.map((opt) => (
            <div key={opt.code} className="contents">
              <span className="font-mono">{opt.code}</span>
              <span>{opt.description}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-gray-600">
          Examples: <span className="font-mono">ABT 1850</span>,{' '}
          <span className="font-mono">BET 1850 AND 1860</span>,{' '}
          <span className="font-mono">FROM 1850 TO 1860</span>
        </div>
      </>
    )}
  </div>
);

type ApproxDateInputProps = {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  options?: LookupType[];
};

export const ApproxDateInput = ({
  label,
  value,
  onChange,
  placeholder,
  options,
}: ApproxDateInputProps) => {
  const resolvedOptions = options ?? [];
  const prefixes = useMemo(
    () => resolvedOptions.map((opt) => opt.code.toUpperCase()),
    [resolvedOptions]
  );
  const parsed = useMemo(() => {
    const p = parseApproxDate(value, prefixes);
    if (p.prefix && resolvedOptions.length > 0) {
      const match = resolvedOptions.find(
        (opt) => opt.code.toUpperCase() === p.prefix.toUpperCase()
      );
      if (match) return { ...p, prefix: match.code };
    }
    return p;
  }, [value, prefixes, resolvedOptions]);

  const [prefixOpen, setPrefixOpen] = useState(false);
  const prefixRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!prefixOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (prefixRef.current && !prefixRef.current.contains(e.target as Node)) {
        setPrefixOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [prefixOpen]);

  const selectedOpt = resolvedOptions.find((o) => o.code === parsed.prefix);
  const displayLabel = selectedOpt ? `${selectedOpt.code} (${selectedOpt.description})` : (parsed.prefix || '-');

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <div className="relative group">
          <Info className="w-4 h-4 text-gray-400 cursor-help" />
          <InfoPopover options={resolvedOptions} />
        </div>
      </div>
      <div className="flex gap-2 min-w-0">
        <div className="relative w-36 shrink-0" ref={prefixRef}>
          <button
            type="button"
            onClick={() => setPrefixOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-1 px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 hover:bg-gray-50"
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${prefixOpen ? 'rotate-180' : ''}`} />
          </button>
          {prefixOpen && (
            <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white py-1 shadow-lg max-h-56 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  onChange(buildApproxDate('', parsed.input));
                  setPrefixOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
              >
                -
              </button>
              {resolvedOptions.map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => {
                    onChange(buildApproxDate(opt.code, parsed.input));
                    setPrefixOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${parsed.prefix === opt.code ? 'bg-emerald-50 text-emerald-800' : ''}`}
                >
                  {opt.code} ({opt.description})
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          type="text"
          value={parsed.input}
          onChange={(e) => onChange(buildApproxDate(parsed.prefix, e.target.value))}
          placeholder={placeholder || ''}
          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>
      <p className="text-xs text-gray-500">
        For BET/FROM, enter two dates separated by whitespace.
      </p>
    </div>
  );
};
