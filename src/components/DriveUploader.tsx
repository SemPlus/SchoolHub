import React, { useRef, useState } from 'react';
import { UploadCloud, FileCheck2, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { DriveError, hasDriveToken, MAX_UPLOAD_BYTES, planFor, titleFromFileName, uploadToDrive } from '../lib/drive';
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
  /** Called when the user picks another file, so the form can clear the old link. */
  onReset?: () => void;
}

type Stage = 'idle' | 'ready' | 'connecting' | 'uploading' | 'sharing' | 'done' | 'error';

const ACCEPT = '.pdf,.doc,.docx,.odt,.rtf,.txt,.ppt,.pptx,.pps,.ppsx,.odp,.xls,.xlsx,.ods,.csv,image/*';

/**
 * One big button: pick a file (or drop it), and it lands in the user's Google
 * Drive as a shareable Google file. Designed so that nobody needs to know
 * what Google Drive sharing settings are.
 */
export default function DriveUploader({ onUploaded, onReset }: DriveUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [makeEditable, setMakeEditable] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<UploadedFile | null>(null);

  const plan = file ? planFor(file) : null;
  const isBusy = stage === 'connecting' || stage === 'uploading' || stage === 'sharing';

  const start = async (chosen: File) => {
    setError(null);
    setProgress(0);
    try {
      const uploaded = await uploadToDrive(chosen, {
        makeEditable,
        onProgress: setProgress,
        onStage: setStage,
      });
      const p = planFor(chosen);
      const done: UploadedFile = {
        url: uploaded.url,
        title: titleFromFileName(chosen.name),
        materialType: makeEditable && p.canMakeEditable ? 'word' : p.materialType,
        isShared: uploaded.isShared,
      };
      setResult(done);
      setStage('done');
      onUploaded(done);
    } catch (err) {
      setStage('error');
      setError(err instanceof DriveError ? err.message : t("Something went wrong while uploading. Please try again."));
    }
  };

  const choose = (chosen: File | undefined) => {
    if (!chosen) return;
    onReset?.();
    setResult(null);
    if (chosen.size > MAX_UPLOAD_BYTES) {
      setFile(null);
      setStage('error');
      setError(t("This file is larger than 100 MB."));
      return;
    }
    setFile(chosen);
    setStage('ready');
    setError(null);
    // With permission already granted, start straight away. The first time,
    // the Upload button opens Google's permission window from a click.
    if (hasDriveToken() && !planFor(chosen).canMakeEditable) start(chosen);
  };

  const stageText = {
    connecting: t('Connecting to your Google Drive…'),
    uploading: t('Uploading… {0}%', Math.round(progress * 100)),
    sharing: plan?.convertTo ? t('Turning it into a {0}…', t(plan.resultLabel)) : t('Making the link shareable…'),
  } as Record<string, string>;

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }}
      />

      {stage === 'idle' || (stage === 'error' && !file) ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); choose(e.dataTransfer.files?.[0]); }}
          className={cn(
            'w-full flex flex-col items-center justify-center gap-3 rounded-[1.5rem] border-2 border-dashed px-6 py-8 transition-all',
            isDragging ? 'border-luxury-gold bg-luxury-gold/10' : 'border-white/15 bg-white/[0.03] hover:border-luxury-gold/60 hover:bg-white/[0.05]'
          )}
        >
          <div className="w-14 h-14 rounded-2xl bg-luxury-gold/15 flex items-center justify-center">
            <UploadCloud className="w-7 h-7 text-luxury-gold" />
          </div>
          <div className="text-center">
            <p className="text-base text-white font-medium">{t("Upload a file")}</p>
            <p className="text-xs text-white/40 mt-1">{t("PDF, Word, PowerPoint, Excel or a photo · saved to your Google Drive")}</p>
          </div>
        </button>
      ) : (
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', stage === 'done' ? 'bg-emerald-400/15' : stage === 'error' ? 'bg-red-400/15' : 'bg-luxury-gold/15')}>
              {stage === 'done' ? <FileCheck2 className="w-5 h-5 text-emerald-300" />
                : stage === 'error' ? <AlertTriangle className="w-5 h-5 text-red-300" />
                : isBusy ? <Loader2 className="w-5 h-5 text-luxury-gold animate-spin" />
                : <UploadCloud className="w-5 h-5 text-luxury-gold" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white truncate">{file?.name}</p>
              <p className="text-[11px] text-white/45">
                {stage === 'done' ? t("Ready: saved as a {0}", t(plan?.resultLabel ?? '')) : isBusy ? stageText[stage] : t("Will be saved as a {0}", t(makeEditable && plan?.canMakeEditable ? 'Google Docs document' : plan?.resultLabel ?? ''))}
              </p>
            </div>
            {!isBusy && (
              <button type="button" onClick={() => inputRef.current?.click()} className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white flex items-center gap-1 shrink-0">
                <RefreshCw className="w-3 h-3" /> {t(" Change")}</button>
            )}
          </div>

          {isBusy && (
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-luxury-gold transition-all duration-300"
                style={{ width: `${stage === 'connecting' ? 5 : stage === 'sharing' ? 100 : Math.max(5, progress * 100)}%` }}
              />
            </div>
          )}

          {stage === 'ready' && (
            <>
              {plan?.canMakeEditable && (
                <label className="flex items-start gap-3 text-xs text-white/60 cursor-pointer select-none">
                  <input type="checkbox" checked={makeEditable} onChange={(e) => setMakeEditable(e.target.checked)} className="mt-0.5 accent-[#D4AF37] w-4 h-4" />
                  <span>{t("Make it an editable Google Doc. Only the text is kept; pictures and layout may be lost.")}</span>
                </label>
              )}
              <button
                type="button"
                onClick={() => file && start(file)}
                className="w-full py-4 rounded-full bg-luxury-gold text-luxury-black text-sm font-bold tracking-wide"
              >
                {t("Upload")}</button>
              <p className="text-[10px] text-white/30 text-center">{t("The first time, Google asks you to allow SchoolHub to save files in your Drive.")}</p>
            </>
          )}

          {stage === 'error' && (
            <div className="space-y-3">
              <p className="text-xs text-red-300">{error}</p>
              {file && (
                <button type="button" onClick={() => start(file)} className="w-full py-3 rounded-full bg-white text-luxury-black text-sm font-bold">
                  {t("Try again")}</button>
              )}
            </div>
          )}

          {stage === 'done' && result && !result.isShared && (
            <p className="text-xs text-amber-300">
              {t("Your school's Google account does not allow public links, so classmates may need to ask you for access in Drive.")}</p>
          )}
        </div>
      )}
      {stage === 'error' && !file && error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
