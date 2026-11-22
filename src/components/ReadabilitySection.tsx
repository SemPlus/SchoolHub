import { useReadability, canSpeak, type Readability } from '../lib/readability';
import { t } from '../lib/i18n';

/** Own profile → Readability: options for students with DSA, saved on this device. */
export default function ReadabilitySection() {
  const [value, update] = useReadability();

  const options: { key: keyof Readability; title: string; hint: string; hidden?: boolean }[] = [
    { key: 'font', title: t("High-readability font"), hint: t("Letters that are harder to confuse, such as b and d, I and l.") },
    { key: 'large', title: t("Larger text"), hint: t("Also the small labels.") },
    { key: 'spacing', title: t("More space"), hint: t("Between lines, letters and words.") },
    { key: 'listen', title: t("Listen"), hint: t("A button in each work reads its title and description aloud."), hidden: !canSpeak() },
  ];

  return (
    <div className="p-6 sm:p-10 border-t border-white/5 space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-white/50">{t("Readability")}</p>
        <p className="text-xs text-white/40 mt-1">{t("For students with DSA, and for anyone who reads better this way. Saved on this device.")}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl">
        {options.filter(o => !o.hidden).map(o => (
          <label
            key={o.key}
            className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] cursor-pointer"
          >
            <input
              type="checkbox"
              checked={value[o.key]}
              onChange={e => update({ [o.key]: e.target.checked })}
              className="mt-1 shrink-0"
              style={{ accentColor: '#D4AF37' }}
            />
            <span className="min-w-0">
              <span className="block text-sm text-white">{o.title}</span>
              <span className="block text-[11px] text-white/45">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
