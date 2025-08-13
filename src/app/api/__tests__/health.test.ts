/**
 * API Tests for Health Check Endpoint
 *
 * Tests the GET /api/health and HEAD /api/health endpoints for:
 * - Service availability checks (database, AI service)
 * - Performance monitoring (latency, memory usage)
 * - Environment configuration validation
 * - Error handling and degraded state detection
 * - Response caching headers and status codes
 */

import { NextRequest } from 'next/server';
import { GET, HEAD } from '../health/route';
import { jest } from '@jest/globals';

// Mock Vercel KV
const mockKvPing = jest.fn();
jest.mock('@vercel/kv', () => ({
  kv: {
    ping: mockKvPing,
  },
}));

// Mock performance.now() for consistent latency testing
const mockPerformanceNow = jest.fn();
Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow,
  },
  writable: true,
});

describe('GET /api/health', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    mockPerformanceNow.mockReturnValueOnce(0).mockReturnValueOnce(50); // 50ms latency
    mockKvPing.mockResolvedValue('PONG');
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ============================================================================
  // HEALTHY STATE TESTS
  // ============================================================================

  describe('Healthy System', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      process.env.NEXT_PUBLIC_APP_VERSION = '1.2.3';
      process.env.VERCEL_ENV = 'production';
    });

    test('should return healthy status with all services operational', async () => {
      const request = new NextRequest('http://localhost:3000/api/health', {
        method: 'GET',
      });

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        status: 'healthy',
        timestamp: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
        ),
        version: '1.2.3',
        environment: 'production',
        checks: {
          database: {
            status: 'healthy',
            latency: 50,
          },
          ai_service: {
            status: 'configured',
            configured: true,
          },
          memory: {
            status: expect.any(String),
            usage: expect.any(Number),
            unit: 'MB',
          },
        },
      });

      expect(response.headers.get('Cache-Control')).toBe(
        'no-store, must-revalidate'
      );
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    test('should check database connectivity and latency', async () => {
      mockPerformanceNow.mockReturnValueOnce(100).mockReturnValueOnce(150); // 50ms latency

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const body = await response.json();

      expect(mockKvPing).toHaveBeenCalledTimes(1);
      expect(body.checks.database).toEqual({
        status: 'healthy',
        latency: 50,
      });
    });

    test('should report memory usage correctly', async () => {
      // Mock process.memoryUsage
      const mockMemoryUsage = jest.fn().mockReturnValue({
        heapUsed: 256 * 1024 * 1024, // 256 MB
        heapTotal: 512 * 1024 * 1024,
        external: 0,
        rss: 300 * 1024 * 1024,
      });
      process.memoryUsage = mockMemoryUsage;

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const body = await response.json();

      expect(body.checks.memory).toEqual({
        status: 'healthy',
        usage: 256,
        unit: 'MB',
      });
    });

    test('should use default values for missing environment variables', async () => {
      delete process.env.NEXT_PUBLIC_APP_VERSION;
      delete process.env.VERCEL_ENV;

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const body = await response.json();

      expect(body.version).toBe('1.0.0');
      expect(body.environment).toBe('development');
    });
  });

  // ============================================================================
  // DEGRADED STATE TESTS
  // ============================================================================

  describe('Degraded System', () => {
    test('should report degraded status for slow database', async () => {
      mockPerformanceNow.mockReturnValueOnce(0).mockReturnValueOnce(150); // 150ms latency
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(206);
      expect(body.status).toBe('degraded');
      expect(body.checks.database).toEqual({
        status: 'degraded',
        latency: 150,
      });
    });

    test('should report degraded status for high memory usage', async () => {
      const mockMemoryUsage = jest.fn().mockReturnValue({
        heapUsed: 600 * 1024 * 1024, // 600 MB (> 512 MB threshold)
        heapTotal: 800 * 1024 * 1024,
        external: 0,
        rss: 700 * 1024 * 1024,
      });
      process.memoryUsage = mockMemoryUsage;
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(206);
      expect(body.status).toBe('degraded');
      expect(body.checks.memory).toEqual({
        status: 'high',
        usage: 600,
        unit: 'MB',
      });
    });

    test('should report missing AI service configuration', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const body = await response.json();

      expect(body.checks.ai_service).toEqual({
        status: 'missing',
        configured: false,
      });
    });
  });

  // ============================================================================
  // UNHEALTHY STATE TESTS
  // ============================================================================

  describe('Unhealthy System', () => {
    test('should report unhealthy status for database connection failure', async () => {
      mockKvPing.mockRejectedValue(new Error('Connection refused'));
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.status).toBe('unhealthy');
      expect(body.checks.database).toEqual({
        status: 'unhealthy',
        latency: -1,
        error: 'Connection failed',
      });
    });

    test('should handle database timeout correctly', async () => {
      mockKvPing.mockRejectedValue(new Error('Timeout'));
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.checks.database.status).toBe('unhealthy');
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    test('should handle unexpected errors gracefully', async () => {
      // Mock a complete failure
      mockKvPing.mockImplementation(() => {
        throw new Error('Unexpected system error');
      });

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body).toEqual({
        status: 'unhealthy',
        timestamp: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
        ),
        error: 'Health check failed',
        version: expect.any(String),
      });

      expect(response.headers.get('Cache-Control')).toBe(
        'no-store, must-revalidate'
      );
    });

    test('should handle memory check failures', async () => {
      // Remove process.memoryUsage to simulate environment without it
      delete (process as any).memoryUsage;

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const body = await response.json();

      expect(body.checks.memory).toEqual({
        status: 'healthy',
        usage: 0,
      });
    });
  });

  // ============================================================================
  // RESPONSE FORMAT TESTS
  // ============================================================================

  describe('Response Format', () => {
    test('should include correct response headers', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      expect(response.headers.get('Cache-Control')).toBe(
        'no-store, must-revalidate'
      );
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    test('should return consistent timestamp format', async () => {
      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const body = await response.json();

      expect(body.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    test('should include all required fields in response', async () => {
      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const body = await response.json();

      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('version');
      expect(body).toHaveProperty('environment');
      expect(body).toHaveProperty('checks');
      expect(body.checks).toHaveProperty('database');
      expect(body.checks).toHaveProperty('ai_service');
      expect(body.checks).toHaveProperty('memory');
    });
  });

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  describe('Performance', () => {
    test('should complete health check quickly', async () => {
      const start = Date.now();

      const request = new NextRequest('http://localhost:3000/api/health');
      await GET(request);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should accurately measure database latency', async () => {
      const expectedLatency = 75;
      mockPerformanceNow
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(100 + expectedLatency);

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const body = await response.json();

      expect(body.checks.database.latency).toBe(expectedLatency);
    });
  });
});

describe('HEAD /api/health (Readiness Check)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    mockKvPing.mockResolvedValue('PONG');
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ============================================================================
  // READINESS TESTS
  // ============================================================================

  describe('Readiness Checks', () => {
    test('should return 200 when all services are ready', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      const request = new NextRequest('http://localhost:3000/api/health', {
        method: 'HEAD',
      });

      const response = await HEAD(request);

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
      expect(response.headers.get('Cache-Control')).toBe(
        'no-store, must-revalidate'
      );
      expect(mockKvPing).toHaveBeenCalledTimes(1);
    });

    test('should return 503 when database is not ready', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      mockKvPing.mockRejectedValue(new Error('Connection failed'));

      const request = new NextRequest('http://localhost:3000/api/health', {
        method: 'HEAD',
      });

      const response = await HEAD(request);

      expect(response.status).toBe(503);
      expect(response.body).toBeNull();
    });

    test('should return 503 when AI service is not configured', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const request = new NextRequest('http://localhost:3000/api/health', {
        method: 'HEAD',
      });

      const response = await HEAD(request);

      expect(response.status).toBe(503);
    });

    test('should handle database connection errors', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      mockKvPing.mockRejectedValue(new Error('Timeout'));

      const request = new NextRequest('http://localhost:3000/api/health', {
        method: 'HEAD',
      });

      const response = await HEAD(request);

      expect(response.status).toBe(503);
    });

    test('should be faster than full health check', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      const start = Date.now();
      const request = new NextRequest('http://localhost:3000/api/health', {
        method: 'HEAD',
      });
      await HEAD(request);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500); // Should be very fast
    });
  });

  // ============================================================================
  // LOAD BALANCER INTEGRATION TESTS
  // ============================================================================

  describe('Load Balancer Integration', () => {
    test('should work with load balancer health checks', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      const request = new NextRequest('http://localhost:3000/api/health', {
        method: 'HEAD',
        headers: {
          'User-Agent': 'AWS ELB Health Checker',
        },
      });

      const response = await HEAD(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe(
        'no-store, must-revalidate'
      );
    });

    test('should handle high frequency health checks', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      // Simulate multiple rapid health checks
      const promises = Array.from({ length: 10 }, () => {
        const request = new NextRequest('http://localhost:3000/api/health', {
          method: 'HEAD',
        });
        return HEAD(request);
      });

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should not overwhelm the database with checks
      expect(mockKvPing).toHaveBeenCalledTimes(10);
    });
  });

  // ============================================================================
  // MONITORING INTEGRATION TESTS
  // ============================================================================

  describe('Monitoring Integration', () => {
    test('should work with Kubernetes liveness probes', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      const request = new NextRequest('http://localhost:3000/api/health', {
        method: 'HEAD',
        headers: {
          'User-Agent': 'kube-probe/1.21',
        },
      });

      const response = await HEAD(request);

      expect(response.status).toBe(200);
    });

    test('should work with Vercel Edge health checks', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      process.env.VERCEL_ENV = 'production';

      const request = new NextRequest('http://localhost:3000/api/health', {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Vercel Edge Health Check',
        },
      });

      const response = await HEAD(request);

      expect(response.status).toBe(200);
    });
  });
});
