import { useState, useEffect } from "react";
import "./App.css";

// ==============================
// 定数
// ==============================
const QUIZ_COUNT = 5;
const BASE = import.meta.env.BASE_URL;
const STORAGE_KEY = "quiz_schedule";
const PHASES = [1, 3, 5, 7, 10, 15, 30, 45, 60, 90, 120, 210, 365];

// ==============================
// ユーティリティ
// ==============================
function pickRandom(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(n, arr.length));
}

function today() {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function daysDiff(dateStr) {
  const d = new Date(dateStr);
  const t = new Date(today());
  return Math.round((d - t) / 86400000);
}

// LocalStorage操作
function loadSchedule() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function saveSchedule(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ファイルの状態を返す
// { status: "new"|"due"|"waiting", nextDate, phaseIndex, daysLeft }
function getFileStatus(name, schedule) {
  const rec = schedule[name];
  if (!rec) return { status: "new", nextDate: null, phaseIndex: -1, daysLeft: null };
  const diff = daysDiff(rec.nextDate);
  if (diff <= 0) return { status: "due", nextDate: rec.nextDate, phaseIndex: rec.phaseIndex, daysLeft: 0 };
  return { status: "waiting", nextDate: rec.nextDate, phaseIndex: rec.phaseIndex, daysLeft: diff };
}

// 問題を解いた後にスケジュールを更新
// missCount=0: 全問正解→次フェーズ / missCount=1: 維持→翌日 / missCount>=2: 1つ戻る→翌日
function advanceSchedule(name, schedule, missCount) {
  const rec = schedule[name];
  const currentPhase = rec ? rec.phaseIndex : -1;

  if (missCount === 0) {
    // 全問正解 → 次のフェーズへ
    const nextPhase = currentPhase + 1;
    if (nextPhase >= PHASES.length) {
      return { ...schedule, [name]: { phaseIndex: PHASES.length - 1, completed: true, nextDate: null } };
    }
    const nextDate = addDays(today(), PHASES[nextPhase]);
    return { ...schedule, [name]: { phaseIndex: nextPhase, nextDate, completed: false } };
  } else if (missCount === 1) {
    // 1問ミス → フェーズ維持、翌日復習
    return { ...schedule, [name]: { phaseIndex: Math.max(currentPhase, 0), nextDate: addDays(today(), 1), completed: false } };
  } else {
    // 2問以上ミス → 1つ前のフェーズへ（フェーズ0以下は翌日復習）
    const prevPhase = Math.max(currentPhase - 1, 0);
    const nextDate = addDays(today(), currentPhase <= 0 ? 1 : PHASES[prevPhase]);
    return { ...schedule, [name]: { phaseIndex: prevPhase, nextDate, completed: false } };
  }
}

// ==============================
// メインアプリ
// ==============================
export default function App() {
  const [screen, setScreen] = useState("top"); // top | quiz | result | manage
  const [fileList, setFileList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [schedule, setSchedule] = useState({});
  const [questions, setQuestions] = useState([]);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [finalScore, setFinalScore] = useState(0);
  const [finalAnswers, setFinalAnswers] = useState([]);

  useEffect(() => {
    setSchedule(loadSchedule());
    fetch(`${BASE}data/index.json`)
      .then(r => r.json())
      .then(data => { setFileList(data); setLoadingList(false); })
      .catch(() => setLoadingList(false));
  }, []);

  const handleSelectFile = (name) => {
    setLoadingQuiz(true);
    setSelectedFile(name);
    fetch(`${BASE}data/${name}.json`)
      .then(r => r.json())
      .then(data => {
        setQuestions(pickRandom(data.questions, QUIZ_COUNT));
        setCurrent(0); setSelected(null); setShowExplanation(false);
        setScore(0); setAnswers([]); setFinalScore(0); setFinalAnswers([]);
        setLoadingQuiz(false);
        setScreen("quiz");
      })
      .catch(() => setLoadingQuiz(false));
  };

  const handleNext = () => {
    const q = questions[current];
    const correct = selected === q.correct_answer;
    const newScore = score + (correct ? 1 : 0);
    const newAnswers = [...answers, { question: q.question, selected, correct_answer: q.correct_answer, isCorrect: correct }];
    if (current + 1 >= questions.length) {
      // ミス数を計算してスケジュール更新
      const missCount = questions.length - newScore;
      const newSchedule = advanceSchedule(selectedFile, schedule, missCount);
      setSchedule(newSchedule);
      saveSchedule(newSchedule);
      setFinalScore(newScore);
      setFinalAnswers(newAnswers);
      setScreen("result");
    } else {
      setScore(newScore); setAnswers(newAnswers);
      setCurrent(c => c + 1); setSelected(null); setShowExplanation(false);
    }
  };

  // ===== トップ画面 =====
  if (screen === "top") {
    const dueFiles = fileList.filter(n => {
      const s = getFileStatus(n, schedule);
      return s.status === "new" || s.status === "due";
    });
    const waitingFiles = fileList.filter(n => getFileStatus(n, schedule).status === "waiting");
    const completedFiles = fileList.filter(n => schedule[n]?.completed);

    return (
      <div className="container">
        <div className="card">
          <div className="select-title">📝 Quiz</div>
          <div className="top-nav">
            <button className="nav-btn active">クイズ</button>
            <button className="nav-btn" onClick={() => setScreen("manage")}>⚙️ 管理</button>
          </div>

          {loadingList ? <div className="center-text">読み込み中...</div> : (
            <>
              {dueFiles.length === 0 && waitingFiles.length > 0 && (
                <div className="empty-msg">
                  今日の復習はありません 🎉<br />
                  <span style={{ fontSize: 13, color: "#64748b" }}>
                    次の復習: {Math.min(...waitingFiles.map(n => getFileStatus(n, schedule).daysLeft))}日後
                  </span>
                </div>
              )}
              {dueFiles.length === 0 && waitingFiles.length === 0 && fileList.length > 0 && (
                <div className="empty-msg">全て完了しました！ 🏆</div>
              )}
              <div className="file-list">
                {dueFiles.map(name => {
                  const s = getFileStatus(name, schedule);
                  return (
                    <button key={name} className="file-btn" onClick={() => handleSelectFile(name)} disabled={loadingQuiz}>
                      <span className="file-icon">{s.status === "new" ? "🆕" : "🔁"}</span>
                      <span className="file-name">{name}</span>
                      <span className="file-phase">
                        {s.status === "new" ? "初回" : `フェーズ ${s.phaseIndex + 1}/${PHASES.length}`}
                      </span>
                    </button>
                  );
                })}
              </div>
              {waitingFiles.length > 0 && (
                <div className="waiting-section">
                  <div className="waiting-title">待機中</div>
                  {waitingFiles.map(name => {
                    const s = getFileStatus(name, schedule);
                    return (
                      <div key={name} className="waiting-item">
                        <span className="file-name">{name}</span>
                        <span className="waiting-days">{s.daysLeft}日後</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {loadingQuiz && <div className="center-text">問題を読み込み中...</div>}
        </div>
      </div>
    );
  }

  // ===== 管理画面 =====
  if (screen === "manage") {
    const updatePhase = (name, phaseIndex) => {
      const newSchedule = { ...schedule };
      if (phaseIndex < 0) {
        // リセット
        delete newSchedule[name];
      } else if (phaseIndex >= PHASES.length) {
        newSchedule[name] = { phaseIndex: PHASES.length - 1, nextDate: null, completed: true };
      } else {
        const nextDate = addDays(today(), PHASES[phaseIndex]);
        newSchedule[name] = { phaseIndex, nextDate, completed: false };
      }
      setSchedule(newSchedule);
      saveSchedule(newSchedule);
    };

    return (
      <div className="container">
        <div className="card">
          <div className="select-title">⚙️ 管理</div>
          <div className="top-nav">
            <button className="nav-btn" onClick={() => setScreen("top")}>クイズ</button>
            <button className="nav-btn active">⚙️ 管理</button>
          </div>
          <div className="manage-list">
            {fileList.map(name => {
              const s = getFileStatus(name, schedule);
              const rec = schedule[name];
              return (
                <div key={name} className="manage-item">
                  <div className="manage-header">
                    <span className="file-name">{name}</span>
                    <span className={`status-badge ${s.status}`}>
                      {s.status === "new" ? "未学習" : s.completed ? "完了" : s.status === "due" ? "復習期日" : `${s.daysLeft}日後`}
                    </span>
                  </div>
                  <div className="phase-selector">
                    <button
                      className={`phase-reset-btn`}
                      onClick={() => updatePhase(name, -1)}
                    >リセット</button>
                    {PHASES.map((days, i) => (
                      <button
                        key={i}
                        className={`phase-btn ${rec && rec.phaseIndex === i ? "phase-current" : ""} ${rec && rec.phaseIndex > i ? "phase-done" : ""}`}
                        onClick={() => updatePhase(name, i)}
                      >{days}日</button>
                    ))}
                  </div>
                  {s.nextDate && (
                    <div className="manage-next">次回: {s.nextDate}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ===== クイズ画面 =====
  if (screen === "quiz") {
    const q = questions[current];
    const TOTAL = questions.length;
    const isCorrect = selected === q.correct_answer;
    const progress = (current / TOTAL) * 100;

    return (
      <div className="container">
        <div className="card">
          <div className="header">
            <button className="back-btn" onClick={() => setScreen("top")}>← 戻る</button>
            <span className="file-tag">{selectedFile}</span>
            <span className="score-label">スコア {score}</span>
          </div>
          <div className="progress-bg">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="counter">{current + 1} / {TOTAL}</div>
          <div className="question">{q.question}</div>
          <div className="choices">
            {q.choices.map((choice, i) => {
              let cls = "choice-btn";
              if (selected !== null) {
                if (choice === q.correct_answer) cls += " correct";
                else if (choice === selected) cls += " wrong";
              }
              return (
                <button key={i} className={cls} onClick={() => selected === null && setSelected(choice)}>
                  <span className="choice-letter">{["A","B","C","D"][i]}</span>
                  <span className="choice-text">{choice}</span>
                </button>
              );
            })}
          </div>
          {selected !== null && (
            <div className={`feedback ${isCorrect ? "feedback-correct" : "feedback-wrong"}`}>
              <div className="feedback-title" style={{ color: isCorrect ? "#4ade80" : "#f87171" }}>
                {isCorrect ? "✓ 正解！" : "✗ 不正解"}
              </div>
              {!isCorrect && (
                <div className="feedback-correct-answer">正解: <span style={{ color: "#4ade80" }}>{q.correct_answer}</span></div>
              )}
              <button className="explanation-toggle" onClick={() => setShowExplanation(v => !v)}>
                {showExplanation ? "解説を閉じる ▲" : "解説を見る ▼"}
              </button>
              {showExplanation && <div className="explanation">{q.explanation}</div>}
            </div>
          )}
          {selected !== null && (
            <button className="btn" onClick={handleNext}>
              {current + 1 >= TOTAL ? "結果を見る" : "次の問題 →"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ===== 結果画面 =====
  if (screen === "result") {
    const TOTAL = questions.length;
    const pct = Math.round((finalScore / TOTAL) * 100);
    const s = getFileStatus(selectedFile, schedule);
    return (
      <div className="container">
        <div className="card">
          <div className="result-emoji">{pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "📚"}</div>
          <div className="result-title">結果 — {selectedFile}</div>
          <div className="result-score">{finalScore} <span className="result-total">/ {TOTAL}</span></div>
          <div className="result-pct">{pct}%</div>
          <div className="result-msg">{pct >= 80 ? "素晴らしい！" : pct >= 50 ? "もう少し！" : "復習しよう"}</div>
          {(() => {
            const missCount = TOTAL - finalScore;
            let phaseMsg = "";
            if (missCount === 0) phaseMsg = "✅ 全問正解！次のフェーズへ";
            else if (missCount === 1) phaseMsg = "⚠️ 1問ミス：フェーズ維持";
            else phaseMsg = "❌ 2問以上ミス：フェーズを1つ戻しました";
            return <div className="phase-result-msg">{phaseMsg}</div>;
          })()}
          {s.nextDate && (
            <div className="next-review">次回復習: {s.nextDate}</div>
          )}
          {s.completed && (
            <div className="next-review">🏆 全フェーズ完了！</div>
          )}
          <div className="review-list">
            {finalAnswers.map((a, i) => (
              <div key={i} className="review-item" style={{ borderLeftColor: a.isCorrect ? "#4ade80" : "#f87171" }}>
                <div className="review-q">Q{i + 1}. {a.question}</div>
                <div style={{ color: a.isCorrect ? "#4ade80" : "#f87171", fontSize: 13 }}>
                  {a.isCorrect ? "✓ 正解" : `✗ あなた: ${a.selected}`}
                </div>
                {!a.isCorrect && <div className="review-answer">正解: {a.correct_answer}</div>}
              </div>
            ))}
          </div>
          <button className="btn" onClick={() => handleSelectFile(selectedFile)} style={{ marginBottom: 10 }}>
            もう一度（別の5問）
          </button>
          <button className="btn btn-secondary" onClick={() => setScreen("top")}>
            トップに戻る
          </button>
        </div>
      </div>
    );
  }
}
