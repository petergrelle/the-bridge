import React, { useState, useEffect, useRef, useCallback } from 'react';

// NOTE: If you're using the Runway React SDK's AvatarCall component,
// uncomment the import below and use Option A in the render.
// import { AvatarCall } from '@runwayml/avatars-react';
// import '@runwayml/avatars-react/styles.css';

const SESSION_DURATION = 5 * 60; // 5 minutes in seconds

export default function Session({ avatarId, survey, onSessionEnd }) {
  const [timeLeft, setTimeLeft] = useState(SESSION_DURATION);
  const [status, setStatus] = useState('connecting'); // connecting | active | ending
  const [transcriptLines, setTranscriptLines] = useState([]);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const transcriptRef = useRef([]);
  const sessionActiveRef = useRef(false);

  // ─── Web Speech API transcript capture ───
  const startTranscription = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported — transcript will be unavailable');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (text) {
            const line = { speaker: 'USER', text, timestamp: Date.now() };
            transcriptRef.current.push(line);
            setTranscriptLines((prev) => [...prev, line]);
          }
        }
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      // Restart on recoverable errors
      if (event.error === 'no-speech' || event.error === 'aborted') {
        if (sessionActiveRef.current) {
          try { recognition.start(); } catch (e) { /* already running */ }
        }
      }
    };

    recognition.onend = () => {
      // Auto-restart if session is still active
      if (sessionActiveRef.current) {
        try { recognition.start(); } catch (e) { /* already running */ }
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, []);

  const stopTranscription = useCallback(() => {
    sessionActiveRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* ok */ }
      recognitionRef.current = null;
    }
  }, []);

  // ─── Timer ───
  useEffect(() => {
    if (status !== 'active') return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSessionComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [status]);

  // ─── Session lifecycle ───
  const handleSessionReady = useCallback(() => {
    setStatus('active');
    sessionActiveRef.current = true;
    startTranscription();
  }, [startTranscription]);

  const handleSessionComplete = useCallback(() => {
    if (status === 'ending') return;
    setStatus('ending');
    stopTranscription();
    clearInterval(timerRef.current);

    // Build transcript string
    const fullTranscript = transcriptRef.current
      .map((line) => `${line.speaker}: ${line.text}`)
      .join('\n');

    // Small delay to let final speech results come in
    setTimeout(() => {
      onSessionEnd(fullTranscript || '[No transcript captured — Web Speech API may not be supported in this browser]');
    }, 500);
  }, [status, stopTranscription, onSessionEnd]);

  const handleEndEarly = useCallback(() => {
    handleSessionComplete();
  }, [handleSessionComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTranscription();
      clearInterval(timerRef.current);
    };
  }, [stopTranscription]);

  // Format timer
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timerStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const timerPct = ((SESSION_DURATION - timeLeft) / SESSION_DURATION) * 100;

  return (
    <div className="screen session-screen">
      {/* Timer bar */}
      <div className="session-timer-bar">
        <div className="timer-fill" style={{ width: `${timerPct}%` }} />
      </div>

      <div className="session-header">
        <div className={`timer-display ${timeLeft <= 30 ? 'timer-warning' : ''}`}>
          {timerStr}
        </div>
        <div className="session-topic">{survey.topic}</div>
      </div>

      {/* ─── Runway Avatar Area ─── */}
      <div className="session-avatar-area">
        {status === 'connecting' && (
          <div className="connecting-overlay">
            <div className="scoring-spinner" />
            <p>Connecting to The Bridge...</p>
            <p className="connecting-hint">Make sure your microphone is enabled.</p>
            {/*
              AUTO-CONNECT: Remove this button and call handleSessionReady()
              from the AvatarCall onConnect callback once you wire in the SDK.
            */}
            <button className="btn btn-primary" onClick={handleSessionReady} style={{ marginTop: '1.5rem' }}>
              Simulate Session Start
            </button>
          </div>
        )}

        {/*
          ════════════════════════════════════════════════
          RUNWAY SDK INTEGRATION — OPTION A (Recommended)
          ════════════════════════════════════════════════
          
          Uncomment this block and remove the placeholder above.
          The AvatarCall component handles all WebRTC.

          <AvatarCall
            avatarId={avatarId}
            connectUrl="/api/create-session"
            onConnect={handleSessionReady}
            onEnd={handleSessionComplete}
            onError={(err) => {
              console.error('Avatar error:', err);
              handleSessionComplete();
            }}
          />

          ════════════════════════════════════════════════
        */}

        {status === 'active' && (
          <div className="session-active-placeholder">
            <div className="avatar-placeholder-ring">
              <div className="avatar-placeholder-inner">
                <span className="avatar-pulse" />
              </div>
            </div>
            <p className="session-active-label">Session Active — Speak naturally</p>
          </div>
        )}
      </div>

      {/* Live transcript indicator */}
      {status === 'active' && transcriptLines.length > 0 && (
        <div className="transcript-ticker">
          <span className="transcript-dot" />
          <span className="transcript-last">
            {transcriptLines[transcriptLines.length - 1]?.text.slice(0, 80)}
            {transcriptLines[transcriptLines.length - 1]?.text.length > 80 ? '...' : ''}
          </span>
        </div>
      )}

      {/* Controls */}
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
