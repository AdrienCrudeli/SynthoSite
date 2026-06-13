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

  test('returns today usage grouped by model', async () => {
    db.query.mockResolvedValueOnce([
      { model_id: 'gemini-flash', used_today: 2 },
      { model_id: 'groq-llama', used_today: 1 }
    ]);

    const usage = await getAiUsageByModel();

    expect(usage).toEqual(new Map([
      ['gemini-flash', 2],
      ['groq-llama', 1]
    ]));
  });

  test('falls back to an empty usage map before the migration is applied', async () => {
    db.query.mockRejectedValueOnce({ code: 'ER_NO_SUCH_TABLE' });

    await expect(getAiUsageByModel()).resolves.toEqual(new Map());
  });
});
