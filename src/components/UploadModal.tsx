import React, { useState, useEffect, useMemo } from 'react';
import { Link as LinkIcon, ChevronDown, Plus } from 'lucide-react';
import { collection, serverTimestamp } from 'firebase/firestore';
import { addDoc } from '../lib/firestoreWrites';
import { keywordsFor } from '../lib/search';
import CoAuthorPicker, { type CoAuthor } from './CoAuthorPicker';
import { db, auth } from '../firebase';
import { Material, MaterialType } from '../types';
import Dropdown from './Dropdown';
import Modal from './Modal';
import DriveUploader from './DriveUploader';
import CollectionPicker from './CollectionPicker';
import ClassificationFields, { ClassificationValue } from './ClassificationFields';
import KindLevelFields from './KindLevelFields';
import TextbookPicker from './TextbookPicker';
import { useAppData } from '../context/AppData';
import { classIdFor, classLabelsOf, formatClassName, isTeacherAccount, parseClassLabel, SECTION_PATTERN } from '../lib/schoolYear';
import { cn } from '../lib/utils';

import { t } from '../lib/i18n';
interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFolderId?: string | null;
  /** Preselect a collection, e.g. when adding a work from a collection window. */
  defaultCollectionId?: string | null;
  /** Preselect a class label such as "3B" (the class a teacher is viewing). */
  defaultClassLabel?: string | null;
  /** Uploading an improved version of this material. */
  improves?: Material | null;
  /** Preselect a subject. */
  defaultSubject?: string | null;
}

export const TYPE_OPTIONS = [
  { value: 'link', label: 'Link' },
  { value: 'pdf', label: 'PDF' },
  { value: 'word', label: 'Document' },
  { value: 'canva', label: 'Presentation' },
  { value: 'other', label: 'Other' },
];

/** Tags already offered across the archive, most used first. */
function useTagSuggestions(): string[] {
  const { materials } = useAppData();
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of materials) {
      for (const tag of m.tags || []) {
        const clean = tag.trim();
        if (clean) counts.set(clean, (counts.get(clean) || 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 200);
  }, [materials]);
}

const LAST_SUBJECT_KEY = 'schoolhub.lastSubject';

export default function UploadModal({ isOpen, onClose, currentFolderId, defaultCollectionId, defaultClassLabel, improves, defaultSubject }: UploadModalProps) {
  const { profile } = useAppData();
  const isTeacher = isTeacherAccount(profile);
  const tagSuggestions = useTagSuggestions();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [materialType, setMaterialType] = useState<MaterialType>('link');
  const [kind, setKind] = useState('');
  const [level, setLevel] = useState('');
  const [book, setBook] = useState<{ isbn: string; title: string } | null>(null);
  const [classification, setClassification] = useState<ClassificationValue>({ school: null, subject: '' });
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([]);
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [showMore, setShowMore] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploaderKey, setUploaderKey] = useState(0);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // Sensible defaults so most people only pick a file and press Add.
    const classLabel = defaultClassLabel || classLabelsOf(profile)[0] || '';
    const parsed = parseClassLabel(classLabel);
    let lastSubject = '';
    try { lastSubject = window.localStorage.getItem(LAST_SUBJECT_KEY) || ''; } catch { /* ignore */ }
    const teacherSubjects = profile?.teacherSubjects || [];
    const subject = defaultSubject || (isTeacher
      ? (teacherSubjects.includes(lastSubject) ? lastSubject : teacherSubjects[0] || '')
      : '');
    setClassification({
      school: profile?.schoolId
        ? { id: profile.schoolId, name: profile.schoolName || profile.schoolId, city: profile.schoolCity || '', grade: profile.schoolGrade }
        : null,
      classYear: parsed?.classYear,
      classSection: parsed?.classSection,
      subject,
    });
    setCollectionId(defaultCollectionId || null);
    setCoAuthors([]);
    setError('');
    // An improved version starts from the original's subject, class and kind.
    if (improves) {
      setClassification({
        school: improves.schoolId ? { id: improves.schoolId, name: improves.schoolName || improves.schoolId, city: improves.schoolCity || '' } : null,
        classYear: improves.classYear,
        classSection: improves.classSection,
        subject: improves.subject || '',
      });
      setKind(improves.kind || '');
      setLevel(improves.level || '');
      setTitle(`${improves.title} (improved)`.slice(0, 100));
      setCollectionId(improves.collectionId || null);
      setBook(improves.isbn ? { isbn: improves.isbn, title: improves.bookTitle || improves.isbn } : null);
    }
  }, [isOpen]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTags('');
    setLinkUrl('');
    setMaterialType('link');
    setKind('');
    setLevel('');
    setBook(null);
    setMode('file');
    setShowMore(false);
    setRightsConfirmed(false);
    setUploaderKey(k => k + 1);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const addTag = (tag: string) => {
    const parts = tags.split(',').map(t => t.trim()).filter(Boolean);
    if (!parts.some(p => p.toLowerCase() === tag.toLowerCase())) parts.push(tag);
    setTags(parts.join(', '));
  };

  const handleSubmit = async () => {
    setError('');
    if (!auth.currentUser) {
      setError(t("You must be signed in to add materials."));
      return;
    }
    if (!/^https?:\/\//i.test(linkUrl.trim())) {
      setError(mode === 'file' ? t("Upload a file first, or paste a link.") : t("Paste a link that starts with https://"));
      return;
    }
    if (!title.trim()) {
      setError(t("Give it a title."));
      return;
    }
    const { school, classYear, classSection, subject } = classification;
    if (!subject) {
      setError(t("Choose a subject."));
      return;
    }
    if (!rightsConfirmed) {
      setError(t("Confirm that you can share it."));
      return;
    }
    const hasClass = !!school && !!classYear && !!classSection && SECTION_PATTERN.test(classSection);
    // The subject has its own field, so a tag that repeats it is dropped.
    const tagList = tags.split(',').map(t => t.trim()).filter(t => t && t.toLowerCase() !== subject.toLowerCase());

    setIsUploading(true);
    try {
      await addDoc(collection(db, 'materials'), {
        title: title.trim(),
        description: description.trim() || null,
        tags: tagList,
        type: materialType,
        url: linkUrl.trim(),
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Unknown User',
        authorPhotoUrl: auth.currentUser.photoURL || null,
        downloadCount: 0,
        saveCount: 0,
        folderId: currentFolderId || null,
        collectionId: collectionId || null,
        kind: kind || null,
        level: level || null,
        improvesId: improves?.id || null,
        isbn: book?.isbn || null,
        bookTitle: book?.title || null,
        createdAt: serverTimestamp(),
        isDeleted: false,
        rightsConfirmed: true,
        schoolId: school?.id || null,
        schoolName: school?.name || null,
        schoolCity: school?.city || null,
        classYear: hasClass ? classYear : null,
        classSection: hasClass ? classSection : null,
        className: hasClass ? formatClassName(classYear, classSection) : null,
        classId: hasClass ? classIdFor(school?.id, classYear, classSection) : null,
        subject,
        coAuthorIds: coAuthors.map(c => c.uid),
        coAuthorNames: coAuthors.map(c => c.name.slice(0, 100)),
        keywords: keywordsFor({
          title: title.trim(),
          tags: tagList,
          subject,
          bookTitle: book?.title || null,
          className: hasClass ? formatClassName(classYear, classSection) : null,
          description: description.trim() || null,
        }),
      });
      try { window.localStorage.setItem(LAST_SUBJECT_KEY, subject); } catch { /* ignore */ }
      handleClose();
    } catch (err: any) {
      console.error('Upload error:', err);
      const code: string = err?.code || 'unknown';
      setError(code === 'permission-denied'
        ? t("The database rejected this entry (permission-denied). {0}", err?.message || '')
        : t("Could not save this entry ({0}): {1}", code, err?.message || String(err)));
    } finally {
      setIsUploading(false);
    }
  };

  const currentTags = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={improves ? t("Improved version") : t("Add material")}
      subtitle={improves ? t("Of \"{0}\" by {1}", improves.title, improves.authorName) : undefined}
      size="md"
      level={2}
      footer={
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rightsConfirmed}
              onChange={(e) => setRightsConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 shrink-0 accent-[#D4AF37]"
            />
            <span className="text-xs text-white/60 leading-relaxed">{t("I can share it: it is my own work or free material (not pages of a book or someone else's paid material).")}</span>
          </label>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isUploading || !rightsConfirmed}
            className="w-full bg-white text-luxury-black font-bold py-4 rounded-full hover:bg-luxury-gold disabled:opacity-30 transition-all"
          >
            {isUploading ? t("Saving…") : t("Add material")}
          </button>
        </div>
      }
    >
      <div className="space-y-8">
        {/* 1. The file or link */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-white/5 border border-white/10">
            {(['file', 'link'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn('py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all', mode === m ? 'bg-white text-luxury-black' : 'text-white/50')}
              >
                {m === 'file' ? t("Upload a file") : t("Paste a link")}
              </button>
            ))}
          </div>

          {mode === 'file' ? (
            <DriveUploader
              key={uploaderKey}
              onReset={() => setLinkUrl('')}
              onUploaded={(file) => {
                setLinkUrl(file.url);
                setMaterialType(file.materialType);
                if (!title.trim()) setTitle(file.title);
              }}
            />
          ) : (
            <div className="relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input
                type="url"
                inputMode="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-11 pr-4 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-luxury-gold/30"
                placeholder="https://…"
              />
              <p className="text-[10px] text-white/30 mt-2 ml-1">{t("For Google Drive files, set sharing to \"Anyone with the link\".")}</p>
            </div>
          )}
        </div>

        {/* 2. Title */}
        <div className="space-y-2">
          <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">{t("Title")}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-luxury-gold/30"
            placeholder={t("e.g. Chapter 5 summary")}
            maxLength={100}
          />
        </div>

        {/* 3. What it is */}
        <KindLevelFields kind={kind} level={level} onKindChange={setKind} onLevelChange={setLevel} showLevel={false} />

        {/* 4. Subject and class */}
        <ClassificationFields
          value={classification}
          onChange={setClassification}
          quickClasses={isTeacher ? profile?.teacherClasses || [] : []}
          preferredSubjects={isTeacher ? profile?.teacherSubjects || [] : []}
        />


        <TextbookPicker
          schoolId={classification.school?.id}
          classYear={classification.classYear}
          classSection={classification.classSection}
          subject={classification.subject}
          isbn={book?.isbn || ''}
          onChange={setBook}
        />

        {/* 5. Collection */}
        <CollectionPicker
          value={collectionId}
          onChange={setCollectionId}
          school={classification.school}
          classYear={classification.classYear}
          classSection={classification.classSection}
          subject={classification.subject}
        />

        <CoAuthorPicker
          schoolId={classification.school?.id}
          classYear={classification.classYear}
          classSection={classification.classSection}
          value={coAuthors}
          onChange={setCoAuthors}
        />

        {/* 6. Optional details */}
        <div className="border-t border-white/5 pt-4">
          <button
            type="button"
            onClick={() => setShowMore(v => !v)}
            className="w-full flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white py-2"
          >
            {t("More options (level, description, topic)")}<ChevronDown className={cn('w-4 h-4 transition-transform', showMore && 'rotate-180')} />
          </button>
          {showMore && (
            <div className="space-y-6 pt-4">
              <KindLevelFields kind={kind} level={level} onKindChange={setKind} onLevelChange={setLevel} showKind={false} />
              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">{t("Description")}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-luxury-gold/30 resize-none h-24"
                  placeholder={t("What is in it, and who is it for?")}
                  maxLength={1000}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">{t("Topic or chapter (comma separated)")}</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-luxury-gold/30"
                  placeholder={t("e.g. Ch. 5, French Revolution")}
                  maxLength={200}
                />
                {tagSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tagSuggestions
                      .filter(t => !currentTags.includes(t.toLowerCase()) && t.toLowerCase() !== classification.subject.toLowerCase())
                      .slice(0, 8)
                      .map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => addTag(t)}
                          className="px-2.5 py-1 rounded-full border border-white/10 text-[10px] text-white/50 hover:text-white flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> {t}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">{t("Type")}</label>
                <Dropdown options={TYPE_OPTIONS} value={materialType} onChange={(val) => setMaterialType(val as MaterialType)} className="w-full" label={t("Type")} />
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
