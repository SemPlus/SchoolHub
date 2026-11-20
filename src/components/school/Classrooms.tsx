import React, { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { Copy, Check, QrCode, Plus } from 'lucide-react';
import { aulaUrl } from '../../lib/aula';
import { sanitizeSection } from '../../lib/schoolYear';
import { formatDistanceToNow, t } from '../../lib/i18n';

/**
 * The classroom links of one school, one per class, to set once a year as the
 * start page of the classroom PC or LIM. Copy, QR, last use, add a class.
 */
export default function Classrooms({ schoolId, classes, visits, busy, onAddClass }: {
  schoolId: string;
  classes: string[];
  visits: Map<string, Date>;
  busy: boolean;
  onAddClass: (label: string) => void;
}) {
  const [newClass, setNewClass] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<string | null>(null);

  const addClass = () => {
    const match = /^([1-5])\s*([A-Za-z]{1,3})$/.exec(newClass.trim());
    if (!match) return;
    onAddClass(`${match[1]}${sanitizeSection(match[2])}`);
    setNewClass('');
  };

  const copy = async (label: string) => {
    try {
      await navigator.clipboard.writeText(aulaUrl(schoolId, label));
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1500);
    } catch { /* clipboard blocked */ }
  };

  return (
    <div className="space-y-3">
      {classes.length === 0 ? (
        <p className="text-xs text-white/40">{t("No class known yet. Add one below.")}</p>
      ) : (
        <div className="divide-y divide-white/5">
          {classes.map(label => {
            const lastUse = visits.get(label);
            return (
              <div key={label} className="py-2.5 space-y-2">
                <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] sm:grid-cols-[3rem_minmax(0,1fr)_8rem_auto] gap-3 items-center">
                  <span className="font-serif text-xl text-white">{label}</span>
                  <a href={aulaUrl(schoolId, label)} target="_blank" rel="noreferrer" className="text-xs text-white/55 hover:text-luxury-gold truncate">
                    {aulaUrl(schoolId, label).replace(/^https?:\/\//, '')}
                  </a>
                  <span className="hidden sm:block text-[11px] text-white/40 text-right">
                    {lastUse ? formatDistanceToNow(lastUse, { addSuffix: true }) : t("never used")}
                  </span>
                  <span className="flex gap-1">
                    <button onClick={() => copy(label)} className="p-2 rounded-full border border-white/10 text-white/60 hover:text-luxury-gold" title={t("Copy link")} aria-label={t("Copy link")}>
                      {copied === label ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setQrFor(qrFor === label ? null : label)} className="p-2 rounded-full border border-white/10 text-white/60 hover:text-luxury-gold" title={t("QR code")} aria-label={t("QR code")}>
                      <QrCode className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </div>
                {qrFor === label && <RoomQr url={aulaUrl(schoolId, label)} />}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={newClass}
          onChange={e => setNewClass(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addClass(); }}
          placeholder={t("Add a class, e.g. 4G")}
          className="w-40 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 outline-none"
        />
        <button onClick={addClass} disabled={busy} className="px-3 py-2 rounded-full border border-white/15 text-white/60 hover:text-white disabled:opacity-40" aria-label={t("Add class")}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function RoomQr({ url }: { url: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 1, scalable: true });
  }, [url]);
  return <div className="w-36 h-36 bg-white rounded-xl p-2 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}
