export type MaterialType = 'pdf' | 'word' | 'canva' | 'link' | 'drive' | 'other';

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
}
