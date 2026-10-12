import React, { useState, useEffect, useRef } from 'react';
import { X, Link as LinkIcon } from 'lucide-react';
import { collection, addDoc, serverTimestamp, getDocs, query, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { MaterialType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import Dropdown from './Dropdown';
import ClassificationFields, { ClassificationValue, fromDateInputValue } from './ClassificationFields';
import { useAppData } from '../context/AppData';
import { classIdFor, formatClassName, SECTION_PATTERN } from '../lib/schoolYear';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFolderId?: string | null;
}

const typeOptions = [
  { value: 'link', label: 'Link' },
  { value: 'pdf', label: 'PDF' },
  { value: 'word', label: 'Word document' },
  { value: 'canva', label: 'Presentation' },
  { value: 'other', label: 'Other' },
];

export default function UploadModal({ isOpen, onClose, currentFolderId }: UploadModalProps) {
  const { profile } = useAppData();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [materialType, setMaterialType] = useState<MaterialType>('link');
  const [classification, setClassification] = useState<ClassificationValue>({ school: null, subject: '', examDate: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  // Tag suggestions
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchExistingTags();
    // Default to the uploader's own school and class.
    setClassification({
      school: profile?.schoolId
        ? { id: profile.schoolId, name: profile.schoolName || profile.schoolId, city: profile.schoolCity || '', grade: profile.schoolGrade }
        : null,
      classYear: profile?.classYear,
      classSection: profile?.classSection,
      subject: '',
      examDate: '',
    });
  }, [isOpen]);

  const fetchExistingTags = async () => {
    try {
      const querySnapshot = await getDocs(query(collection(db, 'materials'), limit(100)));
      const allTags = new Set<string>();
      querySnapshot.forEach((d) => {
        const data = d.data();
        if (Array.isArray(data.tags)) data.tags.forEach((tag: string) => allTags.add(tag));
      });
      setExistingTags(Array.from(allTags));
    } catch (err) {
      console.error('Error fetching tags:', err);
    }
  };

  const handleTagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTags(value);
    const lastTag = value.split(',').pop()?.trim().toLowerCase() || '';
    if (lastTag.length > 0) {
      const suggestions = existingTags.filter(tag =>
        tag.toLowerCase().includes(lastTag) &&
        !value.toLowerCase().includes(tag.toLowerCase())
      ).slice(0, 5);
      setTagSuggestions(suggestions);
      setShowTagSuggestions(suggestions.length > 0);
    } else {
      setShowTagSuggestions(false);
    }
  };

  const selectTagSuggestion = (suggestion: string) => {
    const parts = tags.split(',');
    parts.pop();
    setTags([...parts.map(p => p.trim()), suggestion].filter(p => p !== '').join(', ') + ', ');
    setShowTagSuggestions(false);
    tagInputRef.current?.focus();
  };

  if (!isOpen) return null;

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTags('');
    setLinkUrl('');
    setMaterialType('link');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!auth.currentUser) {
      setError('You must be signed in to add materials.');
      return;
    }
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!/^https?:\/\//i.test(linkUrl.trim())) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    const { school, classYear, classSection, subject, examDate } = classification;
    const hasClass = !!school && !!classYear && !!classSection && SECTION_PATTERN.test(classSection);

    setIsUploading(true);
    try {
      await addDoc(collection(db, 'materials'), {
        title: title.trim(),
        description: description.trim() || null,
        tags: tags.split(',').map(t => t.trim()).filter(t => t !== ''),
        type: materialType,
        url: linkUrl.trim(),
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Unknown User',
        authorPhotoUrl: auth.currentUser.photoURL || null,
        downloadCount: 0,
        saveCount: 0,
        folderId: currentFolderId || null,
        createdAt: serverTimestamp(),
        isDeleted: false,
        schoolId: school?.id || null,
        schoolName: school?.name || null,
        schoolCity: school?.city || null,
        classYear: hasClass ? classYear : null,
        classSection: hasClass ? classSection : null,
        className: hasClass ? formatClassName(classYear, classSection) : null,
        classId: hasClass ? classIdFor(school?.id, classYear, classSection) : null,
        subject: subject || null,
        examDate: fromDateInputValue(examDate),
      });
      resetForm();
      onClose();
    } catch (err: any) {
      console.error('Upload error:', err);
      const code: string = err?.code || 'unknown';
      setError(code === 'permission-denied'
        ? `The database rejected this entry (permission-denied). ${err?.message || ''}`
        : `Could not save this entry (${code}): ${err?.message || String(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-luxury-black/90 backdrop-blur-xl p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="glass-panel rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] border-white/20 relative"
          >
            <div className="flex items-center justify-between p-6 sm:p-8 border-b border-white/10 relative z-10">
              <h2 className="text-3xl font-serif text-white tracking-tight">Add material</h2>
              <button onClick={onClose} className="text-white/20 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar relative z-10">
              {error && (
                <div className="mb-6 p-4 bg-red-400/10 text-red-400 text-xs rounded-2xl border border-red-400/20 font-light tracking-wide">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-0 py-3 bg-transparent border-b border-white/10 focus:border-luxury-gold outline-none transition-all font-light tracking-wide text-sm placeholder:text-white/10"
                    placeholder="e.g. Chapter 5 summary"
                    required
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Link (URL)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                      <LinkIcon className="h-4 w-4 text-white/20" />
                    </div>
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      className="w-full pl-8 pr-0 py-3 bg-transparent border-b border-white/10 focus:border-luxury-gold outline-none transition-all font-light tracking-wide text-sm placeholder:text-white/10"
                      placeholder="https://..."
                      required
                    />
                  </div>
                  <p className="text-[9px] text-white/25 ml-1">For Google Drive files, set sharing to "Anyone with the link".</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Type</label>
                  <Dropdown
                    options={typeOptions}
                    value={materialType}
                    onChange={(val) => setMaterialType(val as MaterialType)}
                    className="w-full"
                  />
                </div>

                <ClassificationFields value={classification} onChange={setClassification} />

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-0 py-3 bg-transparent border-b border-white/10 focus:border-luxury-gold outline-none transition-all font-light tracking-wide text-sm placeholder:text-white/10 resize-none h-24"
                    placeholder="What is in it, and who is it for?"
                    maxLength={1000}
                  />
                </div>

                <div className="space-y-2 relative">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Tags</label>
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={tags}
                    onChange={handleTagChange}
                    onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                    className="w-full px-0 py-3 bg-transparent border-b border-white/10 focus:border-luxury-gold outline-none transition-all font-light tracking-wide text-sm placeholder:text-white/10"
                    placeholder="e.g. Exam, Notes, Exercises (comma separated)"
                    maxLength={100}
                  />
                  <AnimatePresence>
                    {showTagSuggestions && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 left-0 right-0 mt-1 bg-luxury-black border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl"
                      >
                        {tagSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => selectTagSuggestion(suggestion)}
                            className="w-full text-left px-4 py-2 text-xs text-white/60 hover:text-luxury-gold hover:bg-white/5 transition-colors uppercase tracking-widest"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="w-full luxury-button bg-white text-luxury-black font-semibold py-4 rounded-full shadow-2xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-20 transition-all"
                  >
                    {isUploading ? 'Saving…' : 'Add material'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
