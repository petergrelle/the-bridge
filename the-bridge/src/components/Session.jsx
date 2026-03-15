import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AvatarCall } from '@runwayml/avatars-react';
import '@runwayml/avatars-react/styles.css';

const SESSION_DURATION = 5 * 60;

export default function Session({ avatarId, survey, onSessionEnd }) {
  const [timeLeft, setTimeLeft] = useState(SESSION_DURATION);
  const [status, setStatus] = useState('connecting');
  const [transcriptLines, setTranscriptLines] = useState([]);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const transcriptRef = useRef([]);
  const sessionActiveRef = useRef(false);

  const startTranscription = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported');
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
      if (event.error === 'no-speech' || event.error === 'aborted') {
        if (sessionActiveRef.current) {
          try { recognition.start(); } catch (e) { /* already running */ }
        }
      }
    };

    recognition.onend = () => {
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

    const fullTranscript = transcriptRef.current
      .map((line) => `${line.speaker}: ${line.text}`)
      .join('\n');

    setTimeout(() => {
      onSessionEnd(fullTranscript || '[No transcript captured — Web Speech API may not be supported in this browser]');
    }, 500);
  }, [status, stopTranscription, onSessionEnd]);

  const handleEndEarly = useCallback(() => {
    handleSessionComplete();
  }, [handleSessionComplete]);

  useEffect(() => {
    return () => {
      stopTranscription();
      clearInterval(timerRef.current);
    };
  }, [stopTranscription]);

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
      </div>

      {status === 'active' && transcriptLines.length > 0 && (
        <div className="transcript-ticker">
          <span className="transcript-dot" />
          <span className="transcript-last">
            {transcriptLines[transcriptLines.length - 1]?.text.slice(0, 80)}
            {transcriptLines[transcriptLines.length - 1]?.text.length > 80 ? '...' : ''}
          </span>
        </div>
      )}

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
