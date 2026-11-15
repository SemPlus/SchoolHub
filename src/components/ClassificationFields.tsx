import React from 'react';
import SchoolPicker, { PickedSchool } from './SchoolPicker';
import ClassPicker from './ClassPicker';
import Dropdown from './Dropdown';
import { SUBJECTS, subjectStyle } from '../lib/subjects';
import { maxClassYear, parseClassLabel } from '../lib/schoolYear';
import { cn } from '../lib/utils';

import { t } from '../lib/i18n';
export interface ClassificationValue {
  school: PickedSchool | null;
  classYear?: number;
  classSection?: string;
  subject: string;
}

interface ClassificationFieldsProps {
  value: ClassificationValue;
  onChange: (value: ClassificationValue) => void;
  /** Teacher's classes, offered as one-tap choices ("3B", "4A"). */
  quickClasses?: string[];
  /** Subjects listed first, e.g. the ones a teacher teaches. */
  preferredSubjects?: string[];
}

export default function ClassificationFields({ value, onChange, quickClasses = [], preferredSubjects = [] }: ClassificationFieldsProps) {
  const set = (patch: Partial<ClassificationValue>) => onChange({ ...value, ...patch });
  const currentLabel = value.classYear && value.classSection ? `${value.classYear}${value.classSection}` : '';
  const [showFullPicker, setShowFullPicker] = React.useState(quickClasses.length === 0);

  const orderedSubjects = [
    ...preferredSubjects.filter(s => (SUBJECTS as readonly string[]).includes(s)),
    ...SUBJECTS.filter(s => !preferredSubjects.includes(s)),
  ];
  const subjectOptions = [
    { value: '', label: 'Choose a subject' },
    ...orderedSubjects.map(s => ({ value: s, label: s, color: subjectStyle(s).color })),
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">{t("Subject")}</label>
        {preferredSubjects.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {preferredSubjects.map(s => {
              const { color, icon: Icon } = subjectStyle(s);
              const active = value.subject === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => set({ subject: s })}
                  className="px-3 py-2 rounded-xl border text-xs flex items-center gap-1.5 transition-all"
                  style={active ? { borderColor: color, backgroundColor: `${color}22`, color } : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
                >
                  <Icon className="w-3.5 h-3.5" /> {t(s)}
                </button>
              );
            })}
          </div>
        )}
        <Dropdown options={subjectOptions} value={value.subject} onChange={(subject) => set({ subject })} className="w-full" label={t("Subject")} />
      </div>

      {quickClasses.length > 0 && (
        <div className="space-y-2">
          <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">{t("For which class?")}</label>
          <div className="flex flex-wrap gap-2">
            {quickClasses.map(label => {
              const parsed = parseClassLabel(label);
              if (!parsed) return null;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => set({ classYear: parsed.classYear, classSection: parsed.classSection })}
                  className={cn(
                    'w-14 h-11 rounded-xl border text-sm font-semibold transition-all',
                    currentLabel === label ? 'bg-luxury-gold text-luxury-black border-luxury-gold' : 'border-white/10 text-white/60 hover:bg-white/5'
                  )}
                >
                  {label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowFullPicker(v => !v)}
              className="px-3 h-11 rounded-xl border border-dashed border-white/20 text-xs text-white/50 hover:text-white"
            >
              {showFullPicker ? t("Hide other schools") : t("Other class or school")}
            </button>
          </div>
        </div>
      )}

      {showFullPicker && (
        <>
          <div className="space-y-2">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">{t("School")}</label>
            <SchoolPicker
              value={value.school}
              clearable
              onChange={(school) => {
                const max = maxClassYear(school?.grade);
                set({ school, classYear: value.classYear && value.classYear <= max ? value.classYear : undefined });
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
        </>
      )}
    </div>
  );
}
