import { useRef } from 'react';
import { Moon, Sun } from './icons';

interface SettingsProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  dailyGoal: number;
  onSetGoal: (goal: number) => void;
  flashcardCount: number;
  totalFlashcardEligible: number;
  onSetFlashcardCount: (count: number) => void;
  memorizeCount: number;
  totalMemorizeEligible: number;
  onSetMemorizeCount: (count: number) => void;
  randomCount: number;
  totalQuestions: number;
  onSetRandomCount: (count: number) => void;
  shuffleOptions: boolean;
  onToggleShuffleOptions: () => void;
  todayDone: number;
  doneCount: number;
  favCount: number;
  onExportProgress: () => void;
  onImportProgress: (file: File) => void | Promise<void>;
  onClearToday: () => void;
  onClearAll: () => void;
}

export function Settings({
  theme,
  onToggleTheme,
  dailyGoal,
  onSetGoal,
  flashcardCount,
  totalFlashcardEligible,
  onSetFlashcardCount,
  memorizeCount,
  totalMemorizeEligible,
  onSetMemorizeCount,
  randomCount,
  totalQuestions,
  onSetRandomCount,
  shuffleOptions,
  onToggleShuffleOptions,
  todayDone,
  doneCount,
  favCount,
  onExportProgress,
  onImportProgress,
  onClearToday,
  onClearAll,
}: SettingsProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const adjustGoal = (delta: number) =>
    onSetGoal(Math.max(5, Math.min(200, dailyGoal + delta)));
  const adjustFcCount = (delta: number) =>
    onSetFlashcardCount(Math.max(20, Math.min(totalFlashcardEligible, flashcardCount + delta)));
  const memorizeFloor = totalMemorizeEligible >= 5 ? 5 : 1;
  const adjustMemorizeCount = (delta: number) =>
    onSetMemorizeCount(
      Math.max(memorizeFloor, Math.min(totalMemorizeEligible, memorizeCount + delta)),
    );
  const adjustRandomCount = (delta: number) =>
    onSetRandomCount(Math.max(10, Math.min(totalQuestions, randomCount + delta)));

  return (
    <main className="container home has-bottom-nav">
      <section className="hero">
        <h1 className="greeting">设置</h1>
      </section>

      <section className="home-section">
        <h2 className="group-label">外观</h2>
        <div className="list">
          <button type="button" className="list-row" onClick={onToggleTheme}>
            <span className="row-main">
              <span className="row-title">主题</span>
              <span className="row-sub">{theme === 'dark' ? '深色模式' : '浅色模式'}</span>
            </span>
            <span className="row-trail">
              <span className="row-meta" aria-hidden="true">
                {theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
              </span>
            </span>
          </button>
        </div>
      </section>

      <section className="home-section">
        <h2 className="group-label">学习目标</h2>
        <div className="list">
          <div className="list-row settings-stepper-row">
            <span className="row-main">
              <span className="row-title">每日目标</span>
            </span>
            <div className="settings-stepper">
              <button
                type="button"
                className="goal-step"
                onClick={() => adjustGoal(-5)}
                disabled={dailyGoal <= 5}
                aria-label="减少目标"
              >
                −
              </button>
              <span className="goal-edit-value">{dailyGoal}</span>
              <button
                type="button"
                className="goal-step"
                onClick={() => adjustGoal(5)}
                disabled={dailyGoal >= 200}
                aria-label="增加目标"
              >
                +
              </button>
              <span className="settings-stepper-unit">题</span>
            </div>
          </div>
          <div className="list-row settings-stepper-row">
            <span className="row-main">
              <span className="row-title">知识点速览题数</span>
            </span>
            <div className="settings-stepper">
              <button
                type="button"
                className="goal-step"
                onClick={() => adjustFcCount(-5)}
                disabled={flashcardCount <= 20}
                aria-label="减少题数"
              >
                −
              </button>
              <span className="goal-edit-value">{flashcardCount}</span>
              <button
                type="button"
                className="goal-step"
                onClick={() => adjustFcCount(5)}
                disabled={flashcardCount >= totalFlashcardEligible}
                aria-label="增加题数"
              >
                +
              </button>
              <span className="settings-stepper-unit">题</span>
            </div>
          </div>
          <div className="list-row settings-stepper-row">
            <span className="row-main">
              <span className="row-title">背答案题数</span>
              <span className="row-sub">只从未做过的题中抽取</span>
            </span>
            <div className="settings-stepper">
              <button
                type="button"
                className="goal-step"
                onClick={() => adjustMemorizeCount(-5)}
                disabled={memorizeCount <= memorizeFloor || totalMemorizeEligible === 0}
                aria-label="减少题数"
              >
                −
              </button>
              <span className="goal-edit-value">{memorizeCount}</span>
              <button
                type="button"
                className="goal-step"
                onClick={() => adjustMemorizeCount(5)}
                disabled={memorizeCount >= totalMemorizeEligible || totalMemorizeEligible === 0}
                aria-label="增加题数"
              >
                +
              </button>
              <span className="settings-stepper-unit">题</span>
            </div>
          </div>
          <div className="list-row settings-stepper-row">
            <span className="row-main">
              <span className="row-title">随机抽题题数</span>
            </span>
            <div className="settings-stepper">
              <button
                type="button"
                className="goal-step"
                onClick={() => adjustRandomCount(-5)}
                disabled={randomCount <= 10}
                aria-label="减少题数"
              >
                −
              </button>
              <span className="goal-edit-value">{randomCount}</span>
              <button
                type="button"
                className="goal-step"
                onClick={() => adjustRandomCount(5)}
                disabled={randomCount >= totalQuestions}
                aria-label="增加题数"
              >
                +
              </button>
              <span className="settings-stepper-unit">题</span>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section">
        <h2 className="group-label">答题选项</h2>
        <div className="list">
          <button type="button" className="list-row" onClick={onToggleShuffleOptions}>
            <span className="row-main">
              <span className="row-title">选项乱序</span>
              <span className="row-sub">每道题的选项随机打乱顺序显示</span>
            </span>
            <span className="row-trail">
              <span className={`toggle-pill${shuffleOptions ? ' toggle-pill--on' : ''}`} aria-hidden="true">
                <span className="toggle-thumb" />
              </span>
            </span>
          </button>
        </div>
      </section>

      <section className="home-section">
        <h2 className="group-label">数据管理</h2>
        <div className="list">
          <button type="button" className="list-row" onClick={onExportProgress}>
            <span className="row-main">
              <span className="row-title">导出进度</span>
              <span className="row-sub">
                JSON · {doneCount} 道答题记录 · {favCount} 道收藏
              </span>
            </span>
          </button>
          <button
            type="button"
            className="list-row"
            onClick={() => importRef.current?.click()}
          >
            <span className="row-main">
              <span className="row-title">导入进度</span>
              <span className="row-sub">从 JSON 文件恢复答题记录与收藏</span>
            </span>
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImportProgress(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="list-row"
            disabled={todayDone === 0}
            onClick={onClearToday}
          >
            <span className="row-main">
              <span className="row-title">清空今日进度</span>
              <span className="row-sub">
                {todayDone > 0 ? `重置今天的 ${todayDone} 道答题记录` : '今天还没有答题记录'}
              </span>
            </span>
          </button>
          <button
            type="button"
            className="list-row list-row--danger"
            disabled={doneCount === 0}
            onClick={onClearAll}
          >
            <span className="row-main">
              <span className="row-title row-title--danger">清空全部进度</span>
              <span className="row-sub">
                {doneCount > 0 ? `重置累计 ${doneCount} 道题的所有记录` : '暂无答题记录'}
              </span>
            </span>
          </button>
        </div>
      </section>

      <footer className="home-footer">
        进度以 JSON 保存在本地，可导出备份或在其他设备导入。
      </footer>
    </main>
  );
}
