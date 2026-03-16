export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { sessionId } = JSON.parse(event.body);
  const apiKey = process.env.RUNWAYML_API_SECRET;
  const baseUrl = 'https://api.dev.runwayml.com';

  try {
    // Poll until session is COMPLETED and has transcript (max 30 seconds)
    for (let i = 0; i < 30; i++) {
      const res = await fetch(`${baseUrl}/v1/realtime_sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Runway-Version': '2024-11-06',
        },
      });

      const data = await res.json();
      console.log('Session status:', data.status, 'Has transcript:', !!data.transcript);
      console.log('Session data keys:', Object.keys(data));

      if (data.status === 'COMPLETED' || data.status === 'CANCELLED') {
        // Return the full session data so we can find the transcript
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        };
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    return {
      statusCode: 504,
      body: JSON.stringify({ error: 'Timed out waiting for transcript' }),
    };
  } catch (err) {
    console.error('Transcript fetch error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
