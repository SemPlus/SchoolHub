import React, { useEffect, useState } from 'react';
import { BookMarked, Check, Loader2 } from 'lucide-react';
import { booksForClass, bookLabel, Textbook } from '../lib/textbooks';
import { subjectStyle } from '../lib/subjects';
import { cn } from '../lib/utils';

interface TextbookPickerProps {
  schoolId?: string;
  classYear?: number;
  classSection?: string;
  subject?: string;
  isbn: string;
  onChange: (book: { isbn: string; title: string } | null) => void;
}

/**
 * "Which textbook does this go with?" Lists the books the selected class
 * officially uses, the chosen subject's books first.
 */
export default function TextbookPicker({ schoolId, classYear, classSection, subject, isbn, onChange }: TextbookPickerProps) {
  const [books, setBooks] = useState<Textbook[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const label = classYear && classSection ? `${classYear}${classSection}` : '';

  useEffect(() => {
    if (!schoolId || !label) {
      setBooks([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    booksForClass(schoolId, label)
      .then(list => { if (!cancelled) setBooks(list); })
      .catch(() => { if (!cancelled) setBooks([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [schoolId, label]);

  if (!schoolId || !label) return null;
  if (!loading && books.length === 0) return null;

  const forSubject = subject ? books.filter(b => b.subject === subject) : [];
  const others = books.filter(b => !forSubject.includes(b));
  const visible = showAll || forSubject.length === 0 ? [...forSubject, ...others] : forSubject;

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1 flex items-center gap-2">
        <BookMarked className="w-3.5 h-3.5" /> Which textbook does it go with? (optional)
      </p>
      {loading ? (
        <p className="text-xs text-white/40 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading {label}'s books…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {visible.map(book => {
              const active = isbn === book.isbn;
              const color = book.subject ? subjectStyle(book.subject).color : undefined;
              return (
                <button
                  key={book.isbn}
                  type="button"
                  onClick={() => onChange(active ? null : { isbn: book.isbn, title: bookLabel(book) })}
                  className={cn(
                    'max-w-full px-3 py-2 rounded-xl border text-xs text-left flex items-center gap-2 transition-all',
                    active ? 'border-luxury-gold bg-luxury-gold/10 text-white' : 'border-white/10 text-white/60 hover:text-white'
                  )}
                  title={`${book.discipline} · ${book.publisher}`}
                >
                  {color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
                  <span className="truncate">{bookLabel(book)}</span>
                  {active && <Check className="w-3.5 h-3.5 text-luxury-gold shrink-0" />}
                </button>
              );
            })}
          </div>
          {forSubject.length > 0 && others.length > 0 && (
            <button type="button" onClick={() => setShowAll(v => !v)} className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white">
              {showAll ? `Only ${subject} books` : `All ${books.length} books of ${label}`}
            </button>
          )}
          <p className="text-[10px] text-white/25">Every class in Italy using the same book will find it.</p>
        </>
      )}
    </div>
  );
}
