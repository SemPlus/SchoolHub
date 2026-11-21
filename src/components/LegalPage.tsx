import { useEffect, useMemo } from 'react';
import { marked } from 'marked';
import { LEGAL_PAGES, legalInfoMissing, legalMarkdown, type LegalPage as Page } from '../lib/legal';
import { t } from '../lib/i18n';

/**
 * A legal page (/legal/privacy, /legal/termini, /legal/cookie,
 * /legal/regole): readable without signing in and without loading the app's data.
 */
export default function LegalPage({ page }: { page: Page }) {
  // Our own text from legal/*.md, so rendering it as HTML is safe.
  const html = useMemo(() => marked.parse(legalMarkdown(page), { async: false }) as string, [page]);

  useEffect(() => {
    document.title = `${t(page.title)} · SchoolHub`;
  }, [page]);

  return (
    <div className="min-h-screen bg-luxury-black text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10 sm:py-16 space-y-8">
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-widest text-white/40">
          <a href="/" className="font-serif normal-case tracking-normal text-lg text-white hover:text-luxury-gold mr-2">SchoolHub</a>
          {LEGAL_PAGES.map(p => (
            <a key={p.slug} href={`/legal/${p.slug}`} className={p.slug === page.slug ? 'text-luxury-gold' : 'hover:text-white'}>
              {t(p.title)}
            </a>
          ))}
        </nav>
        {legalInfoMissing() && (
          <p className="text-xs text-amber-200/80 border border-amber-200/20 rounded-2xl px-4 py-3">
            {t("Trial version: SchoolHub's company details are added when the company is founded.")}
          </p>
        )}
        <article className="legal-text" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
