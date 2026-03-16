export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { membershipId, rainCheckToken, checkoutStatus } = JSON.parse(event.body);

  // ─── Path 1: Rain check token ───
  if (rainCheckToken) {
    try {
      const { createHmac } = await import('crypto');
      const secret = process.env.RAIN_CHECK_SECRET || 'bridge-rain-check-default-secret';
      const parts = rainCheckToken.split('.');
      if (parts.length !== 2) throw new Error('Invalid token format');

      const [payload, signature] = parts;
      const expectedSig = createHmac('sha256', secret)
        .update(payload)
        .digest('hex')
        .slice(0, 16);

      if (signature !== expectedSig) throw new Error('Bad signature');

      const data = JSON.parse(Buffer.from(payload, 'base64').toString());
      if (Date.now() - data.issuedAt > 7 * 24 * 60 * 60 * 1000) throw new Error('Expired');

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valid: true, source: 'rain_check' }),
      };
    } catch (e) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valid: false, error: 'Invalid or expired rain check' }),
      };
    }
  }

  // ─── Path 2: Whop payment validation ───
  // The payment_id comes from Whop's redirect after successful checkout.
  // checkout_status=success means Whop processed the payment.
  if (membershipId && membershipId.startsWith('pay_')) {
    console.log('Payment ID received:', membershipId, 'Status:', checkoutStatus);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: true, source: 'whop', membershipId }),
    };
  }

  return {
    statusCode: 403,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valid: false, error: 'No valid payment info provided' }),
  };
}
