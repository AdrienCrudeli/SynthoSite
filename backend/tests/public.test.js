process.env.NODE_ENV = 'test';

const request = require('supertest');

jest.mock('../src/config/db', () => ({
  query: jest.fn()
}));

const db = require('../src/config/db');
const app = require('../src/app');

describe('Public project routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /p/:id serves only public generated HTML', async () => {
    db.query
      .mockResolvedValueOnce([
        {
          generated_code: '<!doctype html><html><body>public</body></html>'
        }
      ])
      .mockResolvedValueOnce({ affectedRows: 1 });

    const response = await request(app).get('/p/7');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toBe('<!doctype html><html><body>public</body></html>');
    expect(db.query.mock.calls[0][0]).toContain('is_public = 1');
    expect(db.query.mock.calls[1]).toEqual([
      'UPDATE projects SET view_count = view_count + 1 WHERE id = ? AND is_public = 1',
      ['7']
    ]);
  });

  test('GET /p/:id hides private or missing projects', async () => {
    db.query.mockResolvedValueOnce([]);

    const response = await request(app).get('/p/7');

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Public site not found.');
  });

  test('GET /api/public/projects returns public gallery projects with liked state', async () => {
    db.query
      .mockResolvedValueOnce([
        {
          id: 7,
          title: 'Mustang Showcase',
          description: 'A car website.',
          site_type: 'business',
          model_used: 'gemini-flash',
          view_count: 12,
          like_count: 4,
          created_at: '2026-06-01 10:00:00',
          updated_at: '2026-06-01 11:00:00',
          owner_username: 'student'
        }
      ])
      .mockResolvedValueOnce([
        { project_id: 7 }
      ]);

    const response = await request(app)
      .get('/api/public/projects?sort=favorites&limit=3&visitorId=visitor_12345');

    expect(response.status).toBe(200);
    expect(response.body.projects).toEqual([
      {
        id: 7,
        title: 'Mustang Showcase',
        description: 'A car website.',
        siteType: 'business',
        ownerUsername: 'student',
        modelUsed: 'gemini-flash',
        viewCount: 12,
        likeCount: 4,
        isLiked: true,
        createdAt: '2026-06-01 10:00:00',
        updatedAt: '2026-06-01 11:00:00'
      }
    ]);
    expect(db.query.mock.calls[0][0]).toContain('p.is_public = 1');
    expect(db.query.mock.calls[0][0]).toContain('p.like_count DESC');
  });

  test('POST /api/public/projects/:id/like adds one like per visitor', async () => {
    db.query
      .mockResolvedValueOnce([{ id: 7 }])
      .mockResolvedValueOnce({ affectedRows: 1 })
      .mockResolvedValueOnce({ affectedRows: 1 })
      .mockResolvedValueOnce([{ id: 7, like_count: 5 }]);

    const response = await request(app)
      .post('/api/public/projects/7/like')
      .send({ visitorId: 'visitor_12345' });

    expect(response.status).toBe(200);
    expect(db.query.mock.calls[1]).toEqual([
      'INSERT IGNORE INTO project_likes (project_id, visitor_id) VALUES (?, ?)',
      ['7', 'visitor_12345']
    ]);
    expect(response.body.project).toEqual({
      id: 7,
      likeCount: 5,
      isLiked: true
    });
  });

  test('DELETE /api/public/projects/:id/like removes a visitor like', async () => {
    db.query
      .mockResolvedValueOnce({ affectedRows: 1 })
      .mockResolvedValueOnce({ affectedRows: 1 })
      .mockResolvedValueOnce([{ id: 7, like_count: 4 }]);

    const response = await request(app)
      .delete('/api/public/projects/7/like')
      .send({ visitorId: 'visitor_12345' });

    expect(response.status).toBe(200);
    expect(db.query.mock.calls[0][0]).toContain('DELETE l');
    expect(response.body.project).toEqual({
      id: 7,
      likeCount: 4,
      isLiked: false
    });
  });
});
