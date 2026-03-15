import React, { useState, useEffect } from 'react';

function getGradeColor(letter) {
  const colors = {
    A: '#2ecc71',
    B: '#27ae60',
    C: '#f39c12',
    D: '#e67e22',
    F: '#e74c3c',
  };
  return colors[letter] || '#999';
}

function AnimatedBar({ score, delay = 0 }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setWidth(score), delay);
    return () => clearTimeout(timer);
  }, [score, delay]);

  return (
    <div className="score-bar-track">
      <div
        className="score-bar-fill"
        style={{
          width: `${width}%`,
          transitionDelay: `${delay}ms`,
        }}
      />
    </div>
  );
}

function GradeCard({ grade, index }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 200 + index * 150);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <div className={`grade-card ${visible ? 'grade-visible' : ''}`}>
      <div className="grade-left">
        <div className="grade-letter" style={{ color: getGradeColor(grade.letter) }}>
          {grade.letter}
        </div>
      </div>
      <div className="grade-right">
        <div className="grade-label">{grade.label}</div>
        <AnimatedBar score={grade.score} delay={400 + index * 150} />
        <div className="grade-summary">{grade.summary}</div>
      </div>
      <div className="grade-score-num">{grade.score}</div>
    </div>
  );
}

export default function ReportCard({ scores, error, survey, onRestart, onHome }) {
  const [showHighlights, setShowHighlights] = useState(false);

  useEffect(() => {
    if (scores) {
      const timer = setTimeout(() => setShowHighlights(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [scores]);

  if (error && !scores) {
    return (
      <div className="screen report-screen">
        <div className="report-content">
          <h2>Session Complete</h2>
          <p className="report-error">
            Scoring couldn't be completed: {error}
          </p>
          <p>This might mean the transcript wasn't captured (try Chrome for best results with speech recognition) or the scoring service had an issue.</p>
          <div className="report-actions">
            <button className="btn btn-primary" onClick={onRestart}>Try Again</button>
            <button className="btn btn-ghost" onClick={onHome}>Home</button>
          </div>
        </div>
      </div>
    );
  }

  if (!scores) return null;

  const gradeEntries = Object.values(scores.grades);

  return (
    <div className="screen report-screen">
      <div className="report-content">
        {/* Header */}
        <div className="report-header">
          <div className="report-badge">SESSION REPORT</div>
          <div className="report-topic">{survey?.topic}</div>
        </div>

        {/* Headline */}
        <h1 className="report-headline">{scores.headline}</h1>

        {/* Overall score */}
        <div className="overall-score-ring">
          <svg viewBox="0 0 120 120" className="score-ring-svg">
            <circle cx="60" cy="60" r="52" className="ring-bg" />
            <circle
              cx="60"
              cy="60"
              r="52"
              className="ring-fill"
              style={{
                strokeDasharray: `${(scores.overallScore / 100) * 327} 327`,
              }}
            />
          </svg>
          <div className="score-ring-value">{scores.overallScore}</div>
          <div className="score-ring-label">Overall</div>
        </div>

        {/* Grade cards */}
        <div className="grades-section">
          {gradeEntries.map((grade, i) => (
            <GradeCard key={grade.label} grade={grade} index={i} />
          ))}
        </div>

        {/* Highlights */}
        {showHighlights && scores.highlights && (
          <div className="highlights-section">
            <div className="highlight-card highlight-strong">
              <div className="highlight-icon">★</div>
              <div>
                <div className="highlight-title">Strongest Moment</div>
                <div className="highlight-text">{scores.highlights.strongestMoment}</div>
              </div>
            </div>

            <div className="highlight-card highlight-growth">
              <div className="highlight-icon">↑</div>
              <div>
                <div className="highlight-title">Growth Edge</div>
                <div className="highlight-text">{scores.highlights.growthEdge}</div>
              </div>
            </div>

            {scores.highlights.tacticsDetected?.length > 0 && (
              <div className="highlight-card highlight-tactics">
                <div className="highlight-icon">⚡</div>
                <div>
                  <div className="highlight-title">Tactics Detected</div>
                  <div className="tactics-list">
                    {scores.highlights.tacticsDetected.map((t, i) => (
                      <span key={i} className="tactic-tag">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Debrief explainer */}
        {showHighlights && (
          <div className="debrief-section">
            <h3>What was happening</h3>
            <p>
              The Bridge used <strong>Socratic questioning</strong> to test whether you could
              articulate the reasoning behind your beliefs — not just assert your conclusions.
              When you felt friction, that was the exercise working. That's what respectful
              disagreement feels like when someone refuses to accept your framing.
            </p>
            <p>
              Research shows most Americans dramatically overestimate how extreme the "other side" is.
              You just practiced closing that <strong>perception gap</strong> — not by agreeing, but
              by listening and articulating.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="report-actions">
          <button className="btn btn-primary" onClick={onRestart}>
            Spar Again
          </button>
          <a
            className="btn btn-ghost"
            href="https://sharedgroundmedia.substack.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read More on Substack
          </a>
          <button className="btn btn-ghost" onClick={onHome}>
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
