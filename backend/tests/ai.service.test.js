process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test_gemini_key';
process.env.GROQ_API_KEY = 'test_groq_key';

const mockCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate
      }
    }
  }));
});

const { generateSite } = require('../src/services/ai.service');

describe('AI service provider fallback', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  test('falls back to the next provider when the requested model returns 429', async () => {
    mockCreate
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '```html\n<!doctype html><html><body>ok</body></html>\n```'
            }
          }
        ]
      });

    const result = await generateSite('Build a site', {}, 'gemini-flash');

    expect(result).toEqual({
      code: '<!doctype html><html><body>ok</body></html>',
      modelUsed: 'groq-llama'
    });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[0][0].model).toBe('gemini-2.5-flash');
    expect(mockCreate.mock.calls[1][0].model).toBe('llama-3.3-70b-versatile');
  });
});
