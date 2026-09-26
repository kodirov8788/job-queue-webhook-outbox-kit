import { generateWebhookSignature, verifyWebhookSignature } from '../crypto';

describe('Webhook Signatures', () => {
  const secret = 'test-secret';
  const payload = JSON.stringify({ test: 'data' });

  test('generates consistent signatures', () => {
    const sig1 = generateWebhookSignature(payload, secret);
    const sig2 = generateWebhookSignature(payload, secret);
    expect(sig1).toBe(sig2);
  });

  test('verifies valid signatures', () => {
    const signature = generateWebhookSignature(payload, secret);
    const result = verifyWebhookSignature(payload, signature, secret);
    expect(result).toBe(true);
  });

  test('rejects invalid signatures', () => {
    const result = verifyWebhookSignature(payload, 'invalid', secret);
    expect(result).toBe(false);
  });

  test('rejects signatures with wrong secret', () => {
    const signature = generateWebhookSignature(payload, secret);
    const result = verifyWebhookSignature(payload, signature, 'wrong-secret');
    expect(result).toBe(false);
  });
});
