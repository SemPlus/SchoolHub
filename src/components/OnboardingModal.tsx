import React, { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { GraduationCap, X } from 'lucide-react';
import { db } from '../firebase';
import type { User } from '../types';
import SchoolPicker, { PickedSchool } from './SchoolPicker';
import ClassPicker from './ClassPicker';
import {
  formatClassName,
  formatSchoolYear,
  maxClassYear,
  schoolYearStart,
  SECTION_PATTERN,
  suggestedClassYear,
} from '../lib/schoolYear';
import { firebaseErrorMessage } from '../lib/engagement';

interface OnboardingModalProps {
  profile: User;
  /** 'setup' cannot be dismissed; 'edit' is opened from the profile. */
  mode: 'setup' | 'edit';
  onClose?: () => void;
}

export default function OnboardingModal({ profile, mode, onClose }: OnboardingModalProps) {
  const isTeacher = profile.role === 'teacher';
  const isNewSchoolYear = mode === 'setup' && !!profile.schoolId && (profile.profileSchoolYear ?? 0) < schoolYearStart();

  const [school, setSchool] = useState<PickedSchool | null>(
    profile.schoolId ? { id: profile.schoolId, name: profile.schoolName || profile.schoolId, city: profile.schoolCity || '', grade: profile.schoolGrade } : null
  );
  const [classYear, setClassYear] = useState<number | undefined>(isNewSchoolYear ? suggestedClassYear(profile) : profile.classYear);
  const [classSection, setClassSection] = useState<string>(profile.classSection || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxYear = maxClassYear(school?.grade);

  useEffect(() => {
    // A middle school only has years 1 to 3.
    if (classYear && classYear > maxYear) setClassYear(undefined);
  }, [maxYear]);

  const hasClass = !!classYear && SECTION_PATTERN.test(classSection);
  const canSave = !!school && (isTeacher || hasClass);

  const handleSave = async () => {
    if (!school || !canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        schoolId: school.id,
        schoolName: school.name,
        schoolCity: school.city,
        schoolGrade: school.grade ?? profile.schoolGrade ?? 2,
        classYear: hasClass ? classYear : null,
        classSection: hasClass ? classSection : null,
        profileSchoolYear: schoolYearStart(),
      });
      onClose?.();
    } catch (err) {
      setError(firebaseErrorMessage(err, 'Could not save your school and class.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-luxury-black/95 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass-panel w-full max-w-lg rounded-[2rem] border-white/10 shadow-2xl flex flex-col max-h-[92vh]"
      >
        <div className="p-6 sm:p-8 border-b border-white/5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-luxury-gold/10 rounded-2xl">
              <GraduationCap className="w-6 h-6 text-luxury-gold" />
            </div>
            <div>
              <h2 className="text-2xl font-serif text-white">
                {isNewSchoolYear ? `Welcome to ${formatSchoolYear(schoolYearStart())}` : mode === 'edit' ? 'School and class' : 'Your school and class'}
              </h2>
              <p className="text-xs text-white/50 mt-1 leading-relaxed">
                {isNewSchoolYear
                  ? 'A new school year has started. Check your class so you see the right materials.'
                  : 'This shows you what your class needs and tags your uploads correctly.'}
              </p>
            </div>
          </div>
          {mode === 'edit' && onClose && (
            <button onClick={onClose} className="text-white/30 hover:text-white p-2 rounded-full hover:bg-white/5">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 sm:p-8 space-y-8 overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">School</p>
            <SchoolPicker value={school} onChange={setSchool} />
            <p className="text-[10px] text-white/25">From the official Ministry of Education school registry.</p>
          </div>

          <div className="space-y-2">
            <ClassPicker
              classYear={classYear}
              classSection={classSection}
              maxYear={maxYear}
              disabled={!school}
              onChange={({ classYear: y, classSection: s }) => {
                setClassYear(y);
                setClassSection(s || '');
              }}
            />
            {isTeacher && (
              <p className="text-[10px] text-white/30">As a teacher, the class is optional.</p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        <div className="p-6 sm:p-8 border-t border-white/5">
          <button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="w-full luxury-button bg-white text-luxury-black font-semibold py-4 rounded-full disabled:opacity-20 transition-all"
          >
            {isSaving
              ? 'Saving…'
              : hasClass && school
                ? `Continue as ${formatClassName(classYear, classSection)} · ${school.name}`
                : 'Continue'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
