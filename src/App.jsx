import { useState, useEffect } from "react";
import "./App.css";

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

const QUIZ_COUNT = 5;
const BASE = import.meta.env.BASE_URL;

export default function App() {
  const [screen, setScreen] = useState("select");
  const [fileList, setFileList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  // 結果画面用に確定した値を保持
  const [finalScore, setFinalScore] = useState(0);
  const [finalAnswers, setFinalAnswers] = useState([]);

  useEffect(() => {
    fetch(`${BASE}data/index.json`)
      .then(res => res.json())
      .then(data => { setFileList(data); setLoadingList(false); })
      .catch(() => setLoadingList(false));
  }, []);

  const handleSelectFile = (name) => {
    setLoadingQuiz(true);
    setSelectedFile(name);
    fetch(`${BASE}data/${name}.json`)
      .then(res => res.json())
      .then(data => {
        const picked = pickRandom(data.questions, QUIZ_COUNT);
        setQuestions(picked);
        setCurrent(0);
        setSelected(null);
        setShowExplanation(false);
        setScore(0);
        setAnswers([]);
        setFinalScore(0);
        setFinalAnswers([]);
        setLoadingQuiz(false);
        setScreen("quiz");
      })
      .catch(() => setLoadingQuiz(false));
  };

  const handleSelect = (choice) => {
    if (selected !== null) return;
    setSelected(choice);
  };

  const handleNext = () => {
    const q = questions[current];
    const correct = selected === q.correct_answer;
    const newScore = score + (correct ? 1 : 0);
    const newAnswers = [...answers, {
      question: q.question,
      selected,
      correct_answer: q.correct_answer,
      isCorrect: correct,
    }];

    if (current + 1 >= questions.length) {
      // 結果画面に渡す値を確定してから画面遷移
      setFinalScore(newScore);
      setFinalAnswers(newAnswers);
      setScreen("result");
    } else {
      setScore(newScore);
      setAnswers(newAnswers);
      setCurrent(c => c + 1);
      setSelected(null);
      setShowExplanation(false);
    }
  };

  const handleRestart = () => {
    setScreen("select");
    setSelectedFile(null);
    setQuestions([]);
  };

  const handleRetry = () => {
    handleSelectFile(selectedFile);
  };

  // ===== ファイル選択画面 =====
  if (screen === "select") {
    return (
      <div className="container">
        <div className="card">
          <div className="select-title">📝 クイズを選択</div>
          <div className="select-subtitle">ファイルを選んでスタート</div>
          {loadingList ? (
            <div className="center-text">読み込み中...</div>
          ) : (
            <div className="file-list">
              {fileList.map(name => (
                <button key={name} className="file-btn" onClick={() => handleSelectFile(name)} disabled={loadingQuiz}>
                  <span className="file-icon">📄</span>
                  <span className="file-name">{name}</span>
                  <span className="file-arrow">→</span>
                </button>
              ))}
            </div>
          )}
          {loadingQuiz && <div className="center-text">問題を読み込み中...</div>}
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
            <button className="back-btn" onClick={() => setScreen("select")}>← 戻る</button>
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
                <button key={i} className={cls} onClick={() => handleSelect(choice)}>
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
                <div className="feedback-correct-answer">
                  正解: <span style={{ color: "#4ade80" }}>{q.correct_answer}</span>
                </div>
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
    return (
      <div className="container">
        <div className="card">
          <div className="result-emoji">{pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "📚"}</div>
          <div className="result-title">結果 — {selectedFile}</div>
          <div className="result-score">{finalScore} <span className="result-total">/ {TOTAL}</span></div>
          <div className="result-pct">{pct}%</div>
          <div className="result-msg">{pct >= 80 ? "素晴らしい！" : pct >= 50 ? "もう少し！" : "復習しよう"}</div>
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
          <button className="btn" onClick={handleRetry} style={{ marginBottom: 10 }}>
            もう一度（別の5問）
          </button>
          <button className="btn btn-secondary" onClick={handleRestart}>
            ファイル選択に戻る
          </button>
        </div>
      </div>
    );
  }
}
