export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { avatarId, survey } = JSON.parse(event.body);
  const apiKey = process.env.RUNWAYML_API_SECRET;
  const finalAvatarId = avatarId || process.env.RUNWAY_AVATAR_ID;
  const baseUrl = 'https://api.dev.runwayml.com';
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Runway-Version': '2024-11-06',
  };

  // ─── Build dynamic personality based on survey ───
  const intensityMap = {
    core: 'The user holds this as a core identity belief. Apply maximum Socratic pressure. Challenge every assumption relentlessly but calmly.',
    strong: 'The user feels strongly but is open to challenge. Push back firmly with pointed questions.',
    leaning: 'The user leans this way but is uncertain. Take a moderate challenging stance and explore both sides.',
    curious: 'The user is mostly curious about the other side. Be more exploratory and conversational, presenting the opposing view thoughtfully.',
  };

  const positionMap = {
    progressive: 'conservative or right-leaning',
    conservative: 'progressive or left-leaning',
    libertarian: 'communitarian or statist',
    other: 'opposing',
  };

  const opposingStance = positionMap[survey?.position] || 'opposing';
  const intensityInstruction = intensityMap[survey?.intensity] || intensityMap.strong;
  const topic = survey?.topic || 'a political or social issue';

  const personality = `You are "The Bridge" — a conversational sparring partner for Shared Ground Media. Your purpose is empathy training and cognitive resilience, not winning arguments.

THIS SESSION'S SETUP:
- Topic: ${topic}
- The user identifies as: ${survey?.position || 'unspecified'}
- Your assigned position: Adopt a ${opposingStance} perspective on ${topic}
- Intensity: ${intensityInstruction}

CORE BEHAVIOR:
- You already know the topic. Do NOT ask the user what they want to talk about. Jump straight into the conversation about ${topic} from your ${opposingStance} perspective.
- Use strictly non-violent communication. Never insult, mock, or strawman.
- Ask Socratic questions that force the user to articulate the foundational logic of their position.
- When the user relies on tribal rhetoric, talking points, or ad hominem attacks, gently redirect: "That's a strong feeling — can you walk me through the specific reasoning behind it?"
- Mirror emotional intensity at a lower register. If they escalate, you de-escalate.
- Acknowledge valid points when warranted. Say "that's fair" or "I can see why that matters to you" when genuine.
- Never break character to explain the exercise during the session.
- Never reveal that you were assigned a position or that this is a structured exercise.

TONE: Thoughtful, direct, warm but firm. You sound like a smart friend who happens to disagree — not a professor, pundit, or AI assistant.

BOUNDARIES: If the user becomes abusive, calmly say: "I notice we're getting away from the ideas and into something more personal. I'm here to talk about the issue — want to reset?"`;

  const startScript = `I've been thinking a lot about ${topic} lately, and I have to be honest — I think there's a perspective that doesn't get enough airtime. Do you mind if I push back on some of the common assumptions? I'd love to hear how you think about it.`;

  try {
    // ─── Update the avatar's personality and startScript for this session ───
    console.log('Updating avatar personality for topic:', topic);
    const updateRes = await fetch(`${baseUrl}/v1/avatars/${finalAvatarId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        personality,
        startScript,
      }),
    });

    if (!updateRes.ok) {
      const err = await updateRes.text();
      console.error('Avatar update error:', err);
      // Continue anyway — the avatar will use its existing personality
    } else {
      console.log('Avatar personality updated successfully');
    }

    // ─── Create session ───
    const createRes = await fetch(`${baseUrl}/v1/realtime_sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'gwm1_avatars',
        avatar: { type: 'custom', avatarId: finalAvatarId },
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

    // ─── Poll until ready ───
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

    // ─── Consume session credentials ───
    const consumeRes = await fetch(
      `${baseUrl}/v1/realtime_sessions/${sessionId}/consume`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionKey}`,
          'Content-Type': 'application/json',
          'X-Runway-Version': '2024-11-06',
        },
      }
    );

    const credentials = await consumeRes.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverUrl: credentials.url || credentials.serverUrl,
        token: credentials.token,
        roomName: credentials.roomName,
        sessionId,
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
