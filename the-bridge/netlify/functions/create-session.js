export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.RUNWAYML_API_SECRET;
  const avatarId = process.env.RUNWAY_AVATAR_ID;
  const baseUrl = 'https://api.dev.runwayml.com';
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Runway-Version': '2024-11-06',
  };

  try {
    // 1. Create session
    const createRes = await fetch(`${baseUrl}/v1/realtime_sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'gwm1_avatars',
        avatar: { type: 'custom', avatarId },
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      console.error('Create session error:', err);
      return { statusCode: createRes.status, body: err };
    }

    const session = await createRes.json();
    const sessionId = session.id;
    console.log('Session created:', sessionId);

    // 2. Poll until ready
    let sessionKey = null;
    for (let i = 0; i < 60; i++) {
      const pollRes = await fetch(`${baseUrl}/v1/realtime_sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-Runway-Version': '2024-11-06',
        },
      });
      const pollData = await pollRes.json();
      console.log('Poll status:', pollData.status);

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
    const consumeRes = await fetch(
      `${baseUrl}/v1/realtime_sessions/${sessionId}/consume`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionKey}`,
          'X-Runway-Version': '2024-11-06',
        },
      }
    );

    const credentials = await consumeRes.json();
    console.log('Consume response keys:', Object.keys(credentials));
    console.log('Full consume response:', JSON.stringify(credentials));

    // Return the full credentials object so the SDK gets whatever it needs
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    };
  } catch (err) {
    console.error('Session creation error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error', message: err.message }),
    };
  }
}
