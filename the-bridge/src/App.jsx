import React, { useState, useCallback } from 'react';
import Landing from './components/Landing';
import Survey from './components/Survey';
import Session from './components/Session';
import ReportCard from './components/ReportCard';

const AVATAR_ID = import.meta.env.VITE_RUNWAY_AVATAR_ID || '';

export default function App() {
  const [phase, setPhase] = useState('landing'); // landing | survey | connecting | session | scoring | report
  const [survey, setSurvey] = useState(null);
  const [scores, setScores] = useState(null);
  const [error, setError] = useState(null);

  const handleStartSurvey = useCallback(() => {
    setPhase('survey');
  }, []);

  const handleSurveyComplete = useCallback((surveyData) => {
    setSurvey(surveyData);
    setPhase('session');
  }, []);

  const handleSessionEnd = useCallback(async (transcript) => {
    setPhase('scoring');
    try {
      const res = await fetch('/api/score-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, survey }),
      });
      if (!res.ok) throw new Error(`Scoring failed: ${res.status}`);
      const data = await res.json();
      setScores(data);
      setPhase('report');
    } catch (err) {
      console.error('Scoring error:', err);
      setError(err.message);
      setPhase('report');
    }
  }, [survey]);

  const handleRestart = useCallback(() => {
    setSurvey(null);
    setScores(null);
    setError(null);
    setPhase('survey');
  }, []);

  const handleBackToStart = useCallback(() => {
    setSurvey(null);
    setScores(null);
    setError(null);
    setPhase('landing');
  }, []);

  return (
    <div className="app">
      {phase === 'landing' && <Landing onStart={handleStartSurvey} />}
      {phase === 'survey' && <Survey onComplete={handleSurveyComplete} />}
      {phase === 'session' && (
        <Session
          avatarId={AVATAR_ID}
          survey={survey}
          onSessionEnd={handleSessionEnd}
        />
      )}
      {phase === 'scoring' && <ScoringScreen />}
      {phase === 'report' && (
        <ReportCard
          scores={scores}
          error={error}
          survey={survey}
          onRestart={handleRestart}
          onHome={handleBackToStart}
        />
      )}
    </div>
  );
}

function ScoringScreen() {
  return (
    <div className="screen scoring-screen">
      <div className="scoring-content">
        <div className="scoring-spinner" />
        <h2>Analyzing your session...</h2>
        <p>Reviewing your reasoning, emotional regulation, and argumentation patterns.</p>
      </div>
    </div>
  );
}
