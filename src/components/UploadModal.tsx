import React, { useState, useEffect, useRef } from 'react';
import { X, Link as LinkIcon, ChevronDown } from 'lucide-react';
import { collection, addDoc, serverTimestamp, getDocs, query, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { MaterialType, OperationType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import Dropdown from './Dropdown';

const handleFirestoreError = (error: any, operationType: OperationType, path: string | null) => {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [materialType, setMaterialType] = useState<MaterialType>('link');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  
  // Tag auto-proposal state
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const classificationOptions = [
    { value: 'link', label: 'External Link' },
    { value: 'pdf', label: 'Manuscript (PDF Link)' },
    { value: 'word', label: 'Document (Word Link)' },
    { value: 'canva', label: 'Presentation' },
    { value: 'other', label: 'Miscellaneous' },
  ];

  useEffect(() => {
    if (isOpen) {
      fetchExistingTags();
    }
  }, [isOpen]);

  const fetchExistingTags = async () => {
    try {
      const q = query(collection(db, 'materials'), limit(100));
      const querySnapshot = await getDocs(q);
      const allTags = new Set<string>();
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.tags && Array.isArray(data.tags)) {
          data.tags.forEach((tag: string) => allTags.add(tag));
        }
      });
      setExistingTags(Array.from(allTags));
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.LIST, 'materials');
      } catch (e) {
        console.error('Error fetching tags:', err);
      }
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
    const newTags = [...parts.map(p => p.trim()), suggestion].filter(p => p !== '').join(', ') + ', ';
    setTags(newTags);
    setShowTagSuggestions(false);
    tagInputRef.current?.focus();
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!auth.currentUser) {
      setError('You must be logged in to upload materials.');
      return;
    }

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    if (!linkUrl.trim() || !linkUrl.startsWith('http')) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    setIsUploading(true);

    try {
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
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'materials');
      }

      onClose();
      // Reset form
      setTitle('');
      setDescription('');
      setTags('');
      setLinkUrl('');
      setMaterialType('link');
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'An error occurred during upload.');
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
            className="glass-panel rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border-white/20 relative"
          >
            {/* Decorative background element */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-luxury-gold/10 rounded-full blur-[80px] pointer-events-none"></div>
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-white/5 rounded-full blur-[80px] pointer-events-none"></div>

            <div className="flex items-center justify-between p-8 border-b border-white/10 relative z-10">
              <h2 className="text-3xl font-serif text-white tracking-tight">New Entry</h2>
              <button onClick={onClose} className="text-white/20 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar relative z-10">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-6 p-4 bg-red-400/10 text-red-400 text-xs rounded-2xl border border-red-400/20 font-light tracking-wide"
                >
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-0 py-3 bg-transparent border-b border-white/10 focus:border-luxury-gold outline-none transition-all font-light tracking-wide text-sm placeholder:text-white/10"
                    placeholder="The title of your work..."
                    required
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Annotation</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-0 py-3 bg-transparent border-b border-white/10 focus:border-luxury-gold outline-none transition-all font-light tracking-wide text-sm placeholder:text-white/10 resize-none h-24 italic"
                    placeholder="A brief summary of the contents..."
                    maxLength={1000}
                  />
                </div>

                <div className="space-y-2 relative">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Keywords / Tags</label>
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={tags}
                    onChange={handleTagChange}
                    onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                    onFocus={() => {
                      const lastTag = tags.split(',').pop()?.trim().toLowerCase() || '';
                      if (lastTag.length > 0) setShowTagSuggestions(tagSuggestions.length > 0);
                    }}
                    className="w-full px-0 py-3 bg-transparent border-b border-white/10 focus:border-luxury-gold outline-none transition-all font-light tracking-wide text-sm placeholder:text-white/10"
                    placeholder="e.g. Biology, Exam, Notes (comma separated)"
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

                <div className="grid grid-cols-1 gap-8">
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Classification</label>
                    <Dropdown
                      options={classificationOptions}
                      value={materialType}
                      onChange={(val) => setMaterialType(val as MaterialType)}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Digital Path</label>
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
                </div>

                <div className="pt-10">
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="w-full luxury-button bg-white text-luxury-black font-semibold py-4 rounded-full shadow-2xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-20 transition-all"
                  >
                    {isUploading ? 'Archiving...' : 'Add to Collection'}
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
