import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AvatarSession,
  AvatarVideo,
  useAvatarSession,
  useLocalMedia,
} from '@runwayml/avatars-react';
import '@runwayml/avatars-react/styles.css';

const SESSION_DURATION = 5 * 60;

function CallUI({ timeLeft, survey, onEnd, transcriptLines }) {
  const { state, end } = useAvatarSession();
  const { isMicEnabled, toggleMic } = useLocalMedia();

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
        <AvatarVideo
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '8px',
          }}
        />
      </div>

      {transcriptLines.length > 0 && (
        <div className="transcript-ticker">
          <span className="transcript-dot" />
          <span className="transcript-last">
            {transcriptLines[transcriptLines.length - 1]?.text.slice(0, 80)}
            {transcriptLines[transcriptLines.length - 1]?.text.length > 80 ? '...' : ''}
          </span>
        </div>
      )}

      <div className="session-controls">
        <button className="btn btn-ghost" onClick={toggleMic} style={{ marginRight: '0.5rem' }}>
          {isMicEnabled ? 'Mute' : 'Unmute'}
        </button>
        <button
          className="btn btn-danger"
          onClick={() => {
            try { end(); } catch (e) { /* ok */ }
            onEnd();
          }}
        >
          End Session Early
        </button>
      </div>
    </div>
  );
}

export default function Session({ avatarId, survey, onSessionEnd }) {
  const [phase, setPhase] = useState('init');
  const [credentials, setCredentials] = useState(null);
  const [timeLeft, setTimeLeft] = useState(SESSION_DURATION);
  const [transcriptLines, setTranscriptLines] = useState([]);
  const timerRef = useRef(null);
  const timeoutRef = useRef(null);
  const hasEndedRef = useRef(false);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef([]);

  // ─── Web Speech API for transcript capture ───
  const startTranscription = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported in this browser');
      return;
    }

    console.log('Starting Web Speech API transcription...');
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
      if (!hasEndedRef.current && (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'network')) {
        setTimeout(() => {
          if (!hasEndedRef.current) {
            try { recognition.start(); } catch (e) { /* already running */ }
          }
        }, 500);
      }
    };

    recognition.onend = () => {
      console.log('Speech recognition ended, restarting...');
      if (!hasEndedRef.current) {
        setTimeout(() => {
          if (!hasEndedRef.current) {
            try { recognition.start(); } catch (e) { /* already running */ }
          }
        }, 200);
      }
    };

    try {
      recognition.start();
      console.log('Web Speech API started successfully');
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
    }

    recognitionRef.current = recognition;
  }, []);

  const stopTranscription = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* ok */ }
      recognitionRef.current = null;
    }
  }, []);

  // ─── End session ───
  const endSession = useCallback(async () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    clearInterval(timerRef.current);
    clearTimeout(timeoutRef.current);
    stopTranscription();

    console.log('Ending session. Transcript lines captured:', transcriptRef.current.length);

    setPhase('fetching');
    setCredentials(null);

    const fullTranscript = transcriptRef.current
      .map((line) => `${line.speaker}: ${line.text}`)
      .join('\n');

    console.log('Full transcript:', fullTranscript || '(empty)');

    // If we got transcript from Web Speech API, use it
    if (fullTranscript) {
      console.log('Using Web Speech API transcript');
      onSessionEnd(fullTranscript);
      return;
    }

    // Fallback: try to get transcript from Runway
    console.log('No Web Speech transcript — trying Runway API...');
    onSessionEnd('[No transcript captured. For best results, use Chrome and allow microphone access. The Web Speech API needs to run alongside the avatar conversation.]');
  }, [onSessionEnd, stopTranscription]);

  // ─── Provision session ───
  useEffect(() => {
    if (phase !== 'init') return;
    setPhase('provisioning');

    async function provision() {
      try {
        console.log('Provisioning session for avatar:', avatarId);
        const res = await fetch('/api/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarId }),
        });

        if (!res.ok) {
          const err = await res.text();
          console.error('Create session failed:', res.status, err);
          onSessionEnd('[Session creation failed: ' + err + ']');
          return;
        }

        const data = await res.json();
        console.log('Session created:', data.sessionId);

        setCredentials({
          serverUrl: data.serverUrl,
          token: data.token,
          roomName: data.roomName,
        });
        setPhase('live');

        // Start transcription BEFORE the avatar connects
        // This gives Web Speech API time to get mic access first
        startTranscription();

        // Start timer
        console.log('Starting 5-minute timer');
        const startTime = Date.now();
        timerRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const remaining = SESSION_DURATION - elapsed;
          if (remaining <= 0) {
            clearInterval(timerRef.current);
            setTimeLeft(0);
          } else {
            setTimeLeft(remaining);
          }
        }, 1000);

        // Hard timeout
        timeoutRef.current = setTimeout(() => {
          console.log('5-minute hard timeout — ending session');
          endSession();
        }, SESSION_DURATION * 1000);

      } catch (err) {
        console.error('Provisioning error:', err);
        onSessionEnd('[Connection error: ' + err.message + ']');
      }
    }

    provision();
  }, [phase, avatarId, onSessionEnd, endSession, startTranscription]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(timeoutRef.current);
      stopTranscription();
    };
  }, [stopTranscription]);

  if (phase === 'provisioning' || phase === 'init') {
    return (
      <div className="screen session-screen">
        <div className="session-avatar-area">
          <div className="connecting-overlay">
            <div className="scoring-spinner" />
            <p>Provisioning session...</p>
            <p className="connecting-hint">This takes a few seconds.</p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'fetching') {
    return (
      <div className="screen session-screen">
        <div className="session-avatar-area">
          <div className="connecting-overlay">
            <div className="scoring-spinner" />
            <p>Session complete — analyzing your performance...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!credentials) return null;

  return (
    <AvatarSession credentials={credentials} audio video>
      <CallUI
        timeLeft={timeLeft}
        survey={survey}
        onEnd={endSession}
        transcriptLines={transcriptLines}
      />
    </AvatarSession>
  );
}
