import React, { useRef, useState } from 'react';
import {
  UploadCloud, FileCheck2, Loader2, AlertTriangle, RefreshCw, Plus, X, ChevronUp, ChevronDown, GripVertical,
  FileText, Image as ImageIcon, Presentation, Sheet, File as FileIcon,
} from 'lucide-react';
import { DriveError, MAX_UPLOAD_BYTES, planFor, titleFromFileName, uploadToDrive, type UploadStage } from '../lib/drive';
import { MAX_MERGE_FILES, TARGET_LABEL, kindOf, mergeTargetFor, uploadMergedToDrive, type FileKind } from '../lib/driveMerge';
import type { MaterialType } from '../types';
import { cn } from '../lib/utils';
import { t } from '../lib/i18n';

export interface UploadedFile {
  url: string;
  title: string;
  materialType: MaterialType;
  isShared: boolean;
}

interface DriveUploaderProps {
  onUploaded: (file: UploadedFile) => void;
  /** Called when the files change, so the form can clear the old link. */
  onReset?: () => void;
}

type Stage = 'idle' | 'ready' | UploadStage | 'done' | 'error';

interface Picked { key: string; file: File }

const ACCEPT = '.pdf,.doc,.docx,.odt,.rtf,.txt,.md,.ppt,.pptx,.pps,.ppsx,.odp,.xls,.xlsx,.ods,.csv,.tsv,image/*';

const KIND_ICON: Record<FileKind, React.ElementType> = {
  image: ImageIcon,
  document: FileText,
  pdf: FileText,
  sheet: Sheet,
  presentation: Presentation,
  unsupported: FileIcon,
};

function sizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

let keySeed = 0;

/**
 * Pick one or more files (or drop them). One file lands in the user's Google
 * Drive as a shareable Google file; several are combined into one file first,
 * in the order the student sets. Designed so that nobody needs to know what
 * Google Drive sharing settings are.
 */
export default function DriveUploader({ onUploaded, onReset }: DriveUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [makeEditable, setMakeEditable] = useState(false);
  const [forcePdf, setForcePdf] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [result, setResult] = useState<UploadedFile | null>(null);

  const files = picked.map(p => p.file);
  const single = files.length === 1 ? files[0] : null;
  const plan = single ? planFor(single) : null;
  const target = files.length > 1 ? mergeTargetFor(files, forcePdf) : null;
  const naturalTarget = files.length > 1 ? mergeTargetFor(files, false) : null;
  const isBusy = stage === 'connecting' || stage === 'preparing' || stage === 'uploading' || stage === 'sharing';
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  const resultLabel = single
    ? (makeEditable && plan?.canMakeEditable ? 'Google Docs document' : plan?.resultLabel ?? '')
    : target ? TARGET_LABEL[target] : '';

  const changed = (next: Picked[]) => {
    setPicked(next);
    setResult(null);
    setError(null);
    setStage(next.length ? 'ready' : 'idle');
    onReset?.();
  };

  const add = (list: FileList | File[] | null | undefined) => {
    const incoming = Array.from(list || []);
    if (!incoming.length) return;
    const unsupported = incoming.filter(f => kindOf(f) === 'unsupported');
    const usable = incoming.filter(f => kindOf(f) !== 'unsupported');
    const next = [...picked, ...usable.map(file => ({ key: `f${keySeed++}`, file }))].slice(0, MAX_MERGE_FILES);
    changed(next);
    const problems: string[] = [];
    if (unsupported.length) problems.push(t("{0} cannot be added. Use PDFs, photos, Word, PowerPoint or Excel files.", unsupported.map(f => f.name).join(', ')));
    if (picked.length + usable.length > MAX_MERGE_FILES) problems.push(t("You can combine up to {0} files at a time.", MAX_MERGE_FILES));
    if (problems.length) setError(problems.join(' '));
  };

  const remove = (key: string) => changed(picked.filter(p => p.key !== key));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= picked.length || from === to) return;
    const next = [...picked];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    changed(next);
  };

  const start = async () => {
    if (!files.length) return;
    setError(null);
    setProgress(0);
    setStep(null);
    try {
      let done: UploadedFile;
      if (single) {
        const uploaded = await uploadToDrive(single, { makeEditable, onProgress: setProgress, onStage: setStage });
        done = {
          url: uploaded.url,
          title: titleFromFileName(single.name),
          materialType: makeEditable && plan?.canMakeEditable ? 'word' : plan!.materialType,
          isShared: uploaded.isShared,
        };
      } else {
        const merged = await uploadMergedToDrive(files, {
          forcePdf,
          onProgress: (p) => {
            setStage(p.stage);
            if (p.current && p.total) setStep({ current: p.current, total: p.total });
            if (p.fraction !== undefined) setProgress(p.fraction);
          },
        });
        done = { url: merged.url, title: titleFromFileName(files[0].name), materialType: merged.materialType, isShared: merged.isShared };
      }
      setResult(done);
      setStage('done');
      onUploaded(done);
    } catch (err) {
      setStage('error');
      setError(err instanceof DriveError ? err.message : t("Something went wrong while uploading. Please try again."));
    }
  };

  const stageText: Record<string, string> = {
    connecting: t('Connecting to your Google Drive…'),
    preparing: step ? t('Combining file {0} of {1}…', step.current, step.total) : t('Combining your files…'),
    uploading: t('Uploading… {0}%', Math.round(progress * 100)),
    sharing: single && plan?.convertTo ? t('Turning it into a {0}…', t(plan.resultLabel)) : t('Making the link shareable…'),
  };

  const barWidth = stage === 'connecting' ? 5
    : stage === 'preparing' ? Math.max(5, ((step?.current ?? 1) - 1) / (step?.total ?? 1) * 60)
    : stage === 'uploading' ? (single ? Math.max(5, progress * 100) : 60 + progress * 38)
    : 100;

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept={ACCEPT}
      className="hidden"
      onChange={(e) => { add(e.target.files); e.target.value = ''; }}
    />
  );

  if (stage === 'idle') {
    return (
      <div className="space-y-3">
        {fileInput}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); add(e.dataTransfer.files); }}
          className={cn(
            'w-full flex flex-col items-center justify-center gap-3 rounded-[1.5rem] border-2 border-dashed px-6 py-8 transition-all',
            isDragging ? 'border-luxury-gold bg-luxury-gold/10' : 'border-white/15 bg-white/[0.03] hover:border-luxury-gold/60 hover:bg-white/[0.05]'
          )}
        >
          <div className="w-14 h-14 rounded-2xl bg-luxury-gold/15 flex items-center justify-center">
            <UploadCloud className="w-7 h-7 text-luxury-gold" />
          </div>
          <div className="text-center">
            <p className="text-base text-white font-medium">{t("Upload one or more files")}</p>
            <p className="text-xs text-white/40 mt-1">{t("PDF, Word, PowerPoint, Excel or photos · several files become one file in your Google Drive")}</p>
          </div>
        </button>
        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>
    );
  }

  const editable = stage === 'ready' || stage === 'error';

  return (
    <div className="space-y-3">
      {fileInput}
      <div
        className={cn('rounded-[1.5rem] border bg-white/[0.03] p-3 sm:p-4 space-y-3 transition-colors', isDragging ? 'border-luxury-gold' : 'border-white/10')}
        onDragOver={(e) => { if (editable && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setIsDragging(true); } }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { if (editable && e.dataTransfer.files?.length) { e.preventDefault(); setIsDragging(false); add(e.dataTransfer.files); } }}
      >
        {/* Status line */}
        <div className="flex items-center gap-3 px-1">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', stage === 'done' ? 'bg-emerald-400/15' : stage === 'error' ? 'bg-red-400/15' : 'bg-luxury-gold/15')}>
            {stage === 'done' ? <FileCheck2 className="w-5 h-5 text-emerald-300" />
              : stage === 'error' ? <AlertTriangle className="w-5 h-5 text-red-300" />
              : isBusy ? <Loader2 className="w-5 h-5 text-luxury-gold animate-spin" />
              : <UploadCloud className="w-5 h-5 text-luxury-gold" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white">
              {files.length === 1 ? t('1 file') : t('{0} files', files.length)}
              <span className="text-white/35"> · {sizeLabel(totalSize)}</span>
            </p>
            <p className="text-[11px] text-white/45">
              {stage === 'done'
                ? (single ? t("Ready: saved as a {0}", t(resultLabel)) : t("Ready: combined into one {0}", t(resultLabel)))
                : isBusy ? stageText[stage]
                : single ? t("Will be saved as a {0}", t(resultLabel))
                : t("Will become one {0}", t(resultLabel))}
            </p>
          </div>
          {stage === 'done' && (
            <button type="button" onClick={() => { setStage('ready'); setResult(null); onReset?.(); }} className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white flex items-center gap-1 shrink-0">
              <RefreshCw className="w-3 h-3" /> {t("Change")}
            </button>
          )}
        </div>

        {isBusy && (
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-luxury-gold transition-all duration-300" style={{ width: `${barWidth}%` }} />
          </div>
        )}

        {/* File list */}
        {stage !== 'done' && (
          <ol className="space-y-1.5">
            {picked.map((p, index) => {
              const Icon = KIND_ICON[kindOf(p.file)];
              return (
                <li
                  key={p.key}
                  draggable={editable && picked.length > 1}
                  onDragStart={(e) => { setDragKey(p.key); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragOver={(e) => {
                    if (!dragKey || dragKey === p.key) return;
                    e.preventDefault();
                    move(picked.findIndex(x => x.key === dragKey), index);
                  }}
                  onDragEnd={() => setDragKey(null)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/5 pl-1.5 pr-1 py-1.5',
                    dragKey === p.key && 'opacity-50 border-luxury-gold/50'
                  )}
                >
                  {picked.length > 1 && (
                    <span className="hidden sm:flex w-5 justify-center text-white/25 cursor-grab active:cursor-grabbing" aria-hidden>
                      <GripVertical className="w-4 h-4" />
                    </span>
                  )}
                  {picked.length > 1 && <span className="w-5 text-center text-[10px] text-white/35 tabular-nums shrink-0">{index + 1}</span>}
                  <Icon className="w-4 h-4 text-luxury-gold/80 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white truncate">{p.file.name}</p>
                    <p className="text-[10px] text-white/30">{sizeLabel(p.file.size)}</p>
                  </div>
                  {editable && (
                    <div className="flex items-center shrink-0">
                      {picked.length > 1 && (
                        <>
                          <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} aria-label={t("Move up")} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent">
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => move(index, index + 1)} disabled={index === picked.length - 1} aria-label={t("Move down")} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent">
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button type="button" onClick={() => remove(p.key)} aria-label={t("Remove")} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-red-300 hover:bg-red-400/10">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {editable && (
          <>
            {picked.length < MAX_MERGE_FILES && (
              <button type="button" onClick={() => inputRef.current?.click()} className="w-full py-2.5 rounded-xl border border-dashed border-white/15 text-xs text-white/55 hover:text-white hover:border-luxury-gold/50 flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> {t("Add more files")}
              </button>
            )}

            {single && plan?.canMakeEditable && (
              <label className="flex items-start gap-3 text-xs text-white/60 cursor-pointer select-none px-1">
                <input type="checkbox" checked={makeEditable} onChange={(e) => setMakeEditable(e.target.checked)} className="mt-0.5 accent-[#D4AF37] w-4 h-4" />
                <span>{t("Make it an editable Google Doc. Only the text is kept; pictures and layout may be lost.")}</span>
              </label>
            )}

            {files.length > 1 && naturalTarget !== 'pdf' && (
              <label className="flex items-start gap-3 text-xs text-white/60 cursor-pointer select-none px-1">
                <input type="checkbox" checked={forcePdf} onChange={(e) => setForcePdf(e.target.checked)} className="mt-0.5 accent-[#D4AF37] w-4 h-4" />
                <span>{t("Make it one PDF instead. Keeps the look of every page, but it cannot be edited.")}</span>
              </label>
            )}

            {files.length > 1 && (
              <p className="text-[10px] text-white/35 px-1">
                {target === 'slides' ? t("Each photo becomes one slide, in this order.")
                  : target === 'doc' ? t("Each file starts on a new page, in this order.")
                  : t("All pages are joined into one PDF, in this order.")}
                <span className="hidden sm:inline"> {t("Drag to reorder.")}</span>
              </p>
            )}

            {error && <p className="text-xs text-red-300 px-1">{error}</p>}

            <button
              type="button"
              onClick={start}
              disabled={!files.length || totalSize > MAX_UPLOAD_BYTES}
              className="w-full py-4 rounded-full bg-luxury-gold text-luxury-black text-sm font-bold tracking-wide disabled:opacity-40"
            >
              {stage === 'error' ? t("Try again") : files.length > 1 ? t("Combine and upload") : t("Upload")}
            </button>
            {totalSize > MAX_UPLOAD_BYTES && <p className="text-xs text-red-300 text-center">{t("Together these files are larger than 100 MB.")}</p>}
            <p className="text-[10px] text-white/30 text-center">{t("The first time, Google asks you to allow SchoolHub to save files in your Drive.")}</p>
          </>
        )}

        {stage === 'done' && result && !result.isShared && (
          <p className="text-xs text-amber-300 px-1">
            {t("Your school's Google account does not allow public links, so classmates may need to ask you for access in Drive.")}
          </p>
        )}
      </div>
    </div>
  );
}
