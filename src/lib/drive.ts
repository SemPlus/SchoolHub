import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import type { MaterialType } from '../types';

import { t } from './i18n';
import { guardWrite } from './simulation';
// Uploads a file from the user's device to their own Google Drive, converts
// it to a Google Docs / Slides / Sheets file where that keeps the content
// intact, shares it as "anyone with the link can view", and returns the link.
//
// Permission comes from the same Google sign-in the app already uses, with
// the narrow drive.file scope: SchoolHub can only see files it created
// itself, never the rest of the user's Drive.

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'SchoolHub';
const MULTIPART_LIMIT = 5 * 1024 * 1024;

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export class DriveError extends Error {}

interface CachedToken { token: string; expires: number; uid: string }
let cachedToken: CachedToken | null = null;

/** Opens Google's permission popup if needed. Must be called from a click. */
export async function getDriveToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new DriveError(t("Sign in first."));
  if (cachedToken && cachedToken.uid === user.uid && cachedToken.expires > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);
  if (user.email) provider.setCustomParameters({ login_hint: user.email });
  try {
    const result = await reauthenticateWithPopup(user, provider);
    const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
    if (!token) throw new DriveError(t("Google did not give access to Drive. Please try again."));
    cachedToken = { token, uid: user.uid, expires: Date.now() + 55 * 60 * 1000 };
    return token;
  } catch (error: any) {
    if (error instanceof DriveError) throw error;
    const code: string = error?.code || '';
    if (code === 'auth/popup-blocked') throw new DriveError(t("Your browser blocked the Google window. Allow pop-ups for this site and tap Upload again."));
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') throw new DriveError(t("The Google window was closed before finishing."));
    if (code === 'auth/user-mismatch') throw new DriveError(t("Choose the same Google account you are signed in with."));
    throw new DriveError(error?.message || t("Could not connect to Google Drive."));
  }
}

export function hasDriveToken(): boolean {
  return !!cachedToken && cachedToken.uid === auth.currentUser?.uid && cachedToken.expires > Date.now() + 60_000;
}

export interface FilePlan {
  /** Google file type to convert to, or null to keep the original file. */
  convertTo: string | null;
  /** Material type to preset in the form. */
  materialType: MaterialType;
  /** Human description of the result, e.g. "Google Slides". */
  resultLabel: string;
  /** PDFs can optionally become an editable (text only) Google Doc. */
  canMakeEditable: boolean;
}

export const GOOGLE_DOC = 'application/vnd.google-apps.document';
export const GOOGLE_SLIDES = 'application/vnd.google-apps.presentation';
export const GOOGLE_SHEET = 'application/vnd.google-apps.spreadsheet';

export function planFor(file: File): FilePlan {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'html', 'htm'].includes(ext)) {
    return { convertTo: GOOGLE_DOC, materialType: 'word', resultLabel: 'Google Docs document', canMakeEditable: false };
  }
  if (['ppt', 'pptx', 'pps', 'ppsx', 'odp'].includes(ext)) {
    return { convertTo: GOOGLE_SLIDES, materialType: 'canva', resultLabel: 'Google Slides presentation', canMakeEditable: false };
  }
  if (['xls', 'xlsx', 'ods', 'csv', 'tsv'].includes(ext)) {
    return { convertTo: GOOGLE_SHEET, materialType: 'other', resultLabel: 'Google Sheets spreadsheet', canMakeEditable: false };
  }
  if (ext === 'pdf' || file.type === 'application/pdf') {
    return { convertTo: null, materialType: 'pdf', resultLabel: 'PDF in Google Drive', canMakeEditable: true };
  }
  if (file.type.startsWith('image/')) {
    return { convertTo: null, materialType: 'other', resultLabel: 'image in Google Drive', canMakeEditable: false };
  }
  return { convertTo: null, materialType: 'other', resultLabel: 'file in Google Drive', canMakeEditable: false };
}

/** "Chapter 5 – summary.pdf" -> "Chapter 5 – summary" */
export function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim().slice(0, 100);
}

export async function driveFetch(token: string, url: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  if (!response.ok) throw await toDriveError(response);
  return response.status === 204 ? null : response.json();
}

async function toDriveError(response: Response): Promise<DriveError> {
  let reason = '';
  let message = '';
  try {
    const body = await response.json();
    reason = body?.error?.errors?.[0]?.reason || body?.error?.status || '';
    message = body?.error?.message || '';
  } catch {
    // Not JSON
  }
  if (response.status === 401) {
    cachedToken = null;
    return new DriveError(t("Your Google permission expired. Tap Upload again."));
  }
  if (reason === 'insufficientPermissions' || reason === 'PERMISSION_DENIED' || /insufficient/i.test(message)) {
    cachedToken = null;
    return new DriveError(t("SchoolHub needs permission to save files in your Google Drive. Tap Upload again and tick the Google Drive box."));
  }
  if (reason === 'accessNotConfigured' || /has not been used|is disabled/i.test(message)) {
    return new DriveError(t("Google Drive uploads are not switched on for SchoolHub yet. Please tell the SchoolHub team."));
  }
  if (reason === 'storageQuotaExceeded') {
    return new DriveError(t("Your Google Drive is full."));
  }
  return new DriveError(message || t("Google Drive error ({0}).", response.status));
}

async function ensureFolder(token: string, uid: string): Promise<string> {
  const storageKey = `schoolhub.driveFolder.${uid}`;
  try {
    const known = window.localStorage.getItem(storageKey);
    if (known) {
      const folder = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${known}?fields=id,trashed`).catch(() => null);
      if (folder && !folder.trashed) return known;
    }
  } catch {
    // localStorage unavailable
  }
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const found = await driveFetch(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`);
  let id: string | undefined = found?.files?.[0]?.id;
  if (!id) {
    const created = await driveFetch(token, 'https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    });
    id = created.id;
  }
  try { window.localStorage.setItem(storageKey, id!); } catch { /* ignore */ }
  return id!;
}

function sendWithProgress(method: string, url: string, headers: Record<string, string>, body: Blob | FormData, onProgress: (fraction: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); }
      } else {
        reject(await toDriveError(new Response(xhr.responseText, { status: xhr.status })));
      }
    };
    xhr.onerror = () => reject(new DriveError(t("The upload stopped. Check your connection and try again.")));
    xhr.send(body);
  });
}

export interface UploadResult {
  url: string;
  fileId: string;
  /** False when the school's Google account does not allow public links. */
  isShared: boolean;
}

export type UploadStage = 'connecting' | 'preparing' | 'uploading' | 'sharing';

/**
 * Uploads one blob into the SchoolHub folder, converting it to `convertTo`
 * (a Google file type) when given. Returns the new file's id and link.
 */
export async function uploadBlob(
  token: string,
  folderId: string,
  blob: Blob,
  options: { name: string; contentType?: string; convertTo?: string | null; onProgress?: (fraction: number) => void }
): Promise<{ id: string; webViewLink?: string }> {
  const metadata: Record<string, unknown> = {
    name: options.name,
    parents: [folderId],
    ...(options.convertTo ? { mimeType: options.convertTo } : {}),
  };
  const fields = 'id,webViewLink';
  const contentType = options.contentType || blob.type || 'application/octet-stream';
  const onProgress = options.onProgress ?? (() => undefined);

  // Resumable upload handles large files; small files fall back to a single
  // multipart request if the session URL is not readable in this browser.
  const start = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=${fields}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': contentType,
      'X-Upload-Content-Length': String(blob.size),
    },
    body: JSON.stringify(metadata),
  });
  if (!start.ok) throw await toDriveError(start);
  const sessionUrl = start.headers.get('Location');

  if (sessionUrl) {
    return sendWithProgress('PUT', sessionUrl, { 'Content-Type': contentType }, blob, onProgress);
  }
  if (blob.size <= MULTIPART_LIMIT) {
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob.type === contentType ? blob : new Blob([blob], { type: contentType }));
    return sendWithProgress('POST', `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=${fields}`, { Authorization: `Bearer ${token}` }, form, onProgress);
  }
  throw new DriveError(t("This browser cannot upload large files to Drive. Try a file under 5 MB, or another browser."));
}

/** Downloads a Google file converted to another format (e.g. a Google Doc as PDF). */
export async function exportDriveFile(token: string, fileId: string, mimeType: string): Promise<Blob> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(mimeType)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw await toDriveError(response);
  return response.blob();
}

/** Removes a file SchoolHub created (used for temporary conversion files). */
export async function deleteDriveFile(token: string, fileId: string): Promise<void> {
  await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${fileId}`, { method: 'DELETE' }).catch(() => undefined);
}

/** Shares the file as "anyone with the link can view" and returns its link. */
export async function shareAndLink(token: string, uploaded: { id: string; webViewLink?: string }): Promise<UploadResult> {
  let isShared = true;
  try {
    await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
  } catch {
    // School-managed accounts often forbid public links.
    isShared = false;
  }
  let url = uploaded.webViewLink;
  if (!url) {
    const info = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${uploaded.id}?fields=webViewLink`);
    url = info.webViewLink;
  }
  return { url: url!, fileId: uploaded.id, isShared };
}

/** Signs in to Drive and finds (or creates) the SchoolHub folder. */
export async function openDrive(): Promise<{ token: string; folderId: string }> {
  guardWrite();
  const user = auth.currentUser;
  if (!user) throw new DriveError(t("Sign in first."));
  const token = await getDriveToken();
  const folderId = await ensureFolder(token, user.uid);
  return { token, folderId };
}

export async function uploadToDrive(
  file: File,
  options: { makeEditable?: boolean; onProgress?: (fraction: number) => void; onStage?: (stage: UploadStage) => void } = {}
): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_BYTES) throw new DriveError(t("This file is larger than 100 MB."));

  options.onStage?.('connecting');
  const { token, folderId } = await openDrive();
  const plan = planFor(file);
  const convertTo = plan.convertTo ?? (options.makeEditable && plan.canMakeEditable ? GOOGLE_DOC : null);

  options.onStage?.('uploading');
  const uploaded = await uploadBlob(token, folderId, file, {
    name: convertTo ? titleFromFileName(file.name) : file.name,
    contentType: file.type || 'application/octet-stream',
    convertTo,
    onProgress: options.onProgress,
  });

  options.onStage?.('sharing');
  const result = await shareAndLink(token, uploaded);
  options.onProgress?.(1);
  return result;
}

/**
 * Embeddable preview URL for Google Docs, Slides, Sheets and Drive files, or
 * null when the link cannot be previewed inside SchoolHub.
 */
export function previewUrlFor(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'docs.google.com') {
      const match = /^\/(document|presentation|spreadsheets)\/d\/([^/]+)/.exec(u.pathname);
      if (match) return `https://docs.google.com/${match[1]}/d/${match[2]}/preview`;
    }
    if (u.hostname === 'drive.google.com') {
      const byPath = /^\/file\/d\/([^/]+)/.exec(u.pathname)?.[1];
      const byQuery = u.searchParams.get('id');
      const id = byPath || byQuery;
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
    }
    if (u.hostname.endsWith('canva.com') && /\/design\//.test(u.pathname)) {
      return url.includes('?embed') ? url : `${u.origin}${u.pathname.replace(/\/(edit|view)\/?$/, '/view')}?embed`;
    }
  } catch {
    // Not a URL
  }
  return null;
}
