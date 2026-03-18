import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Link as LinkIcon, FileText, File, ChevronDown, HardDrive } from 'lucide-react';
import { collection, addDoc, serverTimestamp, getDocs, query, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { MaterialType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import Dropdown from './Dropdown';
import GoogleDrivePicker from './GoogleDrivePicker';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [uploadType, setUploadType] = useState<'file' | 'link' | 'drive'>('file');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [materialType, setMaterialType] = useState<MaterialType>('pdf');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  
  // Tag auto-proposal state
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const classificationOptions = [
    { value: 'pdf', label: 'Manuscript (PDF)' },
    { value: 'word', label: 'Document (Word)' },
    { value: 'canva', label: 'Presentation' },
    { value: 'link', label: 'External Link' },
    { value: 'drive', label: 'Google Drive Asset' },
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
    const newTags = [...parts.map(p => p.trim()), suggestion].filter(p => p !== '').join(', ') + ', ';
    setTags(newTags);
    setShowTagSuggestions(false);
    tagInputRef.current?.focus();
  };

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Check file size (Firestore limit is 1MB, Base64 adds ~33% overhead)
      // We'll limit to 700KB to be safe
      if (file.size > 700 * 1024) {
        setError('File is too large for free tier storage (>700KB). Please use the Google Drive integration for seamless linking.');
        return;
      }

      setSelectedFile(file);
      setError('');
      
      // Auto-detect type
      if (file.type === 'application/pdf') setMaterialType('pdf');
      else if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) setMaterialType('word');
      else if (file.type.includes('presentation') || file.name.endsWith('.ppt') || file.name.endsWith('.pptx')) setMaterialType('canva');
      else setMaterialType('other');
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

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

    setIsUploading(true);

    try {
      let finalUrl = '';

      if (uploadType === 'link' || uploadType === 'drive') {
        if (!linkUrl.trim() || !linkUrl.startsWith('http')) {
          const driveError = 'Please select a file from your Google Drive archive first. Click "Authorize Access" if you haven\'t yet.';
          const linkError = 'Please enter a valid URL starting with http:// or https://';
          throw new Error(uploadType === 'link' ? linkError : driveError);
        }
        finalUrl = linkUrl;
      } else if (uploadType === 'file') {
        if (!selectedFile) {
          throw new Error('Please select a local manuscript (PDF, DOCX, PPTX) to upload.');
        }

        setProgress(50);
        finalUrl = await fileToBase64(selectedFile);
        setProgress(100);
      } else {
        throw new Error('Invalid upload type selected.');
      }

      await addDoc(collection(db, 'materials'), {
        title: title.trim(),
        description: description.trim() || null,
        tags: tags.split(',').map(t => t.trim()).filter(t => t !== ''),
        type: materialType,
        url: finalUrl,
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Unknown User',
        authorPhotoUrl: auth.currentUser.photoURL || null,
        downloadCount: 0,
        createdAt: serverTimestamp(),
      });

      onClose();
      // Reset form
      setTitle('');
      setDescription('');
      setTags('');
      setLinkUrl('');
      setSelectedFile(null);
      setMaterialType('pdf');
      setProgress(0);
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
              <div className="flex gap-4 mb-10 p-1.5 bg-white/5 rounded-full border border-white/5">
                <button
                  onClick={() => setUploadType('file')}
                  className={`flex-1 py-2.5 text-[10px] uppercase tracking-[0.2em] font-medium rounded-full transition-all ${
                    uploadType === 'file' ? 'bg-white text-luxury-black shadow-lg' : 'text-white/40 hover:text-white'
                  }`}
                >
                  Manuscript
                </button>
                <button
                  onClick={() => {
                    setUploadType('link');
                    setMaterialType('canva');
                  }}
                  className={`flex-1 py-2.5 text-[10px] uppercase tracking-[0.2em] font-medium rounded-full transition-all ${
                    uploadType === 'link' ? 'bg-white text-luxury-black shadow-lg' : 'text-white/40 hover:text-white'
                  }`}
                >
                  External Link
                </button>
                <button
                  onClick={() => {
                    setUploadType('drive');
                    setMaterialType('drive');
                  }}
                  className={`flex-1 py-2.5 text-[10px] uppercase tracking-[0.2em] font-medium rounded-full transition-all ${
                    uploadType === 'drive' ? 'bg-white text-luxury-black shadow-lg' : 'text-white/40 hover:text-white'
                  }`}
                >
                  Google Drive
                </button>
              </div>

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

                {uploadType === 'link' ? (
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
                        required={uploadType === 'link'}
                      />
                    </div>
                  </div>
                ) : uploadType === 'drive' ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-luxury-gold/5 border border-luxury-gold/10 rounded-2xl">
                      <p className="text-[10px] uppercase tracking-widest text-luxury-gold font-medium mb-1">Archive Integration</p>
                      <p className="text-[10px] text-white/30 font-light leading-relaxed">
                        Authorize access to link files directly from your Drive. This is required for assets exceeding 700KB.
                      </p>
                    </div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Drive Archive</label>
                    <GoogleDrivePicker 
                      onSelect={(file) => {
                        if (!file.webViewLink) {
                          setError('Selected file does not have a public web link. Please check your Drive permissions.');
                          return;
                        }
                        setTitle(file.name);
                        setLinkUrl(file.webViewLink);
                        
                        // Auto-detect type from Drive file
                        if (file.mimeType === 'application/pdf') {
                          setMaterialType('pdf');
                        } else if (file.mimeType.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
                          setMaterialType('word');
                        } else if (file.mimeType.includes('presentation') || file.name.endsWith('.ppt') || file.name.endsWith('.pptx')) {
                          setMaterialType('canva');
                        } else {
                          setMaterialType('drive');
                        }
                        
                        // Show success feedback
                        setError('');
                      }}
                    />
                    {linkUrl && uploadType === 'drive' && (
                      <div className="mt-4 p-3 bg-white/5 border border-luxury-gold/20 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-luxury-gold" />
                          <span className="text-xs text-white/60 truncate max-w-[200px]">{title}</span>
                        </div>
                        <span className="text-[8px] uppercase tracking-widest text-luxury-gold">Linked</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Source File</label>
                    <div className="mt-1 flex justify-center px-8 pt-10 pb-10 border border-white/10 border-dashed rounded-[2rem] hover:border-luxury-gold/50 transition-colors bg-white/5 group cursor-pointer relative overflow-hidden">
                      <div className="space-y-4 text-center z-10">
                        <Upload className="mx-auto h-8 w-8 text-white/20 group-hover:text-luxury-gold transition-colors" />
                        <div className="flex text-[10px] uppercase tracking-[0.2em] text-white/40 justify-center">
                          <label className="relative cursor-pointer font-medium text-white hover:text-luxury-gold transition-colors">
                            <span>Select Manuscript</span>
                            <input type="file" className="sr-only" onChange={handleFileChange} required={uploadType === 'file'} />
                          </label>
                        </div>
                        <p className="text-[10px] uppercase tracking-widest text-white/20 font-light">
                          {selectedFile ? selectedFile.name : 'PDF, DOCX, PPTX up to 700KB'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {isUploading && uploadType === 'file' && (
                  <div className="w-full bg-white/5 rounded-full h-1 mt-8 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="bg-luxury-gold h-full rounded-full transition-all duration-300"
                    />
                  </div>
                )}

                <div className="pt-10">
                  <button
                    type="submit"
                    disabled={isUploading || (uploadType === 'drive' && !linkUrl)}
                    className="w-full luxury-button bg-white text-luxury-black font-semibold py-4 rounded-full shadow-2xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-20 transition-all"
                  >
                    {isUploading ? 'Archiving...' : (uploadType === 'drive' && !linkUrl) ? 'Select a Drive File' : 'Add to Collection'}
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
