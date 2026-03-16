// netlify/functions/validate-payment.js
// Validates a Whop membership or rain check token

import crypto from 'crypto';

const RAIN_CHECK_SECRET = process.env.RAIN_CHECK_SECRET || 'bridge-rain-check-default-secret';

function verifyRainCheck(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const [payload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', RAIN_CHECK_SECRET)
      .update(payload)
      .digest('hex')
      .slice(0, 16);

    if (signature !== expectedSig) return false;

    const data = JSON.parse(Buffer.from(payload, 'base64').toString());

    // Check expiration (7 days)
    if (Date.now() - data.issuedAt > 7 * 24 * 60 * 60 * 1000) return false;

    // Check it hasn't been used (we mark it with a "used" flag client-side,
    // but server-side we just check expiration since we have no DB)
    return { valid: true, data };
  } catch (e) {
    return false;
  }
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { membershipId, rainCheckToken } = JSON.parse(event.body);

  // ─── Path 1: Rain check token ───
  if (rainCheckToken) {
    const result = verifyRainCheck(rainCheckToken);
    if (result && result.valid) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valid: true, source: 'rain_check', data: result.data }),
      };
    }
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: false, error: 'Invalid or expired rain check' }),
    };
  }

  // ─── Path 2: Whop membership validation ───
  if (!membershipId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: false, error: 'No membership ID or rain check provided' }),
    };
  }

  const whopApiKey = process.env.WHOP_API_KEY;
  const companyId = process.env.WHOP_COMPANY_ID;

  if (!whopApiKey) {
    console.error('WHOP_API_KEY not configured');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: false, error: 'Payment validation not configured' }),
    };
  }

try {
    // Try as payment ID first (pay_xxx format from checkout redirect)
    let isValid = false;

    if (membershipId.startsWith('pay_')) {
      const res = await fetch(`https://api.whop.com/api/v2/payments/${membershipId}`, {
        headers: {
          'Authorization': `Bearer ${whopApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const payment = await res.json();
        console.log('Payment status:', payment.status);
        isValid = payment.status === 'paid' || payment.status === 'succeeded';
      } else {
        console.error('Whop payment check failed:', res.status);
      }
    } else {
      const res = await fetch(`https://api.whop.com/api/v2/memberships/${membershipId}`, {
        headers: {
          'Authorization': `Bearer ${whopApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const membership = await res.json();
        console.log('Membership status:', membership.status);
        isValid = membership.status === 'active' || membership.status === 'completed';
      } else {
        console.error('Whop membership check failed:', res.status);
      }
    }

    return {
      statusCode: isValid ? 200 : 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valid: isValid,
        source: 'whop',
        membershipId,
      }),
    };
  } catch (err) {
    console.error('Payment validation error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: false, error: 'Validation failed' }),
    };
  }
}
