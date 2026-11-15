import React from 'react';
import {
  X, BookOpen, ExternalLink, FileText, File, Link as LinkIcon, Edit2, Folder as FolderIcon, ChevronLeft,
  Trash2, GraduationCap, School, Eye, Bookmark, HeartHandshake, BadgeCheck,
} from 'lucide-react';
import { Material, Folder, User } from '../types';
import { formatDistanceToNow } from '../lib/i18n';
import { doc, updateDoc, onSnapshot, query, collection, where, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { getNextRank, getRank } from '../lib/ranks';
import { getEarnedBadges } from '../lib/badges';
import { IMPACT_POINTS } from '../lib/stats';
import { firebaseErrorMessage, recordOpen } from '../lib/engagement';
import { mapFolderDoc } from '../lib/mappers';
import { formatClassName } from '../lib/schoolYear';
import { useAppData } from '../context/AppData';
import AchievementBadges from './AchievementBadges';
import ProfileCustomization from './ProfileCustomization';
import OnboardingModal from './OnboardingModal';
import Modal from './Modal';
import PendingTeachers from './PendingTeachers';
import SubjectBadge from './SubjectBadge';
import ClassPosterModal from './ClassPosterModal';
import { isTeacherAccount } from '../lib/schoolYear';
import UserAvatar from './UserAvatar';

import { t } from '../lib/i18n';
interface AuthorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  authorId: string;
  authorName: string;
  authorPhotoUrl?: string;
  onMaterialClick?: (material: Material) => void;
  onEditClick?: (material: Material) => void;
  userRole?: string | null;
}

export default function AuthorProfileModal({ isOpen, onClose, authorId, authorName, authorPhotoUrl, onMaterialClick, onEditClick, userRole }: AuthorProfileModalProps) {
  const { materials, getStats, profile: myProfile } = useAppData();
  const [authorProfile, setAuthorProfile] = React.useState<User | null>(null);
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = React.useState<string | null>(null);
  const [folderPath, setFolderPath] = React.useState<Folder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = React.useState(true);
  const [isEditingClass, setIsEditingClass] = React.useState(false);
  const [roleBusy, setRoleBusy] = React.useState(false);
  const [isPosterOpen, setIsPosterOpen] = React.useState(false);

  const stats = getStats(authorId);
  const rank = getRank(stats.impact);
  const nextRank = getNextRank(stats.impact);
  const earnedBadges = getEarnedBadges(stats);
  const isCurrentUser = auth.currentUser?.uid === authorId;
  const canCustomize = !!rank.canCustomize && isCurrentUser;
  const isAdmin = userRole === 'admin';

  // Live profile, so role and customization changes show immediately.
  React.useEffect(() => {
    if (!isOpen || !authorId) return;
    const unsubscribe = onSnapshot(doc(db, 'users', authorId), (snapshot) => {
      setAuthorProfile(snapshot.exists() ? ({ uid: snapshot.id, ...(snapshot.data() as any) } as User) : null);
    }, (error) => console.error('Error loading profile:', error));
    return () => unsubscribe();
  }, [isOpen, authorId]);

  // Every folder is visible to everyone now.
  React.useEffect(() => {
    if (!isOpen || !authorId) return;
    setIsLoadingFolders(true);
    const q = query(
      collection(db, 'folders'),
      where('authorId', '==', authorId),
      where('parentId', '==', currentFolderId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => mapFolderDoc(d.id, d.data())).filter(f => !f.isDeleted);
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setFolders(list);
      setIsLoadingFolders(false);
    }, (error) => {
      console.error('Error fetching folders:', error);
      setIsLoadingFolders(false);
    });
    return () => unsubscribe();
  }, [isOpen, authorId, currentFolderId]);

  const authorMaterials = React.useMemo(() => materials.filter(m =>
    m.authorId === authorId &&
    !m.isDeleted &&
    (currentFolderId === null ? !m.folderId : m.folderId === currentFolderId)
  ), [materials, authorId, currentFolderId]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="w-4 h-4 text-red-400" />;
      case 'word': return <File className="w-4 h-4 text-blue-400" />;
      case 'canva': return <BookOpen className="w-4 h-4 text-purple-400" />;
      case 'link': return <LinkIcon className="w-4 h-4 text-emerald-400" />;
      default: return <File className="w-4 h-4 text-gray-400" />;
    }
  };

  const handleTrash = async (e: React.MouseEvent, collectionName: 'materials' | 'folders', id: string, name: string) => {
    e.stopPropagation();
    if (!confirm(t("Move \"{0}\" to Trash?", name))) return;
    try {
      await updateDoc(doc(db, collectionName, id), { isDeleted: true, deletedAt: serverTimestamp() });
    } catch (error) {
      alert(firebaseErrorMessage(error, t("Could not move this to Trash.")));
    }
  };

  const toggleTeacher = async () => {
    if (!authorProfile) return;
    const next = authorProfile.role === 'teacher' ? 'user' : 'teacher';
    if (!confirm(next === 'teacher'
      ? t("Confirm {0} as a teacher? Confirmed teachers can verify materials from their school.", authorName)
      : t("Remove the teacher confirmation from {0}?", authorName))) return;
    setRoleBusy(true);
    try {
      await updateDoc(doc(db, 'users', authorId), { role: next });
    } catch (error) {
      alert(firebaseErrorMessage(error, t("Could not change the role.")));
    } finally {
      setRoleBusy(false);
    }
  };

  const className = formatClassName(authorProfile?.classYear, authorProfile?.classSection);
  const statItems = [
    { icon: <Eye className="w-3.5 h-3.5" />, label: 'Opens', value: stats.opensReceived, points: IMPACT_POINTS.open },
    { icon: <Bookmark className="w-3.5 h-3.5" />, label: 'Saves', value: stats.savesReceived, points: IMPACT_POINTS.save },
    { icon: <HeartHandshake className="w-3.5 h-3.5" />, label: 'Requests filled', value: stats.answersAccepted, points: IMPACT_POINTS.acceptedAnswer },
    { icon: <BadgeCheck className="w-3.5 h-3.5" />, label: 'Verified', value: stats.verified, points: IMPACT_POINTS.verified },
  ];

  const authorIsTeacher = isTeacherAccount(authorProfile);
  const teacherConfirmed = authorProfile?.role === 'teacher';

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="xl" bare>
              <div>
                {/* Header */}
                <div className="relative p-6 sm:p-10 border-b border-white/10 bg-white/[0.02]">

                  <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8">
                    <UserAvatar
                      name={authorName}
                      photoUrl={authorPhotoUrl}
                      contributionCount={stats.impact}
                      size="xl"
                      customColor={authorProfile?.customColor}
                    />
                    <div className="text-center md:text-left space-y-2">
                      <h2 className="text-3xl sm:text-5xl font-serif text-white tracking-tight">{authorName}</h2>
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                        <span className={`text-[9px] px-2 py-0.5 rounded border border-white/10 bg-white/5 font-bold tracking-widest ${rank.color}`}>
                          {t(authorProfile?.customBadge || rank.label)} · {rank.grade}
                        </span>
                        {authorIsTeacher && (
                          <span
                            className={teacherConfirmed
                              ? 'flex items-center gap-1 text-[9px] px-2 py-0.5 rounded border border-purple-400/30 bg-purple-400/10 text-purple-300 font-bold tracking-widest uppercase'
                              : 'flex items-center gap-1 text-[9px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-white/50 font-bold tracking-widest uppercase'}
                            title={teacherConfirmed ? t("Confirmed by the SchoolHub team") : t("Not confirmed yet")}
                          >
                            <GraduationCap className="w-3 h-3" /> {teacherConfirmed ? t("Teacher") : t("Teacher · unconfirmed")}
                          </span>
                        )}
                        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">{stats.impact} {t(" impact · ")}{stats.uploads} {t(" materials")}</span>
                      </div>
                      {authorProfile?.schoolName && (
                        <p className="text-xs text-white/50 flex items-center justify-center md:justify-start gap-1.5">
                          <School className="w-3.5 h-3.5 text-luxury-gold" />
                          {!authorIsTeacher && className ? `${className} · ` : ''}{authorProfile.schoolName}
                          {authorProfile.schoolCity ? `, ${authorProfile.schoolCity}` : ''}
                        </p>
                      )}
                      {authorIsTeacher && (authorProfile?.teacherClasses?.length || authorProfile?.teacherSubjects?.length) ? (
                        <div className="flex flex-wrap justify-center md:justify-start gap-1.5 pt-1">
                          {(authorProfile?.teacherClasses || []).map(l => (
                            <span key={l} className="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest bg-luxury-gold/10 border border-luxury-gold/20 text-luxury-gold">{l}</span>
                          ))}
                          {(authorProfile?.teacherSubjects || []).map(s => <SubjectBadge key={s} subject={s} />)}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-1">
                        {isCurrentUser && myProfile && (
                          <button
                            onClick={() => setIsEditingClass(true)}
                            className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[9px] uppercase tracking-widest text-white/60 hover:text-white"
                          >
                            {authorIsTeacher ? t("Change school, classes or subjects") : t("Change school or class")}
                          </button>
                        )}
                        {isCurrentUser && myProfile?.schoolId && !authorIsTeacher && className && (
                          <button
                            onClick={() => setIsPosterOpen(true)}
                            className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[9px] uppercase tracking-widest text-white/60 hover:text-white"
                          >
                            {t("Poster for ")}{className}
                          </button>
                        )}
                        {isAdmin && !isCurrentUser && authorProfile && authorProfile.role !== 'admin' && (
                          <button
                            onClick={toggleTeacher}
                            disabled={roleBusy}
                            className="px-3 py-1.5 rounded-full bg-purple-400/10 border border-purple-400/30 text-[9px] uppercase tracking-widest text-purple-200 hover:bg-purple-400/20 disabled:opacity-40"
                          >
                            {teacherConfirmed ? t("Remove teacher confirmation") : authorIsTeacher ? t("Confirm teacher") : t("Make teacher")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {isAdmin && isCurrentUser && <PendingTeachers />}

                  {/* Impact breakdown */}
                  <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {statItems.map(item => (
                      <div key={item.label} className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
                        <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-white/40">{item.icon}{t(item.label)}</p>
                        <p className="text-xl font-serif text-white mt-1">{item.value}</p>
                        <p className="text-[9px] text-white/25">{item.points} {t(" impact each")}</p>
                      </div>
                    ))}
                  </div>
                  {nextRank && (
                    <p className="mt-3 text-[10px] text-white/40">
                      {nextRank.missing} {t(" more impact to reach ")}{t(nextRank.rank.label)}.
                    </p>
                  )}

                  {canCustomize && (
                    <div className="mt-8 max-w-md mx-auto md:mx-0">
                      <ProfileCustomization
                        currentUserId={authorId}
                        customColor={authorProfile?.customColor}
                        customBadge={authorProfile?.customBadge}
                        earnedBadges={earnedBadges}
                      />
                    </div>
                  )}
                </div>

                {/* Badges */}
                <div className="p-6 sm:p-10 bg-white/[0.01] border-b border-white/5">
                  <h3 className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-bold mb-6">{t("Badges")}</h3>
                  <AchievementBadges stats={stats} />
                </div>

                {/* Materials */}
                <div className="p-6 sm:p-10 bg-luxury-black/20">
                  <div className="flex items-center gap-4 mb-6">
                    {currentFolderId && (
                      <button
                        onClick={() => {
                          const newPath = folderPath.slice(0, -1);
                          setFolderPath(newPath);
                          setCurrentFolderId(newPath.length > 0 ? newPath[newPath.length - 1].id : null);
                        }}
                        className="p-2 bg-white/5 border border-white/10 rounded-full text-white/40 hover:text-white"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    )}
                    <h3 className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-bold">
                      {t("Materials ")}{folderPath.length > 0 ? `› ${folderPath.map(f => f.name).join(' › ')}` : ''}
                    </h3>
                  </div>

                  {isLoadingFolders ? (
                    <div className="flex justify-center py-16">
                      <div className="w-8 h-8 border-2 border-luxury-gold/30 border-t-luxury-gold rounded-full animate-spin"></div>
                    </div>
                  ) : folders.length === 0 && authorMaterials.length === 0 ? (
                    <div className="text-center py-16 border border-white/5 rounded-3xl">
                      <p className="text-white/40 font-light">{t("Nothing here yet.")}</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {folders.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {folders.map(folder => (
                            <div
                              key={folder.id}
                              onClick={() => {
                                setFolderPath([...folderPath, folder]);
                                setCurrentFolderId(folder.id);
                              }}
                              className="glass-panel p-4 rounded-xl hover:bg-white/5 border-white/5 flex items-center justify-between gap-3 cursor-pointer group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2.5 bg-luxury-gold/5 rounded-lg">
                                  <FolderIcon className="w-5 h-5 text-luxury-gold" />
                                </div>
                                <p className="text-sm font-serif text-white truncate group-hover:text-luxury-gold transition-colors">{folder.name}</p>
                              </div>
                              {(isCurrentUser || isAdmin) && (
                                <button
                                  onClick={(e) => handleTrash(e, 'folders', folder.id, folder.name)}
                                  className="sm:opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-400/10 rounded-lg text-white/30 hover:text-red-400"
                                  title={t("Move to Trash")}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {authorMaterials.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {authorMaterials.map(material => (
                            <div
                              key={material.id}
                              onClick={() => onMaterialClick?.(material)}
                              className="glass-panel p-5 rounded-2xl hover:bg-white/5 transition-all group border-white/5 cursor-pointer"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="w-10 h-10 border border-white/5 rounded-xl flex items-center justify-center bg-white/5">
                                  {getIcon(material.type)}
                                </div>
                                <div className="flex gap-1">
                                  {(isCurrentUser || isAdmin) && (
                                    <>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onEditClick?.(material); }}
                                        className="text-white/30 hover:text-luxury-gold transition-colors p-2 hover:bg-white/5 rounded-lg"
                                        title={t("Edit")}
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={(e) => handleTrash(e, 'materials', material.id, material.title)}
                                        className="text-white/30 hover:text-red-400 transition-colors p-2 hover:bg-red-400/10 rounded-lg"
                                        title={t("Move to Trash")}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                  <a
                                    href={material.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => { e.stopPropagation(); recordOpen(material); }}
                                    className="text-white/30 hover:text-luxury-gold transition-colors p-2 hover:bg-white/5 rounded-lg"
                                    title={t("Open")}
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </div>
                              </div>
                              <h4 className="text-lg font-serif text-white mb-2 line-clamp-1 group-hover:text-luxury-gold transition-colors">
                                {material.title}
                              </h4>
                              <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-white/30 flex-wrap">
                                <span>{formatDistanceToNow(material.createdAt, { addSuffix: true })}</span>
                                {material.subject && <><span>•</span><span>{material.subject}</span></>}
                                <span>•</span>
                                <span className="flex items-center gap-1"><Eye className="w-2.5 h-2.5" />{material.downloadCount || 0}</span>
                                {material.verifiedBy && <BadgeCheck className="w-3 h-3 text-purple-300" />}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
      </Modal>

      {isPosterOpen && myProfile?.schoolId && className && (
        <ClassPosterModal
          isOpen
          onClose={() => setIsPosterOpen(false)}
          schoolId={myProfile.schoolId}
          schoolName={myProfile.schoolName || myProfile.schoolId}
          classLabel={className}
        />
      )}

      {isEditingClass && myProfile && (
        <OnboardingModal profile={myProfile} mode="edit" onClose={() => setIsEditingClass(false)} />
      )}
    </>
  );
}
