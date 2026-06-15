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

  test('generates multi-page sites through a plan plus one request per page', async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: `\`\`\`json
{
  "pages": [
    { "id": "home", "label": "Home", "brief": "Hero, story, featured dishes" },
    { "id": "menu", "label": "Menu", "brief": "Detailed menu sections and specials" },
    { "id": "contact", "label": "Contact", "brief": "Hours, booking form and location" }
  ],
  "headerHtml": "<header><nav><a href=\\"#\\" data-page=\\"home\\">Home</a><a href=\\"#\\" data-page=\\"menu\\">Menu</a><a href=\\"#\\" data-page=\\"contact\\">Contact</a></nav></header>",
  "footerHtml": "<footer><a href=\\"https://www.pexels.com\\">Photos provided by Pexels</a></footer>"
}
\`\`\``
            }
          }
        ]
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '<section id="page-home"><h1>Home</h1></section>'
            }
          }
        ]
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '<section id="page-menu"><h1>Menu</h1></section>'
            }
          }
        ]
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '<section id="page-contact"><h1>Contact</h1></section>'
            }
          }
        ]
      });

    const result = await generateSite('Build a multi-page restaurant website', {}, 'groq-llama', {
      mode: 'multipage'
    });

    expect(mockCreate).toHaveBeenCalledTimes(4);
    expect(mockCreate.mock.calls[0][0].model).toBe('llama-3.3-70b-versatile');
    expect(mockCreate.mock.calls[0][0].max_tokens).toBe(4000);
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('objet JSON valide');
    expect(mockCreate.mock.calls[1][0].max_tokens).toBe(8000);
    expect(mockCreate.mock.calls[1][0].messages[0].content).toContain('Header du site');
    expect(mockCreate.mock.calls[1][0].messages[0].content).toContain('Brief : Hero, story, featured dishes');
    expect(result).toMatchObject({
      modelUsed: 'groq-llama',
      apiCalls: 4
    });
    expect(result.code).toContain('<script src="https://cdn.tailwindcss.com"></script>');
    expect(result.code).toContain('<section id="page-home">');
    expect(result.code).toContain('<section id="page-menu">');
    expect(result.code).toContain('<section id="page-contact">');
    expect(result.code).toContain('Photos provided by Pexels');
    expect(result.code).toContain("show('home');");
  });

  test('falls back to the one-shot multi-page prompt when the plan JSON is malformed', async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'not valid json'
            }
          }
        ]
      })
      .mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '<!doctype html><html><body><section id="page-home">ok</section></body></html>'
          }
        }
      ]
      });

    const result = await generateSite('Build a multi-page restaurant website', {}, 'groq-llama', {
      mode: 'multipage'
    });

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[1][0].messages[0].content).toContain('PLUSIEURS pages');
    expect(mockCreate.mock.calls[1][0].max_tokens).toBe(16000);
    expect(result).toEqual({
      code: '<!doctype html><html><body><section id="page-home">ok</section></body></html>',
      modelUsed: 'groq-llama',
      apiCalls: 2
    });
  });

  test('continues remaining multi-page calls on the fallback model after a 429', async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                pages: [
                  { id: 'home', label: 'Home', brief: 'Hero and highlights' },
                  { id: 'services', label: 'Services', brief: 'Detailed services' },
                  { id: 'contact', label: 'Contact', brief: 'Contact form' }
                ],
                headerHtml: '<header><a href="#" data-page="home">Home</a><a href="#" data-page="services">Services</a><a href="#" data-page="contact">Contact</a></header>',
                footerHtml: '<footer><a href="https://www.pexels.com">Photos provided by Pexels</a></footer>'
              })
            }
          }
        ]
      })
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '<section id="page-home"><h1>Home</h1></section>'
            }
          }
        ]
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '<section id="page-services"><h1>Services</h1></section>'
            }
          }
        ]
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '<section id="page-contact"><h1>Contact</h1></section>'
            }
          }
        ]
      });

    const result = await generateSite('Build a multi-page service website', {}, 'groq-llama', {
      mode: 'multipage'
    });

    expect(mockCreate.mock.calls.map((call) => call[0].model)).toEqual([
      'llama-3.3-70b-versatile',
      'llama-3.3-70b-versatile',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash-lite'
    ]);
    expect(modelSettings.autoDisableModel).toHaveBeenCalledWith('groq-llama');
    expect(result).toMatchObject({
      modelUsed: 'gemini-flash-lite',
      apiCalls: 5
    });
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
      modelUsed: 'gemini-flash',
      apiCalls: 1
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
      modelUsed: 'groq-llama',
      apiCalls: 2
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
      modelUsed: 'groq-llama',
      apiCalls: 2
    });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[0][0].model).toBe('gemini-2.5-flash');
    expect(mockCreate.mock.calls[1][0].model).toBe('llama-3.3-70b-versatile');
  });
});
