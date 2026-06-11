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

function createToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
}

describe('Admin routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
