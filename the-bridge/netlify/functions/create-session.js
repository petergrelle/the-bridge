// netlify/functions/create-session.js
// Creates a Runway realtime session, polls until ready, consumes credentials

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { avatarId, personality, startScript } = JSON.parse(event.body);
  const apiKey = process.env.RUNWAYML_API_SECRET;
  const baseUrl = 'https://api.dev.runwayml.com';
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Runway-Version': '2024-11-06',
  };

  try {
    // 1. Create session
    const createBody = {
      model: 'gwm1_avatars',
      avatar: {
        type: 'custom',
        avatarId: avatarId || process.env.RUNWAY_AVATAR_ID,
      },
    };

    // If personality override is provided (from survey), pass it
    if (personality) {
      createBody.avatar.personality = personality;
    }
    if (startScript) {
      createBody.avatar.startScript = startScript;
    }

    const createRes = await fetch(`${baseUrl}/v1/realtime_sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(createBody),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      console.error('Create session error:', err);
      return { statusCode: createRes.status, body: err };
    }

    const session = await createRes.json();
    const sessionId = session.id;

    // 2. Poll until ready (max 60 seconds)
    let sessionKey = null;
    for (let i = 0; i < 60; i++) {
      const pollRes = await fetch(`${baseUrl}/v1/realtime_sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-Runway-Version': '2024-11-06',
        },
      });
      const pollData = await pollRes.json();

      if (pollData.status === 'READY') {
        sessionKey = pollData.sessionKey;
        break;
      }
      if (pollData.status === 'FAILED') {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Session failed', details: pollData.failure }),
        };
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!sessionKey) {
      return { statusCode: 504, body: JSON.stringify({ error: 'Session timed out' }) };
    }

    // 3. Consume session credentials
    const consumeRes = await fetch(`${baseUrl}/v1/realtime_sessions/${sessionId}/consume`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionKey}`,
        'X-Runway-Version': '2024-11-06',
      },
    });

    const credentials = await consumeRes.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        serverUrl: credentials.url,
        token: credentials.token,
        roomName: credentials.roomName,
      }),
    };
  } catch (err) {
    console.error('Session creation error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error', message: err.message }),
    };
  }
}
