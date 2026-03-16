// netlify/functions/score-session.js
// Sends transcript + survey context to Claude API for scoring

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { transcript, survey } = JSON.parse(event.body);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const scoringPrompt = `You are an expert conversation analyst for Shared Ground Media's "Bridge" empathy training platform. A user just completed a 5-minute sparring session where they debated a political/social topic with an AI avatar that held the opposing view.

Analyze this transcript and return ONLY a JSON object (no markdown, no backticks, no preamble) with the following structure:

{
  "overallScore": <number 0-100>,
  "grades": {
    "reasoningDepth": {
      "score": <number 0-100>,
      "letter": "<A/B/C/D/F>",
      "label": "Reasoning Depth",
      "summary": "<1 sentence>"
    },
    "emotionalRegulation": {
      "score": <number 0-100>,
      "letter": "<A/B/C/D/F>",
      "label": "Emotional Regulation", 
      "summary": "<1 sentence>"
    },
    "activeListening": {
      "score": <number 0-100>,
      "letter": "<A/B/C/D/F>",
      "label": "Active Listening",
      "summary": "<1 sentence>"
    },
    "steelManning": {
      "score": <number 0-100>,
      "letter": "<A/B/C/D/F>",
      "label": "Steel-Manning",
      "summary": "<1 sentence>"
    },
    "tribalResistance": {
      "score": <number 0-100>,
      "letter": "<A/B/C/D/F>",
      "label": "Tribal Resistance",
      "summary": "<1 sentence>"
    }
  },
  "highlights": {
    "strongestMoment": "<Quote or describe their best moment in 1-2 sentences>",
    "growthEdge": "<The one thing that would most improve their next session, 1-2 sentences>",
    "tacticsDetected": ["<list of rhetorical shortcuts or tribal signals detected, e.g. 'ad hominem', 'appeal to group identity', 'whataboutism'>"]
  },
  "headline": "<A punchy 5-8 word summary of their performance, like a newspaper headline>"
}

SCORING CRITERIA:

**Reasoning Depth (0-100):** Did they articulate WHY they believe what they believe? Did they go beyond surface talking points to underlying values and logic? Or did they just assert conclusions?

**Emotional Regulation (0-100):** Did they stay calm and engaged when challenged? Did they escalate, get defensive, or shut down? Did they maintain curiosity even under pressure?

**Active Listening (0-100):** Did they respond to what the avatar actually said, or talk past it? Did they acknowledge valid points? Did they ask clarifying questions?

**Steel-Manning (0-100):** Did they demonstrate understanding of the opposing position? Could they articulate WHY someone might reasonably hold the other view? Or did they strawman/caricature?

**Tribal Resistance (0-100):** Did they rely on group identity ("people like you", "everyone knows", partisan labels) or did they speak from personal reasoning? Did they use talking points or think independently?

LETTER GRADES: A = 85-100, B = 70-84, C = 55-69, D = 40-54, F = 0-39

Be honest and constructive. Most first-time users score 40-65. A score above 80 should be rare and genuinely earned. Don't grade on a curve — grade on quality.

USER CONTEXT:
Topic: ${survey.topic}
Position: ${survey.position}
Self-reported intensity: ${survey.intensity}

IMPORTANT NOTE ABOUT THE TRANSCRIPT:
The transcript below was captured via browser speech recognition, which labels ALL speech as "USER" — including both the human participant AND the AI avatar's responses. You must infer who is speaking from context. The AI avatar asks Socratic questions, reflects back what the user says, and maintains a calm probing tone. The human participant states opinions, responds to challenges, and may show emotional reactions. Separate the speakers yourself before scoring.

TRANSCRIPT:
${transcript}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [
          { role: 'user', content: scoringPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Claude API error:', err);
      return { statusCode: response.status, body: err };
    }

    const data = await response.json();
    const text = data.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Parse the JSON response (strip any accidental markdown fences)
    const clean = text.replace(/```json|```/g, '').trim();
    const scores = JSON.parse(clean);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scores),
    };
  } catch (err) {
    console.error('Scoring error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Scoring failed', message: err.message }),
    };
  }
}
