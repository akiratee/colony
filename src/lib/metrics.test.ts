import { describe, it, expect, beforeEach } from 'vitest';
import {
  incrementMetric,
  incrementResponseTime,
  incrementSocketConnections,
  incrementSocketMessages,
  incrementWhatsAppReceived,
  incrementWhatsAppSent,
  getMetrics,
  getRawMetrics,
  resetMetrics,
} from './metrics';

describe('Metrics', () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe('incrementMetric', () => {
    it('should increment requests count', () => {
      incrementMetric('requests');
      incrementMetric('requests');
      const metrics = getMetrics();
      expect(metrics?.requests).toBe(2);
    });

    it('should increment messages created count', () => {
      incrementMetric('messagesCreated');
      const metrics = getMetrics();
      expect(metrics?.messagesCreated).toBe(1);
    });

    it('should increment channels created count', () => {
      incrementMetric('channelsCreated');
      incrementMetric('channelsCreated');
      incrementMetric('channelsCreated');
      const metrics = getMetrics();
      expect(metrics?.channelsCreated).toBe(3);
    });

    it('should increment users registered count', () => {
      incrementMetric('usersRegistered');
      const metrics = getMetrics();
      expect(metrics?.usersRegistered).toBe(1);
    });

    it('should increment errors count', () => {
      incrementMetric('errors');
      const metrics = getMetrics();
      expect(metrics?.errors).toBe(1);
    });

    it('should increment auth failures count', () => {
      incrementMetric('authFailures');
      incrementMetric('authFailures');
      const metrics = getMetrics();
      expect(metrics?.authFailures).toBe(2);
    });

    it('should increment validation failures count', () => {
      incrementMetric('validationFailures');
      const metrics = getMetrics();
      expect(metrics?.validationFailures).toBe(1);
    });
  });

  describe('incrementResponseTime', () => {
    it('should track response times correctly', () => {
      incrementResponseTime(100);
      incrementResponseTime(200);
      incrementResponseTime(300);
      
      const metrics = getMetrics();
      expect(metrics?.requests).toBe(3);
      expect(metrics?.avgResponseTime).toBe(200);
      expect(metrics?.slowestResponseTime).toBe(300);
      expect(metrics?.fastestResponseTime).toBe(100);
    });

    it('should handle single response time', () => {
      incrementResponseTime(150);
      
      const metrics = getMetrics();
      expect(metrics?.avgResponseTime).toBe(150);
      expect(metrics?.slowestResponseTime).toBe(150);
      expect(metrics?.fastestResponseTime).toBe(150);
    });

    it('should return 0 for avg when no requests', () => {
      const metrics = getMetrics();
      expect(metrics?.avgResponseTime).toBe(0);
      expect(metrics?.slowestResponseTime).toBe(0);
      expect(metrics?.fastestResponseTime).toBe(0);
    });
  });

  describe('incrementSocketConnections', () => {
    it('should increment socket connections by delta', () => {
      incrementSocketConnections(1);
      incrementSocketConnections(2);
      incrementSocketConnections(-1);
      
      const metrics = getMetrics();
      expect(metrics?.socketConnections).toBe(2);
    });
  });

  describe('incrementSocketMessages', () => {
    it('should increment socket messages count', () => {
      incrementSocketMessages();
      incrementSocketMessages();
      incrementSocketMessages();
      
      const metrics = getMetrics();
      expect(metrics?.socketMessages).toBe(3);
    });
  });

  describe('incrementWhatsAppReceived', () => {
    it('should increment WhatsApp received count', () => {
      incrementWhatsAppReceived();
      incrementWhatsAppReceived();
      
      const metrics = getMetrics();
      expect(metrics?.whatsappMessagesReceived).toBe(2);
    });
  });

  describe('incrementWhatsAppSent', () => {
    it('should increment WhatsApp sent count', () => {
      incrementWhatsAppSent();
      
      const metrics = getMetrics();
      expect(metrics?.whatsappMessagesSent).toBe(1);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics with calculated averages', () => {
      incrementMetric('messagesCreated');
      incrementMetric('channelsCreated');
      incrementMetric('usersRegistered');
      incrementMetric('errors');
      incrementResponseTime(50);
      
      const metrics = getMetrics();
      
      expect(metrics).not.toBeNull();
      expect(metrics?.messagesCreated).toBe(1);
      expect(metrics?.channelsCreated).toBe(1);
      expect(metrics?.usersRegistered).toBe(1);
      expect(metrics?.errors).toBe(1);
      expect(metrics?.avgResponseTime).toBe(50);
      expect(metrics?.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should include all metric types', () => {
      const metrics = getMetrics();
      
      expect(metrics).toHaveProperty('requests');
      expect(metrics).toHaveProperty('messagesCreated');
      expect(metrics).toHaveProperty('channelsCreated');
      expect(metrics).toHaveProperty('usersRegistered');
      expect(metrics).toHaveProperty('errors');
      expect(metrics).toHaveProperty('authFailures');
      expect(metrics).toHaveProperty('validationFailures');
      expect(metrics).toHaveProperty('avgResponseTime');
      expect(metrics).toHaveProperty('slowestResponseTime');
      expect(metrics).toHaveProperty('fastestResponseTime');
      expect(metrics).toHaveProperty('socketConnections');
      expect(metrics).toHaveProperty('socketMessages');
      expect(metrics).toHaveProperty('whatsappMessagesReceived');
      expect(metrics).toHaveProperty('whatsappMessagesSent');
      expect(metrics).toHaveProperty('uptime');
    });
  });

  describe('getRawMetrics', () => {
    it('should return raw metrics data', () => {
      incrementMetric('requests');
      incrementMetric('messagesCreated');
      
      const raw = getRawMetrics();
      
      expect(raw.requests).toBe(1);
      expect(raw.messagesCreated).toBe(1);
      expect(raw).toHaveProperty('totalResponseTime');
      expect(raw).toHaveProperty('startTime');
    });

    it('should return a copy, not the original', () => {
      const raw = getRawMetrics();
      raw.requests = 999;
      
      const metrics = getMetrics();
      expect(metrics?.requests).not.toBe(999);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to initial values', () => {
      incrementMetric('requests');
      incrementMetric('messagesCreated');
      incrementMetric('errors');
      incrementResponseTime(100);
      incrementSocketConnections(5);
      incrementWhatsAppReceived();
      
      resetMetrics();
      
      const metrics = getMetrics();
      expect(metrics?.requests).toBe(0);
      expect(metrics?.messagesCreated).toBe(0);
      expect(metrics?.errors).toBe(0);
      expect(metrics?.avgResponseTime).toBe(0);
      expect(metrics?.socketConnections).toBe(0);
      expect(metrics?.whatsappMessagesReceived).toBe(0);
    });

    it('should reset uptime on reset', () => {
      const m1 = getMetrics();
      const uptime1 = m1?.uptime;
      
      resetMetrics();
      const m2 = getMetrics();
      
      expect(m2?.uptime).toBeLessThan(uptime1! + 100);
    });
  });
});
