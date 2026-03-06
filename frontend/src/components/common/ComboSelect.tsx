import { forwardRef, useId } from 'react';
import type { LookupType } from '../../types/models';

interface ComboSelectProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'list'> {
  label?: string;
  options?: LookupType[];
  helperText?: string;
  error?: string;
}

/**
 * A hybrid input that offers dropdown suggestions from a lookup table
 * while still allowing free-text entry (required by GEDCOM 5.5.1 for
 * fields that may hold non-standard values).
 */
export const ComboSelect = forwardRef<HTMLInputElement, ComboSelectProps>(
  ({ label, options, helperText, error, className = '', id, ...props }, ref) => {
    const autoId = useId();
    const listId = `${autoId}-list`;
    const inputId = id || props.name;

    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          list={listId}
          className={`
            block w-full px-3 py-2 border rounded-lg shadow-sm
            focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
            disabled:bg-gray-50 disabled:text-gray-500
            ${error ? 'border-red-300 text-red-900 placeholder-red-300' : 'border-gray-300'}
            ${className}
          `}
          {...props}
        />
        <datalist id={listId}>
          {options?.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.description}
            </option>
          ))}
        </datalist>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {helperText && !error && (
          <p className="text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

ComboSelect.displayName = 'ComboSelect';
