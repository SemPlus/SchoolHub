import React from 'react';
import SchoolPicker, { PickedSchool } from './SchoolPicker';
import ClassPicker from './ClassPicker';
import Dropdown from './Dropdown';
import { SUBJECTS } from '../lib/subjects';
import { maxClassYear } from '../lib/schoolYear';

export interface ClassificationValue {
  school: PickedSchool | null;
  classYear?: number;
  classSection?: string;
  subject: string;
  /** yyyy-mm-dd from the date input, or '' for none. */
  examDate: string;
}

interface ClassificationFieldsProps {
  value: ClassificationValue;
  onChange: (value: ClassificationValue) => void;
}

const subjectOptions = [{ value: '', label: 'No subject' }, ...SUBJECTS.map(s => ({ value: s, label: s }))];

export function toDateInputValue(date?: Date | null): string {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Midday local time avoids the date shifting across time zones. */
export function fromDateInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
}

export default function ClassificationFields({ value, onChange }: ClassificationFieldsProps) {
  const set = (patch: Partial<ClassificationValue>) => onChange({ ...value, ...patch });
  const today = toDateInputValue(new Date());

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">School</label>
        <SchoolPicker
          value={value.school}
          clearable
          onChange={(school) => {
            const max = maxClassYear(school?.grade);
            set({
              school,
              classYear: value.classYear && value.classYear <= max ? value.classYear : undefined,
            });
          }}
        />
      </div>

      <ClassPicker
        classYear={value.classYear}
        classSection={value.classSection}
        maxYear={maxClassYear(value.school?.grade)}
        disabled={!value.school}
        onChange={({ classYear, classSection }) => set({ classYear, classSection })}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Subject</label>
          <Dropdown
            options={subjectOptions}
            value={value.subject}
            onChange={(subject) => set({ subject })}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Test date (optional)</label>
          <input
            type="date"
            min={today}
            value={value.examDate}
            onChange={(e) => set({ examDate: e.target.value })}
            className="w-full bg-transparent border-b border-white/10 py-2 px-1 text-sm text-white focus:border-luxury-gold outline-none [color-scheme:dark]"
          />
          <p className="text-[9px] text-white/25 ml-1">Shows this material in the class's test radar.</p>
        </div>
      </div>
    </div>
  );
}
