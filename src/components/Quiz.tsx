import { useEffect, useMemo, useRef, useState } from 'react';
import type { Question } from '../types';
import { Header } from './Header';
import { QuestionView, shuffledOptions } from './QuestionView';
import { ArrowLeft, ChevronLeft, ChevronRight, Close, Grid } from './icons';

interface QuizProps {
  /** Header title — subject name or deck title. */
  title: string;
  /** Questions in display order. */
  questions: Question[];
  /** Selected option labels, indexed by position (undefined = unanswered). */
  answers: (string | undefined)[];
  position: number;
  /** Optional per-question context label (e.g. subject name in mixed decks). */
  contextLabels?: (string | undefined)[];
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSelect: (position: number, label: string) => void;
  onGoTo: (position: number) => void;
  onExit: () => void;
  onShowResults: () => void;
  favorites?: Record<string, boolean>;
  onToggleFavorite?: (qid: string) => void;
  shuffleOptions?: boolean;
}

export function Quiz({
  title,
  questions,
  answers,
  position,
  contextLabels,
  theme,
  onToggleTheme,
  onSelect,
  onGoTo,
  onExit,
  onShowResults,
  favorites,
  onToggleFavorite,
  shuffleOptions,
}: QuizProps) {
  const total = questions.length;
  const question = questions[position];
  const selected = answers[position];
  const answered = selected !== undefined;
  const isLast = position >= total - 1;

  const [navOpen, setNavOpen] = useState(false);
  const currentCellRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (navOpen) currentCellRef.current?.scrollIntoView({ block: 'center' });
  }, [navOpen]);

  const stats = useMemo(() => {
    let done = 0;
    let correct = 0;
    answers.forEach((picked, i) => {
      if (picked !== undefined) {
        done++;
        if (picked === questions[i].answer) correct++;
      }
    });
    return { done, correct };
  }, [answers, questions]);

  const goNext = () => (isLast ? onShowResults() : onGoTo(position + 1));
  const goPrev = () => onGoTo(position - 1);

  // Keyboard shortcuts (desktop): A–E / 1–9 to answer, arrows to navigate.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (navOpen) {
        if (e.key === 'Escape') setNavOpen(false);
        return;
      }
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.key === 'ArrowRight') return goNext();
      if (e.key === 'ArrowLeft') return goPrev();
      if (answered) return;

      const displayOpts =
        shuffleOptions && question.type !== 'judge'
          ? shuffledOptions(question.options, question.id)
          : question.options;

      let optIdx = -1;
      const key = e.key.toUpperCase();
      if (/^[1-9]$/.test(e.key)) optIdx = Number(e.key) - 1;
      else if (/^[A-G]$/.test(key)) {
        // Letter key: find by original label so A always means option A
        const idx = displayOpts.findIndex((o) => o.label === key);
        if (idx >= 0) onSelect(position, key);
        return;
      }

      if (optIdx >= 0 && optIdx < displayOpts.length) {
        onSelect(position, displayOpts[optIdx].label);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const progressPct = total ? Math.round(((position + 1) / total) * 100) : 0;

  const nav = (
    <div className="quiz-nav">
      <button type="button" className="btn btn--ghost" onClick={goPrev} disabled={position === 0}>
        <ChevronLeft size={18} />
        上一题
      </button>
      <button type="button" className="btn btn--primary" onClick={goNext}>
        {isLast ? '查看结果' : '下一题'}
        {!isLast && <ChevronRight size={18} />}
      </button>
    </div>
  );

  return (
    <>
      <Header
        theme={theme}
        onToggleTheme={onToggleTheme}
        left={
          <button type="button" className="icon-btn icon-btn--text" onClick={onExit}>
            <ArrowLeft size={18} />
            <span className="icon-btn-label">返回</span>
          </button>
        }
        center={
          <div className="quiz-heading">
            <span className="quiz-heading-name">{title}</span>
            <span className="quiz-heading-meta">
              第 {position + 1} / {total} 题
            </span>
          </div>
        }
      />

      <div className="progress-bar" aria-hidden="true">
        <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <main className="container quiz">
        <div className="quiz-toolbar">
          <span className="quiz-stat">
            已答 <strong>{stats.done}</strong> · 正确 <strong>{stats.correct}</strong>
          </span>
          <div className="quiz-toolbar-actions">
            <button type="button" className="chip-btn" onClick={() => setNavOpen(true)}>
              <Grid size={16} />
              题号导航
            </button>
            {nav}
          </div>
        </div>

        <QuestionView
          key={position}
          question={question}
          selected={selected}
          context={contextLabels?.[position]}
          onSelect={(label) => onSelect(position, label)}
          isFavorite={favorites?.[question.id] ?? false}
          onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(question.id) : undefined}
          shuffleOptions={shuffleOptions}
        />
      </main>

      {navOpen && (
        <div className="overlay" onClick={() => setNavOpen(false)}>
          <div
            className="nav-panel"
            role="dialog"
            aria-label="题号导航"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="nav-panel-head">
              <h3>题号导航</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setNavOpen(false)}
                aria-label="关闭"
              >
                <Close size={18} />
              </button>
            </div>
            <div className="nav-legend">
              <span><i className="dot dot--correct" />正确</span>
              <span><i className="dot dot--wrong" />错误</span>
              <span><i className="dot dot--current" />当前</span>
              <span><i className="dot" />未答</span>
            </div>
            <div className="nav-grid">
              {questions.map((q, pos) => {
                const picked = answers[pos];
                let cls = 'nav-cell';
                if (pos === position) cls += ' nav-cell--current';
                else if (picked !== undefined) {
                  cls += picked === q.answer ? ' nav-cell--correct' : ' nav-cell--wrong';
                }
                return (
                  <button
                    key={pos}
                    ref={pos === position ? currentCellRef : undefined}
                    type="button"
                    className={cls}
                    onClick={() => {
                      onGoTo(pos);
                      setNavOpen(false);
                    }}
                  >
                    {pos + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
