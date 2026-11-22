import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, MonitorPlay, Crown, History, Search, BarChart3, Flag, BadgeCheck, BookOpenText, ShieldCheck } from 'lucide-react';
import { DEMO_AULA_PATH, DEMO_PANEL_PATH } from '../lib/demo';
import { CONTACT_MAX, CONTACT_ROLES, contactProblem, sendContactRequest, type ContactInput } from '../lib/contactRequests';
import { LEGAL_PAGES } from '../lib/legal';
import { t } from '../lib/i18n';

// The page for schools (/scuole): what SchoolHub does, the demo school and a
// contact form. Written for Italian principals, so in Italian only (like the
// legal pages). No sign-in, none of the app's data loading.

const kicker = 'text-[11px] uppercase tracking-[0.3em] text-luxury-gold';
const card = 'glass-panel rounded-[1.75rem] p-6 sm:p-7 border-white/10 space-y-3 min-w-0';
const field = 'w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-luxury-gold/50';

function Seal({ big = false }: { big?: boolean }) {
  return (
    <span className={`relative ${big ? 'w-12 h-12 text-3xl' : 'w-9 h-9 text-xl'} rounded-full border border-luxury-gold/60 bg-white/5 flex items-center justify-center font-serif italic text-luxury-gold leading-none shrink-0`}>
      <span className="absolute inset-[3px] rounded-full border border-luxury-gold/20" />
      <span className="relative -mt-0.5">S</span>
    </span>
  );
}

function Feature({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className={card}>
      <Icon className="w-5 h-5 text-luxury-gold" />
      <h3 className="font-serif text-2xl text-white leading-snug">{title}</h3>
      <p className="text-sm text-white/60 leading-relaxed">{children}</p>
    </div>
  );
}

export default function SchoolsPage() {
  useEffect(() => {
    document.title = 'SchoolHub per le scuole';
  }, []);

  return (
    <div className="min-h-screen bg-luxury-black text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-8">
        {/* Navigation */}
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-3 py-6 text-[10px] uppercase tracking-widest text-white/45">
          <a href="/" className="flex items-center gap-3 mr-auto normal-case tracking-normal">
            <Seal />
            <span className="font-serif text-xl text-white">SchoolHub</span>
          </a>
          <a href="#come-funziona" className="hover:text-white">Come funziona</a>
          <a href="#dirigenza" className="hover:text-white">Per la dirigenza</a>
          <a href="#privacy" className="hover:text-white">Privacy</a>
          <a href="#contatti" className="hover:text-white">Contatti</a>
        </nav>

        {/* Hero */}
        <header className="py-14 sm:py-24 space-y-8 max-w-4xl">
          <p className={kicker}>Per le scuole superiori</p>
          <h1 className="font-serif text-5xl sm:text-7xl leading-[1.05] text-white">
            L'archivio che la scuola <span className="italic text-luxury-gold">si tramanda</span>.
          </h1>
          <p className="text-lg sm:text-xl text-white/65 font-light leading-relaxed max-w-3xl">
            I lavori migliori degli studenti, pronti da presentare sulla LIM ed ereditati dalle classi degli anni dopo.
            Senza credenziali personali sui computer della scuola.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={DEMO_AULA_PATH} className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-luxury-gold text-luxury-black text-xs font-bold uppercase tracking-widest hover:bg-white">
              Apri l'aula demo <ArrowRight className="w-4 h-4" />
            </a>
            <a href={DEMO_PANEL_PATH} className="flex items-center gap-2 px-6 py-3.5 rounded-full border border-luxury-gold/50 text-luxury-gold text-xs uppercase tracking-widest hover:bg-luxury-gold/10">
              Vedi il pannello della scuola
            </a>
          </div>
        </header>

        {/* The problem */}
        <section className="py-10 sm:py-14 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            ['Lavori persi a fine anno', 'Presentazioni e ricerche finiscono su chiavette, gruppi WhatsApp e cartelle del registro che spariscono a giugno.'],
            ['Minuti persi in aula', 'Trovare il file, entrare con il proprio account sul PC della classe, aprirlo: ogni volta, a ogni ora.'],
            ['Si riparte da zero', 'Ogni classe rifà gli stessi lavori senza vedere i migliori degli anni precedenti.'],
          ].map(([title, text]) => (
            <div key={title} className="space-y-2">
              <h2 className="font-serif text-2xl text-white">{title}</h2>
              <p className="text-sm text-white/55 leading-relaxed">{text}</p>
            </div>
          ))}
        </section>

        {/* How it works */}
        <section id="come-funziona" className="py-14 sm:py-20 border-t border-white/5 space-y-10 scroll-mt-6">
          <div className="space-y-3 max-w-3xl">
            <p className={kicker}>Come funziona</p>
            <h2 className="font-serif text-4xl sm:text-5xl text-white leading-tight">Dalla consegna alla LIM, e all'anno dopo.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <Feature icon={MonitorPlay} title="Un link fisso per ogni aula">
              Si imposta una volta l'anno come pagina iniziale del PC o della LIM. Apre l'archivio della classe senza accesso
              e, con l'orario caricato, la materia dell'ora in corso. Funziona anche sui PC che si azzerano a ogni riavvio.
            </Feature>
            <Feature icon={Crown} title="Lotti: resta il lavoro migliore">
              Il docente apre un lotto su un tema, gli studenti consegnano dal telefono, il docente sceglie il migliore.
              Solo quello resta nell'archivio: un motivo in più per fare ricerche e presentazioni migliori.
            </Feature>
            <Feature icon={History} title="L'eredità delle classi">
              Le quarte di quest'anno partono dai lavori migliori delle quarte degli anni scorsi, sullo stesso tema:
              un modello da cui partire o da cui studiare.
            </Feature>
            <Feature icon={Search} title="Una ricerca in tutto il Paese">
              Un'unica lista: prima la propria classe e i lavori ereditati, poi la propria scuola, poi tutte le altre scuole.
            </Feature>
          </div>
        </section>

        {/* For principals */}
        <section id="dirigenza" className="py-14 sm:py-20 border-t border-white/5 space-y-10 scroll-mt-6">
          <div className="space-y-3 max-w-3xl">
            <p className={kicker}>Per la dirigenza</p>
            <h2 className="font-serif text-4xl sm:text-5xl text-white leading-tight">Tutto sotto controllo, senza lavoro in più.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Feature icon={BarChart3} title="Pannello della scuola">
              Studenti attivi, lavori e lotti per classe e per materia; resoconto annuale da stampare. Solo numeri: nessun dato del singolo studente.
            </Feature>
            <Feature icon={Flag} title="Moderazione">
              Lavori, commenti e richieste si segnalano con un tocco. Dopo tre segnalazioni il contenuto si nasconde da solo finché la scuola non decide.
            </Feature>
            <Feature icon={BadgeCheck} title="Docenti verificati">
              Con l'email della scuola la conferma come docente è automatica. Le altre iscrizioni come docente le conferma la scuola.
            </Feature>
            <Feature icon={BookOpenText} title="Inclusione (DSA)">
              Carattere ad alta leggibilità, testo più grande, più spazio tra le righe e lettura ad alta voce, attivabili da ogni studente.
            </Feature>
          </div>
          <a href={DEMO_PANEL_PATH} className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-luxury-gold hover:text-white">
            Prova il pannello del Liceo Demo <ArrowRight className="w-4 h-4" />
          </a>
        </section>

        {/* Privacy */}
        <section id="privacy" className="py-14 sm:py-20 border-t border-white/5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-8 lg:gap-14 scroll-mt-6">
          <div className="space-y-3">
            <p className={kicker}>Privacy</p>
            <h2 className="font-serif text-4xl sm:text-5xl text-white leading-tight">Pensato per una scuola.</h2>
            <ShieldCheck className="w-8 h-8 text-luxury-gold/70" />
          </div>
          <ul className="space-y-4">
            {[
              'Accordo per il trattamento dei dati (art. 28 GDPR) per le funzioni della scuola, con informativa, termini e registro pronti.',
              'Nessuna pubblicità, nessuna profilazione, nessun uso dei lavori per addestrare intelligenze artificiali.',
              'Le email non sono pubbliche. Il pannello mostra solo numeri per classe e per materia.',
              'I file restano nel Google Drive di chi li carica. Accesso solo con Google, iscrizione dai 14 anni.',
              'Database su Google Cloud a Londra: il Regno Unito è riconosciuto dall’Unione europea come paese con protezione adeguata.',
            ].map(text => (
              <li key={text} className="flex gap-3 text-sm sm:text-base text-white/70 leading-relaxed">
                <Check className="w-4 h-4 mt-1 text-luxury-gold shrink-0" /> {text}
              </li>
            ))}
          </ul>
        </section>

        {/* Price and contact */}
        <section id="contatti" className="py-14 sm:py-20 border-t border-white/5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-8 lg:gap-14 scroll-mt-6">
          <div className="space-y-5">
            <p className={kicker}>Prezzi e contatti</p>
            <h2 className="font-serif text-4xl sm:text-5xl text-white leading-tight">Gratis per gli studenti. Sempre.</h2>
            <p className="text-sm sm:text-base text-white/60 leading-relaxed">
              Studenti e famiglie non pagano mai niente. Le funzioni per la scuola (aule, pannello, moderazione, orario,
              docenti verificati) hanno una licenza annuale: il prezzo è su richiesta e dipende dal numero di studenti.
            </p>
            <p className="text-sm sm:text-base text-white/60 leading-relaxed">
              Scrivici: ti mostriamo SchoolHub e prepariamo con te le aule della tua scuola.
            </p>
          </div>
          <ContactForm />
        </section>

        <footer className="py-10 border-t border-white/5 flex flex-wrap items-center gap-x-6 gap-y-3 text-[10px] uppercase tracking-widest text-white/35">
          <span className="mr-auto">SchoolHub</span>
          {LEGAL_PAGES.map(p => (
            <a key={p.slug} href={`/legal/${p.slug}`} className="hover:text-luxury-gold">{t(p.title)}</a>
          ))}
        </footer>
      </div>
    </div>
  );
}

function ContactForm() {
  const [input, setInput] = useState<ContactInput>({ name: '', role: 'principal', school: '', email: '', message: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<ContactInput>) => setInput(v => ({ ...v, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = contactProblem(input);
    if (problem) { setError(problem); return; }
    setError(null);
    setState('sending');
    try {
      await sendContactRequest(input);
      setState('sent');
    } catch {
      setState('idle');
      setError('Invio non riuscito. Riprova tra qualche minuto.');
    }
  };

  if (state === 'sent') {
    return (
      <div className={`${card} flex flex-col justify-center`}>
        <Check className="w-6 h-6 text-luxury-gold" />
        <p className="font-serif text-3xl text-white">Grazie, richiesta inviata.</p>
        <p className="text-sm text-white/60">Ti scriviamo all'indirizzo {input.email.trim()} per fissare un incontro.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={card} noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-widest text-white/45">Nome e cognome</span>
          <input value={input.name} onChange={e => set({ name: e.target.value })} maxLength={CONTACT_MAX.name} autoComplete="name" className={field} />
        </label>
        <label className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-widest text-white/45">Ruolo</span>
          <select value={input.role} onChange={e => set({ role: e.target.value as ContactInput['role'] })} className={`${field} appearance-none`}>
            {CONTACT_ROLES.map(r => <option key={r.id} value={r.id} className="bg-luxury-black">{r.label}</option>)}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-widest text-white/45">Scuola</span>
          <input value={input.school} onChange={e => set({ school: e.target.value })} maxLength={CONTACT_MAX.school} autoComplete="organization" placeholder="Nome e città" className={field} />
        </label>
        <label className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-widest text-white/45">Email</span>
          <input type="email" value={input.email} onChange={e => set({ email: e.target.value })} maxLength={CONTACT_MAX.email} autoComplete="email" className={field} />
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="text-[10px] uppercase tracking-widest text-white/45">Messaggio (facoltativo)</span>
        <textarea value={input.message} onChange={e => set({ message: e.target.value })} maxLength={CONTACT_MAX.message} rows={4} className={`${field} resize-y`} />
      </label>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button type="submit" disabled={state === 'sending'} className="px-6 py-3.5 rounded-full bg-luxury-gold text-luxury-black text-xs font-bold uppercase tracking-widest hover:bg-white disabled:opacity-50">
          {state === 'sending' ? 'Invio…' : 'Richiedi un incontro'}
        </button>
        <p className="text-[11px] text-white/40">
          Usiamo questi dati solo per risponderti. <a href="/legal/privacy" className="underline underline-offset-2 hover:text-white">Informativa privacy</a>
        </p>
      </div>
    </form>
  );
}
