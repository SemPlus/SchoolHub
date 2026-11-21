// Legal pages shown in the app (/legal/<slug>), rendered from the drafts in
// legal/*.md so there is one text only. Company details are filled in here
// once the company exists (February 2027); until then the brackets stay and
// the page says it is a trial version.
import privacy from '../../legal/01-informativa-privacy.md?raw';
import terms from '../../legal/02-termini-di-uso.md?raw';
import cookies from '../../legal/03-cookie.md?raw';
import rules from '../../legal/04-regole-contenuti.md?raw';

/** Version the user accepts at sign-up; raise it when the terms change. */
export const TERMS_VERSION = '1.0';

/** Fill these in when the company exists. Empty = left as "[…]" on the page. */
export const LEGAL_INFO: Record<string, string> = {
  'RAGIONE SOCIALE': '',
  'SEDE LEGALE': '',
  'P.IVA': '',
  'PEC': '',
  'EMAIL PRIVACY': '',
  'EMAIL ASSISTENZA': '',
  'EMAIL LEGALE': '',
  'DATA': '',
  'CITTÀ DELLA SEDE': '',
};

export interface LegalPage {
  slug: string;
  /** English key for t(). */
  title: string;
  source: string;
  file: string;
}

export const LEGAL_PAGES: LegalPage[] = [
  { slug: 'privacy', title: 'Privacy', source: privacy, file: '01-informativa-privacy.md' },
  { slug: 'termini', title: 'Terms of use', source: terms, file: '02-termini-di-uso.md' },
  { slug: 'cookie', title: 'Cookies', source: cookies, file: '03-cookie.md' },
  { slug: 'regole', title: 'Content rules', source: rules, file: '04-regole-contenuti.md' },
];

export const LEGAL_PREFIX = '/legal/';

export function legalPageFor(pathname: string): LegalPage | null {
  if (!pathname.startsWith(LEGAL_PREFIX)) return null;
  const slug = pathname.slice(LEGAL_PREFIX.length).replace(/\/+$/, '');
  return LEGAL_PAGES.find(p => p.slug === slug) || null;
}

/** True while some company details are still missing. */
export function legalInfoMissing(): boolean {
  return Object.values(LEGAL_INFO).some(v => !v);
}

/**
 * The page's Markdown, ready to show: internal notes removed, company
 * details filled in, links between documents pointing at the app's pages.
 */
export function legalMarkdown(page: LegalPage): string {
  let md = page.source;
  // Notes for the lawyer and the sign-up text are not part of the page.
  md = md.replace(/ ?Bozza da far rivedere a un avvocato\./g, '');
  if (page.slug === 'privacy') md = md.replace(/\n---\n\n## Testo breve per l'iscrizione[\s\S]*$/, '\n');
  for (const [key, value] of Object.entries(LEGAL_INFO)) {
    if (value) md = md.split(`[${key}]`).join(value);
  }
  for (const p of LEGAL_PAGES) md = md.split(`](${p.file})`).join(`](${LEGAL_PREFIX}${p.slug})`);
  return md;
}
