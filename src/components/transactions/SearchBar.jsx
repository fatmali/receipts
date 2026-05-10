import { useState, useEffect, useRef } from 'react';

export default function SearchBar({ value, onChange, onClear }) {
  const [local, setLocal] = useState(value || '');
  const timerRef = useRef(null);

  useEffect(() => {
    setLocal(value || '');
  }, [value]);

  const handleChange = (e) => {
    const v = e.target.value;
    setLocal(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 300);
  };

  const handleClear = () => {
    setLocal('');
    clearTimeout(timerRef.current);
    onChange('');
    onClear?.();
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className="relative px-4 py-2">
      <div className="relative">
        {/* Search icon */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          type="text"
          value={local}
          onChange={handleChange}
          placeholder="Search transactions..."
          className="w-full bg-surface border border-border rounded-xl pl-10 pr-10 py-3 text-sm text-text placeholder:text-text-muted focus:border-green focus:ring-1 focus:ring-green transition-colors"
          style={{ minHeight: 44 }}
        />

        {/* Clear button */}
        {local && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text min-w-[44px] min-h-[44px] flex items-center justify-center -mr-3"
            aria-label="Clear search"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
