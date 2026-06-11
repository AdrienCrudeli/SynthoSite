process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test_gemini_key';
process.env.GROQ_API_KEY = 'test_groq_key';
process.env.MISTRAL_API_KEY = 'test_mistral_key';
process.env.CEREBRAS_API_KEY = 'test_cerebras_key';

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

  test('falls back when the requested provider rejects an invalid key', async () => {
    mockCreate
      .mockRejectedValueOnce({ status: 401 })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '<!doctype html><html><body>fallback</body></html>'
            }
          }
        ]
      });

    const result = await generateSite('Build a site', {}, 'mistral-large');

    expect(result).toEqual({
      code: '<!doctype html><html><body>fallback</body></html>',
      modelUsed: 'gemini-flash'
    });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[0][0].model).toBe('mistral-large-latest');
    expect(mockCreate.mock.calls[1][0].model).toBe('gemini-2.5-flash');
  });

  test('continues fallback order when a provider has a temporary server error', async () => {
    mockCreate
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '<!doctype html><html><body>available</body></html>'
            }
          }
        ]
      });

    const result = await generateSite('Build a site', {}, 'gemini-flash');

    expect(result).toEqual({
      code: '<!doctype html><html><body>available</body></html>',
      modelUsed: 'groq-llama'
    });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[0][0].model).toBe('gemini-2.5-flash');
    expect(mockCreate.mock.calls[1][0].model).toBe('llama-3.3-70b-versatile');
  });
});
