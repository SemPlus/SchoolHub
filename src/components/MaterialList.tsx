import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, where, doc, deleteDoc, or, and, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Material, Folder, OperationType } from '../types';
import MaterialCard from './MaterialCard';
import AuthorProfileModal from './AuthorProfileModal';
import MaterialDetailModal from './MaterialDetailModal';
import EditModal from './EditModal';
import FolderCard from './FolderCard';
import CreateFolderModal from './CreateFolderModal';
import MoveModal from './MoveModal';
import UploadModal from './UploadModal';
import Dropdown from './Dropdown';
import ContextMenu from './ContextMenu';
import { Search, Filter, Lock, FolderPlus, ChevronRight, Home, ArrowLeft, BookOpen, Plus, Trash2, Move, Edit, Share2, Info, RotateCcw } from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

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

interface MaterialListProps {
  userRole: string | null;
  view?: 'archive' | 'personal' | 'trash';
  onViewChange?: (view: 'archive' | 'personal' | 'trash') => void;
}

export default function MaterialList({ userRole, view = 'archive', onViewChange }: MaterialListProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [authorCounts, setAuthorCounts] = useState<Record<string, number>>({});
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedProfile, setSelectedProfile] = useState<{id: string, name: string, photoUrl?: string} | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState<Material | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [itemsToMove, setItemsToMove] = useState<{ materials: string[], folders: string[] }>({ materials: [], folders: [] });
  const [isAuthenticated, setIsAuthenticated] = useState(!!auth.currentUser);
  const [userSaves, setUserSaves] = useState<Set<string>>(new Set());
  const [currentView, setCurrentView] = useState<'archive' | 'personal' | 'trash'>(view);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Multi-selection state
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<{index: number, type: 'material' | 'folder'} | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, target: any, type: 'material' | 'folder' | 'background' } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, type: 'material' | 'folder' | 'background', target?: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    // If right clicking an item that isn't selected, select only that item
    if (type !== 'background' && target) {
      const isSelected = type === 'material' ? selectedMaterialIds.has(target.id) : selectedFolderIds.has(target.id);
      if (!isSelected) {
        setSelectedMaterialIds(new Set(type === 'material' ? [target.id] : []));
        setSelectedFolderIds(new Set(type === 'folder' ? [target.id] : []));
      }
    }

    setContextMenu({ x: e.clientX, y: e.clientY, type, target });
  };

  const getContextMenuItems = () => {
    if (!contextMenu) return [];
    
    const { type, target } = contextMenu;
    const isTrash = currentView === 'trash';
    const multiple = (selectedMaterialIds.size + selectedFolderIds.size) > 1;

    if (type === 'background') {
      return [
        { label: 'New Material', icon: <Plus className="w-4 h-4" />, onClick: () => setIsUploadModalOpen(true) },
        { label: 'New Directory', icon: <FolderPlus className="w-4 h-4" />, onClick: () => setIsCreateFolderOpen(true) },
      ];
    }

    if (isTrash) {
      return [
        { label: multiple ? 'Restore Selected' : 'Restore Record', icon: <RotateCcw className="w-4 h-4" />, onClick: handleBulkRestore },
        { label: multiple ? 'Purge Selected' : 'Purge Record', icon: <Trash2 className="w-4 h-4" />, onClick: handleBulkDelete, variant: 'danger' as const },
      ];
    }

    const items = [
      { label: multiple ? 'Relocate Selected' : 'Relocate', icon: <Move className="w-4 h-4" />, onClick: handleBulkMove },
      { label: multiple ? 'Move to Trash' : 'Trash', icon: <Trash2 className="w-4 h-4" />, onClick: handleBulkTrash, variant: 'danger' as const },
    ];

    if (!multiple) {
      if (type === 'material') {
        const canEdit = isAuthenticated && (userRole === 'admin' || auth.currentUser?.uid === target.authorId);
        if (canEdit) items.unshift({ label: 'Edit Metadata', icon: <Edit className="w-4 h-4" />, onClick: () => handleEditClick(target) });
        items.push({ label: 'View Insights', icon: <Info className="w-4 h-4" />, onClick: () => handleCardClick(target) });
      } else {
        const canEdit = isAuthenticated && (userRole === 'admin' || auth.currentUser?.uid === target.authorId);
        if (canEdit) items.unshift({ label: 'Rename Directory', icon: <Edit className="w-4 h-4" />, onClick: () => handleMoveFolder(target) });
      }
    }

    return items;
  };

  const handleViewChange = (newView: 'archive' | 'personal' | 'trash') => {
    setCurrentView(newView);
    onViewChange?.(newView);
  };

  const filterOptions = [
    { value: 'all', label: 'All Collections' },
    { value: 'pdf', label: 'Manuscripts (PDF)' },
    { value: 'word', label: 'Documents (Word)' },
    { value: 'canva', label: 'Presentations' },
    { value: 'link', label: 'External Links' },
    { value: 'other', label: 'Miscellaneous' },
  ];

  const sortOptions = [
    { value: 'newest', label: 'Lately (Newest)' },
    { value: 'oldest', label: 'Heritage (Oldest)' },
    { value: 'az', label: 'Index (A-Z)' },
    { value: 'za', label: 'Index (Z-A)' },
  ];

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) {
      setUserSaves(new Set());
      return;
    }

    const q = query(
      collection(db, 'saves'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const savedIds = new Set(snapshot.docs.map(doc => doc.data().materialId));
      setUserSaves(savedIds);
    }, (error) => {
      console.error("Saves snapshot error:", error);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  useEffect(() => {
    setCurrentFolderId(null);
    setFolderPath([]);
    setSearchTerm('');
    setFilterType('all');
    setSelectedMaterialIds(new Set());
    setSelectedFolderIds(new Set());
    setLastSelectedIndex(null);
  }, [currentView]);

  useEffect(() => {
    setSelectedMaterialIds(new Set());
    setSelectedFolderIds(new Set());
    setLastSelectedIndex(null);
  }, [searchTerm, filterType]);

  useEffect(() => {
    setIsLoading(true);
    
    // Fetch Folders
    let foldersQuery = null;
    
    if (currentView === 'trash' && auth.currentUser) {
      foldersQuery = query(
        collection(db, 'folders'),
        where('authorId', '==', auth.currentUser.uid)
      );
    } else if (currentView === 'personal' && auth.currentUser) {
      foldersQuery = query(
        collection(db, 'folders'),
        where('authorId', '==', auth.currentUser.uid),
        where('parentId', '==', currentFolderId)
      );
    } else {
      // Archive view or others
      if (userRole === 'admin') {
        foldersQuery = query(
          collection(db, 'folders'),
          where('parentId', '==', currentFolderId)
        );
      } else {
        foldersQuery = query(
          collection(db, 'folders'),
          where('parentId', '==', currentFolderId),
          where('isPublic', '==', true)
        );
      }
    }

    // Fetch Materials
    let materialsQuery = query(collection(db, 'materials'));
    
    if (currentView === 'trash' && auth.currentUser) {
      materialsQuery = query(
        collection(db, 'materials'),
        where('authorId', '==', auth.currentUser.uid)
      );
    }

    const unsubFolders = foldersQuery ? onSnapshot(foldersQuery, (snapshot) => {
      const foldersList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || (data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : new Date()),
          deletedAt: data.deletedAt?.toDate?.() || (data.deletedAt?.seconds ? new Date(data.deletedAt.seconds * 1000) : null),
        } as Folder;
      });
      
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      // Filter by isDeleted for non-trash view
      const filteredFolders = foldersList.filter(f => {
        if (currentView === 'trash') {
          if (f.isDeleted !== true) return false;
          const deletedTime = f.deletedAt ? f.deletedAt.getTime() : now;
          return (now - deletedTime) < THIRTY_DAYS_MS;
        }
        return !f.isDeleted;
      });

      // Sort in memory
      filteredFolders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setFolders(filteredFolders);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'folders');
    }) : () => {
      setFolders([]);
    };

    const unsubMaterials = onSnapshot(materialsQuery, (snapshot) => {
      const materialsList = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || (data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : new Date()),
            deletedAt: data.deletedAt?.toDate?.() || (data.deletedAt?.seconds ? new Date(data.deletedAt.seconds * 1000) : null),
          } as Material;
        })
        .filter(material => {
          const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
          const now = Date.now();

          if (currentView === 'trash') {
            if (material.isDeleted !== true || material.authorId !== auth.currentUser?.uid) return false;
            const deletedTime = material.deletedAt ? material.deletedAt.getTime() : now;
            return (now - deletedTime) < THIRTY_DAYS_MS;
          }

          if (material.isDeleted) return false;

          if (currentView === 'archive') return true; // Show everything flat
          
          if (currentView === 'personal' && auth.currentUser) {
            // Show if it's mine OR if I saved it
            const isMine = material.authorId === auth.currentUser.uid;
            const isSaved = userSaves.has(material.id);
            
            if (isMine || isSaved) {
              if (currentFolderId === null) {
                return !material.folderId || !isMine; // Show saved items at root of personal space if they aren't mine (since they won't match my folder structure)
              }
              return material.folderId === currentFolderId;
            }
            return false;
          }

          if (currentFolderId === null) {
            return !material.folderId;
          }
          return material.folderId === currentFolderId;
        }) as Material[];
      
      // Sort in memory
      materialsList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      setMaterials(materialsList);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'materials');
      setIsLoading(false);
    });

    return () => {
      unsubFolders();
      unsubMaterials();
    };
  }, [currentFolderId, currentView, auth.currentUser?.uid, isAuthenticated]);

  useEffect(() => {
    // Fetch global counts for rank calculation
    const q = query(collection(db, 'materials'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.authorId) {
          counts[data.authorId] = (counts[data.authorId] || 0) + 1;
        }
      });
      setAuthorCounts(counts);
    }, (error) => {
      console.error("Global materials count error:", error);
    });

    return () => unsubscribe();
  }, []);

  const sortedFolders = useMemo(() => {
    const filtered = folders.filter(folder => {
      return folder.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'newest') return b.createdAt.getTime() - a.createdAt.getTime();
      if (sortBy === 'oldest') return a.createdAt.getTime() - b.createdAt.getTime();
      if (sortBy === 'az') return a.name.localeCompare(b.name);
      if (sortBy === 'za') return b.name.localeCompare(a.name);
      return 0;
    });
  }, [folders, searchTerm, sortBy]);

  const sortedMaterials = useMemo(() => {
    const filtered = materials.filter(material => {
      const matchesSearch = material.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (material.description && material.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            (material.tags && material.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));
      const matchesFilter = filterType === 'all' || material.type === filterType;
      return matchesSearch && matchesFilter;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'newest') return b.createdAt.getTime() - a.createdAt.getTime();
      if (sortBy === 'oldest') return a.createdAt.getTime() - b.createdAt.getTime();
      if (sortBy === 'az') return a.title.localeCompare(b.title);
      if (sortBy === 'za') return b.title.localeCompare(a.title);
      return 0;
    });
  }, [materials, searchTerm, filterType, sortBy]);

  // Selection box state
  const [marquee, setMarquee] = useState<{ start: { x: number, y: number }, end: { x: number, y: number } } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentView(view);
    // Clear selection on view change
    setSelectedMaterialIds(new Set());
    setSelectedFolderIds(new Set());
    setLastSelectedIndex(null);
  }, [view]);

  // Combined list for indexing (Folders first, then Materials)
  const allItems = [...sortedFolders.map(f => ({ ...f, itemType: 'folder' })), ...sortedMaterials.map(m => ({ ...m, itemType: 'material' }))];

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start marquee if clicking background
    if (e.target !== e.currentTarget) return;
    if (e.button !== 0) return; // Left click only

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setMarquee({
      start: { x: e.clientX, y: e.clientY },
      end: { x: e.clientX, y: e.clientY }
    });

    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      setSelectedMaterialIds(new Set());
      setSelectedFolderIds(new Set());
      setLastSelectedIndex(null);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!marquee) return;

    setMarquee(prev => prev ? ({ ...prev, end: { x: e.clientX, y: e.clientY } }) : null);

    // Calculate selection
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x1 = Math.min(marquee.start.x, e.clientX);
    const x2 = Math.max(marquee.start.x, e.clientX);
    const y1 = Math.min(marquee.start.y, e.clientY);
    const y2 = Math.max(marquee.start.y, e.clientY);

    const newSelectedMats = new Set(selectedMaterialIds);
    const newSelectedFolders = new Set(selectedFolderIds);

    // This is a simplified check - in a production app we'd use element bounds
    // For now we'll just track if we are dragging
  };

  const handleMouseUp = () => {
    if (marquee) {
      // Actually perform selection based on final marquee bounds
      const mElements = document.querySelectorAll('[data-item-type="material"]');
      const fElements = document.querySelectorAll('[data-item-type="folder"]');

      const x1 = Math.min(marquee.start.x, marquee.end.x);
      const x2 = Math.max(marquee.start.x, marquee.end.x);
      const y1 = Math.min(marquee.start.y, marquee.end.y);
      const y2 = Math.max(marquee.start.y, marquee.end.y);

      const newMats = new Set(selectedMaterialIds);
      const newFolders = new Set(selectedFolderIds);

      mElements.forEach(el => {
        const bounds = el.getBoundingClientRect();
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        if (centerX >= x1 && centerX <= x2 && centerY >= y1 && centerY <= y2) {
          newMats.add(el.getAttribute('data-item-id')!);
        }
      });

      fElements.forEach(el => {
        const bounds = el.getBoundingClientRect();
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        if (centerX >= x1 && centerX <= x2 && centerY >= y1 && centerY <= y2) {
          newFolders.add(el.getAttribute('data-item-id')!);
        }
      });

      setSelectedMaterialIds(newMats);
      setSelectedFolderIds(newFolders);
    }
    setMarquee(null);
  };

  useEffect(() => {
    if (marquee) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [marquee]);

  const handleItemSelect = (id: string, type: 'material' | 'folder', index: number, e: React.MouseEvent | KeyboardEvent) => {
    const isShift = e.shiftKey;
    const isCtrl = e.ctrlKey || e.metaKey;

    if (isShift && lastSelectedIndex) {
      // Prevent browser text selection during range selection
      window.getSelection()?.removeAllRanges();

      const start = Math.min(lastSelectedIndex.index, index);
      const end = Math.max(lastSelectedIndex.index, index);
      
      const newSelectedMats = new Set(selectedMaterialIds);
      const newSelectedFolders = new Set(selectedFolderIds);

      for (let i = start; i <= end; i++) {
        const item = allItems[i];
        if (!item) continue;
        if (item.itemType === 'material') newSelectedMats.add(item.id);
        else newSelectedFolders.add(item.id);
      }

      setSelectedMaterialIds(newSelectedMats);
      setSelectedFolderIds(newSelectedFolders);
    } else if (isCtrl) {
      if (type === 'material') {
        const newSet = new Set(selectedMaterialIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedMaterialIds(newSet);
      } else {
        const newSet = new Set(selectedFolderIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedFolderIds(newSet);
      }
      setLastSelectedIndex({ index, type });
    } else {
      // Single select
      setSelectedMaterialIds(new Set(type === 'material' ? [id] : []));
      setSelectedFolderIds(new Set(type === 'folder' ? [id] : []));
      setLastSelectedIndex({ index, type });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in search or other inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedMaterialIds.size > 0 || selectedFolderIds.size > 0)) {
        if (confirm(`Move ${selectedMaterialIds.size + selectedFolderIds.size} items to Trash?`)) {
          handleBulkTrash();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedMaterialIds(new Set(sortedMaterials.map(m => m.id)));
        setSelectedFolderIds(new Set(sortedFolders.map(f => f.id)));
      }

      if (e.key === 'Escape') {
        setSelectedMaterialIds(new Set());
        setSelectedFolderIds(new Set());
        setLastSelectedIndex(null);
      }

      if (e.key === 'Enter' && lastSelectedIndex) {
        const item = allItems[lastSelectedIndex.index];
        if (item) {
          if (item.itemType === 'folder') {
            handleNavigateToFolder(item as Folder);
          } else {
            handleCardClick(item as Material);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMaterialIds, selectedFolderIds, sortedMaterials, sortedFolders, allItems]);

  const handleBulkTrash = async () => {
    setErrorStatus(null);
    const mIds = Array.from(selectedMaterialIds);
    const fIds = Array.from(selectedFolderIds);

    try {
      const promises = [
        ...mIds.map(id => updateDoc(doc(db, 'materials', id), { isDeleted: true, deletedAt: serverTimestamp() })),
        ...fIds.map(id => updateDoc(doc(db, 'folders', id), { isDeleted: true, deletedAt: serverTimestamp() }))
      ];
      await Promise.all(promises);
      setSelectedMaterialIds(new Set());
      setSelectedFolderIds(new Set());
    } catch (error: any) {
      setErrorStatus(`Bulk move failed: ${error.message}`);
    }
  };

  const handleBulkRestore = async () => {
    const mIds = Array.from(selectedMaterialIds);
    const fIds = Array.from(selectedFolderIds);

    try {
      const promises = [
        ...mIds.map(id => updateDoc(doc(db, 'materials', id), { isDeleted: false, deletedAt: null })),
        ...fIds.map(id => updateDoc(doc(db, 'folders', id), { isDeleted: false, deletedAt: null }))
      ];
      await Promise.all(promises);
      setSelectedMaterialIds(new Set());
      setSelectedFolderIds(new Set());
    } catch (error: any) {
      setErrorStatus(`Bulk restore failed: ${error.message}`);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Permanently delete ${selectedMaterialIds.size + selectedFolderIds.size} items?`)) return;
    
    const mIds = Array.from(selectedMaterialIds);
    const fIds = Array.from(selectedFolderIds);

    try {
      const promises = [
        ...mIds.map(id => deleteDoc(doc(db, 'materials', id))),
        ...fIds.map(id => deleteDoc(doc(db, 'folders', id)))
      ];
      await Promise.all(promises);
      setSelectedMaterialIds(new Set());
      setSelectedFolderIds(new Set());
    } catch (error: any) {
      setErrorStatus(`Bulk delete failed: ${error.message}`);
    }
  };

  const handleAuthorClick = (id: string, name: string, photoUrl?: string) => {
    setSelectedProfile({ id, name, photoUrl });
  };

  const handleCardClick = (material: Material) => {
    setSelectedMaterial(material);
    setIsDetailModalOpen(true);
  };

  const handleEditClick = (material: Material) => {
    setMaterialToEdit(material);
    setIsEditModalOpen(true);
  };

  const handleNavigateToFolder = (folder: Folder) => {
    setFolderPath([...folderPath, folder]);
    setCurrentFolderId(folder.id);
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentFolderId(null);
      setFolderPath([]);
    } else {
      const target = folderPath[index];
      setCurrentFolderId(target.id);
      setFolderPath(folderPath.slice(0, index + 1));
    }
  };

  const handleFolderDelete = async (folder: Folder) => {
    setErrorStatus(null);
    if (currentView === 'trash') {
      try {
        await deleteDoc(doc(db, 'folders', folder.id));
      } catch (error: any) {
        setErrorStatus(`Permanent Delete Failed: ${error.message || String(error)}`);
        handleFirestoreError(error, OperationType.DELETE, `folders/${folder.id}`);
      }
      return;
    }

    try {
      await updateDoc(doc(db, 'folders', folder.id), {
        isDeleted: true,
        deletedAt: serverTimestamp()
      });
    } catch (error: any) {
      setErrorStatus(`Move to Trash Failed: ${error.message || String(error)}`);
      handleFirestoreError(error, OperationType.UPDATE, `folders/${folder.id}`);
    }
  };

  const handleRestoreFolder = async (folder: Folder) => {
    try {
      await updateDoc(doc(db, 'folders', folder.id), {
        isDeleted: false,
        deletedAt: null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `folders/${folder.id}`);
    }
  };

  const handleRestoreMaterial = async (material: Material) => {
    try {
      await updateDoc(doc(db, 'materials', material.id), {
        isDeleted: false,
        deletedAt: null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `materials/${material.id}`);
    }
  };

  const handleBulkMove = () => {
    setItemsToMove({
      materials: Array.from(selectedMaterialIds),
      folders: Array.from(selectedFolderIds)
    });
    setIsMoveModalOpen(true);
  };

  const handleItemDrop = async (targetFolderId: string | null) => {
    const materialsToMove = Array.from(selectedMaterialIds);
    const foldersToMove = Array.from(selectedFolderIds);

    if (materialsToMove.length === 0 && foldersToMove.length === 0) return;

    // Prevent dropping into one of the selected folders
    if (targetFolderId && foldersToMove.includes(targetFolderId)) {
      setErrorStatus("Cannot move a folder into itself");
      return;
    }

    try {
      const promises = [
        ...materialsToMove.map(id => updateDoc(doc(db, 'materials', id), { folderId: targetFolderId })),
        ...foldersToMove.map(id => updateDoc(doc(db, 'folders', id), { parentId: targetFolderId }))
      ];
      await Promise.all(promises);
      setSelectedMaterialIds(new Set());
      setSelectedFolderIds(new Set());
    } catch (error: any) {
      setErrorStatus(`Move failed: ${error.message}`);
    }
  };

  const handleDragStart = (id: string, type: 'material' | 'folder') => {
    // If the dragged item isn't in current selection, select ONLY it
    const isSelected = type === 'material' ? selectedMaterialIds.has(id) : selectedFolderIds.has(id);
    if (!isSelected) {
      setSelectedMaterialIds(new Set(type === 'material' ? [id] : []));
      setSelectedFolderIds(new Set(type === 'folder' ? [id] : []));
    }
  };

  const handleMoveMaterial = (material: Material) => {
    setItemsToMove({ materials: [material.id], folders: [] });
    setIsMoveModalOpen(true);
  };

  const handleMoveFolder = (folder: Folder) => {
    setItemsToMove({ materials: [], folders: [folder.id] });
    setIsMoveModalOpen(true);
  };

  if (isLoading && materials.length === 0 && folders.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 border border-luxury-gold/30 rounded-full border-t-luxury-gold animate-spin"></div>
          <span className="text-luxury-gold/50 text-[10px] uppercase tracking-widest">Loading Archives</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Refined Modular Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 bg-white/[0.02] p-8 rounded-[2.5rem] border border-white/5 backdrop-blur-xl relative z-50">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleBreadcrumbClick(-1)}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-white/10'); }}
            onDragLeave={(e) => e.currentTarget.classList.remove('bg-white/10')}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-white/10'); handleItemDrop(null); }}
            className={cn(
              "p-3 rounded-2xl transition-all group",
              (currentFolderId === null && currentView !== 'trash') ? "bg-luxury-gold text-luxury-black" : "text-white/40 hover:text-white hover:bg-white/5"
            )}
          >
            <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
          
          {(currentView === 'personal' || currentView === 'archive') && folderPath.map((folder, index) => (
            <React.Fragment key={folder.id}>
              <ChevronRight className="w-4 h-4 text-white/10 shrink-0" />
              <button
                onClick={() => handleBreadcrumbClick(index)}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-white/10'); }}
                onDragLeave={(e) => e.currentTarget.classList.remove('bg-white/10')}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-white/10'); handleItemDrop(folder.id); }}
                className={cn(
                  "px-4 py-2 hover:bg-white/10 rounded-xl transition-all text-sm font-medium tracking-wide whitespace-nowrap",
                  index === folderPath.length - 1 ? "text-luxury-gold bg-luxury-gold/5" : "text-white/60 hover:text-white"
                )}
              >
                {folder.name}
              </button>
            </React.Fragment>
          ))}

          {currentView === 'trash' && (
            <>
              <ChevronRight className="w-4 h-4 text-white/10 shrink-0" />
              <button className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl text-sm font-bold uppercase tracking-widest whitespace-nowrap">
                Recycle Bin
              </button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group min-w-[280px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-luxury-gold transition-colors" />
            <input
              type="text"
              placeholder={currentView === 'archive' ? "Deep Search Archives..." : "Filter Directory..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-white placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-luxury-gold/30 focus:bg-white/10 transition-all font-light"
            />
          </div>
          
          <div className="flex items-center gap-2">
            {isAuthenticated && currentView === 'personal' && (
              <>
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="p-3 bg-luxury-gold text-luxury-black rounded-2xl hover:scale-105 transition-all shadow-lg shadow-luxury-gold/20"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsCreateFolderOpen(true)}
                  className="p-3 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 rounded-2xl transition-all border border-white/5"
                >
                  <FolderPlus className="w-5 h-5" />
                </button>
              </>
            )}
            
            <div className="flex items-center gap-4">
              <Dropdown
                options={sortOptions}
                value={sortBy}
                onChange={setSortBy}
              />
              <Dropdown
                options={filterOptions}
                value={filterType}
                onChange={setFilterType}
                icon={<Filter className="w-4 h-4 text-white/40" />}
              />
            </div>
          </div>
        </div>
      </div>

      {errorStatus && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between"
        >
          <p className="text-xs text-red-400 font-medium">{errorStatus}</p>
          <button onClick={() => setErrorStatus(null)} className="text-red-400/50 hover:text-red-400 text-xs uppercase tracking-widest font-bold px-2">Dismiss</button>
        </motion.div>
      )}

      <AnimatePresence mode="popLayout">
        {/* Selection Marquee Overlay */}
        {marquee && (
          <div 
            className="fixed pointer-events-none border-2 border-luxury-gold/40 bg-luxury-gold/5 z-[100] backdrop-blur-[2px]"
            style={{
              left: Math.min(marquee.start.x, marquee.end.x),
              top: Math.min(marquee.start.y, marquee.end.y),
              width: Math.abs(marquee.start.x - marquee.end.x),
              height: Math.abs(marquee.start.y - marquee.end.y)
            }}
          />
        )}

        {/* Bulk Action Toolbar */}
        {(selectedMaterialIds.size > 0 || selectedFolderIds.size > 0) && (
          <motion.div
            initial={{ y: 50, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: 50, opacity: 0, x: '-50%' }}
            className="fixed bottom-10 left-1/2 z-50 bg-luxury-black/90 backdrop-blur-3xl border border-white/10 px-8 py-4 rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] flex items-center gap-8"
          >
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-black">Archive Stack</span>
              <span className="text-luxury-gold font-serif text-xl">{selectedMaterialIds.size + selectedFolderIds.size} <span className="text-xs uppercase tracking-widest text-white/20 font-sans ml-1">Entries</span></span>
            </div>
            
            <div className="h-10 w-px bg-white/10" />

            <div className="flex gap-3">
              {currentView === 'trash' ? (
                <>
                  <button 
                    onClick={handleBulkRestore}
                    className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] uppercase tracking-widest text-white font-bold transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Restore
                  </button>
                  <button 
                    onClick={handleBulkDelete}
                    className="flex items-center gap-2 px-6 py-3 bg-red-500/20 hover:bg-red-400 rounded-2xl text-[10px] uppercase tracking-widest text-red-100 font-bold transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    Purge
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={handleBulkMove}
                    className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] uppercase tracking-widest text-white font-bold transition-all"
                  >
                    <Move className="w-4 h-4" />
                    Relocate
                  </button>
                  <button 
                    onClick={handleBulkTrash}
                    className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] uppercase tracking-widest text-white/50 font-bold transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    Archive
                  </button>
                </>
              )}
              <button 
                onClick={() => { setSelectedMaterialIds(new Set()); setSelectedFolderIds(new Set()); setLastSelectedIndex(null); }}
                className="flex items-center gap-2 px-6 py-3 bg-transparent hover:bg-white/5 rounded-2xl text-[10px] uppercase tracking-widest text-white/30 hover:text-white transition-all underline underline-offset-8 decoration-white/10"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}

        <div 
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onContextMenu={(e) => handleContextMenu(e, 'background')}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 min-h-[500px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedMaterialIds(new Set());
              setSelectedFolderIds(new Set());
              setLastSelectedIndex(null);
            }
          }}
        >
          {sortedFolders.map((folder, index) => (
            <motion.div
              layout
              key={folder.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              data-item-type="folder"
              data-item-id={folder.id}
              onContextMenu={(e) => handleContextMenu(e, 'folder', folder)}
            >
              <FolderCard 
                folder={folder} 
                onClick={currentView === 'trash' ? () => {} : handleNavigateToFolder}
                onDeleteClick={handleFolderDelete}
                onMoveClick={currentView === 'trash' ? undefined : handleMoveFolder}
                userRole={userRole}
                isInTrash={currentView === 'trash'}
                onRestore={handleRestoreFolder}
                isSelected={selectedFolderIds.has(folder.id)}
                onSelect={(e) => handleItemSelect(folder.id, 'folder', index, e)}
                onDragStart={() => handleDragStart(folder.id, 'folder')}
                onDrop={() => handleItemDrop(folder.id)}
              />
            </motion.div>
          ))}
          
          {sortedMaterials.map((material, index) => (
            <motion.div
              layout
              key={material.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              data-item-type="material"
              data-item-id={material.id}
              onContextMenu={(e) => handleContextMenu(e, 'material', material)}
            >
              <MaterialCard 
                material={material} 
                onAuthorClick={handleAuthorClick}
                onCardClick={currentView === 'trash' ? () => {} : handleCardClick}
                onEditClick={handleEditClick}
                onMoveClick={handleMoveMaterial}
                userRole={userRole}
                authorContributionCount={authorCounts[material.authorId] || 0}
                isSaved={userSaves.has(material.id)}
                isInTrash={currentView === 'trash'}
                onRestore={handleRestoreMaterial}
                isSelected={selectedMaterialIds.has(material.id)}
                onSelect={(e) => handleItemSelect(material.id, 'material', sortedFolders.length + index, e)}
                onDragStart={() => handleDragStart(material.id, 'material')}
              />
            </motion.div>
          ))}
        </div>

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={getContextMenuItems()}
            onClose={() => setContextMenu(null)}
          />
        )}
      </AnimatePresence>

      {(sortedFolders.length === 0 && sortedMaterials.length === 0) && !isLoading && (
        <div className="text-center py-24 glass-panel rounded-[3rem] border-white/5">
          {currentView === 'trash' ? (
            <>
              <Trash2 className="w-16 h-16 text-white/5 mx-auto mb-6" />
              <h3 className="text-2xl font-serif text-white/40">Trash is Empty</h3>
              <p className="text-white/20 mt-2 text-sm font-light">Items in Trash are automatically cleared after 30 days.</p>
              <button 
                onClick={() => handleViewChange('personal')}
                className="mt-8 text-[10px] uppercase tracking-[0.3em] text-luxury-gold hover:text-white transition-colors flex items-center gap-2 mx-auto"
              >
                <ArrowLeft className="w-3 h-3" />
                Return to Space
              </button>
            </>
          ) : (
            <>
              <BookOpen className="w-16 h-16 text-white/5 mx-auto mb-6" />
              <h3 className="text-2xl font-serif text-white/40">{currentView === 'archive' ? 'Archive Empty' : 'Directory Empty'}</h3>
              <p className="text-white/20 mt-2 text-sm font-light">This directory holds no manuscripts yet.</p>
              {currentFolderId && (
                <button 
                  onClick={() => handleBreadcrumbClick(-1)}
                  className="mt-8 text-[10px] uppercase tracking-[0.3em] text-luxury-gold hover:text-white transition-colors flex items-center gap-2 mx-auto"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Return to Roots
                </button>
              )}
            </>
          )}
        </div>
      )}

      {selectedProfile && (
        <AuthorProfileModal
          isOpen={true}
          onClose={() => setSelectedProfile(null)}
          authorId={selectedProfile.id}
          authorName={selectedProfile.name}
          authorPhotoUrl={selectedProfile.photoUrl}
          onMaterialClick={handleCardClick}
          onEditClick={handleEditClick}
          userRole={userRole}
        />
      )}

      <MaterialDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        material={selectedMaterial}
        authorContributionCount={selectedMaterial ? (authorCounts[selectedMaterial.authorId] || 0) : 0}
        onAuthorClick={(id, name, photoUrl) => {
          setIsDetailModalOpen(false);
          handleAuthorClick(id, name, photoUrl);
        }}
        userRole={userRole}
      />

      <EditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        material={materialToEdit}
      />

      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        parentId={currentFolderId}
      />

      <MoveModal 
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        targetItems={itemsToMove}
        onSuccess={() => {
          setSelectedMaterialIds(new Set());
          setSelectedFolderIds(new Set());
        }}
      />

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        currentFolderId={currentFolderId}
      />
    </div>
  );
}
