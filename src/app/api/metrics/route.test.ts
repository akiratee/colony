import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from './route';
import { getMetrics, resetMetrics } from '@/lib/metrics';

describe('GET /api/metrics', () => {
  beforeEach(() => {
    resetMetrics();
  });

  it('should return metrics with uptime information', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('uptime');
    expect(data.uptime).toHaveProperty('seconds');
    expect(data.uptime).toHaveProperty('human');
    expect(typeof data.uptime.seconds).toBe('number');
    expect(typeof data.uptime.human).toBe('string');
  });

  it('should return zero counts when no activity', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.requests).toBe(0);
    expect(data.messages).toBe(0);
    expect(data.channels).toBe(0);
    expect(data.users).toBe(0);
    expect(data.errors).toBe(0);
  });

  it('should return performance metrics', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.performance).toHaveProperty('avgResponseTime');
    expect(data.performance).toHaveProperty('slowestResponseTime');
    expect(data.performance).toHaveProperty('fastestResponseTime');
  });

  it('should return websocket metrics', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.websocket).toHaveProperty('connections');
    expect(data.websocket).toHaveProperty('messages');
  });

  it('should return whatsapp metrics', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.whatsapp).toHaveProperty('received');
    expect(data.whatsapp).toHaveProperty('sent');
  });
});
