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

function createToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
}

describe('Admin routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usageService.getAiUsageByModel.mockResolvedValue(new Map());
  });

  test('GET /api/admin/users rejects non-admin users', async () => {
    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${createToken({ id: 4, role: 'user' })}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Admin access is required.');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('GET /api/admin/users returns users for an admin', async () => {
    db.query.mockResolvedValueOnce([
      {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        project_count: 2,
        created_at: '2026-06-01 10:00:00'
      }
    ]);

    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${createToken({ id: 1, role: 'admin' })}`);

    expect(response.status).toBe(200);
    expect(response.body.users).toEqual([
      {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        projectCount: 2,
        createdAt: '2026-06-01 10:00:00'
      }
    ]);
  });

  test('GET /api/admin/projects returns projects for an admin', async () => {
    db.query.mockResolvedValueOnce([
      {
        id: 10,
        user_id: 4,
        owner_username: 'student',
        owner_email: 'student@example.com',
        title: 'Portfolio',
        description: 'A personal website.',
        site_type: 'portfolio',
        created_at: '2026-06-01 10:00:00',
        updated_at: '2026-06-01 11:00:00'
      }
    ]);

    const response = await request(app)
      .get('/api/admin/projects')
      .set('Authorization', `Bearer ${createToken({ id: 1, role: 'admin' })}`);

    expect(response.status).toBe(200);
    expect(response.body.projects).toEqual([
      {
        id: 10,
        userId: 4,
        ownerUsername: 'student',
        ownerEmail: 'student@example.com',
        title: 'Portfolio',
        description: 'A personal website.',
        siteType: 'portfolio',
        createdAt: '2026-06-01 10:00:00',
        updatedAt: '2026-06-01 11:00:00'
      }
    ]);
  });

  test('GET /api/admin/models returns model status and usage for an admin', async () => {
    db.query
      .mockResolvedValueOnce([
        { model_id: 'mistral-large', enabled: 0 }
      ]);
    usageService.getAiUsageByModel.mockResolvedValueOnce(new Map([
      ['gemini-flash', 3],
      ['mistral-large', 1]
    ]));

    const response = await request(app)
      .get('/api/admin/models')
      .set('Authorization', `Bearer ${createToken({ id: 1, role: 'admin' })}`);

    expect(response.status).toBe(200);
    expect(response.body.models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'gemini-flash',
          label: 'Gemini 2.5 Flash',
          enabled: true,
          used: 3,
          limit: 250
        }),
        expect.objectContaining({
          id: 'mistral-large',
          label: 'Mistral Large',
          enabled: false,
          used: 1,
          limit: 100
        })
      ])
    );
  });

  test('PATCH /api/admin/models/:id updates model availability', async () => {
    db.query
      .mockResolvedValueOnce([
        { model_id: 'gemini-flash', enabled: 1 },
        { model_id: 'groq-llama', enabled: 1 }
      ])
      .mockResolvedValueOnce({ affectedRows: 1 })
      .mockResolvedValueOnce([
        { model_id: 'gemini-flash', enabled: 0 },
        { model_id: 'groq-llama', enabled: 1 }
      ]);

    const response = await request(app)
      .patch('/api/admin/models/gemini-flash')
      .set('Authorization', `Bearer ${createToken({ id: 1, role: 'admin' })}`)
      .send({ enabled: false });

    expect(response.status).toBe(200);
    expect(response.body.model).toMatchObject({
      id: 'gemini-flash',
      enabled: false
    });
    expect(db.query.mock.calls[1][0]).toContain('INSERT INTO ai_model_settings');
    expect(db.query.mock.calls[1][1]).toEqual(['gemini-flash', 0]);
  });

  test('GET /api/admin/usage returns internal Pexels usage', async () => {
    db.query.mockResolvedValueOnce([
      {
        used_today: 12,
        matched_today: 10,
        fallback_today: 2
      }
    ]);

    const response = await request(app)
      .get('/api/admin/usage')
      .set('Authorization', `Bearer ${createToken({ id: 1, role: 'admin' })}`);

    expect(response.status).toBe(200);
    expect(response.body.pexels).toMatchObject({
      id: 'pexels',
      label: 'Pexels API',
      used: 12,
      matched: 10,
      fallback: 2
    });
  });
});
