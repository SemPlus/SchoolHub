import { useEffect, useState } from 'react';
import { Mail, Trash2 } from 'lucide-react';
import { CONTACT_ROLES, deleteContactRequest, loadContactRequests, type ContactRequest } from '../../lib/contactRequests';
import { format, t } from '../../lib/i18n';

/** Founder dashboard: requests from the page for schools (/scuole). */
export default function ContactRequests() {
  const [items, setItems] = useState<ContactRequest[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => loadContactRequests().then(setItems).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  if (!items || items.length === 0) return null;

  const remove = async (item: ContactRequest) => {
    if (!window.confirm(t("Delete the request from {0}?", item.name))) return;
    setBusy(item.id);
    try {
      await deleteContactRequest(item.id);
      setItems(list => (list || []).filter(x => x.id !== item.id));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-luxury-gold/25 p-4 space-y-3">
      <p className="text-[10px] uppercase tracking-widest text-luxury-gold flex items-center gap-2">
        <Mail className="w-3.5 h-3.5" /> {t("Requests from schools")} · {items.length}
      </p>
      <ul className="divide-y divide-white/5">
        {items.map(item => (
          <li key={item.id} className="py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm text-white">
                {item.name}
                <span className="text-white/45"> · {CONTACT_ROLES.find(r => r.id === item.role)?.label} · {item.school}</span>
              </p>
              <a href={`mailto:${item.email}`} className="text-xs text-luxury-gold/80 hover:text-luxury-gold break-all">{item.email}</a>
              {item.message && <p className="text-xs text-white/60 whitespace-pre-line">{item.message}</p>}
              {item.createdAt && <p className="text-[10px] text-white/30">{format(item.createdAt, 'd MMM yyyy, HH:mm')}</p>}
            </div>
            <button
              onClick={() => remove(item)}
              disabled={busy === item.id}
              aria-label={t("Delete")}
              className="shrink-0 p-2 rounded-full border border-white/10 text-white/40 hover:text-red-300 disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
