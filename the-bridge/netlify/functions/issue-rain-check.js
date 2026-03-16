// netlify/functions/issue-rain-check.js
// Issues a signed rain check token when Runway capacity is exhausted

import crypto from 'crypto';

const RAIN_CHECK_SECRET = process.env.RAIN_CHECK_SECRET || 'bridge-rain-check-default-secret';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { membershipId, survey } = JSON.parse(event.body);

  const payload = {
    id: crypto.randomBytes(8).toString('hex'),
    issuedAt: Date.now(),
    membershipId: membershipId || 'rain_check',
    topic: survey?.topic || 'unspecified',
    reason: 'capacity_limit',
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto
    .createHmac('sha256', RAIN_CHECK_SECRET)
    .update(payloadStr)
    .digest('hex')
    .slice(0, 16);

  const token = `${payloadStr}.${signature}`;

  console.log('Rain check issued:', payload.id);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      id: payload.id,
    }),
  };
}
