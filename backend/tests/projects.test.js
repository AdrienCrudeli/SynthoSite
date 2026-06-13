process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/services/ai.service', () => ({
  generateSite: jest.fn(),
  reviseSite: jest.fn()
}));

jest.mock('../src/services/image.service', () => ({
  injectImages: jest.fn()
}));

jest.mock('../src/services/usage.service', () => ({
  recordAiUsage: jest.fn()
}));

const db = require('../src/config/db');
const aiService = require('../src/services/ai.service');
const imageService = require('../src/services/image.service');
const usageService = require('../src/services/usage.service');
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
        model_used: 'gemini-flash',
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
      modelUsed: 'gemini-flash',
      styleOptions: {
        primaryColor: '#14B8A6',
        mood: 'premium'
      }
    });
    expect(db.query.mock.calls[0][0]).toContain('WHERE user_id = ?');
    expect(db.query.mock.calls[0][1][0]).toBe(12);
  });

  test('POST /api/projects/generate stores image-injected HTML', async () => {
    aiService.generateSite.mockResolvedValueOnce({
      code: '<!doctype html><html><body><img data-query="red ford mustang sports car" alt="Ford Mustang" width="1200" height="600" /></body></html>',
      modelUsed: 'gemini-flash'
    });
    imageService.injectImages.mockResolvedValueOnce(
      '<!doctype html><html><body><img src="https://images.pexels.com/photos/mustang.jpeg" alt="Ford Mustang" width="1200" height="600" /></body></html>'
    );
    db.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ insertId: 9 });

    const response = await request(app)
      .post('/api/projects/generate')
      .set('Authorization', `Bearer ${createToken()}`)
      .send({
        title: 'Mustang Showcase',
        description: 'Ford Mustang presentation website',
        siteType: 'business',
        model: 'gemini-flash',
        styleOptions: {
          primaryColor: '#14B8A6',
          mood: 'premium'
        }
      });

    expect(response.status).toBe(201);
    expect(aiService.generateSite).toHaveBeenCalledWith(
      expect.stringContaining('Mustang Showcase'),
      {
        primaryColor: '#14B8A6',
        mood: 'premium'
      },
      'gemini-flash',
      {
        allowedModelIds: [
          'gemini-flash',
          'groq-llama',
          'gemini-flash-lite',
          'mistral-large',
          'cerebras-llama'
        ]
      }
    );
    expect(imageService.injectImages).toHaveBeenCalledWith(
      '<!doctype html><html><body><img data-query="red ford mustang sports car" alt="Ford Mustang" width="1200" height="600" /></body></html>'
    );
    expect(usageService.recordAiUsage).toHaveBeenCalledWith('gemini-flash', 'generation');
    expect(db.query.mock.calls[2][1][7]).toBe(
      '<!doctype html><html><body><img src="https://images.pexels.com/photos/mustang.jpeg" alt="Ford Mustang" width="1200" height="600" /></body></html>'
    );
    expect(response.body.project.generatedCode).toContain('https://images.pexels.com/photos/mustang.jpeg');
  });

  test('POST /api/projects/generate rejects disabled models', async () => {
    db.query.mockResolvedValueOnce([
      { model_id: 'gemini-flash', enabled: 0 }
    ]);

    const response = await request(app)
      .post('/api/projects/generate')
      .set('Authorization', `Bearer ${createToken()}`)
      .send({
        title: 'Disabled Model',
        description: 'Should not generate.',
        siteType: 'business',
        model: 'gemini-flash',
        styleOptions: {}
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Selected AI model is disabled by an administrator.');
    expect(aiService.generateSite).not.toHaveBeenCalled();
  });

  test('POST /api/projects/:id/revise updates generated HTML for the owner', async () => {
    db.query
      .mockResolvedValueOnce([
        {
          id: 7,
          user_id: 12,
          title: 'Mustang Showcase',
          description: 'A car website.',
          site_type: 'business',
          prompt: 'Create a business website.',
          model_used: 'gemini-flash',
          style_options: '{"primaryColor":"#14B8A6"}',
          generated_code: '<!doctype html><html><body><header>Bright</header></body></html>',
          created_at: '2026-06-01 10:00:00',
          updated_at: '2026-06-01 10:00:00'
        }
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ affectedRows: 1 })
      .mockResolvedValueOnce([
        {
          id: 7,
          user_id: 12,
          title: 'Mustang Showcase',
          description: 'A car website.',
          site_type: 'business',
          prompt: 'Create a business website.',
          model_used: 'groq-llama',
          style_options: '{"primaryColor":"#14B8A6"}',
          generated_code: '<!doctype html><html><body><header>Dark</header><img src="https://images.pexels.com/photos/dark.jpeg" alt="Dark header" /></body></html>',
          created_at: '2026-06-01 10:00:00',
          updated_at: '2026-06-01 10:05:00'
        }
      ]);
    aiService.reviseSite.mockResolvedValueOnce({
      code: '<!doctype html><html><body><header>Dark</header></body></html>',
      modelUsed: 'groq-llama'
    });
    imageService.injectImages.mockResolvedValueOnce(
      '<!doctype html><html><body><header>Dark</header><img src="https://images.pexels.com/photos/dark.jpeg" alt="Dark header" /></body></html>'
    );

    const response = await request(app)
      .post('/api/projects/7/revise')
      .set('Authorization', `Bearer ${createToken()}`)
      .send({ modification: 'Make the header darker' });

    expect(response.status).toBe(200);
    expect(aiService.reviseSite).toHaveBeenCalledWith(
      '<!doctype html><html><body><header>Bright</header></body></html>',
      'Make the header darker',
      { primaryColor: '#14B8A6' },
      'gemini-flash',
      {
        allowedModelIds: [
          'gemini-flash',
          'groq-llama',
          'gemini-flash-lite',
          'mistral-large',
          'cerebras-llama'
        ]
      }
    );
    expect(imageService.injectImages).toHaveBeenCalledWith(
      '<!doctype html><html><body><header>Dark</header></body></html>'
    );
    expect(usageService.recordAiUsage).toHaveBeenCalledWith('groq-llama', 'revision');
    expect(db.query.mock.calls[2]).toEqual([
      'UPDATE projects SET generated_code = ?, model_used = ? WHERE id = ? AND user_id = ?',
      [
        '<!doctype html><html><body><header>Dark</header><img src="https://images.pexels.com/photos/dark.jpeg" alt="Dark header" /></body></html>',
        'groq-llama',
        '7',
        12
      ]
    ]);
    expect(response.body.project).toMatchObject({
      id: 7,
      userId: 12,
      modelUsed: 'groq-llama',
      generatedCode: '<!doctype html><html><body><header>Dark</header><img src="https://images.pexels.com/photos/dark.jpeg" alt="Dark header" /></body></html>'
    });
  });
});
