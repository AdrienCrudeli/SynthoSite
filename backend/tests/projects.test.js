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

describe('Project routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/projects rejects requests without a token', async () => {
    const response = await request(app).get('/api/projects');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Authentication token is required.');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('GET /api/projects returns projects for an authenticated user', async () => {
    db.query.mockResolvedValueOnce([
      {
        id: 3,
        user_id: 12,
        title: 'Studio Landing Page',
        description: 'A clean business website.',
        site_type: 'business',
        prompt: 'Create a business website.',
        style_options: '{"primaryColor":"#14B8A6","mood":"premium"}',
        created_at: '2026-06-01 10:00:00',
        updated_at: '2026-06-01 10:00:00'
      }
    ]);

    const response = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${createToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.projects).toHaveLength(1);
    expect(response.body.projects[0]).toMatchObject({
      id: 3,
      userId: 12,
      title: 'Studio Landing Page',
      siteType: 'business',
      styleOptions: {
        primaryColor: '#14B8A6',
        mood: 'premium'
      }
    });
    expect(db.query.mock.calls[0][0]).toContain('WHERE user_id = ?');
    expect(db.query.mock.calls[0][1][0]).toBe(12);
  });
});
