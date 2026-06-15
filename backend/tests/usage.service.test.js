process.env.NODE_ENV = 'test';

jest.mock('../src/config/db', () => ({
  query: jest.fn()
}));

const db = require('../src/config/db');
const { getAiUsageByModel, recordAiUsage } = require('../src/services/usage.service');

describe('AI usage service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('records a successful AI request', async () => {
    db.query.mockResolvedValueOnce({ insertId: 1 });

    await recordAiUsage('gemini-flash', 'generation');

    expect(db.query).toHaveBeenCalledWith(
      'INSERT INTO ai_usage (model_id, request_type) VALUES (?, ?)',
      ['gemini-flash', 'generation']
    );
  });

  test('returns today usage grouped by model from project api calls', async () => {
    db.query
      .mockResolvedValueOnce([
        { model_id: 'gemini-flash', used_today: 1 },
        { model_id: 'groq-llama', used_today: 6 }
      ])
      .mockResolvedValueOnce([
        { model_id: 'gemini-flash', used_today: 1 },
        { model_id: 'cerebras-llama', used_today: 1 }
      ]);

    const usage = await getAiUsageByModel();

    expect(usage).toEqual(new Map([
      ['gemini-flash', 2],
      ['groq-llama', 6],
      ['cerebras-llama', 1]
    ]));
    expect(db.query.mock.calls[0][0]).toContain('SUM(COALESCE(api_calls, 1))');
    expect(db.query.mock.calls[0][0]).toContain('FROM projects');
    expect(db.query.mock.calls[1][0]).toContain("request_type = 'revision'");
  });

  test('falls back to an empty usage map before the migration is applied', async () => {
    db.query.mockRejectedValueOnce({ code: 'ER_NO_SUCH_TABLE' });

    await expect(getAiUsageByModel()).resolves.toEqual(new Map());
  });

  test('keeps project usage when the revision counter table is unavailable', async () => {
    db.query
      .mockResolvedValueOnce([
        { model_id: 'groq-llama', used_today: 4 }
      ])
      .mockRejectedValueOnce({ code: 'ER_NO_SUCH_TABLE' });

    await expect(getAiUsageByModel()).resolves.toEqual(new Map([
      ['groq-llama', 4]
    ]));
  });
});
