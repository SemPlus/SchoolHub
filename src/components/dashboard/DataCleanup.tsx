import { useEffect, useState } from 'react';
import { collection, getDocsFromServer, query, Timestamp, where, type DocumentReference } from 'firebase/firestore';
import { Eraser } from 'lucide-react';
import { db } from '../../firebase';
import { deleteDoc } from '../../lib/firestoreWrites';
import { weekIndex } from '../../lib/schoolPanel';
import { t } from '../../lib/i18n';

// Retention (legal/01-informativa-privacy.md): activity markers and reports
// are kept 12 months. Without server functions (until February 2027) the
// founder clears them from here; later a scheduled function does it.

const YEAR_MS = 365 * 86_400_000;

interface Stale {
  markers: DocumentReference[];
  reports: DocumentReference[];
  moderation: DocumentReference[];
}

async function findStale(): Promise<Stale> {
  const cutoff = Timestamp.fromMillis(Date.now() - YEAR_MS);
  const [markers, reports, moderation] = await Promise.all([
    getDocsFromServer(query(collection(db, 'activity'), where('week', '<', weekIndex() - 52))),
    getDocsFromServer(query(collection(db, 'reports'), where('createdAt', '<', cutoff))),
    getDocsFromServer(query(collection(db, 'moderation'), where('updatedAt', '<', cutoff))),
  ]);
  // Reports on content still waiting for a decision stay.
  const open = new Set(moderation.docs.filter(d => d.data().status === 'open').map(d => d.id));
  return {
    markers: markers.docs.map(d => d.ref),
    reports: reports.docs.filter(d => !open.has(d.data().targetKey)).map(d => d.ref),
    moderation: moderation.docs.filter(d => d.data().status !== 'open').map(d => d.ref),
  };
}

export default function DataCleanup() {
  const [stale, setStale] = useState<Stale | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => findStale().then(setStale).catch(() => setStale(null));
  useEffect(() => { load(); }, []);

  const total = stale ? stale.markers.length + stale.reports.length + stale.moderation.length : 0;
  if (!stale || (total === 0 && !message)) return null;

  const clean = async () => {
    setBusy(true);
    setMessage(null);
    const refs = [...stale.markers, ...stale.reports, ...stale.moderation];
    const results = await Promise.allSettled(refs.map(ref => deleteDoc(ref)));
    const failed = results.filter(r => r.status === 'rejected').length;
    setMessage(failed ? t("{0} removed, {1} failed", refs.length - failed, failed) : t("{0} removed", refs.length));
    setBusy(false);
    load();
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-white/10 p-4">
      <Eraser className="w-4 h-4 text-white/40 shrink-0" />
      <p className="flex-1 text-xs text-white/60">
        {message || t("Older than 12 months: {0} activity markers, {1} reports, {2} closed moderation records.", stale.markers.length, stale.reports.length, stale.moderation.length)}
      </p>
      {total > 0 && (
        <button
          onClick={clean}
          disabled={busy}
          className="shrink-0 px-4 py-2.5 rounded-full border border-white/15 text-xs text-white/80 hover:text-white disabled:opacity-50"
        >
          {busy ? t("Removing…") : t("Remove old data")}
        </button>
      )}
    </div>
  );
}
