import React, { useState, useEffect } from 'react';
import { X, Link as LinkIcon, ChevronDown } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Material, MaterialType, OperationType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import Dropdown from './Dropdown';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: Material | null;
}

const handleFirestoreError = (error: any, operationType: OperationType, path: string | null) => {
  const errInfo = {
    error: error.message,
    operationType,
    path,
  };
  console.error("Firestore Error:", JSON.stringify(errInfo, null, 2));
  return error.message || "An unexpected database error occurred.";
};

export default function EditModal({ isOpen, onClose, material }: EditModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [materialType, setMaterialType] = useState<MaterialType>('link');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (material) {
      setTitle(material.title);
      setDescription(material.description);
      setTags(material.tags.join(', '));
      setLinkUrl(material.url);
      setMaterialType(material.type);
    }
  }, [material, isOpen]);

  const classificationOptions = [
    { value: 'link', label: 'External Link' },
    { value: 'pdf', label: 'Manuscript (PDF Link)' },
    { value: 'word', label: 'Document (Word Link)' },
    { value: 'canva', label: 'Presentation' },
    { value: 'other', label: 'Miscellaneous' },
  ];

  if (!isOpen || !material) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setError('');

    if (!linkUrl.trim() || !linkUrl.startsWith('http')) {
      setError('Please enter a valid URL starting with http:// or https://');
      setIsUpdating(false);
      return;
    }

    try {
      const materialRef = doc(db, 'materials', material.id);
      await updateDoc(materialRef, {
        title: title.trim(),
        description: description.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(t => t !== ''),
        type: materialType,
        url: linkUrl.trim(),
        updatedAt: new Date().toISOString(), // Optional: if you want to track edits separately
      });

      onClose();
    } catch (err: any) {
      setError(handleFirestoreError(err, OperationType.UPDATE, `materials/${material.id}`));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-luxury-black/90 backdrop-blur-xl"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="glass-panel w-full max-w-xl relative overflow-hidden rounded-[2.5rem] shadow-2xl z-10 max-h-[90vh] flex flex-col"
          >
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div>
                <h3 className="text-2xl font-serif text-white mb-1">Edit Manuscript</h3>
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-light">Refinement of Archive Entry</p>
              </div>
              <button onClick={onClose} className="text-white/20 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar">
              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                  <p className="text-xs text-red-400 font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-transparent border-b border-white/10 py-3 px-0 focus:border-luxury-gold outline-none transition-all font-light tracking-wide text-sm placeholder:text-white/10"
                      placeholder="Entry Name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Classification</label>
                    <Dropdown
                      options={classificationOptions}
                      value={materialType}
                      onChange={(val) => setMaterialType(val as MaterialType)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-5 focus:border-luxury-gold/50 outline-none transition-all font-light tracking-wide text-sm min-h-[100px] placeholder:text-white/10"
                    placeholder="Briefly describe the context..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Taxonomy (Comma Separated)</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full bg-transparent border-b border-white/10 py-3 px-0 focus:border-luxury-gold outline-none transition-all font-light tracking-wide text-sm placeholder:text-white/10"
                    placeholder="e.g. Manuscript, Lecture, Summary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Digital Path (URL)</label>
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

                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="w-full luxury-button bg-white text-luxury-black font-semibold py-4 rounded-full shadow-2xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-20 transition-all"
                  >
                    {isUpdating ? 'Updating Archive...' : 'Save Changes'}
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
