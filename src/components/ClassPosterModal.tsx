import React, { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { Printer, QrCode, Copy, Check } from 'lucide-react';
import Modal from './Modal';
import { joinLinkFor } from '../lib/join';

interface ClassPosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  schoolName: string;
  classLabel: string;
}

/**
 * A printable poster for the classroom wall. Scanning the QR code opens
 * SchoolHub with this school and class already chosen.
 */
export default function ClassPosterModal({ isOpen, onClose, schoolId, schoolName, classLabel }: ClassPosterModalProps) {
  const [copied, setCopied] = useState(false);
  const link = joinLinkFor(schoolId, classLabel);

  const svg = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(link);
    qr.make();
    return qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
  }, [link]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Poster for ${classLabel}`}
      subtitle="Print it and hang it in the classroom"
      icon={<QrCode className="w-5 h-5 text-luxury-gold" />}
      size="md"
      level={3}
      footer={
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-2 py-4 rounded-full bg-white text-luxury-black font-bold">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={copy} className="px-5 py-4 rounded-full bg-white/5 border border-white/10 text-white/70 flex items-center gap-2 text-xs">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      }
    >
      {/* Everything inside .print-area is all that prints (see index.css). */}
      <div className="print-area rounded-3xl bg-white text-black p-8 sm:p-10 text-center space-y-6">
        <p className="text-xs uppercase tracking-[0.4em] text-neutral-500">SchoolHub</p>
        <div>
          <p className="text-6xl sm:text-7xl font-serif">{classLabel}</p>
          <p className="text-base sm:text-lg mt-2 text-neutral-700">{schoolName}</p>
        </div>
        <div className="mx-auto w-56 sm:w-64" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="space-y-1">
          <p className="text-lg font-semibold">Scan to join your class</p>
          <p className="text-sm text-neutral-600">Notes, summaries and past tests shared by your classmates, all in one place.</p>
        </div>
        <p className="text-[10px] text-neutral-400 break-all">{link}</p>
      </div>
    </Modal>
  );
}
