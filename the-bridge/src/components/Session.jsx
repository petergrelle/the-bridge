import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AvatarSession,
  AvatarVideo,
  useAvatarSession,
  useLocalMedia,
} from '@runwayml/avatars-react';
import '@runwayml/avatars-react/styles.css';

const SESSION_DURATION = 5 * 60;

// ─── Inner component that uses the SDK hooks ───
function CallUI({ onReady, onEnd, timeLeft, survey }) {
  const { state, end } = useAvatarSession();
  const { isMicEnabled, toggleMic } = useLocalMedia();

  useEffect(() => {
    if (state === 'connected') {
      onReady();
    }
  }, [state, onReady]);

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
        {(state === 'connecting' || state === 'idle') && (
          <div className="connecting-overlay">
            <div className="scoring-spinner" />
            <p>Connecting to The Bridge...</p>
            <p className="connecting-hint">Make sure your microphone is enabled.</p>
          </div>
        )}
        <AvatarVideo
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '8px',
          }}
        />
      </div>

      {state === 'connected' && (
        <div className="session-controls">
          <button className="btn btn-ghost" onClick={toggleMic} style={{ marginRight: '0.5rem' }}>
            {isMicEnabled ? 'Mute' : 'Unmute'}
          </button>
          <button className="btn btn-danger" onClick={() => { end(); onEnd(); }}>
            End Session Early
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Session component ───
export default function Session({ avatarId, survey, onSessionEnd }) {
  const [phase, setPhase] = useState('init'); // init | provisioning | live | ending | fetching
  const [credentials, setCredentials] = useState(null);
  const [timeLeft, setTimeLeft] = useState(SESSION_DURATION);
  const timerRef = useRef(null);
  const hasEndedRef = useRef(false);
  const sessionIdRef = useRef(null);

  // ─── Step 1: Provision the session ourselves ───
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
        console.log('Session created. Keys:', Object.keys(data));
        console.log('Session data:', JSON.stringify(data).slice(0, 300));

        // Capture sessionId for transcript retrieval
        sessionIdRef.current = data.sessionId;
        console.log('Stored session ID:', data.sessionId);

        setCredentials({
          serverUrl: data.serverUrl,
          token: data.token,
          roomName: data.roomName,
        });
        setPhase('live');
      } catch (err) {
        console.error('Provisioning error:', err);
        onSessionEnd('[Connection error: ' + err.message + ']');
      }
    }

    provision();
  }, [phase, avatarId, onSessionEnd]);

  // ─── Step 2: Timer ───
  const endSession = useCallback(async () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    clearInterval(timerRef.current);
    setPhase('fetching');
    setCredentials(null); // unmount AvatarSession

    console.log('Session ended. Waiting for Runway to process transcript...');
    await new Promise((r) => setTimeout(r, 3000));

    const sid = sessionIdRef.current;
    if (!sid) {
      console.warn('No session ID — cannot fetch transcript');
      onSessionEnd('[No session ID available for transcript retrieval]');
      return;
    }

    console.log('Fetching transcript for session:', sid);
    try {
      const res = await fetch('/api/get-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      });

      if (!res.ok) {
        console.error('Transcript fetch failed:', res.status);
        onSessionEnd('[Transcript retrieval failed]');
        return;
      }

      const data = await res.json();
      console.log('Runway session data keys:', Object.keys(data));
      console.log('Full session data:', JSON.stringify(data).slice(0, 1000));

      // Try to find transcript in various possible fields
      let transcript = null;

      if (data.transcript) {
        if (typeof data.transcript === 'string') {
          transcript = data.transcript;
        } else if (Array.isArray(data.transcript)) {
          transcript = data.transcript
            .map((t) => `${t.speaker || t.role || 'UNKNOWN'}: ${t.text || t.content || ''}`)
            .join('\n');
        } else {
          transcript = JSON.stringify(data.transcript);
        }
      } else if (data.messages) {
        transcript = data.messages
          .map((m) => `${m.role || m.speaker}: ${m.content || m.text}`)
          .join('\n');
      } else if (data.conversation) {
        transcript = typeof data.conversation === 'string'
          ? data.conversation
          : JSON.stringify(data.conversation);
      }

      console.log('Extracted transcript:', transcript ? transcript.slice(0, 300) : '(none)');
      onSessionEnd(transcript || '[Transcript not yet available — check Runway dev portal]');
    } catch (err) {
      console.error('Transcript error:', err);
      onSessionEnd('[Error retrieving transcript: ' + err.message + ']');
    }
  }, [onSessionEnd]);

  const handleReady = useCallback(() => {
    console.log('Avatar connected — starting timer');
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
  }, [endSession]);

  // Cleanup
  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  // ─── Render ───
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

  if (phase === 'fetching' || phase === 'ending') {
    return (
      <div className="screen session-screen">
        <div className="session-avatar-area">
          <div className="connecting-overlay">
            <div className="scoring-spinner" />
            <p>Session complete — retrieving transcript...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!credentials) return null;

  return (
    <AvatarSession credentials={credentials} audio video>
      <CallUI
        onReady={handleReady}
        onEnd={endSession}
        timeLeft={timeLeft}
        survey={survey}
      />
    </AvatarSession>
  );
}
