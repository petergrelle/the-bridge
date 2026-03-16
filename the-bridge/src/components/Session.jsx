import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AvatarCall } from '@runwayml/avatars-react';
import '@runwayml/avatars-react/styles.css';

const SESSION_DURATION = 5 * 60;

export default function Session({ avatarId, survey, onSessionEnd }) {
  const [timeLeft, setTimeLeft] = useState(SESSION_DURATION);
  const [status, setStatus] = useState('connecting');
  const [showAvatar, setShowAvatar] = useState(true);
  const [transcriptLines, setTranscriptLines] = useState([]);
  const timerRef = useRef(null);
  const sessionActiveRef = useRef(false);
  const hasEndedRef = useRef(false);
  const sessionIdRef = useRef(null);

  // ─── Capture session ID from the create-session response ───
  // We intercept the fetch to grab the sessionId for later transcript retrieval
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      // Clone the response so we can read it without consuming it
      if (typeof args[0] === 'string' && args[0].includes('create-session')) {
        const clone = response.clone();
        try {
          const data = await clone.json();
          if (data.sessionId) {
            sessionIdRef.current = data.sessionId;
            console.log('Captured session ID:', data.sessionId);
          }
        } catch (e) {
          // ignore parse errors
        }
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // ─── Fetch transcript from Runway API ───
  const fetchRunwayTranscript = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) {
      console.warn('No session ID available for transcript fetch');
      return null;
    }

    console.log('Fetching Runway transcript for session:', sid);

    try {
      const res = await fetch('/api/get-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      });

      if (!res.ok) {
        console.error('Transcript fetch failed:', res.status);
        return null;
      }

      const data = await res.json();
      console.log('Runway session data:', JSON.stringify(data).slice(0, 500));

      // The transcript could be in various fields - check all possibilities
      if (data.transcript) {
        // Could be a string or an array of objects
        if (typeof data.transcript === 'string') {
          return data.transcript;
        }
        if (Array.isArray(data.transcript)) {
          return data.transcript
            .map((t) => `${t.speaker || t.role || 'UNKNOWN'}: ${t.text || t.content || ''}`)
            .join('\n');
        }
        return JSON.stringify(data.transcript);
      }

      if (data.messages) {
        return data.messages
          .map((m) => `${m.role || m.speaker || 'UNKNOWN'}: ${m.content || m.text || ''}`)
          .join('\n');
      }

      if (data.conversation) {
        if (typeof data.conversation === 'string') return data.conversation;
        return JSON.stringify(data.conversation);
      }

      // If we can't find a known transcript field, return the whole thing for debugging
      console.log('No known transcript field found. Full data:', JSON.stringify(data));
      return null;
    } catch (err) {
      console.error('Error fetching transcript:', err);
      return null;
    }
  }, []);

  // ─── End session (called once only) ───
  const endSession = useCallback(async () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    console.log('Ending session...');
    sessionActiveRef.current = false;
    clearInterval(timerRef.current);

    // Unmount AvatarCall to kill the WebRTC connection
    setShowAvatar(false);
    setStatus('ending');

    // Wait a moment for Runway to process, then fetch transcript
    await new Promise((r) => setTimeout(r, 2000));

    const transcript = await fetchRunwayTranscript();
    console.log('Retrieved transcript:', transcript ? transcript.slice(0, 200) : '(none)');

    onSessionEnd(
      transcript ||
        '[No transcript available — session data may still be processing]'
    );
  }, [fetchRunwayTranscript, onSessionEnd]);

  // ─── Timer ───
  useEffect(() => {
    if (status !== 'active') return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          endSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [status, endSession]);

  // ─── Callbacks for AvatarCall ───
  const handleSessionReady = useCallback(() => {
    console.log('Avatar connected — session active');
    setStatus('active');
    sessionActiveRef.current = true;
  }, []);

  const handleAvatarEnd = useCallback(() => {
    console.log('AvatarCall onEnd fired');
    endSession();
  }, [endSession]);

  const handleAvatarError = useCallback((err) => {
    console.error('Avatar error:', err);
    endSession();
  }, [endSession]);

  const handleEndEarly = useCallback(() => {
    endSession();
  }, [endSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
    };
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timerStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const timerPct = ((SESSION_DURATION - timeLeft) / SESSION_DURATION) * 100;

  return (
    <div className="screen session-screen">
      <div className="session-timer-bar">
        <div className="timer-fill" style={{ width: `${timerPct}%` }} />
      </div>

      <div className="session-header">
        <div className={`timer-display ${timeLeft <= 30 ? 'timer-warning' : ''}`}>
          {timerStr}
        </div>
        <div className="session-topic">{survey.topic}</div>
      </div>

      <div className="session-avatar-area">
        {status === 'connecting' && (
          <div className="connecting-overlay">
            <div className="scoring-spinner" />
            <p>Connecting to The Bridge...</p>
            <p className="connecting-hint">Make sure your microphone is enabled.</p>
          </div>
        )}

        {status === 'ending' && (
          <div className="connecting-overlay">
            <div className="scoring-spinner" />
            <p>Session complete — retrieving transcript...</p>
          </div>
        )}

        {showAvatar && (
          <AvatarCall
            avatarId={avatarId}
            connectUrl="/api/create-session"
            onConnect={handleSessionReady}
            onEnd={handleAvatarEnd}
            onError={handleAvatarError}
          />
        )}
      </div>

      {status === 'active' && (
        <div className="session-controls">
          <button className="btn btn-danger" onClick={handleEndEarly}>
            End Session Early
          </button>
        </div>
      )}
    </div>
  );
}
