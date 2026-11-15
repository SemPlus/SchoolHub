import React, { useState, useEffect } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Material, MaterialType } from '../types';
import Dropdown from './Dropdown';
import Modal from './Modal';
import CollectionPicker from './CollectionPicker';
import ClassificationFields, { ClassificationValue } from './ClassificationFields';
import KindLevelFields from './KindLevelFields';
import TextbookPicker from './TextbookPicker';
import { TYPE_OPTIONS } from './UploadModal';
import { useAppData } from '../context/AppData';
import { classIdFor, formatClassName, isTeacherAccount, SECTION_PATTERN } from '../lib/schoolYear';
import { firebaseErrorMessage } from '../lib/engagement';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: Material | null;
}

export default function EditModal({ isOpen, onClose, material }: EditModalProps) {
  const { profile, userRole } = useAppData();
  const isTeacher = isTeacherAccount(profile);
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
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!material) return;
    setTitle(material.title || '');
    setDescription(material.description || '');
    setTags(material.tags?.join(', ') || '');
    setLinkUrl(material.url || '');
    setMaterialType(material.type || 'link');
    setKind(material.kind || '');
    setLevel(material.level || '');
    setBook(material.isbn ? { isbn: material.isbn, title: material.bookTitle || material.isbn } : null);
    setClassification({
      school: material.schoolId
        ? { id: material.schoolId, name: material.schoolName || material.schoolId, city: material.schoolCity || '' }
        : null,
      classYear: material.classYear,
      classSection: material.classSection,
      subject: material.subject || '',
    });
    setCollectionId(material.collectionId || null);
    setError('');
  }, [material, isOpen]);

  if (!material) return null;

  const isEditingOthers = auth.currentUser?.uid !== material.authorId;

  const handleSubmit = async () => {
    setError('');
    if (!/^https?:\/\//i.test(linkUrl.trim())) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }
    if (!title.trim()) {
      setError('Give it a title.');
      return;
    }

    const { school, classYear, classSection, subject } = classification;
    const hasClass = !!school && !!classYear && !!classSection && SECTION_PATTERN.test(classSection);
    const urlChanged = linkUrl.trim() !== material.url;
    const tagList = tags.split(',').map(t => t.trim()).filter(t => t && t.toLowerCase() !== subject.toLowerCase());

    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'materials', material.id), {
        title: title.trim(),
        description: description.trim(),
        tags: tagList,
        type: materialType,
        url: linkUrl.trim(),
        updatedAt: serverTimestamp(),
        schoolId: school?.id || null,
        schoolName: school?.name || null,
        schoolCity: school?.city || null,
        classYear: hasClass ? classYear : null,
        classSection: hasClass ? classSection : null,
        className: hasClass ? formatClassName(classYear, classSection) : null,
        classId: hasClass ? classIdFor(school?.id, classYear, classSection) : null,
        subject: subject || null,
        collectionId: collectionId || null,
        kind: kind || null,
        level: level || null,
        isbn: book?.isbn || null,
        bookTitle: book?.title || null,
        // A new link has not been checked, and a teacher's verification no
        // longer applies to it.
        ...(urlChanged ? { linkStatus: null, verifiedBy: null, verifiedByName: null, verifiedAt: null } : {}),
      });
      onClose();
    } catch (err: any) {
      console.error('Edit error:', err);
      setError(firebaseErrorMessage(err, 'Could not save your changes.'));
    } finally {
      setIsUpdating(false);
    }
  };

  const inputClass = 'w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-luxury-gold/30';
  const labelClass = 'block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit material"
      subtitle={isEditingOthers && userRole === 'admin' ? `Editing as founder · uploaded by ${material.authorName}` : undefined}
      size="md"
      level={3}
      footer={
        <div className="space-y-3">
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isUpdating}
            className="w-full bg-white text-luxury-black font-bold py-4 rounded-full hover:bg-luxury-gold disabled:opacity-30 transition-all"
          >
            {isUpdating ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      }
    >
      <div className="space-y-7">
        <div className="space-y-2">
          <label className={labelClass}>Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} maxLength={200} />
        </div>

        <div className="space-y-2">
          <label className={labelClass}>Link (URL)</label>
          <div className="relative">
            <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className={`${inputClass} pl-11`} placeholder="https://…" />
          </div>
        </div>

        <KindLevelFields kind={kind} level={level} onKindChange={setKind} onLevelChange={setLevel} />

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

        <CollectionPicker
          value={collectionId}
          onChange={setCollectionId}
          school={classification.school}
          classYear={classification.classYear}
          classSection={classification.classSection}
          subject={classification.subject}
        />

        <div className="space-y-2">
          <label className={labelClass}>Type</label>
          <Dropdown options={TYPE_OPTIONS} value={materialType} onChange={(val) => setMaterialType(val as MaterialType)} className="w-full" label="Type" />
        </div>

        <div className="space-y-2">
          <label className={labelClass}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} min-h-[100px]`} maxLength={2000} />
        </div>

        <div className="space-y-2">
          <label className={labelClass}>Topic or chapter (comma separated)</label>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} />
        </div>
      </div>
    </Modal>
  );
}
