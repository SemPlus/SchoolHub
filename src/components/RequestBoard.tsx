import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { addDoc, deleteDoc, setDoc, updateDoc } from '../lib/firestoreWrites';
import { formatDistanceToNow } from '../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import {
  HandHelping, Plus, CheckCircle2, ChevronDown, ExternalLink, Trash2, X, Search, RotateCcw, Lock,
} from 'lucide-react';
import { db } from '../firebase';
import { useAppData } from '../context/AppData';
import type { Material, MaterialRequest, RequestAnswer } from '../types';
import { mapAnswerDoc } from '../lib/mappers';
import { SUBJECTS } from '../lib/subjects';
import { formatClassName } from '../lib/schoolYear';
import { firebaseErrorMessage, recordOpen } from '../lib/engagement';
import { IMPACT_POINTS } from '../lib/stats';
import { cn } from '../lib/utils';
import Dropdown from './Dropdown';

import { t, tc } from '../lib/i18n';
type Scope = 'class' | 'school' | 'all';
type StatusFilter = 'open' | 'fulfilled';

const subjectOptions = [{ value: '', label: 'Any subject' }, ...SUBJECTS.map(s => ({ value: s, label: s }))];

export default function RequestBoard() {
  const { user, profile, requests, materials } = useAppData();
  const [scope, setScope] = useState<Scope>(profile?.classYear ? 'class' : 'all');
  const [status, setStatus] = useState<StatusFilter>('open');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visible = useMemo(() => requests.filter(r => {
    if (status === 'fulfilled' && r.status !== 'fulfilled') return false;
    if (status === 'open') {
      if (r.status === 'fulfilled') return false;
      // Closed requests stay visible to their author so they can reopen them.
      if (r.status === 'closed' && r.authorId !== user?.uid) return false;
    }
    if (scope === 'all') return true;
    if (!profile?.schoolId || r.schoolId !== profile.schoolId) return false;
    if (scope === 'school') return true;
    return r.classYear === profile.classYear && r.classSection === profile.classSection;
  }), [requests, status, scope, user?.uid, profile?.schoolId, profile?.classYear, profile?.classSection]);

  const chip = (value: Scope, label: string, disabled = false) => (
    <button
      key={value}
      disabled={disabled}
      onClick={() => setScope(value)}
      className={cn(
        'px-4 py-2 rounded-full text-[10px] uppercase tracking-widest font-semibold border transition-all disabled:opacity-30',
        scope === value ? 'bg-luxury-gold text-luxury-black border-luxury-gold' : 'border-white/10 text-white/50 hover:text-white'
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-8">
      <div className="glass-panel rounded-[1.5rem] sm:rounded-[1.5rem] p-5 sm:p-8 border-white/5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-serif text-white">{t("Requests")}</h2>
            <p className="text-xs text-white/40 mt-1">
              {t("Ask for what you need, or answer with one of your materials. Each accepted answer is worth ")}{IMPACT_POINTS.acceptedAnswer} {t(" impact.")}</p>
          </div>
          {user && (
            <button
              onClick={() => setIsFormOpen(v => !v)}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-luxury-gold text-luxury-black rounded-full text-[10px] uppercase tracking-widest font-bold hover:scale-105 transition-transform"
            >
              {isFormOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {isFormOpen ? t("Cancel") : t("New request")}
            </button>
          )}
        </div>

        <AnimatePresence>
          {isFormOpen && user && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <NewRequestForm onDone={() => setIsFormOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center gap-2">
          {chip('class', profile?.classYear ? t("My class · {0}", formatClassName(profile.classYear, profile.classSection)) : t("My class"), !profile?.classYear)}
          {chip('school', t("My school"), !profile?.schoolId)}
          {chip('all', t("Everywhere"))}
          <div className="w-px h-6 bg-white/10 mx-1" />
          {(['open', 'fulfilled'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                'px-4 py-2 rounded-full text-[10px] uppercase tracking-widest font-semibold transition-all',
                status === s ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
              )}
            >
              {s === 'open' ? tc('status', 'Open') : t("Fulfilled")}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-20 glass-panel rounded-[1.5rem] border-white/5">
          <HandHelping className="w-14 h-14 text-white/10 mx-auto mb-4" />
          <h3 className="text-xl font-serif text-white/50">{status === 'open' ? t("No open requests here") : t("Nothing fulfilled yet")}</h3>
          <p className="text-white/30 mt-2 text-sm font-light">
            {status === 'open' ? t("Need notes or exercises? Post a request.") : t("Accepted answers show up here.")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map(request => (
            <RequestCard
              key={request.id}
              request={request}
              isExpanded={expandedId === request.id}
              onToggle={() => setExpandedId(expandedId === request.id ? null : request.id)}
              materials={materials}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NewRequestForm({ onDone }: { onDone: () => void }) {
  const { user, profile } = useAppData();
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [subject, setSubject] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || title.trim().length < 3) return;
    setIsSaving(true);
    setError(null);
    const hasClass = !!profile?.classYear && !!profile?.classSection;
    try {
      await addDoc(collection(db, 'requests'), {
        title: title.trim(),
        details: details.trim() || null,
        subject: subject || null,
        authorId: user.uid,
        authorName: user.displayName || 'Student',
        schoolId: profile?.schoolId || null,
        schoolName: profile?.schoolName || null,
        classYear: hasClass ? profile!.classYear : null,
        classSection: hasClass ? profile!.classSection : null,
        className: hasClass ? formatClassName(profile!.classYear, profile!.classSection) : null,
        status: 'open',
        createdAt: serverTimestamp(),
      });
      setTitle('');
      setDetails('');
      setSubject('');
      onDone();
    } catch (err) {
      setError(firebaseErrorMessage(err, t("Could not post your request.")));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("What do you need? e.g. History notes, chapter 5")}
        maxLength={120}
        required
        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-luxury-gold/30"
      />
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder={t("Details (optional): pages, topics, test date…")}
        maxLength={1000}
        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-luxury-gold/30 h-20 resize-none"
      />
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
        <Dropdown options={subjectOptions} value={subject} onChange={setSubject} className="sm:w-60" />
        <p className="text-[10px] text-white/30 flex-1">
          {profile?.classYear ? t("Posted for {0} · {1}", formatClassName(profile.classYear, profile.classSection), profile.schoolName) : t("Posted for everyone")}
        </p>
        <button
          type="submit"
          disabled={isSaving || title.trim().length < 3}
          className="px-6 py-3 bg-white text-luxury-black rounded-full text-[10px] uppercase tracking-widest font-bold disabled:opacity-30"
        >
          {isSaving ? t("Posting…") : t("Post request")}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  );
}

interface RequestCardProps {
  key?: React.Key;
  request: MaterialRequest;
  isExpanded: boolean;
  onToggle: () => void;
  materials: Material[];
}

function RequestCard({ request, isExpanded, onToggle, materials }: RequestCardProps) {
  const { user, userRole, ensureMaterials } = useAppData();
  const [answers, setAnswers] = useState<RequestAnswer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [pickQuery, setPickQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const isRequester = user?.uid === request.authorId;
  const canModerate = isRequester || userRole === 'admin';
  const myAnswer = answers.find(a => a.userId === user?.uid);

  useEffect(() => {
    if (!isExpanded) return;
    const unsubscribe = onSnapshot(collection(db, 'requests', request.id, 'answers'), (snapshot) => {
      const list = snapshot.docs.map(d => mapAnswerDoc(d.id, d.data()));
      list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      setAnswers(list);
    }, (err) => setError(firebaseErrorMessage(err, t("Could not load answers."))));
    return () => unsubscribe();
  }, [isExpanded, request.id]);

  // Answers can point at materials from any school.
  useEffect(() => {
    if (answers.length) ensureMaterials(answers.map(a => a.materialId));
  }, [answers, ensureMaterials]);

  const myMaterials = useMemo(() => {
    if (!user) return [];
    const q = pickQuery.trim().toLowerCase();
    return materials
      .filter(m => m.authorId === user.uid && !m.isDeleted)
      .filter(m => !q || m.title.toLowerCase().includes(q) || (m.subject || '').toLowerCase().includes(q))
      .slice(0, 20);
  }, [materials, user, pickQuery]);

  const materialById = (id: string) => materials.find(m => m.id === id);

  const run = async (action: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(firebaseErrorMessage(err, failure));
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = (material: Material) => run(async () => {
    if (!user) return;
    await setDoc(doc(db, 'requests', request.id, 'answers', user.uid), {
      userId: user.uid,
      userName: user.displayName || 'Student',
      materialId: material.id,
      materialTitle: material.title.slice(0, 200),
      createdAt: serverTimestamp(),
    });
    setIsPicking(false);
    setPickQuery('');
  }, 'Could not send your answer.');

  const withdrawAnswer = () => run(
    () => deleteDoc(doc(db, 'requests', request.id, 'answers', user!.uid)),
    'Could not withdraw your answer.'
  );

  const acceptAnswer = (answer: RequestAnswer) => run(() => updateDoc(doc(db, 'requests', request.id), {
    status: 'fulfilled',
    acceptedAnswerId: answer.id,
    acceptedUserId: answer.userId,
    acceptedUserName: answer.userName,
    acceptedMaterialId: answer.materialId,
    fulfilledAt: serverTimestamp(),
  }), 'Could not accept this answer.');

  const setOpenState = (next: 'open' | 'closed') => run(() => updateDoc(doc(db, 'requests', request.id), {
    status: next,
  }), 'Could not update the request.');

  const deleteRequest = () => {
    if (!confirm(t("Delete this request?"))) return;
    run(() => deleteDoc(doc(db, 'requests', request.id)), 'Could not delete the request.');
  };

  const openMaterialLink = (materialId: string, fallbackTitle: string) => {
    const material = materialById(materialId);
    if (!material || material.isDeleted) {
      return <span className="text-white/30 text-sm">{fallbackTitle} {t(" (removed)")}</span>;
    }
    return (
      <a
        href={material.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => recordOpen(material)}
        className="text-sm text-white hover:text-luxury-gold inline-flex items-center gap-1.5"
      >
        {material.title}
        <ExternalLink className="w-3 h-3" />
      </a>
    );
  };

  return (
    <div className="glass-panel rounded-[1.5rem] sm:rounded-[1.25rem] border-white/5 overflow-hidden">
      <button onClick={onToggle} className="w-full text-left p-5 sm:p-6 flex items-start justify-between gap-4 hover:bg-white/[0.03] transition-colors">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {request.subject && (
              <span className="px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest border border-white/10 bg-white/5 text-white/60">{t(request.subject)}</span>
            )}
            {request.className && (
              <span className="px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest bg-luxury-gold/10 border border-luxury-gold/20 text-luxury-gold truncate max-w-[240px]">
                {request.className}{request.schoolName ? ` · ${request.schoolName}` : ''}
              </span>
            )}
            {request.status === 'closed' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest bg-white/5 border border-white/10 text-white/40">
                <Lock className="w-3 h-3" /> {t(" Closed")}</span>
            )}
            {request.status === 'fulfilled' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest bg-emerald-400/10 border border-emerald-400/30 text-emerald-300">
                <CheckCircle2 className="w-3 h-3" /> {t(" Fulfilled by ")}{request.acceptedUserName}
              </span>
            )}
          </div>
          <h3 className="text-lg font-serif text-white">{request.title}</h3>
          <p className="text-[10px] uppercase tracking-widest text-white/30">
            {request.authorName} · {formatDistanceToNow(request.createdAt, { addSuffix: true })}
          </p>
        </div>
        <ChevronDown className={cn('w-5 h-5 text-white/30 shrink-0 transition-transform mt-1', isExpanded && 'rotate-180')} />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-5 sm:px-6 pb-6 space-y-5 border-t border-white/5 pt-5">
              {request.details && <p className="text-sm text-white/60 whitespace-pre-line">{request.details}</p>}

              {request.status === 'fulfilled' && request.acceptedMaterialId && (
                <div className="p-4 rounded-2xl bg-emerald-400/5 border border-emerald-400/20">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-300 mb-1">{t("Accepted answer")}</p>
                  {openMaterialLink(request.acceptedMaterialId, t("Material"))}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-white/30">
                  {answers.length === 0 ? t("No answers yet") : (answers.length === 1 ? t('1 answer') : t('{0} answers', answers.length))}
                </p>
                {answers.map(answer => (
                  <div key={answer.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="min-w-0">
                      {openMaterialLink(answer.materialId, answer.materialTitle)}
                      <p className="text-[10px] uppercase tracking-widest text-white/30">{t("from ")}{answer.userName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isRequester && request.status === 'open' && answer.userId !== user?.uid && (
                        <button
                          disabled={busy}
                          onClick={() => acceptAnswer(answer)}
                          className="px-3 py-2 rounded-full bg-emerald-400/15 text-emerald-300 text-[9px] uppercase tracking-widest font-bold hover:bg-emerald-400/25 disabled:opacity-40"
                        >
                          {t("Accept")}</button>
                      )}
                      {answer.userId === user?.uid && request.status === 'open' && (
                        <button disabled={busy} onClick={withdrawAnswer} className="text-white/30 hover:text-red-400 p-1" title={t("Withdraw your answer")}>
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {user && !isRequester && request.status === 'open' && !myAnswer && (
                isPicking ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        autoFocus
                        value={pickQuery}
                        onChange={(e) => setPickQuery(e.target.value)}
                        placeholder={t("Pick one of your materials…")}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-white/20 focus:outline-none"
                      />
                    </div>
                    {myMaterials.length === 0 ? (
                      <p className="text-xs text-white/40">{t("You have no matching materials. Add one in My Space first, then answer.")}</p>
                    ) : (
                      <ul className="max-h-56 overflow-y-auto custom-scrollbar rounded-xl border border-white/5 divide-y divide-white/5">
                        {myMaterials.map(m => (
                          <li key={m.id}>
                            <button
                              disabled={busy}
                              onClick={() => submitAnswer(m)}
                              className="w-full text-left px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-luxury-gold disabled:opacity-40"
                            >
                              {m.title}
                              {m.subject && <span className="text-white/30 text-xs"> · {t(m.subject)}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button onClick={() => setIsPicking(false)} className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white">{t("Cancel")}</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsPicking(true)}
                    className="flex items-center gap-2 px-5 py-3 rounded-full bg-white text-luxury-black text-[10px] uppercase tracking-widest font-bold"
                  >
                    <HandHelping className="w-4 h-4" /> {t(" Answer with a material")}</button>
                )
              )}

              {canModerate && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                  {request.status === 'open' && (
                    <button disabled={busy} onClick={() => setOpenState('closed')} className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 text-white/50 hover:text-white text-[9px] uppercase tracking-widest">
                      <Lock className="w-3 h-3" /> {t(" Close without answer")}</button>
                  )}
                  {request.status === 'closed' && (
                    <button disabled={busy} onClick={() => setOpenState('open')} className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 text-white/50 hover:text-white text-[9px] uppercase tracking-widest">
                      <RotateCcw className="w-3 h-3" /> {t(" Reopen")}</button>
                  )}
                  {/* A fulfilled request is part of the helper's record; only an admin removes it. */}
                  {(request.status !== 'fulfilled' || userRole === 'admin') && (
                    <button disabled={busy} onClick={deleteRequest} className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-red-400/10 text-red-400 hover:bg-red-400/20 text-[9px] uppercase tracking-widest">
                      <Trash2 className="w-3 h-3" /> {t(" Delete")}</button>
                  )}
                </div>
              )}

              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
