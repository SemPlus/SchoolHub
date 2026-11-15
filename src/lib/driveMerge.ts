import type { MaterialType } from '../types';
import {
  DriveError, GOOGLE_DOC, GOOGLE_SHEET, GOOGLE_SLIDES, MAX_UPLOAD_BYTES,
  deleteDriveFile, exportDriveFile, openDrive, shareAndLink, titleFromFileName, uploadBlob,
  type UploadResult, type UploadStage,
} from './drive';
import { t } from './i18n';

// Several files from the student's device become ONE file in their Google
// Drive. What that file is depends on what was picked:
//   only photos            -> Google Slides, one photo per slide
//   only text documents    -> one Google Doc, each file on a new page
//   anything else / a mix  -> one PDF, in the chosen order
// The student can always ask for one PDF instead.
//
// Libraries are loaded only when needed, so the app stays light.

export const MAX_MERGE_FILES = 20;

export type FileKind = 'image' | 'document' | 'sheet' | 'presentation' | 'pdf' | 'unsupported';
export type MergeTarget = 'slides' | 'doc' | 'pdf';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

function extOf(file: File): string {
  return file.name.split('.').pop()?.toLowerCase() || '';
}

export function kindOf(file: File): FileKind {
  const ext = extOf(file);
  if (file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp'].includes(ext)) return 'image';
  if (ext === 'pdf' || file.type === 'application/pdf') return 'pdf';
  if (['doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'html', 'htm'].includes(ext)) return 'document';
  if (['xls', 'xlsx', 'ods', 'csv', 'tsv'].includes(ext)) return 'sheet';
  if (['ppt', 'pptx', 'pps', 'ppsx', 'odp'].includes(ext)) return 'presentation';
  return 'unsupported';
}

export function mergeTargetFor(files: File[], forcePdf: boolean): MergeTarget {
  if (forcePdf) return 'pdf';
  const kinds = new Set(files.map(kindOf));
  if (kinds.size === 1) {
    if (kinds.has('image')) return 'slides';
    if (kinds.has('document')) return 'doc';
  }
  return 'pdf';
}

export const TARGET_LABEL: Record<MergeTarget, string> = {
  slides: 'Google Slides presentation',
  doc: 'Google Docs document',
  pdf: 'PDF in Google Drive',
};

const TARGET_TYPE: Record<MergeTarget, MaterialType> = {
  slides: 'canva',
  doc: 'word',
  pdf: 'pdf',
};

export interface MergeResult extends UploadResult {
  materialType: MaterialType;
  target: MergeTarget;
}

export interface MergeProgress {
  stage: UploadStage;
  /** 1-based index of the file being prepared, during 'preparing'. */
  current?: number;
  total?: number;
  /** 0..1 of the final upload, during 'uploading'. */
  fraction?: number;
}

interface DriveSession {
  token: string;
  folderId: string;
  /** Temporary files to remove at the end, whatever happens. */
  temp: string[];
}

/** Uploads a file converted to a Google type and keeps track of it for clean-up. */
async function tempConvert(session: DriveSession, file: File, convertTo: string): Promise<string> {
  const uploaded = await uploadBlob(session.token, session.folderId, file, {
    name: `~ SchoolHub temp · ${file.name}`,
    contentType: file.type || 'application/octet-stream',
    convertTo,
  });
  session.temp.push(uploaded.id);
  return uploaded.id;
}

const CONVERT_FOR_KIND: Partial<Record<FileKind, string>> = {
  document: GOOGLE_DOC,
  sheet: GOOGLE_SHEET,
  presentation: GOOGLE_SLIDES,
};

// ------------------------------------------------------------------ images

interface Jpeg { bytes: Uint8Array; width: number; height: number }

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new DriveError(t("{0} is a photo format this browser cannot open. Try a JPG or PNG.", file.name))); };
    img.src = url;
  });
}

/** Any photo the browser can show -> upright JPEG, at most 2400 px on the long side. */
async function toJpeg(file: File, maxSide = 2400): Promise<Jpeg> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new DriveError(t("{0} could not be read.", file.name));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ------------------------------------------------------------------ PDF

const A4: [number, number] = [595.28, 841.89];

export async function buildPdf(
  files: File[],
  onFile: (index: number) => void,
  convert: (file: File, kind: FileKind) => Promise<Blob>
): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const out = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onFile(i);
    const kind = kindOf(file);
    if (kind === 'image') {
      const jpeg = await toJpeg(file);
      const image = await out.embedJpg(jpeg.bytes);
      const landscape = jpeg.width > jpeg.height;
      const [pw, ph] = landscape ? [A4[1], A4[0]] : A4;
      const margin = 24;
      const scale = Math.min((pw - margin * 2) / jpeg.width, (ph - margin * 2) / jpeg.height);
      const w = jpeg.width * scale;
      const h = jpeg.height * scale;
      const page = out.addPage([pw, ph]);
      page.drawImage(image, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
      continue;
    }
    const pdfBytes = kind === 'pdf' ? await file.arrayBuffer() : await (await convert(file, kind)).arrayBuffer();
    let source;
    try {
      source = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    } catch {
      throw new DriveError(t("{0} could not be read. It may be damaged or password-protected.", file.name));
    }
    const pages = await out.copyPages(source, source.getPageIndices());
    pages.forEach(page => out.addPage(page));
  }
  const bytes = await out.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// ------------------------------------------------------------------ Slides

export async function buildSlides(files: File[], onFile: (index: number) => void): Promise<Blob> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  const [sw, sh] = [10, 5.625];

  for (let i = 0; i < files.length; i++) {
    onFile(i);
    const jpeg = await toJpeg(files[i], 2000);
    const scale = Math.min(sw / jpeg.width, sh / jpeg.height);
    const w = jpeg.width * scale;
    const h = jpeg.height * scale;
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    slide.addImage({ data: `data:image/jpeg;base64,${bytesToBase64(jpeg.bytes)}`, x: (sw - w) / 2, y: (sh - h) / 2, w, h });
  }
  return (await pptx.write({ outputType: 'blob' })) as Blob;
}

// ------------------------------------------------------------------ Doc

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function buildDocHtml(
  files: File[],
  onFile: (index: number) => void,
  toDocx: (file: File) => Promise<Blob>
): Promise<Blob> {
  const mammoth = await import('mammoth');
  const sections: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onFile(i);
    const ext = extOf(file);
    let html: string;
    if (ext === 'txt' || ext === 'md') {
      const text = await file.text();
      html = text.split(/\r?\n/).map(line => `<p>${escapeHtml(line) || '&nbsp;'}</p>`).join('');
    } else if (ext === 'html' || ext === 'htm') {
      const parsed = new DOMParser().parseFromString(await file.text(), 'text/html');
      parsed.querySelectorAll('script, style, link, iframe, object, embed').forEach(el => el.remove());
      html = parsed.body.innerHTML;
    } else {
      // .docx is read directly; .doc, .odt and .rtf go through Google first.
      const docx = ext === 'docx' ? file : await toDocx(file);
      try {
        const result = await mammoth.convertToHtml({ arrayBuffer: await docx.arrayBuffer() });
        html = result.value;
      } catch {
        throw new DriveError(t("{0} could not be read. It may be damaged or password-protected.", file.name));
      }
    }
    sections.push(i === 0 ? html : `<p style="page-break-before: always"></p>${html}`);
  }

  const page = `<!doctype html><html><head><meta charset="utf-8"></head><body>${sections.join('')}</body></html>`;
  return new Blob([page], { type: 'text/html' });
}

// ------------------------------------------------------------------ main

/**
 * Turns 1+ files into one shareable file in the student's Google Drive.
 * Must be started from a click (it may open Google's permission window).
 */
export async function uploadMergedToDrive(
  files: File[],
  options: { forcePdf?: boolean; onProgress?: (progress: MergeProgress) => void } = {}
): Promise<MergeResult> {
  if (files.length === 0) throw new DriveError(t("Choose at least one file."));
  if (files.length > MAX_MERGE_FILES) throw new DriveError(t("You can combine up to {0} files at a time.", MAX_MERGE_FILES));
  const bad = files.find(f => kindOf(f) === 'unsupported');
  if (bad) throw new DriveError(t("{0} cannot be combined. Use PDFs, photos, Word, PowerPoint or Excel files.", bad.name));
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_UPLOAD_BYTES) throw new DriveError(t("Together these files are larger than 100 MB."));

  const report = options.onProgress ?? (() => undefined);
  const target = mergeTargetFor(files, !!options.forcePdf);
  const title = titleFromFileName(files[0].name);
  const onFile = (index: number) => report({ stage: 'preparing', current: index + 1, total: files.length });

  report({ stage: 'connecting' });
  const { token, folderId } = await openDrive();
  const session: DriveSession = { token, folderId, temp: [] };

  try {
    let uploaded: { id: string; webViewLink?: string };
    const onUpload = (fraction: number) => report({ stage: 'uploading', fraction });

    if (target === 'slides') {
      const pptx = await buildSlides(files, onFile);
      report({ stage: 'uploading', fraction: 0 });
      uploaded = await uploadBlob(token, folderId, pptx, { name: title, contentType: PPTX_MIME, convertTo: GOOGLE_SLIDES, onProgress: onUpload });
    } else if (target === 'doc') {
      const html = await buildDocHtml(files, onFile, async (file) => {
        const id = await tempConvert(session, file, GOOGLE_DOC);
        return exportDriveFile(token, id, DOCX_MIME);
      });
      report({ stage: 'uploading', fraction: 0 });
      uploaded = await uploadBlob(token, folderId, html, { name: title, contentType: 'text/html', convertTo: GOOGLE_DOC, onProgress: onUpload });
    } else {
      const pdf = await buildPdf(files, onFile, async (file, kind) => {
        const id = await tempConvert(session, file, CONVERT_FOR_KIND[kind]!);
        return exportDriveFile(token, id, 'application/pdf');
      });
      if (pdf.size > MAX_UPLOAD_BYTES) throw new DriveError(t("The combined PDF is larger than 100 MB. Try fewer files."));
      report({ stage: 'uploading', fraction: 0 });
      uploaded = await uploadBlob(token, folderId, pdf, { name: `${title}.pdf`, contentType: 'application/pdf', onProgress: onUpload });
    }

    report({ stage: 'sharing' });
    const result = await shareAndLink(token, uploaded);
    return { ...result, materialType: TARGET_TYPE[target], target };
  } finally {
    await Promise.all(session.temp.map(id => deleteDriveFile(token, id)));
  }
}
