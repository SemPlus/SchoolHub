import React, { useEffect, useRef, useState } from 'react';
import { Search, School, X, Loader2 } from 'lucide-react';
import { describeSchool, searchSchools, SchoolOption } from '../lib/schools';
import { cn } from '../lib/utils';

export interface PickedSchool {
  id: string;
  name: string;
  city: string;
  grade?: 1 | 2;
  type?: string;
  province?: string;
}

interface SchoolPickerProps {
  value: PickedSchool | null;
  onChange: (school: PickedSchool | null) => void;
  placeholder?: string;
  /** Show a clear button on the selected school. */
  clearable?: boolean;
  className?: string;
}

/**
 * Search-as-you-type over the official school registry. Schools can only be
 * picked from the list, never typed freely.
 */
export default function SchoolPicker({ value, onChange, placeholder = 'Search by school name or city…', clearable = false, className }: SchoolPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SchoolOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(!value);
  const requestId = useRef(0);

  useEffect(() => {
    if (!value) setIsEditing(true);
  }, [value]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    const id = ++requestId.current;
    setIsSearching(true);
    const timer = window.setTimeout(() => {
      searchSchools(trimmed)
        .then(found => {
          if (id !== requestId.current) return;
          setResults(found);
          setError(null);
        })
        .catch(err => {
          if (id !== requestId.current) return;
          setError(err?.message || 'Could not load the school list.');
        })
        .finally(() => {
          if (id === requestId.current) setIsSearching(false);
        });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  const pick = (school: SchoolOption) => {
    onChange({ id: school.id, name: school.name, city: school.city, grade: school.grade, type: school.type, province: school.province });
    setQuery('');
    setResults([]);
    setIsEditing(false);
  };

  if (value && !isEditing) {
    return (
      <div className={cn('flex items-center gap-3 p-3 rounded-2xl border border-luxury-gold/30 bg-luxury-gold/5', className)}>
        <School className="w-5 h-5 text-luxury-gold shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white truncate">{value.name}</p>
          <p className="text-[10px] uppercase tracking-widest text-white/40 truncate">
            {value.type ? describeSchool({ type: value.type, city: value.city, province: value.province || '' }) : value.city}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-[10px] uppercase tracking-widest text-luxury-gold hover:text-white px-2 py-1"
        >
          Change
        </button>
        {clearable && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-white/30 hover:text-white p-1"
            title="Clear school"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          autoFocus={!!value}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-luxury-gold/30"
        />
        {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-luxury-gold animate-spin" />}
        {!isSearching && value && (
          <button
            type="button"
            onClick={() => { setIsEditing(false); setQuery(''); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white p-1"
            title="Keep current school"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {query.trim().length >= 2 && !isSearching && results.length === 0 && !error && (
        <p className="mt-2 text-xs text-white/40">
          No school matches. Try the town name, or a shorter part of the school name.
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-2 max-h-64 overflow-y-auto custom-scrollbar rounded-2xl border border-white/10 bg-luxury-black divide-y divide-white/5">
          {results.map(school => (
            <li key={school.id}>
              <button
                type="button"
                onClick={() => pick(school)}
                className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
              >
                <p className="text-sm text-white">{school.name}</p>
                <p className="text-[10px] uppercase tracking-widest text-white/40">{describeSchool(school)}</p>
                {school.parent && <p className="text-[10px] text-white/25 truncate">{school.parent}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
