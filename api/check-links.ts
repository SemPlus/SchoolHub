// Weekly broken-link check, run by Vercel Cron (see vercel.json).
//
// Required Vercel environment variables:
//   CRON_SECRET               any long random string; Vercel sends it as a Bearer token
//   FIREBASE_SERVICE_ACCOUNT  the JSON key of a Firebase service account, on one line
// Optional:
//   FIRESTORE_DATABASE_ID     defaults to the app's AI Studio database
//
// Each run checks the materials whose links were checked longest ago and
// writes linkStatus = 'ok' | 'broken' | 'restricted'. Timeouts and server
// errors are treated as unknown and never flag a link.
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

export const maxDuration = 60;

const DEFAULT_DATABASE_ID = 'ai-studio-0d001ce6-fced-485b-83fd-616a8acdf2d6';
const LINKS_PER_RUN = 150;
const CONCURRENCY = 6;
const TIMEOUT_MS = 8000;
const USER_AGENT = 'Mozilla/5.0 (compatible; SchoolHubLinkCheck/1.0; +https://school-hub-iota.vercel.app)';

type LinkStatus = 'ok' | 'broken' | 'restricted';

// Sign-in pages a private Drive, OneDrive or Canva link redirects to.
const LOGIN_PAGE = /accounts\.google\.com|ServiceLogin|login\.microsoftonline\.com|login\.live\.com|canva\.com\/login/i;

async function request(url: string, method: 'HEAD' | 'GET'): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT, accept: '*/*' },
    });
    // The body is not needed; release the connection.
    await response.body?.cancel().catch(() => undefined);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(url: string): Promise<LinkStatus | null> {
  if (url.startsWith('data:')) return 'ok';
  try {
    let response = await request(url, 'HEAD');
    // Many sites reject HEAD; retry those with GET.
    if ([400, 403, 405, 501].includes(response.status)) response = await request(url, 'GET');

    if (LOGIN_PAGE.test(response.url)) return 'restricted';
    if (response.status === 401 || response.status === 403) return 'restricted';
    if (response.status === 404 || response.status === 410) return 'broken';
    if (response.status >= 200 && response.status < 400) return 'ok';
    return null;
  } catch (error: any) {
    const code = error?.cause?.code;
    // The domain no longer exists.
    if (code === 'ENOTFOUND') return 'broken';
    return null;
  }
}

function getDb() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set.');
  const app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(raw)) });
  return getFirestore(app, process.env.FIRESTORE_DATABASE_ID || DEFAULT_DATABASE_ID);
}

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET is not set.' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const snapshot = await db.collection('materials').select('url', 'isDeleted', 'linkCheckedAt', 'linkStatus').get();

  const due = snapshot.docs
    .filter(d => !d.get('isDeleted') && typeof d.get('url') === 'string')
    .sort((a, b) => {
      const ta = a.get('linkCheckedAt')?.toMillis?.() ?? 0;
      const tb = b.get('linkCheckedAt')?.toMillis?.() ?? 0;
      return ta - tb;
    })
    .slice(0, LINKS_PER_RUN);

  const results: { id: string; status: LinkStatus | null; previous: string | null }[] = [];
  let next = 0;
  async function worker() {
    while (next < due.length) {
      const docSnap = due[next++];
      results.push({
        id: docSnap.id,
        status: await checkUrl(docSnap.get('url')),
        previous: docSnap.get('linkStatus') ?? null,
      });
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Firestore batches hold at most 500 writes.
  for (let i = 0; i < results.length; i += 400) {
    const batch = db.batch();
    for (const result of results.slice(i, i + 400)) {
      const ref = db.collection('materials').doc(result.id);
      batch.update(ref, result.status
        ? { linkStatus: result.status, linkCheckedAt: FieldValue.serverTimestamp() }
        // Unknown: keep the previous status, but move on to other links next run.
        : { linkCheckedAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();
  }

  const count = (status: LinkStatus | null) => results.filter(r => r.status === status).length;
  return Response.json({
    checked: results.length,
    ok: count('ok'),
    broken: count('broken'),
    restricted: count('restricted'),
    unknown: count(null),
  });
}
