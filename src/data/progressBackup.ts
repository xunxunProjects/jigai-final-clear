import { subjectMap } from './questions';
import type { DeckSession, FlashcardSession, HistoryEntry, Session } from '../types';

export const PROGRESS_BACKUP_VERSION = 1;
export const PROGRESS_BACKUP_APP = 'yixue-shuati';

export interface ProgressSettings {
  dailyGoal: number;
  flashcardCount: number;
  memorizeCount: number;
  randomCount: number;
  shuffleOptions: boolean;
}

export interface ProgressBackup {
  version: number;
  app: string;
  exportedAt: string;
  theme: 'light' | 'dark';
  settings: ProgressSettings;
  /** Per-question answer log: question id → { date, pick }. */
  history: Record<string, HistoryEntry>;
  /** Favorited question ids. */
  favorites: string[];
  /** Daily question counts for streaks. */
  activity: Record<string, number>;
  /** Per-subject practice sessions (order, position, answers by q index). */
  sessions: Record<string, Session>;
  deck: DeckSession | null;
  flashcard: FlashcardSession | null;
  summary: {
    answeredCount: number;
    favoriteCount: number;
    sessionSubjects: string[];
  };
}

export interface ProgressBackupInput {
  theme: 'light' | 'dark';
  settings: ProgressSettings;
  history: Record<string, HistoryEntry>;
  favorites: Record<string, boolean>;
  activity: Record<string, number>;
  sessions: Record<string, Session>;
  deck: DeckSession | null;
  flashcard: FlashcardSession | null;
}

export interface ImportResult {
  backup: ProgressBackup;
  skippedHistory: number;
  skippedFavorites: number;
}

function parseQid(qid: string): { subjectId: string; qIndex: number } | null {
  const dash = qid.lastIndexOf('-');
  if (dash < 0) return null;
  const qIndex = Number(qid.slice(dash + 1));
  if (!Number.isInteger(qIndex) || qIndex < 0) return null;
  return { subjectId: qid.slice(0, dash), qIndex };
}

export function isValidQuestionId(qid: string): boolean {
  const ref = parseQid(qid);
  if (!ref) return false;
  return !!subjectMap[ref.subjectId]?.questions[ref.qIndex];
}

function defaultSettings(raw?: Partial<ProgressSettings>): ProgressSettings {
  return {
    dailyGoal: Number.isFinite(raw?.dailyGoal) ? (raw!.dailyGoal as number) : 20,
    flashcardCount: Number.isFinite(raw?.flashcardCount) ? (raw!.flashcardCount as number) : 20,
    memorizeCount: Number.isFinite(raw?.memorizeCount) ? (raw!.memorizeCount as number) : 10,
    randomCount: Number.isFinite(raw?.randomCount) ? (raw!.randomCount as number) : 30,
    shuffleOptions: raw?.shuffleOptions ?? false,
  };
}

function sanitizeHistory(raw: unknown): { history: Record<string, HistoryEntry>; skipped: number } {
  const history: Record<string, HistoryEntry> = {};
  let skipped = 0;
  if (!raw || typeof raw !== 'object') return { history, skipped };
  for (const [qid, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!isValidQuestionId(qid) || !entry || typeof entry !== 'object') {
      skipped++;
      continue;
    }
    const e = entry as Record<string, unknown>;
    const d = typeof e.d === 'string' ? e.d : '';
    const pick = typeof e.pick === 'string' ? e.pick : '';
    if (!d || !pick) {
      skipped++;
      continue;
    }
    history[qid] = { d, pick };
  }
  return { history, skipped };
}

function sanitizeFavorites(raw: unknown): { favorites: string[]; skipped: number } {
  const ids: string[] = [];
  let skipped = 0;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item !== 'string' || !isValidQuestionId(item)) {
        skipped++;
        continue;
      }
      if (!ids.includes(item)) ids.push(item);
    }
    return { favorites: ids, skipped };
  }
  if (raw && typeof raw === 'object') {
    for (const [qid, on] of Object.entries(raw as Record<string, unknown>)) {
      if (!on || typeof qid !== 'string' || !isValidQuestionId(qid)) {
        if (on) skipped++;
        continue;
      }
      if (!ids.includes(qid)) ids.push(qid);
    }
  }
  return { favorites: ids, skipped };
}

function sanitizeActivity(raw: unknown): Record<string, number> {
  const activity: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return activity;
  for (const [day, count] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof day !== 'string' || typeof count !== 'number' || !Number.isFinite(count)) continue;
    activity[day] = Math.max(0, Math.floor(count));
  }
  return activity;
}

function sanitizeSession(raw: unknown, subjectId: string): Session | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const subject = subjectMap[subjectId];
  if (!subject) return null;

  const order = Array.isArray(s.order)
    ? s.order.filter((i): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < subject.questions.length)
    : [];
  if (!order.length) return null;

  const position =
    typeof s.position === 'number' && Number.isFinite(s.position)
      ? Math.max(0, Math.min(Math.floor(s.position), order.length - 1))
      : 0;

  const answers: Record<number, string> = {};
  if (s.answers && typeof s.answers === 'object') {
    for (const [idxStr, pick] of Object.entries(s.answers as Record<string, unknown>)) {
      const idx = Number(idxStr);
      if (!Number.isInteger(idx) || idx < 0 || idx >= subject.questions.length) continue;
      if (typeof pick !== 'string' || !pick) continue;
      answers[idx] = pick;
    }
  }

  return { order, position, answers };
}

function sanitizeSessions(raw: unknown): Record<string, Session> {
  const sessions: Record<string, Session> = {};
  if (!raw || typeof raw !== 'object') return sessions;
  for (const [subjectId, session] of Object.entries(raw as Record<string, unknown>)) {
    if (!subjectMap[subjectId]) continue;
    const clean = sanitizeSession(session, subjectId);
    if (clean) sessions[subjectId] = clean;
  }
  return sessions;
}

function sanitizeDeck(raw: unknown): DeckSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.title !== 'string' || !Array.isArray(d.items)) return null;

  const items = d.items
    .map((it) => {
      if (!it || typeof it !== 'object') return null;
      const item = it as Record<string, unknown>;
      if (typeof item.subjectId !== 'string' || typeof item.qIndex !== 'number') return null;
      if (!subjectMap[item.subjectId]?.questions[item.qIndex]) return null;
      return { subjectId: item.subjectId, qIndex: item.qIndex };
    })
    .filter((x): x is { subjectId: string; qIndex: number } => x !== null);

  if (!items.length) return null;

  const position =
    typeof d.position === 'number'
      ? Math.max(0, Math.min(Math.floor(d.position), items.length - 1))
      : 0;

  const answers: Record<number, string> = {};
  if (d.answers && typeof d.answers === 'object') {
    for (const [posStr, pick] of Object.entries(d.answers as Record<string, unknown>)) {
      const pos = Number(posStr);
      if (!Number.isInteger(pos) || pos < 0 || pos >= items.length) continue;
      if (typeof pick !== 'string' || !pick) continue;
      answers[pos] = pick;
    }
  }

  return { title: d.title, items, position, answers };
}

function sanitizeFlashcard(raw: unknown): FlashcardSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Record<string, unknown>;
  if (!Array.isArray(f.items)) return null;

  const items = f.items
    .map((it) => {
      if (!it || typeof it !== 'object') return null;
      const item = it as Record<string, unknown>;
      if (typeof item.subjectId !== 'string' || typeof item.qIndex !== 'number') return null;
      if (!subjectMap[item.subjectId]?.questions[item.qIndex]) return null;
      return { subjectId: item.subjectId, qIndex: item.qIndex };
    })
    .filter((x): x is { subjectId: string; qIndex: number } => x !== null);

  if (!items.length) return null;

  const phase = f.phase === 'quiz' ? 'quiz' : 'study';
  const mode = f.mode === 'answer' ? 'answer' : f.mode === 'knowledge' ? 'knowledge' : undefined;
  const position =
    typeof f.position === 'number'
      ? Math.max(0, Math.min(Math.floor(f.position), items.length - 1))
      : 0;

  const answers: Record<number, string> = {};
  if (f.answers && typeof f.answers === 'object') {
    for (const [posStr, pick] of Object.entries(f.answers as Record<string, unknown>)) {
      const pos = Number(posStr);
      if (!Number.isInteger(pos) || pos < 0 || pos >= items.length) continue;
      if (typeof pick !== 'string' || !pick) continue;
      answers[pos] = pick;
    }
  }

  return { items, position, phase, mode, answers };
}

export function createProgressBackup(input: ProgressBackupInput): ProgressBackup {
  const favorites = Object.entries(input.favorites)
    .filter(([, on]) => on)
    .map(([qid]) => qid)
    .filter(isValidQuestionId)
    .sort();

  const { history } = sanitizeHistory(input.history);

  return {
    version: PROGRESS_BACKUP_VERSION,
    app: PROGRESS_BACKUP_APP,
    exportedAt: new Date().toISOString(),
    theme: input.theme === 'dark' ? 'dark' : 'light',
    settings: defaultSettings(input.settings),
    history,
    favorites,
    activity: sanitizeActivity(input.activity),
    sessions: sanitizeSessions(input.sessions),
    deck: sanitizeDeck(input.deck),
    flashcard: sanitizeFlashcard(input.flashcard),
    summary: {
      answeredCount: Object.keys(history).length,
      favoriteCount: favorites.length,
      sessionSubjects: Object.keys(sanitizeSessions(input.sessions)).sort(),
    },
  };
}

export function parseProgressBackup(raw: unknown): ImportResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  const version = typeof data.version === 'number' ? data.version : 0;
  if (version !== PROGRESS_BACKUP_VERSION) return null;

  const app = typeof data.app === 'string' ? data.app : '';
  if (app && app !== PROGRESS_BACKUP_APP) return null;

  const { history, skipped: skippedHistory } = sanitizeHistory(data.history);
  const { favorites, skipped: skippedFavorites } = sanitizeFavorites(data.favorites);

  const backup: ProgressBackup = {
    version: PROGRESS_BACKUP_VERSION,
    app: PROGRESS_BACKUP_APP,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    theme: data.theme === 'dark' ? 'dark' : 'light',
    settings: defaultSettings(data.settings as Partial<ProgressSettings>),
    history,
    favorites,
    activity: sanitizeActivity(data.activity),
    sessions: sanitizeSessions(data.sessions),
    deck: sanitizeDeck(data.deck),
    flashcard: sanitizeFlashcard(data.flashcard),
    summary: {
      answeredCount: Object.keys(history).length,
      favoriteCount: favorites.length,
      sessionSubjects: Object.keys(sanitizeSessions(data.sessions)).sort(),
    },
  };

  return { backup, skippedHistory, skippedFavorites };
}

export function favoritesToRecord(favorites: string[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const qid of favorites) map[qid] = true;
  return map;
}

export function downloadProgressBackup(backup: ProgressBackup): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `医学刷题进度-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
