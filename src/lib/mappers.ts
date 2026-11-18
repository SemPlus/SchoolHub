import type { Collection, Folder, Material, MaterialRequest, RequestAnswer, WorkFeedback } from '../types';
import { toDate } from './utils';

// Firestore Timestamps must be converted explicitly: `new Date(timestamp)`
// returns an Invalid Date.

export const mapMaterialDoc = (id: string, data: any): Material => ({
  id,
  ...data,
  tags: Array.isArray(data.tags) ? data.tags : [],
  downloadCount: typeof data.downloadCount === 'number' ? data.downloadCount : 0,
  saveCount: typeof data.saveCount === 'number' ? data.saveCount : 0,
  createdAt: toDate(data.createdAt) ?? new Date(),
  updatedAt: toDate(data.updatedAt),
  deletedAt: toDate(data.deletedAt),
  examDate: toDate(data.examDate),
  verifiedAt: toDate(data.verifiedAt),
  linkCheckedAt: toDate(data.linkCheckedAt),
  visibleInArchiveUntil: toDate(data.visibleInArchiveUntil),
} as Material);

export const mapFolderDoc = (id: string, data: any): Folder => ({
  id,
  ...data,
  createdAt: toDate(data.createdAt) ?? new Date(),
  deletedAt: toDate(data.deletedAt),
} as Folder);

export const mapRequestDoc = (id: string, data: any): MaterialRequest => ({
  id,
  ...data,
  status: data.status || 'open',
  createdAt: toDate(data.createdAt) ?? new Date(),
  fulfilledAt: toDate(data.fulfilledAt),
} as MaterialRequest);

export const mapAnswerDoc = (id: string, data: any): RequestAnswer => ({
  id,
  ...data,
  createdAt: toDate(data.createdAt) ?? new Date(),
} as RequestAnswer);

export const mapCollectionDoc = (id: string, data: any): Collection => ({
  id,
  ...data,
  createdAt: toDate(data.createdAt) ?? new Date(),
  updatedAt: toDate(data.updatedAt),
  dueAt: toDate(data.dueAt),
  closedAt: toDate(data.closedAt),
} as Collection);

export const mapFeedbackDoc = (id: string, data: any): WorkFeedback => ({
  id,
  ...data,
  createdAt: toDate(data.createdAt) ?? new Date(),
  updatedAt: toDate(data.updatedAt),
} as WorkFeedback);
