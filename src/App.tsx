import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { subjects, subjectMap } from './data/questions';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { DeckItem, DeckSession, FlashcardSession, HistoryEntry, Question, Session } from './types';
import { Home } from './components/Home';
import { Quiz } from './components/Quiz';
import { Results } from './components/Results';
import { Toast } from './components/Toast';
import { FlashcardView } from './components/Flashcard';
import { BottomNav } from './components/BottomNav';
import { Settings } from './components/Settings';

type View = 'home' | 'settings' | 'quiz' | 'results' | 'flashcard';
type Theme = 'light' | 'dark';
type ActiveKind = 'subject' | 'deck';
export type RestartMode = 'all' | 'shuffle' | 'wrong';
export type DeckKind = 'today' | 'all' | 'wrong' | 'favorites';

type SessionMap = Record<string, Session>;
type History = Record<string, HistoryEntry>;
type Favorites = Record<string, boolean>;
interface Settings {
  dailyGoal: number;
  flashcardCount: number;
}
type Activity = Record<string, number>;

const DECK_TITLES: Record<DeckKind, string> = {
  today: '今日回顾',
  all: '重做做过的题',
  wrong: '重做错题',
  favorites: '收藏题目',
};

function todayKey(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeSession(count: number, mode: 'all' | 'shuffle', subset?: number[]): Session {
  const seq = subset ?? Array.from({ length: count }, (_, i) => i);
  return {
    order: mode === 'shuffle' ? shuffle(seq) : seq,
    position: 0,
    answers: {},
  };
}

/** Parse a question id ("anatomy-15") back into a subject + index. */
function parseQid(qid: string): { subjectId: string; qIndex: number } | null {
  const dash = qid.lastIndexOf('-');
  if (dash < 0) return null;
  return { subjectId: qid.slice(0, dash), qIndex: Number(qid.slice(dash + 1)) };
}

/** Build a list of deck items from the answer history, filtered by kind. */
function deckItemsFromHistory(history: History, kind: Exclude<DeckKind, 'favorites'>): DeckItem[] {
  const today = todayKey();
  const items: DeckItem[] = [];
  for (const [qid, h] of Object.entries(history)) {
    const ref = parseQid(qid);
    if (!ref) continue;
    const subject = subjectMap[ref.subjectId];
    const q = subject?.questions[ref.qIndex];
    if (!q) continue;
    if (kind === 'today' && h.d !== today) continue;
    if (kind === 'wrong' && h.pick === q.answer) continue;
    items.push({ subjectId: ref.subjectId, qIndex: ref.qIndex });
  }
  return items;
}

export default function App() {
  const initialTheme =
    (document.documentElement.getAttribute('data-theme') as Theme) || 'light';
  const [theme, setTheme] = useLocalStorage<Theme>('quiz.theme', initialTheme);
  const [sessions, setSessions] = useLocalStorage<SessionMap>('quiz.sessions.v2', {});
  const [settings, setSettings] = useLocalStorage<Settings>('quiz.settings.v1', {
    dailyGoal: 20,
    flashcardCount: 20,
  });
  const [activity, setActivity] = useLocalStorage<Activity>('quiz.activity.v1', {});
  const [history, setHistory] = useLocalStorage<History>('quiz.history.v1', {});
  const [deck, setDeck] = useLocalStorage<DeckSession | null>('quiz.deck.v1', null);
  const [favorites, setFavorites] = useLocalStorage<Favorites>('quiz.favorites.v1', {});
  const [flashcard, setFlashcard] = useLocalStorage<FlashcardSession | null>('quiz.flashcard.v1', null);

  const [view, setView] = useState<View>('home');
  const [activeKind, setActiveKind] = useState<ActiveKind>('subject');
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    [setTheme],
  );

  // Record any answer into the cumulative history + daily activity.
  const recordAnswer = useCallback(
    (q: Question, label: string) => {
      const d = todayKey();
      setHistory((prev) => ({ ...prev, [q.id]: { d, pick: label } }));
      setActivity((prev) => ({ ...prev, [d]: (prev[d] || 0) + 1 }));
    },
    [setHistory, setActivity],
  );

  // ---- Subject practice ------------------------------------------------
  const openSubject = useCallback(
    (id: string) => {
      const subject = subjectMap[id];
      if (!subject) return;
      setSessions((prev) =>
        prev[id] ? prev : { ...prev, [id]: makeSession(subject.questions.length, 'all') },
      );
      setActiveKind('subject');
      setActiveId(id);
      setView('quiz');
    },
    [setSessions],
  );

  // ---- Review decks ----------------------------------------------------
  const startDeck = useCallback(
    (kind: DeckKind) => {
      let items: DeckItem[];
      if (kind === 'favorites') {
        items = Object.entries(favorites)
          .filter(([, fav]) => fav)
          .map(([qid]) => parseQid(qid))
          .filter((x): x is DeckItem => x !== null);
      } else {
        items = deckItemsFromHistory(history, kind);
      }
      items = shuffle(items);
      if (!items.length) return;
      setDeck({ title: DECK_TITLES[kind], items, position: 0, answers: {} });
      setActiveKind('deck');
      setView('quiz');
    },
    [favorites, history, setDeck],
  );

  const goHome = useCallback(() => {
    setView('home');
    setActiveId(null);
  }, []);

  // ---- Unified handlers (dispatch on the active kind) ------------------
  const handleSelect = useCallback(
    (position: number, label: string) => {
      if (activeKind === 'subject') {
        if (!activeId) return;
        const s = sessions[activeId];
        const subject = subjectMap[activeId];
        if (!s || !subject) return;
        const qIdx = s.order[position];
        if (s.answers[qIdx] !== undefined) return; // locked
        setSessions((prev) => ({
          ...prev,
          [activeId]: { ...prev[activeId], answers: { ...prev[activeId].answers, [qIdx]: label } },
        }));
        recordAnswer(subject.questions[qIdx], label);
      } else if (deck) {
        if (deck.answers[position] !== undefined) return;
        const item = deck.items[position];
        const q = subjectMap[item.subjectId]?.questions[item.qIndex];
        if (!q) return;
        setDeck((prev) =>
          prev ? { ...prev, answers: { ...prev.answers, [position]: label } } : prev,
        );
        recordAnswer(q, label);
      }
    },
    [activeKind, activeId, sessions, deck, setSessions, setDeck, recordAnswer],
  );

  const handleGoTo = useCallback(
    (position: number) => {
      if (activeKind === 'subject') {
        if (!activeId) return;
        setSessions((prev) => {
          const s = prev[activeId];
          if (!s) return prev;
          const clamped = Math.max(0, Math.min(position, s.order.length - 1));
          return { ...prev, [activeId]: { ...s, position: clamped } };
        });
      } else {
        setDeck((prev) => {
          if (!prev) return prev;
          const clamped = Math.max(0, Math.min(position, prev.items.length - 1));
          return { ...prev, position: clamped };
        });
      }
    },
    [activeKind, activeId, setSessions, setDeck],
  );

  const handleRestart = useCallback(
    (mode: RestartMode) => {
      if (activeKind === 'subject') {
        const subject = activeId ? subjectMap[activeId] : null;
        if (!activeId || !subject) return;
        const count = subject.questions.length;
        if (mode === 'wrong') {
          const current = sessions[activeId];
          const wrong = current
            ? current.order.filter((idx) => {
                const picked = current.answers[idx];
                return picked !== undefined && picked !== subject.questions[idx].answer;
              })
            : [];
          const subset = wrong.length ? wrong : current?.order.slice();
          setSessions((prev) => ({ ...prev, [activeId]: makeSession(count, 'shuffle', subset) }));
        } else {
          setSessions((prev) => ({
            ...prev,
            [activeId]: makeSession(count, mode === 'shuffle' ? 'shuffle' : 'all'),
          }));
        }
      } else if (deck) {
        let items = deck.items;
        if (mode === 'wrong') {
          const wrong = deck.items.filter((it, pos) => {
            const picked = deck.answers[pos];
            const q = subjectMap[it.subjectId]?.questions[it.qIndex];
            return picked !== undefined && q && picked !== q.answer;
          });
          if (wrong.length) items = wrong;
        }
        setDeck({ ...deck, items: shuffle(items), position: 0, answers: {} });
      }
      setView('quiz');
    },
    [activeKind, activeId, sessions, deck, setSessions, setDeck],
  );

  const setDailyGoal = useCallback(
    (goal: number) => setSettings((s) => ({ ...s, dailyGoal: Number.isFinite(goal) ? goal : 20 })),
    [setSettings],
  );

  const clearTodayProgress = useCallback(() => {
    if (!window.confirm('确认清空今日刷题进度？此操作无法撤销。')) return;
    const today = todayKey();
    const todayQids = new Set<string>(
      Object.entries(history)
        .filter(([, h]) => h.d === today)
        .map(([qid]) => qid),
    );
    setHistory((prev) => {
      const next = { ...prev };
      for (const qid of todayQids) delete next[qid];
      return next;
    });
    setActivity((prev) => {
      const next = { ...prev };
      delete next[today];
      return next;
    });
    setSessions((prev) => {
      const next: SessionMap = {};
      let changed = false;
      for (const [subjectId, session] of Object.entries(prev)) {
        const newAnswers = { ...session.answers };
        let sessionChanged = false;
        for (const qIdxStr of Object.keys(newAnswers)) {
          if (todayQids.has(`${subjectId}-${qIdxStr}`)) {
            delete newAnswers[Number(qIdxStr)];
            sessionChanged = true;
          }
        }
        next[subjectId] = sessionChanged ? { ...session, answers: newAnswers } : session;
        if (sessionChanged) changed = true;
      }
      return changed ? next : prev;
    });
    setDeck(null);
  }, [history, setHistory, setActivity, setSessions, setDeck]);

  const clearAllProgress = useCallback(() => {
    if (!window.confirm('确认清空所有刷题进度？此操作无法撤销。')) return;
    setHistory({});
    setActivity({});
    setSessions({});
    setDeck(null);
  }, [setHistory, setActivity, setSessions, setDeck]);

  // ---- Favorites -------------------------------------------------------
  const toggleFavorite = useCallback(
    (qid: string) => setFavorites((prev) => ({ ...prev, [qid]: !prev[qid] })),
    [setFavorites],
  );

  // ---- Flashcard (知识点速览) -------------------------------------------
  const totalFlashcardEligible = useMemo(() => {
    let n = 0;
    for (const s of subjects) {
      for (const q of s.questions) if (q.explanation) n++;
    }
    return n;
  }, []);

  const setFlashcardCount = useCallback(
    (count: number) =>
      setSettings((s) => ({ ...s, flashcardCount: Number.isFinite(count) ? count : 20 })),
    [setSettings],
  );

  // Older saved settings may lack these fields; fall back to safe numbers so
  // the steppers never start from undefined (which would produce NaN).
  const dailyGoal = Number.isFinite(settings.dailyGoal) ? settings.dailyGoal : 20;
  const flashcardCount = Math.min(
    Math.max(20, Number.isFinite(settings.flashcardCount) ? settings.flashcardCount : 20),
    Math.max(20, totalFlashcardEligible),
  );

  const startFlashcard = useCallback(
    (count: number) => {
      const pool: DeckItem[] = [];
      for (const s of subjects) {
        for (let i = 0; i < s.questions.length; i++) {
          if (s.questions[i].explanation) pool.push({ subjectId: s.id, qIndex: i });
        }
      }
      const items = shuffle(pool).slice(0, count);
      if (!items.length) return;
      setFlashcard({ items, position: 0, phase: 'study', answers: {} });
      setView('flashcard');
    },
    [setFlashcard],
  );

  const flipFlashcard = useCallback(() => {
    setFlashcard((prev) => (prev ? { ...prev, phase: 'quiz' } : prev));
  }, [setFlashcard]);

  const answerFlashcard = useCallback(
    (position: number, label: string, q: Question) => {
      setFlashcard((prev) => {
        if (!prev || prev.answers[position] !== undefined) return prev;
        return { ...prev, answers: { ...prev.answers, [position]: label } };
      });
      recordAnswer(q, label);
    },
    [setFlashcard, recordAnswer],
  );

  const nextFlashcard = useCallback(() => {
    setFlashcard((prev) =>
      prev ? { ...prev, position: prev.position + 1, phase: 'study' } : prev,
    );
  }, [setFlashcard]);

  const finishFlashcard = useCallback(() => {
    setFlashcard(null);
    setView('home');
  }, [setFlashcard]);

  // ---- Derived stats from history --------------------------------------
  const stats = useMemo(() => {
    const today = todayKey();
    const perSubject: Record<string, { answered: number; correct: number; total: number }> = {};
    for (const s of subjects) {
      perSubject[s.id] = { answered: 0, correct: 0, total: s.questions.length };
    }
    let todayDone = 0;
    let wrong = 0;
    let done = 0;
    for (const [qid, h] of Object.entries(history)) {
      const ref = parseQid(qid);
      if (!ref) continue;
      const q = subjectMap[ref.subjectId]?.questions[ref.qIndex];
      if (!q) continue;
      done++;
      const ok = h.pick === q.answer;
      perSubject[ref.subjectId].answered++;
      if (ok) perSubject[ref.subjectId].correct++;
      else wrong++;
      if (h.d === today) todayDone++;
    }
    return { perSubject, todayDone, wrong, done };
  }, [history]);

  const streak = useMemo(() => {
    const key = (date: Date) => date.toLocaleDateString('en-CA');
    const d = new Date();
    if (!activity[key(d)]) d.setDate(d.getDate() - 1);
    let n = 0;
    while (activity[key(d)]) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }, [activity]);

  // ---- Daily goal toast ------------------------------------------------
  const [goalToast, setGoalToast] = useState(false);
  const prevTodayDoneRef = useRef(stats.todayDone);
  useEffect(() => {
    const prev = prevTodayDoneRef.current;
    prevTodayDoneRef.current = stats.todayDone;
    if (prev < dailyGoal && stats.todayDone >= dailyGoal) {
      setGoalToast(true);
      const timer = setTimeout(() => setGoalToast(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [stats.todayDone, dailyGoal]);

  // ---- Resolve flashcard session into renderable items ------------------
  const activeFlashcard = useMemo(() => {
    if (!flashcard) return null;
    const resolved = flashcard.items
      .map((it) => {
        const subject = subjectMap[it.subjectId];
        const question = subject?.questions[it.qIndex];
        if (!question) return null;
        return { question, subjectName: subject.name };
      })
      .filter((x): x is { question: Question; subjectName: string } => x !== null);
    return { resolved, position: flashcard.position, phase: flashcard.phase, answers: flashcard.answers };
  }, [flashcard]);

  // ---- Resolve the active quiz/results into position-indexed arrays -----
  const active = useMemo(() => {
    if (activeKind === 'subject') {
      const subject = activeId ? subjectMap[activeId] : null;
      const session = activeId ? sessions[activeId] : undefined;
      if (!subject || !session) return null;
      return {
        title: subject.name,
        questions: session.order.map((i) => subject.questions[i]),
        answers: session.order.map((i) => session.answers[i]),
        position: session.position,
        contextLabels: undefined as (string | undefined)[] | undefined,
      };
    }
    if (deck) {
      return {
        title: deck.title,
        questions: deck.items.map((it) => subjectMap[it.subjectId].questions[it.qIndex]),
        answers: deck.items.map((_, pos) => deck.answers[pos]),
        position: deck.position,
        contextLabels: deck.items.map((it) => subjectMap[it.subjectId].name),
      };
    }
    return null;
  }, [activeKind, activeId, sessions, deck]);

  return (
    <div className="app">
      <Toast visible={goalToast}>🎉 今日目标完成！</Toast>

      {view === 'home' && (
        <Home
          subjects={subjects}
          progress={stats.perSubject}
          todayDone={stats.todayDone}
          doneCount={stats.done}
          wrongCount={stats.wrong}
          dailyGoal={dailyGoal}
          streak={streak}
          onOpen={openSubject}
          onStartDeck={startDeck}
          favorites={favorites}
          flashcardCount={flashcardCount}
          onStartFlashcard={startFlashcard}
        />
      )}

      {view === 'settings' && (
        <Settings
          theme={theme}
          onToggleTheme={toggleTheme}
          dailyGoal={dailyGoal}
          onSetGoal={setDailyGoal}
          flashcardCount={flashcardCount}
          totalFlashcardEligible={totalFlashcardEligible}
          onSetFlashcardCount={setFlashcardCount}
          todayDone={stats.todayDone}
          doneCount={stats.done}
          onClearToday={clearTodayProgress}
          onClearAll={clearAllProgress}
        />
      )}

      {(view === 'home' || view === 'settings') && (
        <BottomNav
          active={view}
          onChange={(tab) => setView(tab)}
        />
      )}

      {view === 'quiz' && active && (
        <Quiz
          title={active.title}
          questions={active.questions}
          answers={active.answers}
          position={active.position}
          contextLabels={active.contextLabels}
          theme={theme}
          onToggleTheme={toggleTheme}
          onSelect={handleSelect}
          onGoTo={handleGoTo}
          onExit={goHome}
          onShowResults={() => setView('results')}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {view === 'flashcard' && activeFlashcard && (
        <FlashcardView
          items={activeFlashcard.resolved}
          position={activeFlashcard.position}
          phase={activeFlashcard.phase}
          answers={activeFlashcard.answers}
          theme={theme}
          onToggleTheme={toggleTheme}
          onFlip={flipFlashcard}
          onAnswer={answerFlashcard}
          onNext={nextFlashcard}
          onFinish={finishFlashcard}
          onExit={finishFlashcard}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {view === 'results' && active && (
        <Results
          title={active.title}
          questions={active.questions}
          answers={active.answers}
          contextLabels={active.contextLabels}
          theme={theme}
          onToggleTheme={toggleTheme}
          onExit={goHome}
          onReview={() => setView('quiz')}
          onRestart={handleRestart}
          onJump={(position) => {
            handleGoTo(position);
            setView('quiz');
          }}
        />
      )}
    </div>
  );
}
