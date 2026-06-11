process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/db', () => ({
  query: jest.fn()
}));

const db = require('../src/config/db');
const app = require('../src/app');

function createToken(payload = { id: 12, role: 'user' }) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
}

describe('Model routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/models returns public model labels only', async () => {
    const response = await request(app)
      .get('/api/models')
      .set('Authorization', `Bearer ${createToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: 'gemini-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
      { id: 'groq-llama', label: 'Groq Llama 3.3 70B' }
    ]);
    expect(JSON.stringify(response.body)).not.toContain('apiKey');
    expect(JSON.stringify(response.body)).not.toContain('baseURL');
  });

  test('GET /api/usage returns all registered models including zero usage', async () => {
    db.query.mockResolvedValueOnce([
      { model_used: 'gemini-flash', used_today: 2 }
    ]);

    const response = await request(app)
      .get('/api/usage')
      .set('Authorization', `Bearer ${createToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: 'gemini-flash', label: 'Gemini 2.5 Flash', used: 2, limit: 250 },
      { id: 'gemini-flash-lite', label: 'Gemini 2.5 Flash-Lite', used: 0, limit: 1000 },
      { id: 'groq-llama', label: 'Groq Llama 3.3 70B', used: 0, limit: 1000 }
    ]);
  });
});
