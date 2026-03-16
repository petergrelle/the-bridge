import React from 'react';

export default function CapacityError({ data, onHome }) {
  return (
    <div className="screen landing-screen">
      <div className="landing-content">
        <div className="landing-badge" style={{ color: '#f39c12' }}>SESSION AT CAPACITY</div>
        <h1 className="landing-title" style={{ fontSize: '2.5rem' }}>
          We're at capacity<br />
          <span className="landing-title-accent">right now</span>
        </h1>
        <p className="landing-subtitle">
          All available session slots are currently in use. This happens during
          peak demand — our AI infrastructure has daily limits to maintain quality.
        </p>

        {data?.token ? (
          <div className="rain-check-card">
            <div className="rain-check-header">
              <span className="rain-check-icon">🎫</span>
              <span>Your Rain Check</span>
            </div>
            <p className="rain-check-detail">
              We've saved your spot. Come back anytime in the next 7 days and your
              session will be free — no need to pay again.
            </p>
            <div className="rain-check-meta">
              <span>ID: {data.id}</span>
              <span>Expires: {new Date(data.expiresAt).toLocaleDateString()}</span>
            </div>
            <p className="rain-check-saved">
              Saved automatically — just come back to this site and click "Start."
            </p>
          </div>
        ) : (
          <div className="rain-check-card" style={{ borderColor: 'rgba(231, 76, 60, 0.3)' }}>
            <p>{data?.error || 'Could not issue a rain check. Please contact support for a refund.'}</p>
          </div>
        )}

        <div className="report-actions" style={{ marginTop: '1.5rem' }}>
          <button className="btn btn-primary" onClick={onHome}>
            Back to Home
          </button>
          <a
            className="btn btn-ghost"
            href="https://sharedgroundmedia.substack.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read on Substack While You Wait
          </a>
        </div>
      </div>
    </div>
  );
}
