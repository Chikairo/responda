import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectMenuOption<T extends string = string> {
  value: T;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

interface SelectMenuProps<T extends string = string> {
  value: T;
  options: SelectMenuOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  menuAlign?: 'left' | 'right';
}

export function SelectMenu<T extends string = string>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  menuAlign = 'left',
}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        className={`w-full inline-flex items-center justify-between gap-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] px-3 py-1.5 text-xs text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${buttonClassName}`}
      >
        <span className="truncate text-left">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-[var(--text-muted)] transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute ${
            menuAlign === 'right' ? 'right-0' : 'left-0'
          } mt-1.5 min-w-full w-max max-w-[300px] max-h-64 overflow-y-auto rounded-xl bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-[var(--shadow-floating)] z-[950] p-1 space-y-0.5 ${menuClassName}`}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={opt.disabled}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSelected
                    ? 'bg-[var(--action-blue-bg)] text-[var(--action-blue)] dark:text-[#60A5FA] font-semibold'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]'
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate">{opt.label}</div>
                  {opt.sublabel && (
                    <div className="text-[10px] text-[var(--text-muted)] truncate">
                      {opt.sublabel}
                    </div>
                  )}
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
