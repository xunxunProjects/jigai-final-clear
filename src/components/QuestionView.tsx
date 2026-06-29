import { useMemo } from 'react';
import type { Question } from '../types';
import { RichText } from './RichText';
import { Bookmark, BookmarkFilled, Check, Close } from './icons';

interface QuestionViewProps {
  question: Question;
  /** The selected option label, if any. */
  selected?: string;
  /** Provide to make the options interactive (practice). Omit for read-only review. */
  onSelect?: (label: string) => void;
  /** Optional context (e.g. subject name) shown next to the number in review decks. */
  context?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  /** When true, options are shuffled in a deterministic order per question. */
  shuffleOptions?: boolean;
}

function strHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    const j = (s >>> 0) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function shuffledOptions<T extends { label: string }>(
  opts: T[],
  questionId: string,
): T[] {
  return seededShuffle(opts, strHash(questionId));
}

const judgeBadge: Record<string, string> = { T: '对', F: '错' };

/** A single question: meta, stem, options, and (once answered) the explanation. */
export function QuestionView({ question, selected, onSelect, context, isFavorite, onToggleFavorite, shuffleOptions }: QuestionViewProps) {
  const answered = selected !== undefined;
  const correct = selected === question.answer;

  const displayOptions = useMemo(
    () =>
      shuffleOptions && question.type !== 'judge'
        ? shuffledOptions(question.options, question.id)
        : question.options,
    [shuffleOptions, question.id, question.options, question.type],
  );

  return (
    <div className="question">
      <div className="question-meta">
        <span className="question-number">第 {question.number} 题</span>
        {context && <span className="question-context">{context}</span>}
        {onToggleFavorite !== undefined && (
          <button
            type="button"
            className={`fav-btn${isFavorite ? ' fav-btn--active' : ''}`}
            onClick={onToggleFavorite}
            aria-label={isFavorite ? '取消收藏' : '收藏此题'}
          >
            {isFavorite ? <BookmarkFilled size={16} /> : <Bookmark size={16} />}
          </button>
        )}
      </div>

      <h2 className="question-stem">
        <RichText text={question.stem} />
      </h2>

      <div className="options">
        {displayOptions.map((opt) => {
          const isAnswer = opt.label === question.answer;
          const isChosen = opt.label === selected;
          let cls = 'option';
          if (answered) {
            if (isAnswer) cls += ' option--correct';
            else if (isChosen) cls += ' option--wrong';
            else cls += ' option--dim';
          }
          return (
            <button
              key={opt.label}
              type="button"
              className={cls}
              disabled={answered || !onSelect}
              onClick={() => onSelect?.(opt.label)}
            >
              <span className="option-badge">
                {question.type === 'judge' ? judgeBadge[opt.label] : opt.label}
              </span>
              <span className="option-text">
                <RichText text={opt.text} />
              </span>
              {answered && isAnswer && (
                <span className="option-icon option-icon--correct">
                  <Check size={18} />
                </span>
              )}
              {answered && isChosen && !isAnswer && (
                <span className="option-icon option-icon--wrong">
                  <Close size={18} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className={`explain ${correct ? 'explain--correct' : 'explain--wrong'}`}>
          <p className="explain-verdict">
            {correct ? (
              <>
                <Check size={16} /> 回答正确
              </>
            ) : (
              <>
                <Close size={16} /> 回答错误 · 正确答案
                {question.type === 'judge' ? '' : ` ${question.answer}`}：
                <RichText text={question.answerText} />
              </>
            )}
          </p>
          {question.explanation && (
            <p className="explain-body">
              <span className="explain-label">解析</span>
              <RichText text={question.explanation} />
            </p>
          )}
        </div>
      )}
    </div>
  );
}
