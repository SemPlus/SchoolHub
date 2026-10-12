import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, onSnapshot, where, doc, deleteDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Material, Folder } from '../types';
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
import ExamRadar from './ExamRadar';
import SchoolPicker, { PickedSchool } from './SchoolPicker';
import { Search, Filter, FolderPlus, ChevronRight, Home, ArrowLeft, BookOpen, Plus, Trash2, Move, Edit, Info, RotateCcw, X, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { mapFolderDoc, mapMaterialDoc } from '../lib/mappers';
import { useAppData } from '../context/AppData';
import { formatClassName, formatSchoolYear, schoolYearStart } from '../lib/schoolYear';
import { SUBJECTS } from '../lib/subjects';
import { firebaseErrorMessage } from '../lib/engagement';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type View = 'archive' | 'personal' | 'trash';
/** How far the archive reaches, relative to the signed-in student's class. */
type Scope = 'all' | 'school' | 'grade' | 'class';

const SCOPE_STORAGE_KEY = 'schoolhub.archiveScope';

function readStoredScope(): Scope {
  try {
    const value = window.localStorage.getItem(SCOPE_STORAGE_KEY);
    if (value === 'all' || value === 'school' || value === 'grade' || value === 'class') return value;
  } catch {
    // Storage can be unavailable (private mode); fall back to the default.
  }
  return 'all';
}

interface MaterialListProps {
  userRole: string | null;
  view?: View;
  onViewChange?: (view: View) => void;
}

export default function MaterialList({ userRole, view = 'archive', onViewChange }: MaterialListProps) {
  const { user, profile, materials: allMaterials, isMaterialsLoading, materialsError, getStats } = useAppData();
  const uid = user?.uid;
  const isAuthenticated = !!user;

  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<Folder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [scope, setScope] = useState<Scope>(readStoredScope);
  const [selectedProfile, setSelectedProfile] = useState<{ id: string, name: string, photoUrl?: string } | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState<Material | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [itemsToMove, setItemsToMove] = useState<{ materials: string[], folders: string[] }>({ materials: [], folders: [] });
  const [userSaves, setUserSaves] = useState<Set<string>>(new Set());
  const [currentView, setCurrentView] = useState<View>(view);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Explore filters: any school from the registry, a year and a subject.
  const [showFilters, setShowFilters] = useState(false);
  const [schoolFilter, setSchoolFilter] = useState<PickedSchool | null>(null);
  const [yearFilter, setYearFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');

  // Multi-selection
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<{ index: number, type: 'material' | 'folder' } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, target: any, type: 'material' | 'folder' | 'background' } | null>(null);

  const hasClass = !!profile?.schoolId && !!profile?.classYear && !!profile?.classSection;
  const currentSchoolYear = schoolYearStart();

  useEffect(() => {
    try { window.localStorage.setItem(SCOPE_STORAGE_KEY, scope); } catch { /* ignore */ }
  }, [scope]);

  // A scope that needs a profile falls back to everything without one.
  const effectiveScope: Scope =
    (scope === 'class' || scope === 'grade') && !hasClass ? 'all'
    : scope === 'school' && !profile?.schoolId ? 'all'
    : scope;

  // ---------------------------------------------------------------- data

  // Deep link: ?material=<id>
  useEffect(() => {
    const materialId = new URLSearchParams(window.location.search).get('material');
    if (!materialId) return;
    getDoc(doc(db, 'materials', materialId))
      .then(snapshot => {
        if (!snapshot.exists()) return;
        const material = mapMaterialDoc(snapshot.id, snapshot.data());
        if (!material.isDeleted) handleCardClick(material);
      })
      .catch(error => console.error('Error fetching deep-linked material:', error));
  }, []);

  useEffect(() => {
    if (!uid) {
      setUserSaves(new Set());
      return;
    }
    const q = query(collection(db, 'saves'), where('userId', '==', uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUserSaves(new Set(snapshot.docs.map(d => d.data().materialId)));
    }, (error) => console.error('Saves snapshot error:', error));
    return () => unsubscribe();
  }, [uid]);

  useEffect(() => {
    setCurrentView(view);
  }, [view]);

  useEffect(() => {
    setCurrentFolderId(null);
    setFolderPath([]);
    setSearchTerm('');
    setFilterType('all');
    clearSelection();
  }, [currentView]);

  useEffect(() => {
    clearSelection();
  }, [searchTerm, filterType, effectiveScope]);

  // Folders. Everything is visible to everyone, so the archive lists every
  // folder at the current level.
  useEffect(() => {
    let foldersQuery = null;
    if (currentView === 'trash') {
      if (uid) foldersQuery = query(collection(db, 'folders'), where('authorId', '==', uid));
    } else if (currentView === 'personal') {
      if (uid) foldersQuery = query(collection(db, 'folders'), where('authorId', '==', uid), where('parentId', '==', currentFolderId));
    } else {
      foldersQuery = query(collection(db, 'folders'), where('parentId', '==', currentFolderId));
    }

    if (!foldersQuery) {
      setFolders([]);
      return;
    }

    const unsubscribe = onSnapshot(foldersQuery, (snapshot) => {
      const now = Date.now();
      const list = snapshot.docs
        .map(d => mapFolderDoc(d.id, d.data()))
        .filter(f => {
          if (currentView === 'trash') {
            if (f.isDeleted !== true) return false;
            const deletedTime = f.deletedAt ? f.deletedAt.getTime() : now;
            return (now - deletedTime) < THIRTY_DAYS_MS;
          }
          return !f.isDeleted;
        });
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setFolders(list);
    }, (error) => {
      setFolders([]);
      setErrorStatus(firebaseErrorMessage(error, 'Could not load folders.'));
    });
    return () => unsubscribe();
  }, [currentFolderId, currentView, uid]);

  useEffect(() => {
    if (materialsError) setErrorStatus(`Could not load materials: ${materialsError}`);
  }, [materialsError]);

  /** "Inherited · 2025/26" for materials from earlier years of the student's grade. */
  const inheritedLabelFor = (m: Material): string | undefined => {
    if (!hasClass || m.schoolId !== profile!.schoolId || m.classYear !== profile!.classYear) return undefined;
    const year = schoolYearStart(m.createdAt);
    return year < currentSchoolYear ? `Inherited · ${formatSchoolYear(year)}` : undefined;
  };

  // Materials for the current view, before search and filters.
  const materials = useMemo(() => {
    const now = Date.now();
    return allMaterials.filter(m => {
      if (currentView === 'trash') {
        if (m.isDeleted !== true || !uid || m.authorId !== uid) return false;
        const deletedTime = m.deletedAt ? m.deletedAt.getTime() : now;
        return (now - deletedTime) < THIRTY_DAYS_MS;
      }
      if (m.isDeleted) return false;

      if (currentView === 'personal') {
        if (!uid) return false;
        const isMine = m.authorId === uid;
        if (!isMine && !userSaves.has(m.id)) return false;
        // Saved materials from others live at the root of My Space.
        if (currentFolderId === null) return !m.folderId || !isMine;
        return m.folderId === currentFolderId;
      }

      // Archive: inside a folder, only that folder's materials.
      if (currentFolderId !== null) return m.folderId === currentFolderId;

      switch (effectiveScope) {
        case 'class':
          return m.schoolId === profile!.schoolId &&
            m.classYear === profile!.classYear &&
            m.classSection === profile!.classSection &&
            schoolYearStart(m.createdAt) === currentSchoolYear;
        case 'grade':
          // Same grade at the same school, this year and inherited from earlier years.
          return m.schoolId === profile!.schoolId && m.classYear === profile!.classYear;
        case 'school':
          return m.schoolId === profile!.schoolId;
        default:
          return true;
      }
    });
  }, [allMaterials, currentView, currentFolderId, userSaves, uid, effectiveScope, profile?.schoolId, profile?.classYear, profile?.classSection, currentSchoolYear]);

  const sortedFolders = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = folders.filter(folder => {
      if (!folder.name.toLowerCase().includes(term)) return false;
      if (schoolFilter && folder.schoolId !== schoolFilter.id) return false;
      // Folders are not tied to a grade or subject, so hide them while those filters are on.
      if (yearFilter || subjectFilter) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sortBy === 'oldest') return a.createdAt.getTime() - b.createdAt.getTime();
      if (sortBy === 'az') return a.name.localeCompare(b.name);
      if (sortBy === 'za') return b.name.localeCompare(a.name);
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }, [folders, searchTerm, sortBy, schoolFilter, yearFilter, subjectFilter]);

  const sortedMaterials = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = materials.filter(m => {
      const matchesSearch = !term ||
        m.title.toLowerCase().includes(term) ||
        (m.description || '').toLowerCase().includes(term) ||
        (m.subject || '').toLowerCase().includes(term) ||
        (m.schoolName || '').toLowerCase().includes(term) ||
        m.tags.some(tag => tag.toLowerCase().includes(term));
      if (!matchesSearch) return false;
      if (filterType !== 'all' && m.type !== filterType) return false;
      if (schoolFilter && m.schoolId !== schoolFilter.id) return false;
      if (yearFilter && String(m.classYear || '') !== yearFilter) return false;
      if (subjectFilter && m.subject !== subjectFilter) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sortBy === 'oldest') return a.createdAt.getTime() - b.createdAt.getTime();
      if (sortBy === 'az') return a.title.localeCompare(b.title);
      if (sortBy === 'za') return b.title.localeCompare(a.title);
      if (sortBy === 'popular') {
        const score = (m: Material) => (m.downloadCount || 0) + 2 * (m.saveCount || 0) + (m.verifiedBy ? 10 : 0);
        return score(b) - score(a);
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }, [materials, searchTerm, filterType, sortBy, schoolFilter, yearFilter, subjectFilter]);

  // ---------------------------------------------------------------- selection

  const allItems = [
    ...sortedFolders.map(f => ({ ...f, itemType: 'folder' as const })),
    ...sortedMaterials.map(m => ({ ...m, itemType: 'material' as const })),
  ];

  function clearSelection() {
    setSelectedMaterialIds(new Set());
    setSelectedFolderIds(new Set());
    setLastSelectedIndex(null);
  }

  const [marquee, setMarquee] = useState<{ start: { x: number, y: number }, end: { x: number, y: number } } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start a marquee on the empty grid background.
    if (e.target !== e.currentTarget || e.button !== 0) return;
    setMarquee({ start: { x: e.clientX, y: e.clientY }, end: { x: e.clientX, y: e.clientY } });
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) clearSelection();
  };

  useEffect(() => {
    if (!marquee) return;
    const handleMouseMove = (e: MouseEvent) => {
      setMarquee(prev => prev ? ({ ...prev, end: { x: e.clientX, y: e.clientY } }) : null);
    };
    const handleMouseUp = () => {
      const x1 = Math.min(marquee.start.x, marquee.end.x);
      const x2 = Math.max(marquee.start.x, marquee.end.x);
      const y1 = Math.min(marquee.start.y, marquee.end.y);
      const y2 = Math.max(marquee.start.y, marquee.end.y);
      const inside = (el: Element) => {
        const b = el.getBoundingClientRect();
        const cx = b.left + b.width / 2;
        const cy = b.top + b.height / 2;
        return cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2;
      };
      const newMats = new Set(selectedMaterialIds);
      const newFolders = new Set(selectedFolderIds);
      document.querySelectorAll('[data-item-type="material"]').forEach(el => {
        if (inside(el)) newMats.add(el.getAttribute('data-item-id')!);
      });
      document.querySelectorAll('[data-item-type="folder"]').forEach(el => {
        if (inside(el)) newFolders.add(el.getAttribute('data-item-id')!);
      });
      setSelectedMaterialIds(newMats);
      setSelectedFolderIds(newFolders);
      setMarquee(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [marquee, selectedMaterialIds, selectedFolderIds]);

  const handleItemSelect = (id: string, type: 'material' | 'folder', index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastSelectedIndex) {
      window.getSelection()?.removeAllRanges();
      const start = Math.min(lastSelectedIndex.index, index);
      const end = Math.max(lastSelectedIndex.index, index);
      const newMats = new Set(selectedMaterialIds);
      const newFolders = new Set(selectedFolderIds);
      for (let i = start; i <= end; i++) {
        const item = allItems[i];
        if (!item) continue;
        if (item.itemType === 'material') newMats.add(item.id);
        else newFolders.add(item.id);
      }
      setSelectedMaterialIds(newMats);
      setSelectedFolderIds(newFolders);
    } else if (e.ctrlKey || e.metaKey) {
      const toggle = (set: Set<string>) => {
        const next = new Set(set);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      };
      if (type === 'material') setSelectedMaterialIds(toggle(selectedMaterialIds));
      else setSelectedFolderIds(toggle(selectedFolderIds));
      setLastSelectedIndex({ index, type });
    } else {
      setSelectedMaterialIds(new Set(type === 'material' ? [id] : []));
      setSelectedFolderIds(new Set(type === 'folder' ? [id] : []));
      setLastSelectedIndex({ index, type });
    }
  };

  // ---------------------------------------------------------------- actions

  const handleAuthorClick = (id: string, name: string, photoUrl?: string) => setSelectedProfile({ id, name, photoUrl });

  function handleCardClick(material: Material) {
    setSelectedMaterial(material);
    setIsDetailModalOpen(true);
  }

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
      setCurrentFolderId(folderPath[index].id);
      setFolderPath(folderPath.slice(0, index + 1));
    }
  };

  const runBulk = async (promises: Promise<unknown>[], failure: string) => {
    setErrorStatus(null);
    try {
      await Promise.all(promises);
      clearSelection();
    } catch (error) {
      setErrorStatus(firebaseErrorMessage(error, failure));
    }
  };

  const handleBulkTrash = () => runBulk([
    ...Array.from(selectedMaterialIds).map(id => updateDoc(doc(db, 'materials', id), { isDeleted: true, deletedAt: serverTimestamp() })),
    ...Array.from(selectedFolderIds).map(id => updateDoc(doc(db, 'folders', id), { isDeleted: true, deletedAt: serverTimestamp() })),
  ], 'Moving to Trash failed.');

  const handleBulkRestore = () => runBulk([
    ...Array.from(selectedMaterialIds).map(id => updateDoc(doc(db, 'materials', id), { isDeleted: false, deletedAt: null })),
    ...Array.from(selectedFolderIds).map(id => updateDoc(doc(db, 'folders', id), { isDeleted: false, deletedAt: null })),
  ], 'Restore failed.');

  const handleBulkDelete = () => {
    if (!confirm(`Delete ${selectedMaterialIds.size + selectedFolderIds.size} items forever? This cannot be undone.`)) return;
    runBulk([
      ...Array.from(selectedMaterialIds).map(id => deleteDoc(doc(db, 'materials', id))),
      ...Array.from(selectedFolderIds).map(id => deleteDoc(doc(db, 'folders', id))),
    ], 'Delete failed.');
  };

  const handleBulkMove = () => {
    setItemsToMove({ materials: Array.from(selectedMaterialIds), folders: Array.from(selectedFolderIds) });
    setIsMoveModalOpen(true);
  };

  const handleFolderDelete = async (folder: Folder) => {
    setErrorStatus(null);
    try {
      if (currentView === 'trash') {
        if (!confirm(`Delete folder "${folder.name}" forever? This cannot be undone.`)) return;
        await deleteDoc(doc(db, 'folders', folder.id));
      } else {
        await updateDoc(doc(db, 'folders', folder.id), { isDeleted: true, deletedAt: serverTimestamp() });
      }
    } catch (error) {
      setErrorStatus(firebaseErrorMessage(error, 'Could not delete the folder.'));
    }
  };

  const handleRenameFolder = async (folder: Folder) => {
    const newName = prompt('Rename folder', folder.name)?.trim();
    if (!newName || newName === folder.name) return;
    if (newName.length > 100) {
      setErrorStatus('Folder names are limited to 100 characters.');
      return;
    }
    setErrorStatus(null);
    try {
      await updateDoc(doc(db, 'folders', folder.id), { name: newName, updatedAt: serverTimestamp() });
      setFolderPath(prev => prev.map(f => f.id === folder.id ? { ...f, name: newName } : f));
    } catch (error) {
      setErrorStatus(firebaseErrorMessage(error, 'Rename failed.'));
    }
  };

  const handleRestore = async (collectionName: 'materials' | 'folders', id: string) => {
    setErrorStatus(null);
    try {
      await updateDoc(doc(db, collectionName, id), { isDeleted: false, deletedAt: null });
    } catch (error) {
      setErrorStatus(firebaseErrorMessage(error, 'Restore failed.'));
    }
  };

  const handleItemDrop = async (targetFolderId: string | null) => {
    const materialsToMove = Array.from(selectedMaterialIds);
    const foldersToMove = Array.from(selectedFolderIds);
    if (materialsToMove.length === 0 && foldersToMove.length === 0) return;
    if (targetFolderId && foldersToMove.includes(targetFolderId)) {
      setErrorStatus('A folder cannot be moved into itself.');
      return;
    }
    runBulk([
      ...materialsToMove.map(id => updateDoc(doc(db, 'materials', id), { folderId: targetFolderId })),
      ...foldersToMove.map(id => updateDoc(doc(db, 'folders', id), { parentId: targetFolderId })),
    ], 'Move failed.');
  };

  const handleDragStart = (id: string, type: 'material' | 'folder') => {
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

  // ---------------------------------------------------------------- keyboard

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return;
      // Grid shortcuts must not act behind an open dialog.
      if (isDetailModalOpen || isEditModalOpen || isCreateFolderOpen || isUploadModalOpen || isMoveModalOpen || selectedProfile) return;

      const hasSelection = selectedMaterialIds.size > 0 || selectedFolderIds.size > 0;
      if ((e.key === 'Delete' || e.key === 'Backspace') && hasSelection) {
        e.preventDefault();
        if (currentView === 'trash') handleBulkDelete();
        else if (confirm(`Move ${selectedMaterialIds.size + selectedFolderIds.size} items to Trash?`)) handleBulkTrash();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedMaterialIds(new Set(sortedMaterials.map(m => m.id)));
        setSelectedFolderIds(new Set(sortedFolders.map(f => f.id)));
      }
      if (e.key === 'Escape') clearSelection();
      if (e.key === 'Enter' && lastSelectedIndex && currentView !== 'trash') {
        const item = allItems[lastSelectedIndex.index];
        if (item?.itemType === 'folder') handleNavigateToFolder(item as unknown as Folder);
        else if (item) handleCardClick(item as unknown as Material);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // ---------------------------------------------------------------- context menu

  const handleContextMenu = (e: React.MouseEvent, type: 'material' | 'folder' | 'background', target?: any) => {
    // Creating items is only possible in My Space, like the + buttons.
    if (type === 'background' && (!isAuthenticated || currentView !== 'personal')) return;
    e.preventDefault();
    e.stopPropagation();
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
    const multiple = (selectedMaterialIds.size + selectedFolderIds.size) > 1;

    if (type === 'background') {
      return [
        { label: 'Add material', icon: <Plus className="w-4 h-4" />, onClick: () => setIsUploadModalOpen(true) },
        { label: 'New folder', icon: <FolderPlus className="w-4 h-4" />, onClick: () => setIsCreateFolderOpen(true) },
      ];
    }

    if (currentView === 'trash') {
      return [
        { label: multiple ? 'Restore selected' : 'Restore', icon: <RotateCcw className="w-4 h-4" />, onClick: handleBulkRestore },
        { label: multiple ? 'Delete selected forever' : 'Delete forever', icon: <Trash2 className="w-4 h-4" />, onClick: handleBulkDelete, variant: 'danger' as const },
      ];
    }

    const canModifyTarget = isAuthenticated && (userRole === 'admin' || uid === target?.authorId);
    const items: { label: string; icon: React.ReactNode; onClick: () => void; variant?: 'danger' | 'default' }[] = [];
    // With several items selected, Firestore enforces permissions per item and
    // failures show in the error banner.
    if (multiple || canModifyTarget) {
      items.push(
        { label: multiple ? 'Move selected' : 'Move', icon: <Move className="w-4 h-4" />, onClick: handleBulkMove },
        { label: multiple ? 'Move selected to Trash' : 'Move to Trash', icon: <Trash2 className="w-4 h-4" />, onClick: handleBulkTrash, variant: 'danger' as const },
      );
    }
    if (!multiple) {
      if (type === 'material') {
        if (canModifyTarget) items.unshift({ label: 'Edit', icon: <Edit className="w-4 h-4" />, onClick: () => handleEditClick(target) });
        items.push({ label: 'Details', icon: <Info className="w-4 h-4" />, onClick: () => handleCardClick(target) });
      } else if (canModifyTarget) {
        items.unshift({ label: 'Rename folder', icon: <Edit className="w-4 h-4" />, onClick: () => handleRenameFolder(target) });
      }
    }
    return items;
  };

  const contextMenuItems = getContextMenuItems();

  // Show the live copy of the open material so edits and counts update.
  const liveSelectedMaterial = selectedMaterial
    ? (allMaterials.find(m => m.id === selectedMaterial.id) ?? selectedMaterial)
    : null;

  // ---------------------------------------------------------------- render

  const filterOptions = [
    { value: 'all', label: 'All types' },
    { value: 'pdf', label: 'PDF' },
    { value: 'word', label: 'Word' },
    { value: 'canva', label: 'Presentations' },
    { value: 'link', label: 'Links' },
    { value: 'other', label: 'Other' },
  ];

  const sortOptions = [
    { value: 'newest', label: 'Newest' },
    { value: 'popular', label: 'Most helpful' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'az', label: 'A–Z' },
    { value: 'za', label: 'Z–A' },
  ];

  const maxYear = schoolFilter?.grade === 1 ? 3 : 5;
  const yearOptions = [{ value: '', label: 'Any year' }, ...Array.from({ length: maxYear }, (_, i) => ({ value: String(i + 1), label: `Year ${i + 1}` }))];
  const subjectOptions = [{ value: '', label: 'Any subject' }, ...SUBJECTS.map(s => ({ value: s, label: s }))];
  const activeFilterCount = [schoolFilter, yearFilter, subjectFilter].filter(Boolean).length;

  const myClassName = formatClassName(profile?.classYear, profile?.classSection);
  const scopeChips: { value: Scope; label: string; disabled: boolean }[] = [
    { value: 'all', label: 'Everything', disabled: false },
    { value: 'school', label: 'My school', disabled: !profile?.schoolId },
    { value: 'grade', label: profile?.classYear ? `Year ${profile.classYear}` : 'My year', disabled: !hasClass },
    { value: 'class', label: myClassName ? `My class · ${myClassName}` : 'My class', disabled: !hasClass },
  ];

  if (isMaterialsLoading && allMaterials.length === 0 && folders.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border border-luxury-gold/30 rounded-full border-t-luxury-gold animate-spin"></div>
          <span className="text-luxury-gold/50 text-[10px] uppercase tracking-widest">Loading…</span>
        </div>
      </div>
    );
  }

  const isEmpty = sortedFolders.length === 0 && sortedMaterials.length === 0;

  return (
    <div className="space-y-8 sm:space-y-10">
      {currentView === 'archive' && currentFolderId === null && hasClass && (
        <ExamRadar materials={allMaterials} profile={profile} onOpenMaterial={handleCardClick} />
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-4 bg-white/[0.02] p-4 sm:p-6 md:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-white/5 backdrop-blur-xl relative z-40">
        {currentView === 'archive' && currentFolderId === null && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
            {scopeChips.map(chip => (
              <button
                key={chip.value}
                disabled={chip.disabled}
                onClick={() => setScope(chip.value)}
                className={cn(
                  'shrink-0 px-4 py-2 rounded-full text-[10px] uppercase tracking-widest font-semibold border transition-all disabled:opacity-30',
                  effectiveScope === chip.value ? 'bg-luxury-gold text-luxury-black border-luxury-gold' : 'border-white/10 text-white/50 hover:text-white'
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleBreadcrumbClick(-1)}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-white/10'); }}
              onDragLeave={(e) => e.currentTarget.classList.remove('bg-white/10')}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-white/10'); handleItemDrop(null); }}
              className={cn(
                "p-3 rounded-2xl transition-all",
                (currentFolderId === null && currentView !== 'trash') ? "bg-luxury-gold text-luxury-black" : "text-white/40 hover:text-white hover:bg-white/5"
              )}
              title="Top level"
            >
              <Home className="w-5 h-5" />
            </button>

            {currentView !== 'trash' && folderPath.map((folder, index) => (
              <React.Fragment key={folder.id}>
                <ChevronRight className="w-4 h-4 text-white/10 shrink-0" />
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-white/10'); }}
                  onDragLeave={(e) => e.currentTarget.classList.remove('bg-white/10')}
                  onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-white/10'); handleItemDrop(folder.id); }}
                  className={cn(
                    "px-4 py-2 hover:bg-white/10 rounded-xl transition-all text-sm font-medium whitespace-nowrap",
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
                <span className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl text-sm font-bold uppercase tracking-widest">Trash</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative group w-full md:w-auto md:min-w-[260px] flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-luxury-gold transition-colors" />
              <input
                type="text"
                placeholder="Search materials…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-luxury-gold/30 transition-all font-light"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "relative p-3 rounded-2xl transition-all border",
                  showFilters || activeFilterCount > 0 ? "bg-luxury-gold text-luxury-black border-luxury-gold" : "bg-white/5 text-white/60 hover:text-white border-white/5"
                )}
                title="Filters"
              >
                <SlidersHorizontal className="w-5 h-5" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-luxury-black text-[9px] font-bold flex items-center justify-center">{activeFilterCount}</span>
                )}
              </button>

              {isAuthenticated && currentView === 'personal' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="p-3 bg-luxury-gold text-luxury-black rounded-2xl hover:scale-105 transition-all shadow-lg shadow-luxury-gold/20"
                    title="Add material"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setIsCreateFolderOpen(true)}
                    className="p-3 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 rounded-2xl transition-all border border-white/5"
                    title="New folder"
                  >
                    <FolderPlus className="w-5 h-5" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3 ml-auto md:ml-0">
                <Dropdown options={sortOptions} value={sortBy} onChange={setSortBy} />
                <Dropdown options={filterOptions} value={filterType} onChange={setFilterType} icon={<Filter className="w-4 h-4 text-white/40" />} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative z-30"
          >
            <div className="bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-[2rem] grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-4 md:items-end">
              <div className="space-y-2">
                <p className="text-[9px] uppercase tracking-widest text-white/40 ml-1">School</p>
                <SchoolPicker value={schoolFilter} onChange={setSchoolFilter} clearable placeholder="Any school – search to filter" />
              </div>
              <div className="space-y-2">
                <p className="text-[9px] uppercase tracking-widest text-white/40 ml-1">Year</p>
                <Dropdown options={yearOptions} value={yearFilter} onChange={setYearFilter} className="w-full" />
              </div>
              <div className="space-y-2">
                <p className="text-[9px] uppercase tracking-widest text-white/40 ml-1">Subject</p>
                <Dropdown options={subjectOptions} value={subjectFilter} onChange={setSubjectFilter} className="w-full" />
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setSchoolFilter(null); setYearFilter(''); setSubjectFilter(''); }}
                  className="text-[10px] text-luxury-gold uppercase tracking-widest hover:underline px-2 py-3"
                >
                  Clear all
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {errorStatus && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between gap-4">
          <p className="text-xs text-red-400 font-medium">{errorStatus}</p>
          <button onClick={() => setErrorStatus(null)} className="text-red-400/50 hover:text-red-400 text-xs uppercase tracking-widest font-bold px-2">Dismiss</button>
        </div>
      )}

      {marquee && (
        <div
          className="fixed pointer-events-none border-2 border-luxury-gold/40 bg-luxury-gold/5 z-[100]"
          style={{
            left: Math.min(marquee.start.x, marquee.end.x),
            top: Math.min(marquee.start.y, marquee.end.y),
            width: Math.abs(marquee.start.x - marquee.end.x),
            height: Math.abs(marquee.start.y - marquee.end.y)
          }}
        />
      )}

      <AnimatePresence>
        {(selectedMaterialIds.size > 0 || selectedFolderIds.size > 0) && (
          <motion.div
            key="bulk-toolbar"
            initial={{ y: 50, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: 50, opacity: 0, x: '-50%' }}
            className="fixed bottom-6 sm:bottom-10 left-1/2 z-50 bg-luxury-black/90 backdrop-blur-3xl border border-white/10 px-4 sm:px-8 py-3 sm:py-4 rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] flex items-center gap-4 sm:gap-8 max-w-[calc(100vw-2rem)]"
          >
            <div className="flex flex-col shrink-0">
              <span className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-black">Selected</span>
              <span className="text-luxury-gold font-serif text-xl">{selectedMaterialIds.size + selectedFolderIds.size}</span>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {currentView === 'trash' ? (
                <>
                  <button onClick={handleBulkRestore} className="flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] uppercase tracking-widest text-white font-bold transition-all whitespace-nowrap">
                    <ArrowLeft className="w-4 h-4" /> Restore
                  </button>
                  <button onClick={handleBulkDelete} className="flex items-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-400 rounded-2xl text-[10px] uppercase tracking-widest text-red-100 font-bold transition-all whitespace-nowrap">
                    <Trash2 className="w-4 h-4" /> Delete forever
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handleBulkMove} className="flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] uppercase tracking-widest text-white font-bold transition-all whitespace-nowrap">
                    <Move className="w-4 h-4" /> Move
                  </button>
                  <button onClick={handleBulkTrash} className="flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] uppercase tracking-widest text-white/60 font-bold transition-all whitespace-nowrap">
                    <Trash2 className="w-4 h-4" /> Trash
                  </button>
                </>
              )}
              <button onClick={clearSelection} className="px-4 py-3 hover:bg-white/5 rounded-2xl text-[10px] uppercase tracking-widest text-white/30 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selection is cleared in handleMouseDown. A click handler here would
          also fire after a marquee drag and wipe the selection just made. */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => handleContextMenu(e, 'background')}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 min-h-[300px]"
      >
        <AnimatePresence mode="popLayout">
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
                onRestore={(f) => handleRestore('folders', f.id)}
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
                authorImpact={getStats(material.authorId).impact}
                isSaved={userSaves.has(material.id)}
                isInTrash={currentView === 'trash'}
                onRestore={(m) => handleRestore('materials', m.id)}
                isSelected={selectedMaterialIds.has(material.id)}
                onSelect={(e) => handleItemSelect(material.id, 'material', sortedFolders.length + index, e)}
                onDragStart={() => handleDragStart(material.id, 'material')}
                inheritedLabel={currentView === 'archive' ? inheritedLabelFor(material) : undefined}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {contextMenu && contextMenuItems.length > 0 && (
          <ContextMenu
            key="context-menu"
            x={contextMenu.x}
            y={contextMenu.y}
            items={contextMenuItems}
            onClose={() => setContextMenu(null)}
          />
        )}
      </AnimatePresence>

      {isEmpty && !isMaterialsLoading && (
        <div className="text-center py-20 glass-panel rounded-[3rem] border-white/5 px-6">
          {currentView === 'trash' ? (
            <>
              <Trash2 className="w-16 h-16 text-white/5 mx-auto mb-6" />
              <h3 className="text-2xl font-serif text-white/40">Trash is empty</h3>
              <p className="text-white/30 mt-2 text-sm font-light">Items in Trash are deleted for good after 30 days.</p>
              <button
                onClick={() => onViewChange?.('personal')}
                className="mt-8 text-[10px] uppercase tracking-[0.3em] text-luxury-gold hover:text-white transition-colors flex items-center gap-2 mx-auto"
              >
                <ArrowLeft className="w-3 h-3" /> Back to My Space
              </button>
            </>
          ) : (
            <>
              <BookOpen className="w-16 h-16 text-white/5 mx-auto mb-6" />
              <h3 className="text-2xl font-serif text-white/40">
                {currentView === 'personal' ? 'Nothing here yet' : effectiveScope === 'class' ? `Nothing for ${myClassName} yet` : 'No materials found'}
              </h3>
              <p className="text-white/30 mt-2 text-sm font-light">
                {currentView === 'personal'
                  ? 'Add your first material with the + button, or save materials from the archive.'
                  : effectiveScope !== 'all'
                    ? 'Be the first to share something, or look wider.'
                    : 'Try a different search or clear the filters.'}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                {currentView === 'archive' && effectiveScope !== 'all' && currentFolderId === null && (
                  <button onClick={() => setScope('all')} className="text-[10px] uppercase tracking-[0.3em] text-luxury-gold hover:text-white transition-colors">
                    Show everything
                  </button>
                )}
                {currentFolderId && (
                  <button onClick={() => handleBreadcrumbClick(-1)} className="text-[10px] uppercase tracking-[0.3em] text-luxury-gold hover:text-white transition-colors flex items-center gap-2">
                    <ArrowLeft className="w-3 h-3" /> Back to top level
                  </button>
                )}
              </div>
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
        material={liveSelectedMaterial}
        authorImpact={liveSelectedMaterial ? getStats(liveSelectedMaterial.authorId).impact : 0}
        isSaved={liveSelectedMaterial ? userSaves.has(liveSelectedMaterial.id) : false}
        onAuthorClick={(id, name, photoUrl) => {
          setIsDetailModalOpen(false);
          handleAuthorClick(id, name, photoUrl);
        }}
        userRole={userRole}
      />

      <EditModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} material={materialToEdit} />

      <CreateFolderModal isOpen={isCreateFolderOpen} onClose={() => setIsCreateFolderOpen(false)} parentId={currentFolderId} />

      <MoveModal
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        targetItems={itemsToMove}
        onSuccess={clearSelection}
      />

      <UploadModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} currentFolderId={currentFolderId} />
    </div>
  );
}
