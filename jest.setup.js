// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock next/router
import { jest } from '@jest/globals';

jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
    };
  },
}));

// Mock next/navigation for App Router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Mock Next.js server environment for API routes
if (typeof global.Request === 'undefined') {
  Object.defineProperty(global, 'Request', {
    value: class MockRequest {
      constructor(url, init = {}) {
        this.url = url;
        this.method = init.method || 'GET';
        this.headers = new Map();
        if (init.headers) {
          Object.entries(init.headers).forEach(([key, value]) => {
            this.headers.set(key.toLowerCase(), value);
          });
        }
        this.body = init.body || null;
      }

      async json() {
        if (this.body) {
          try {
            return JSON.parse(this.body);
          } catch {
            throw new Error('Invalid JSON');
          }
        }
        return {};
      }
    },
  });
}

if (typeof global.Response === 'undefined') {
  Object.defineProperty(global, 'Response', {
    value: class MockResponse {
      constructor(body, init = {}) {
        this.body = body;
        this.status = init.status || 200;
        this.statusText = init.statusText || 'OK';
        this.headers = new Map();
        if (init.headers) {
          Object.entries(init.headers).forEach(([key, value]) => {
            this.headers.set(key.toLowerCase(), value);
          });
        }
      }

      async json() {
        if (typeof this.body === 'string') {
          return JSON.parse(this.body);
        }
        return this.body;
      }

      async text() {
        return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
      }
    },
  });
}

// Mock Anthropic API
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ text: 'Mocked AI response' }],
        id: 'mock-message-id',
        model: 'claude-3-opus-20240229',
        role: 'assistant',
        stop_reason: 'end_turn',
        stop_sequence: null,
        type: 'message',
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
      stream: jest.fn().mockImplementation(async function* () {
        yield { type: 'content_block_delta', delta: { text: 'Mock' } };
        yield { type: 'content_block_delta', delta: { text: ' response' } };
      }),
    },
  })),
}));

// Mock Vercel KV
jest.mock('@vercel/kv', () => ({
  kv: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    hget: jest.fn(),
    hset: jest.fn(),
    hdel: jest.fn(),
    hgetall: jest.fn(),
    sadd: jest.fn(),
    srem: jest.fn(),
    smembers: jest.fn(),
    zadd: jest.fn(),
    zrange: jest.fn(),
    zrem: jest.fn(),
  },
}));

// Mock Vercel Blob
jest.mock('@vercel/blob', () => ({
  put: jest.fn(),
  del: jest.fn(),
  head: jest.fn(),
  list: jest.fn(),
}));

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
process.env.KV_URL = 'redis://localhost:6379';
process.env.NEXT_PUBLIC_APP_NAME = 'RpgAInfinity';

// Global test utilities
global.mockConsoleError = () => {
  const originalError = console.error;
  const mockError = jest.fn();
  console.error = mockError;
  
  return () => {
    console.error = originalError;
  };
};

global.mockConsoleWarn = () => {
  const originalWarn = console.warn;
  const mockWarn = jest.fn();
  console.warn = mockWarn;
  
  return () => {
    console.warn = originalWarn;
  };
};

// Mock IntersectionObserver for components that use it
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});