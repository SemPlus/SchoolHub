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

export interface Material {
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

export type UserRole = 'admin' | 'teacher' | 'user';

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

export interface MaterialRequest {
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
