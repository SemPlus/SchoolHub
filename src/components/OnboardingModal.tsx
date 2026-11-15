import React, { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { GraduationCap, Backpack, Presentation, Plus, X, Check } from 'lucide-react';
import { db } from '../firebase';
import type { AccountType, User } from '../types';
import Modal from './Modal';
import SchoolPicker, { PickedSchool } from './SchoolPicker';
import ClassPicker from './ClassPicker';
import {
  formatClassName,
  formatSchoolYear,
  isTeacherAccount,
  maxClassYear,
  parseClassLabel,
  schoolYearStart,
  SECTION_PATTERN,
  suggestedClassYear,
} from '../lib/schoolYear';
import { firebaseErrorMessage } from '../lib/engagement';
import { SUBJECTS, subjectStyle, withAlpha } from '../lib/subjects';
import { cn } from '../lib/utils';
import { clearJoinInvite, JoinInvite } from '../lib/join';
import { findSchoolById } from '../lib/schools';

interface OnboardingModalProps {
  profile: User;
  /** 'setup' cannot be dismissed; 'edit' is opened from the profile. */
  mode: 'setup' | 'edit';
  onClose?: () => void;
  /** From a class poster: prefill the school and class. */
  invite?: JoinInvite | null;
}

export default function OnboardingModal({ profile, mode, onClose, invite }: OnboardingModalProps) {
  const isNewSchoolYear = mode === 'setup' && !!profile.schoolId && (profile.profileSchoolYear ?? 0) < schoolYearStart();

  const [accountType, setAccountType] = useState<AccountType | null>(
    profile.accountType ?? (isTeacherAccount(profile) ? 'teacher' : profile.schoolId ? 'student' : null)
  );
  const [school, setSchool] = useState<PickedSchool | null>(
    profile.schoolId ? { id: profile.schoolId, name: profile.schoolName || profile.schoolId, city: profile.schoolCity || '', grade: profile.schoolGrade } : null
  );
  // Student class
  const [classYear, setClassYear] = useState<number | undefined>(isNewSchoolYear ? suggestedClassYear(profile) : profile.classYear);
  const [classSection, setClassSection] = useState<string>(profile.classSection || '');
  // Teacher classes and subjects
  const [teacherClasses, setTeacherClasses] = useState<string[]>(profile.teacherClasses || []);
  const [draftYear, setDraftYear] = useState<number | undefined>();
  const [draftSection, setDraftSection] = useState('');
  const [teacherSubjects, setTeacherSubjects] = useState<string[]>(profile.teacherSubjects || []);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxYear = maxClassYear(school?.grade);

  // A poster invitation fills in the school and class for a new student.
  useEffect(() => {
    if (!invite || mode !== 'setup' || profile.schoolId) return;
    const parsed = parseClassLabel(invite.classLabel);
    findSchoolById(invite.schoolId).then(found => {
      if (!found) return;
      setSchool({ id: found.id, name: found.name, city: found.city, grade: found.grade, type: found.type, province: found.province });
      setAccountType(current => current ?? 'student');
      if (parsed) {
        setClassYear(parsed.classYear);
        setClassSection(parsed.classSection);
      }
    }).catch(() => undefined);
  }, [invite?.schoolId, invite?.classLabel]);

  useEffect(() => {
    // A middle school only has years 1 to 3.
    if (classYear && classYear > maxYear) setClassYear(undefined);
    setTeacherClasses(list => list.filter(l => (parseClassLabel(l)?.classYear ?? 9) <= maxYear));
  }, [maxYear]);

  const hasStudentClass = !!classYear && SECTION_PATTERN.test(classSection);
  const draftLabel = draftYear && SECTION_PATTERN.test(draftSection) ? formatClassName(draftYear, draftSection) : '';
  const canSave = !!school && (
    accountType === 'student' ? hasStudentClass
    : accountType === 'teacher' ? teacherClasses.length > 0 && teacherSubjects.length > 0
    : false
  );

  const addDraftClass = () => {
    if (!draftLabel || teacherClasses.includes(draftLabel)) return;
    setTeacherClasses([...teacherClasses, draftLabel].sort());
    setDraftSection('');
  };

  const toggleSubject = (subject: string) => {
    setTeacherSubjects(list => list.includes(subject) ? list.filter(s => s !== subject) : [...list, subject]);
  };

  const handleSave = async () => {
    if (!school || !canSave || !accountType) return;
    setIsSaving(true);
    setError(null);
    try {
      const isTeacher = accountType === 'teacher';
      await updateDoc(doc(db, 'users', profile.uid), {
        accountType,
        schoolId: school.id,
        schoolName: school.name,
        schoolCity: school.city,
        schoolGrade: school.grade ?? profile.schoolGrade ?? 2,
        classYear: !isTeacher && hasStudentClass ? classYear : null,
        classSection: !isTeacher && hasStudentClass ? classSection : null,
        teacherClasses: isTeacher ? teacherClasses : [],
        teacherSubjects: isTeacher ? teacherSubjects : [],
        profileSchoolYear: schoolYearStart(),
      });
      clearJoinInvite();
      onClose?.();
    } catch (err) {
      setError(firebaseErrorMessage(err, 'Could not save your profile.'));
    } finally {
      setIsSaving(false);
    }
  };

  const label = 'text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium';

  const continueText = !canSave
    ? 'Continue'
    : accountType === 'teacher'
      ? `Continue as teacher · ${teacherClasses.length} ${teacherClasses.length === 1 ? 'class' : 'classes'}`
      : `Continue as ${formatClassName(classYear, classSection)} · ${school?.name}`;

  return (
    <Modal
      isOpen
      onClose={onClose}
      dismissible={mode === 'edit'}
      level={3}
      size="md"
      icon={<GraduationCap className="w-5 h-5 text-luxury-gold" />}
      title={isNewSchoolYear ? `Welcome to ${formatSchoolYear(schoolYearStart())}` : mode === 'edit' ? 'School and classes' : 'Welcome to SchoolHub'}
      subtitle={isNewSchoolYear ? 'A new school year has started: check your classes' : 'This shows you what your class needs first'}
      footer={
        <div className="space-y-3">
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="w-full bg-white text-luxury-black font-bold py-4 rounded-full disabled:opacity-20 transition-all truncate px-4"
          >
            {isSaving ? 'Saving…' : continueText}
          </button>
        </div>
      }
    >
      <div className="space-y-8">
        {/* 1. Student or teacher */}
        <div className="space-y-3">
          <p className={label}>I am a</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { type: 'student' as const, title: 'Student', icon: Backpack, hint: 'One class' },
              { type: 'teacher' as const, title: 'Teacher', icon: Presentation, hint: 'Several classes' },
            ]).map(option => (
              <button
                key={option.type}
                type="button"
                onClick={() => setAccountType(option.type)}
                className={cn(
                  'flex flex-col items-center gap-2 p-5 rounded-2xl border transition-all',
                  accountType === option.type ? 'border-luxury-gold bg-luxury-gold/10 text-white' : 'border-white/10 text-white/60 hover:bg-white/5'
                )}
              >
                <option.icon className={cn('w-7 h-7', accountType === option.type ? 'text-luxury-gold' : 'text-white/40')} />
                <span className="text-sm font-semibold">{option.title}</span>
                <span className="text-[10px] text-white/40">{option.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {accountType && (
          <>
            {/* 2. School */}
            <div className="space-y-2">
              <p className={label}>School</p>
              <SchoolPicker value={school} onChange={setSchool} />
              <p className="text-[10px] text-white/25">From the official Ministry of Education school registry.</p>
            </div>

            {/* 3a. Student class */}
            {accountType === 'student' && (
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
            )}

            {/* 3b. Teacher classes and subjects */}
            {accountType === 'teacher' && (
              <>
                <div className={cn('space-y-4', !school && 'opacity-40 pointer-events-none')}>
                  <p className={label}>Classes you teach</p>
                  {teacherClasses.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {teacherClasses.map(l => (
                        <span key={l} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl bg-luxury-gold/10 border border-luxury-gold/30 text-sm text-white">
                          {l}
                          <button type="button" onClick={() => setTeacherClasses(teacherClasses.filter(x => x !== l))} className="p-0.5 text-white/40 hover:text-white" aria-label={`Remove ${l}`}>
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <ClassPicker
                    classYear={draftYear}
                    classSection={draftSection}
                    maxYear={maxYear}
                    onChange={({ classYear: y, classSection: s }) => {
                      setDraftYear(y);
                      setDraftSection(s || '');
                    }}
                  />
                  <button
                    type="button"
                    onClick={addDraftClass}
                    disabled={!draftLabel || teacherClasses.includes(draftLabel)}
                    className="w-full py-3 rounded-xl border border-dashed border-white/20 text-sm text-white/70 hover:text-white flex items-center justify-center gap-2 disabled:opacity-30"
                  >
                    <Plus className="w-4 h-4" /> {draftLabel ? `Add class ${draftLabel}` : 'Pick a year and section, then add'}
                  </button>
                </div>

                <div className="space-y-3">
                  <p className={label}>Subjects you teach</p>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS.map(s => {
                      const { color, icon: Icon } = subjectStyle(s);
                      const active = teacherSubjects.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleSubject(s)}
                          className="px-3 py-2 rounded-xl border text-xs flex items-center gap-1.5 transition-all"
                          style={active
                            ? { borderColor: color, backgroundColor: withAlpha(color, 0.15), color }
                            : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}
                        >
                          {active ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <p className="text-[11px] text-white/35 leading-relaxed">
                  Teacher accounts can add materials for any of these classes right away. Verifying other people's materials unlocks once the SchoolHub team confirms you are a teacher.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
