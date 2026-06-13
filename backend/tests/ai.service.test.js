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

jest.mock('../src/services/modelSettings.service', () => ({
  autoDisableModel: jest.fn(),
  getEnabledModelIds: jest.fn()
}));

const { generateSite, reviseSite } = require('../src/services/ai.service');
const modelSettings = require('../src/services/modelSettings.service');

describe('AI service provider fallback', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    modelSettings.autoDisableModel.mockResolvedValue(null);
    modelSettings.getEnabledModelIds.mockResolvedValue([
      'gemini-flash',
      'groq-llama',
      'gemini-flash-lite',
      'mistral-large',
      'cerebras-llama'
    ]);
  });

  test('instructs providers to use data-query images and Pexels attribution', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '<!doctype html><html><body>mustang</body></html>'
          }
        }
      ]
    });

    await generateSite('Build a site about the Ford Mustang', {}, 'gemini-flash');

    const systemPrompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(systemPrompt).toContain('NEVER add a src attribute');
    expect(systemPrompt).toContain('data-query="red ford mustang sports car"');
    expect(systemPrompt).toContain('The src attribute will be injected automatically by the server');
    expect(systemPrompt).toContain('Photos provided by Pexels');
    expect(systemPrompt).toContain('https://www.pexels.com');
    expect(systemPrompt).toContain('Use at most 5 to 6 images across the whole site');
    expect(systemPrompt).not.toContain('pollinations');
    expect(systemPrompt).not.toContain('picsum');
  });

  test('uses the multi-page prompt and larger token budget when requested', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '<!doctype html><html><body><section id="page-home">ok</section></body></html>'
          }
        }
      ]
    });

    await generateSite('Build a multi-page restaurant website', {}, 'groq-llama', {
      mode: 'multipage'
    });

    const request = mockCreate.mock.calls[0][0];
    expect(request.model).toBe('llama-3.3-70b-versatile');
    expect(request.max_tokens).toBe(16000);
    expect(request.messages[0].content).toContain('PLUSIEURS pages');
    expect(request.messages[0].content).toContain('id="page-home"');
    expect(request.messages[0].content).toContain("show('home');");
    expect(request.messages[0].content).toContain('Utilise au maximum 5 à 6 images');
  });

  test('sends the current HTML and requested change when revising a site', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '<!doctype html><html><body>updated</body></html>'
          }
        }
      ]
    });

    const result = await reviseSite(
      '<!doctype html><html><body><header>Bright</header></body></html>',
      'Make the header darker',
      { primaryColor: '#14B8A6' },
      'gemini-flash'
    );

    const userPrompt = mockCreate.mock.calls[0][0].messages[1].content;
    expect(userPrompt).toContain('Current HTML:');
    expect(userPrompt).toContain('<header>Bright</header>');
    expect(userPrompt).toContain('Requested modification:');
    expect(userPrompt).toContain('Make the header darker');
    expect(result).toEqual({
      code: '<!doctype html><html><body>updated</body></html>',
      modelUsed: 'gemini-flash'
    });
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
    expect(modelSettings.autoDisableModel).toHaveBeenCalledWith('gemini-flash');
  });

  test('surfaces selected provider auth errors instead of silently falling back', async () => {
    mockCreate.mockRejectedValueOnce({ status: 401 });

    await expect(generateSite('Build a site', {}, 'groq-llama')).rejects.toThrow(
      'Groq Llama 3.3 70B rejected the API key. Update GROQ_API_KEY in backend/backend.env.'
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].model).toBe('llama-3.3-70b-versatile');
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
