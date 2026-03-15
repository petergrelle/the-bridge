import React from 'react';

export default function Landing({ onStart }) {
  return (
    <div className="screen landing-screen">
      <div className="landing-content">
        <div className="landing-badge">SHARED GROUND MEDIA</div>
        <h1 className="landing-title">
          The<br />
          <span className="landing-title-accent">Bridge</span>
        </h1>
        <p className="landing-subtitle">
          A 5-minute conversation with someone who disagrees with you — calmly,
          respectfully, and on purpose.
        </p>
        <div className="landing-features">
          <div className="feature">
            <span className="feature-icon">◉</span>
            <span>Pick a topic you feel strongly about</span>
          </div>
          <div className="feature">
            <span className="feature-icon">◉</span>
            <span>Debate a live AI that holds the opposing view</span>
          </div>
          <div className="feature">
            <span className="feature-icon">◉</span>
            <span>Get scored on reasoning, empathy, and resilience</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={onStart}>
          Start a Sparring Session
        </button>
        <p className="landing-disclaimer">
          This is an AI simulation. No data is stored. You can leave anytime.
        </p>
      </div>
    </div>
  );
}
