process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const request = require('supertest');
const bcrypt = require('bcrypt');

jest.mock('../src/config/db', () => ({
  query: jest.fn()
}));

const db = require('../src/config/db');
const app = require('../src/app');

describe('Auth routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/auth/signup creates a user with a hashed password', async () => {
    db.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ insertId: 1 });

    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        username: 'student_user',
        email: 'student@example.com',
        password: 'StrongPass123'
      });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      id: 1,
      username: 'student_user',
      email: 'student@example.com',
      role: 'user'
    });
    expect(response.body.user.password_hash).toBeUndefined();

    const insertParams = db.query.mock.calls[1][1];
    expect(insertParams[2]).not.toBe('StrongPass123');
    await expect(bcrypt.compare('StrongPass123', insertParams[2])).resolves.toBe(true);
  });

  test('POST /api/auth/login returns a JWT token for valid credentials', async () => {
    const passwordHash = await bcrypt.hash('StrongPass123', 4);
    db.query.mockResolvedValueOnce([
      {
        id: 7,
        username: 'student_user',
        email: 'student@example.com',
        password_hash: passwordHash,
        role: 'user'
      }
    ]);

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'student@example.com',
        password: 'StrongPass123'
      });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({
      id: 7,
      username: 'student_user',
      email: 'student@example.com',
      role: 'user'
    });
    expect(response.body.user.password_hash).toBeUndefined();
  });

  test('POST /api/auth/login rejects a wrong password', async () => {
    const passwordHash = await bcrypt.hash('StrongPass123', 4);
    db.query.mockResolvedValueOnce([
      {
        id: 7,
        username: 'student_user',
        email: 'student@example.com',
        password_hash: passwordHash,
        role: 'user'
      }
    ]);

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'student@example.com',
        password: 'WrongPass123'
      });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid email or password.');
  });
});
