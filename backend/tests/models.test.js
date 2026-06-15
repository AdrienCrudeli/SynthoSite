process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/services/usage.service', () => ({
  getAiUsageByModel: jest.fn()
}));

const db = require('../src/config/db');
const usageService = require('../src/services/usage.service');
const app = require('../src/app');

function createToken(payload = { id: 12, role: 'user' }) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
}

describe('Model routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usageService.getAiUsageByModel.mockResolvedValue(new Map());
  });

  test('GET /api/models returns public model labels and availability status', async () => {
    db.query.mockResolvedValueOnce([
      { model_id: 'mistral-large', enabled: 0, auto_disabled_until: null }
    ]);

    const response = await request(app)
      .get('/api/models')
      .set('Authorization', `Bearer ${createToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'gemini-flash',
        label: 'Gemini 2.5 Flash',
        enabled: true,
        available: true,
        status: 'available',
        autoDisabledUntil: null,
        supportsMultiPage: false
      }),
      expect.objectContaining({
        id: 'groq-llama',
        label: 'Groq Llama 3.3 70B',
        enabled: true,
        available: true,
        status: 'available',
        supportsMultiPage: true
      }),
      expect.objectContaining({
        id: 'gemini-flash-lite',
        label: 'Gemini 2.5 Flash-Lite',
        enabled: true,
        available: true,
        status: 'available',
        supportsMultiPage: true
      }),
      expect.objectContaining({
        id: 'mistral-large',
        label: 'Mistral Large',
        enabled: false,
        available: false,
        status: 'disabled',
        supportsMultiPage: false
      }),
      expect.objectContaining({
        id: 'cerebras-llama',
        label: 'Cerebras GPT-OSS 120B',
        enabled: true,
        available: true,
        supportsMultiPage: true
      })
    ]));
    expect(JSON.stringify(response.body)).not.toContain('apiKey');
    expect(JSON.stringify(response.body)).not.toContain('baseURL');
  });

  test('GET /api/usage returns all registered models including zero usage', async () => {
    usageService.getAiUsageByModel.mockResolvedValueOnce(new Map([
      ['gemini-flash', 2]
    ]));
    db.query.mockResolvedValueOnce([]);

    const response = await request(app)
      .get('/api/usage')
      .set('Authorization', `Bearer ${createToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: 'gemini-flash',
        label: 'Gemini 2.5 Flash',
        used: 2,
        limit: 250,
        enabled: true,
        available: true,
        status: 'available',
        autoDisabledUntil: null
      },
      {
        id: 'gemini-flash-lite',
        label: 'Gemini 2.5 Flash-Lite',
        used: 0,
        limit: 1000,
        enabled: true,
        available: true,
        status: 'available',
        autoDisabledUntil: null
      },
      {
        id: 'groq-llama',
        label: 'Groq Llama 3.3 70B',
        used: 0,
        limit: 1000,
        enabled: true,
        available: true,
        status: 'available',
        autoDisabledUntil: null
      },
      {
        id: 'mistral-large',
        label: 'Mistral Large',
        used: 0,
        limit: 100,
        enabled: true,
        available: true,
        status: 'available',
        autoDisabledUntil: null
      },
      {
        id: 'cerebras-llama',
        label: 'Cerebras GPT-OSS 120B',
        used: 0,
        limit: 150,
        enabled: true,
        available: true,
        status: 'available',
        autoDisabledUntil: null
      }
    ]);
  });
});
