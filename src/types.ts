import type { Moderated } from './lib/moderation';

export type MaterialType = 'pdf' | 'word' | 'canva' | 'link' | 'other';

export type LinkStatus = 'ok' | 'broken' | 'restricted';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface Material extends Moderated {
  id: string;
  title: string;
  description?: string;
  type: MaterialType;
  url: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl?: string;
  tags: string[];
  /** Unique opens by signed-in users other than the author. */
  downloadCount: number;
  /** Saves by users other than the author. */
  saveCount?: number;
  createdAt: Date;
  updatedAt?: Date | null;
  folderId?: string | null;
  isDeleted?: boolean;
  deletedAt?: Date | null;
  /** Official school code (codice meccanografico). */
  schoolId?: string;
  schoolName?: string;
  schoolCity?: string;
  classId?: string;
  /** Display label such as "3B". */
  className?: string;
  /** Grade within the school, 1-5. */
  classYear?: number;
  /** Section letters, e.g. "B". */
  classSection?: string;
  subject?: string;
  /** Date of the test this material prepares for. */
  examDate?: Date | null;
  verifiedBy?: string | null;
  verifiedByName?: string | null;
  verifiedAt?: Date | null;
  linkStatus?: LinkStatus | null;
  linkCheckedAt?: Date | null;
  /** Legacy field from the removed archive-expiry feature. Ignored. */
  visibleInArchiveUntil?: Date | null;
  /** The collection (shared theme or project) this material belongs to. */
  collectionId?: string | null;
  /** What it is: notes, exercises, past test… (see lib/materialKinds). */
  kind?: string | null;
  /** revision | extra | catch-up */
  level?: string | null;
  /** The material this one improves (a corrected or extended version). */
  improvesId?: string | null;
  /** Textbook this material goes with (ISBN-13) and its title. */
  isbn?: string | null;
  bookTitle?: string | null;
  /** Word prefixes for search across schools (see lib/search). */
  keywords?: string[] | null;
  /** Classmates who made the work together with the author (max 5). */
  coAuthorIds?: string[] | null;
  coAuthorNames?: string[] | null;
  /** "I can share it": ticked at upload (works added before 21 Nov 2026 lack it). */
  rightsConfirmed?: boolean;
  /** When the school kept or removed it after reports. */
  modAt?: Date | null;
  /** When the author corrected it after the school hid or removed it. */
  modFixedAt?: Date | null;
}

/**
 * A shared theme, project or exam that groups works by different people,
 * e.g. every group's presentation on the Renaissance for 4B.
 */
export interface Collection {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  schoolId?: string;
  schoolName?: string;
  classYear?: number;
  classSection?: string;
  className?: string;
  classId?: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt?: Date | null;
  isDeleted?: boolean;
  /** Hand-in mode: a teacher's collection with a deadline. */
  isHandIn?: boolean;
  dueAt?: Date | null;
  /** "Best work" chosen by the class vote, announced by the creator. */
  winnerMaterialId?: string | null;
  winnerAuthorId?: string | null;
  winnerAuthorName?: string | null;
  /** A teacher's lot (see lib/lots). Unset on collections created before lots existed. */
  isLot?: boolean;
  /** "same": one topic, the best work stays. "different": every work is its own topic. */
  lotType?: 'same' | 'different' | null;
  /** The theme this lot repeats (id of the theme's first lot), or null for a new theme. */
  themeId?: string | null;
  /** When the teacher closed the lot (chose the best work or closed it). */
  closedAt?: Date | null;
  /** "different" lots: works the teacher took out. */
  removedMaterialIds?: string[] | null;
}

/** One person's vote for the best work in a collection (id = their uid). */
export interface CollectionVote {
  id: string;
  userId: string;
  materialId: string;
  createdAt: Date;
}

/** One person's stars and comment on a work. The document id is their uid. */
export interface WorkFeedback extends Moderated {
  id: string;
  userId: string;
  userName: string;
  rating?: number | null;
  comment?: string | null;
  createdAt: Date;
  updatedAt?: Date | null;
}

export interface Folder {
  id: string;
  name: string;
  authorId: string;
  authorName: string;
  parentId?: string | null;
  /** Always true now: every folder is visible to everyone. */
  isPublic: boolean;
  createdAt: any;
  isDeleted?: boolean;
  deletedAt?: any;
  schoolId?: string;
  schoolName?: string;
  classId?: string;
  className?: string;
}

/**
 * Permission level. 'teacher' is granted by the founder and allows verifying
 * materials; it is separate from the self-chosen account type.
 */
export type UserRole = 'admin' | 'teacher' | 'user';

export type AccountType = 'student' | 'teacher';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  customColor?: string;
  customBadge?: string;
  /** Legacy, no longer written. Badges are computed from activity. */
  unlockedBadges?: string[];
  schoolId?: string;
  schoolName?: string;
  schoolCity?: string;
  /** 1 = lower secondary (3 years), 2 = upper secondary (5 years). */
  schoolGrade?: 1 | 2;
  classYear?: number;
  classSection?: string;
  /** Start year of the school year the class was confirmed for, e.g. 2026 for 2026/27. */
  profileSchoolYear?: number;
  /** Chosen at sign-up. Teachers pick several classes and their subjects. */
  accountType?: AccountType;
  /** Teacher classes as labels such as "3B". */
  teacherClasses?: string[];
  teacherSubjects?: string[];
  /** Last day the user opened the app (updated at most once a day). */
  lastSeenAt?: any;
  createdAt: any;
}

export interface Save {
  id: string;
  userId: string;
  materialId: string;
  /** True when the save was added to the material's saveCount. */
  counted?: boolean;
  createdAt: any;
}

export type RequestStatus = 'open' | 'fulfilled' | 'closed';

export interface MaterialRequest extends Moderated {
  id: string;
  title: string;
  details?: string;
  subject?: string;
  authorId: string;
  authorName: string;
  schoolId?: string;
  schoolName?: string;
  classYear?: number;
  classSection?: string;
  className?: string;
  status: RequestStatus;
  createdAt: Date;
  acceptedAnswerId?: string | null;
  acceptedUserId?: string | null;
  acceptedUserName?: string | null;
  acceptedMaterialId?: string | null;
  fulfilledAt?: Date | null;
}

export interface RequestAnswer {
  /** Equal to the answering user's uid: one answer per user per request. */
  id: string;
  userId: string;
  userName: string;
  materialId: string;
  materialTitle: string;
  createdAt: Date;
}
