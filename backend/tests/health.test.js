process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const request = require('supertest');

jest.mock('../src/config/db', () => ({
  query: jest.fn()
}));

const db = require('../src/config/db');
const app = require('../src/app');

describe('Health route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /health pings the database and returns ok', async () => {
    db.query.mockResolvedValueOnce([{ healthy: 1 }]);

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok'
    });
    expect(db.query).toHaveBeenCalledWith('SELECT 1');
  });

  test('GET /health returns 503 when the database is unreachable', async () => {
    db.query.mockRejectedValueOnce(new Error('Database unavailable'));

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'db_unreachable'
    });
  });
});
