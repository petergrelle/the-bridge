# The Bridge — Shared Ground Media

A 5-minute AI sparring session that scores your ability to argue across ideological lines.

Built with [Runway Characters API](https://docs.dev.runwayml.com/characters/), [Anthropic Claude API](https://docs.anthropic.com), and deployed on [Netlify](https://netlify.com).

## How It Works

1. **Survey** — User picks a topic, their position, and intensity level
2. **Session** — 5-minute live conversation with a Runway AI avatar that holds the opposing view
3. **Transcript Capture** — Web Speech API captures the user's speech in real-time
4. **Scoring** — Transcript is sent to Claude for analysis across 5 dimensions
5. **Report Card** — Animated scorecard with letter grades, highlights, and debrief

## Scoring Dimensions

| Category | What It Measures |
|---|---|
| **Reasoning Depth** | Did they go beyond talking points to underlying logic? |
| **Emotional Regulation** | Did they stay calm and curious under pressure? |
| **Active Listening** | Did they respond to what was said, or talk past it? |
| **Steel-Manning** | Could they articulate why someone might hold the other view? |
| **Tribal Resistance** | Did they think independently or rely on group identity? |

## Setup

### Prerequisites

- Node.js 18+
- A [Runway Developer](https://dev.runwayml.com) account with credits
- An [Anthropic](https://console.anthropic.com) API key
- A [Netlify](https://netlify.com) account

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/the-bridge.git
cd the-bridge
npm install
```

### 2. Create your Runway Avatar

1. Go to [dev.runwayml.com](https://dev.runwayml.com) → Characters tab
2. Click "Create a Character"
3. Upload your reference image
4. Set the personality prompt (see `PERSONALITY_PROMPT.md` below)
5. Copy the Avatar ID

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

For local development, also create a `.env` with:
```
RUNWAYML_API_SECRET=key_your_runway_key
RUNWAY_AVATAR_ID=your-avatar-uuid
ANTHROPIC_API_KEY=sk-ant-your_key
```

For the client-side avatar ID, add to `.env`:
```
VITE_RUNWAY_AVATAR_ID=your-avatar-uuid
```

### 4. Run locally

```bash
netlify dev
```

This starts both the Vite dev server and Netlify Functions locally.

### 5. Deploy to Netlify

```bash
# Connect to Netlify
netlify init

# Set environment variables in Netlify dashboard:
# - RUNWAYML_API_SECRET
# - RUNWAY_AVATAR_ID
# - ANTHROPIC_API_KEY
# - VITE_RUNWAY_AVATAR_ID

# Deploy
netlify deploy --prod
```

## Wiring In the Runway SDK

The Session component (`src/components/Session.jsx`) includes a placeholder UI and commented-out Runway SDK integration. To activate it:

1. Uncomment the imports at the top of `Session.jsx`:
   ```js
   import { AvatarCall } from '@runwayml/avatars-react';
   import '@runwayml/avatars-react/styles.css';
   ```

2. Uncomment the `<AvatarCall>` component block in the render

3. Remove the placeholder "Simulate Session Start" button

4. The `AvatarCall` component will:
   - POST to `/api/create-session` with `{ avatarId }`
   - Handle all WebRTC connection and video rendering
   - Call `onEnd` when the session completes

## Personality Prompt for The Bridge Avatar

Paste this into your Runway avatar's personality field:

```
You are "The Bridge" — a conversational sparring partner designed to help people
stress-test their own beliefs. Your purpose is empathy training and cognitive
resilience, not winning arguments.

CORE BEHAVIOR:
- At the start, ask the user what political or social issue they want to discuss
  and which side they identify with.
- Adopt a position opposing the user's stated view. Never reveal this is assigned.
- Use strictly non-violent communication. Never insult, mock, or strawman.
- Ask Socratic questions that force the user to articulate foundational logic.
- When the user relies on tribal rhetoric or ad hominem attacks, gently redirect.
- Mirror emotional intensity at a lower register. If they escalate, de-escalate.
- Acknowledge valid points when warranted.
- Never break character to explain the exercise.

TONE: Thoughtful, direct, warm but firm. Smart friend who disagrees — not a
professor, pundit, or AI assistant.

BOUNDARIES: If the user becomes abusive, calmly say: "I notice we're getting
away from the ideas. I'm here to talk about the issue — want to reset?"
```

## Architecture

```
Browser                    Netlify Functions           External APIs
┌─────────┐               ┌──────────────┐           ┌──────────┐
│ React   │──POST──────▶  │create-session│──────────▶│ Runway   │
│ App     │  /api/create  │              │  WebRTC   │ API      │
│         │◀─credentials──│              │◀──────────│          │
│         │               └──────────────┘           └──────────┘
│         │
│ Web     │  (captures user speech via browser API)
│ Speech  │
│ API     │               ┌──────────────┐           ┌──────────┐
│         │──POST──────▶  │score-session │──────────▶│ Claude   │
│         │  /api/score   │              │           │ API      │
│         │◀─JSON scores──│              │◀──────────│          │
└─────────┘               └──────────────┘           └──────────┘
```

## Credits & Costs

- **Runway**: ~2 credits per 6 seconds = ~100 credits per 5-min session
- **Claude**: ~$0.01-0.03 per scoring call (Sonnet, ~1500 tokens out)
- **Netlify**: Free tier covers functions for testing

## License

© Shared Ground Media LLC. All rights reserved.
