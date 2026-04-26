export type MaterialType = 'pdf' | 'word' | 'canva' | 'link' | 'other';

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
  downloadCount: number;
  createdAt: Date;
  folderId?: string | null;
  isDeleted?: boolean;
  deletedAt?: Date;
}

export interface Folder {
  id: string;
  name: string;
  authorId: string;
  authorName: string;
  parentId?: string | null;
  isPublic: boolean;
  createdAt: any;
  isDeleted?: boolean;
  deletedAt?: any;
}

export interface User {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: 'admin' | 'user';
  customColor?: string;
  customBadge?: string;
  unlockedBadges?: string[];
  createdAt: any;
}

export interface Save {
  id: string;
  userId: string;
  materialId: string;
  createdAt: any;
}
