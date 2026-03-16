import React, { useState, useEffect, useCallback } from 'react';
import Landing from './components/Landing';
import Survey from './components/Survey';
import Session from './components/Session';
import ReportCard from './components/ReportCard';
import CapacityError from './components/CapacityError';

const AVATAR_ID = import.meta.env.VITE_RUNWAY_AVATAR_ID || '';
const WHOP_CHECKOUT_URL = import.meta.env.VITE_WHOP_CHECKOUT_URL || '';

export default function App() {
  const [phase, setPhase] = useState('landing');
  const [survey, setSurvey] = useState(null);
  const [scores, setScores] = useState(null);
  const [error, setError] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState(null); // { membershipId, source }
  const [capacityData, setCapacityData] = useState(null); // rain check info

  // ─── Check URL for Whop redirect on mount ───
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get('payment_id') || params.get('receipt_id');
    const checkoutStatus = params.get('checkout_status') || params.get('status');
    const membershipId = params.get('membership_id') || paymentId;

    if (membershipId && checkoutStatus === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
      validatePayment(membershipId);
    }

    // Check for stored rain check
    const storedRainCheck = localStorage.getItem('bridge_rain_check');
    if (storedRainCheck) {
      try {
        const rc = JSON.parse(storedRainCheck);
        if (rc.token && new Date(rc.expiresAt) > new Date()) {
          setPaymentInfo({ rainCheckToken: rc.token, source: 'rain_check' });
          // Don't auto-advance — let them click "Start" which will show the rain check option
        }
      } catch (e) {
        localStorage.removeItem('bridge_rain_check');
      }
    }
  }, []);

  const validatePayment = useCallback(async (membershipId) => {
    setPhase('validating');
    try {
      const res = await fetch('/api/validate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId }),
      });

      const data = await res.json();

      if (data.valid) {
        setPaymentInfo({ membershipId, source: 'whop' });
        setPhase('survey');
      } else {
        setError('Payment could not be verified. Please try again.');
        setPhase('landing');
      }
    } catch (err) {
      console.error('Payment validation error:', err);
      setError('Payment verification failed. Please try again.');
      setPhase('landing');
    }
  }, []);

  const validateRainCheck = useCallback(async (token) => {
    setPhase('validating');
    try {
      const res = await fetch('/api/validate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rainCheckToken: token }),
      });

      const data = await res.json();

      if (data.valid) {
        // Remove the used rain check
        localStorage.removeItem('bridge_rain_check');
        setPaymentInfo({ rainCheckToken: token, source: 'rain_check' });
        setPhase('survey');
      } else {
        setError('This rain check has expired or is invalid.');
        setPhase('landing');
      }
    } catch (err) {
      console.error('Rain check validation error:', err);
      setError('Could not validate rain check. Please try again.');
      setPhase('landing');
    }
  }, []);

  const handleStartSession = useCallback(() => {
    // Check for stored rain check first
    const storedRainCheck = localStorage.getItem('bridge_rain_check');
    if (storedRainCheck) {
      try {
        const rc = JSON.parse(storedRainCheck);
        if (rc.token && new Date(rc.expiresAt) > new Date()) {
          validateRainCheck(rc.token);
          return;
        } else {
          localStorage.removeItem('bridge_rain_check');
        }
      } catch (e) {
        localStorage.removeItem('bridge_rain_check');
      }
    }

    // No rain check — redirect to Whop checkout
    if (WHOP_CHECKOUT_URL) {
      const redirectUrl = encodeURIComponent(window.location.origin);
      window.location.href = `${WHOP_CHECKOUT_URL}?redirect_url=${redirectUrl}`;
    } else {
      // No Whop configured — go straight to survey (free mode / testing)
      setPhase('survey');
    }
  }, [validateRainCheck]);

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

  const handleCapacityError = useCallback(async () => {
    // Issue a rain check
    try {
      const res = await fetch('/api/issue-rain-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membershipId: paymentInfo?.membershipId,
          survey,
        }),
      });

      const data = await res.json();

      // Store rain check locally
      localStorage.setItem('bridge_rain_check', JSON.stringify({
        token: data.token,
        expiresAt: data.expiresAt,
        id: data.id,
      }));

      setCapacityData(data);
      setPhase('capacity');
    } catch (err) {
      console.error('Rain check error:', err);
      setCapacityData({ error: 'Could not issue rain check. Contact support.' });
      setPhase('capacity');
    }
  }, [paymentInfo, survey]);

  const handleRestart = useCallback(() => {
    setSurvey(null);
    setScores(null);
    setError(null);
    setPaymentInfo(null);
    setCapacityData(null);
    setPhase('landing');
  }, []);

  return (
    <div className="app">
      {phase === 'landing' && (
        <Landing
          onStart={handleStartSession}
          error={error}
          hasRainCheck={!!localStorage.getItem('bridge_rain_check')}
        />
      )}
      {phase === 'validating' && <ValidatingScreen />}
      {phase === 'survey' && <Survey onComplete={handleSurveyComplete} />}
      {phase === 'session' && (
        <Session
          avatarId={AVATAR_ID}
          survey={survey}
          onSessionEnd={handleSessionEnd}
          onCapacityError={handleCapacityError}
        />
      )}
      {phase === 'scoring' && <ScoringScreen />}
      {phase === 'report' && (
        <ReportCard
          scores={scores}
          error={error}
          survey={survey}
          onRestart={handleRestart}
          onHome={handleRestart}
        />
      )}
      {phase === 'capacity' && (
        <CapacityError
          data={capacityData}
          onHome={handleRestart}
        />
      )}
    </div>
  );
}

function ValidatingScreen() {
  return (
    <div className="screen scoring-screen">
      <div className="scoring-content">
        <div className="scoring-spinner" />
        <h2>Verifying your purchase...</h2>
      </div>
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
