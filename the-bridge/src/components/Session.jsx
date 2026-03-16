import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AvatarCall } from '@runwayml/avatars-react';
import '@runwayml/avatars-react/styles.css';

const SESSION_DURATION = 5 * 60;

export default function Session({ avatarId, survey, onSessionEnd }) {
  const [timeLeft, setTimeLeft] = useState(SESSION_DURATION);
  const [status, setStatus] = useState('connecting');
  const [showAvatar, setShowAvatar] = useState(true);
  const [transcriptLines, setTranscriptLines] = useState([]);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const transcriptRef = useRef([]);
  const sessionActiveRef = useRef(false);
  const hasEndedRef = useRef(false);

  // ─── Web Speech API transcript capture ───
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
            console.log('Transcript captured:', text);
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

  // ─── End session (called once only) ───
  const endSession = useCallback(() => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    console.log('Ending session, transcript lines:', transcriptRef.current.length);

    stopTranscription();
    clearInterval(timerRef.current);

    // Unmount the AvatarCall component to kill the WebRTC connection
    setShowAvatar(false);

    const fullTranscript = transcriptRef.current
      .map((line) => `${line.speaker}: ${line.text}`)
      .join('\n');

    console.log('Full transcript:', fullTranscript || '(empty)');

    // Give a moment for cleanup, then transition
    setTimeout(() => {
      onSessionEnd(
        fullTranscript ||
          '[No transcript captured — Web Speech API may not be supported in this browser]'
      );
    }, 1000);
  }, [stopTranscription, onSessionEnd]);

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
    startTranscription();
  }, [startTranscription]);

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
