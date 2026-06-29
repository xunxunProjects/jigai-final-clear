import type { Question } from '../types';
import { Header } from './Header';
import { QuestionView } from './QuestionView';
import { RichText } from './RichText';
import { ArrowLeft, ChevronRight, Spark } from './icons';

export interface FlashcardItem {
  question: Question;
  subjectName: string;
}

interface FlashcardViewProps {
  items: FlashcardItem[];
  position: number;
  phase: 'study' | 'quiz';
  answers: Record<number, string>;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onFlip: () => void;
  onAnswer: (position: number, label: string, q: Question) => void;
  onNext: () => void;
  onFinish: () => void;
  onExit: () => void;
  favorites: Record<string, boolean>;
  onToggleFavorite: (qid: string) => void;
  shuffleOptions?: boolean;
}

export function FlashcardView({
  items,
  position,
  phase,
  answers,
  theme,
  onToggleTheme,
  onFlip,
  onAnswer,
  onNext,
  onFinish,
  onExit,
  favorites,
  onToggleFavorite,
  shuffleOptions,
}: FlashcardViewProps) {
  const total = items.length;
  const current = items[position];
  const isLast = position >= total - 1;
  const selectedAnswer = answers[position];
  const answered = selectedAnswer !== undefined;

  const progressPct = Math.round(
    ((position + (phase === 'quiz' ? 0.5 : 0)) / total) * 100,
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
            <span className="quiz-heading-name">知识点速览</span>
            <span className="quiz-heading-meta">
              {position + 1} / {total}
            </span>
          </div>
        }
      />

      <div className="progress-bar" aria-hidden="true">
        <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <main className="container quiz">
        {phase === 'study' ? (
          <div className="fc-card">
            <div className="fc-card-label">
              <span className="fc-subject-badge">{current.subjectName}</span>
              <Spark size={14} />
              知识点
            </div>
            <p className="fc-stem-hint">考查：{current.question.stem}</p>
            <p className="fc-knowledge"><RichText text={current.question.knowledgePoint} /></p>
            <button type="button" className="btn btn--primary fc-flip-btn" onClick={onFlip}>
              开始答题
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <div>
            <QuestionView
              key={position}
              question={current.question}
              selected={selectedAnswer}
              context={current.subjectName}
              onSelect={(label) => !answered && onAnswer(position, label, current.question)}
              isFavorite={favorites[current.question.id] ?? false}
              onToggleFavorite={() => onToggleFavorite(current.question.id)}
              shuffleOptions={shuffleOptions}
            />
            {answered && (
              <div className="fc-next">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={isLast ? onFinish : onNext}
                >
                  {isLast ? '完成学习' : '下一个知识点'}
                  {!isLast && <ChevronRight size={18} />}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
