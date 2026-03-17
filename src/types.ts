export type MaterialType = 'pdf' | 'word' | 'canva' | 'link' | 'other';

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
  createdAt: Date;
}
