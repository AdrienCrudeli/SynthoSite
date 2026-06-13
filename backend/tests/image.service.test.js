process.env.NODE_ENV = 'test';

jest.mock('../src/config/db', () => ({
  query: jest.fn()
}));

const { buildQueryCandidates, injectImages } = require('../src/services/image.service');
const db = require('../src/config/db');

describe('Image injection service', () => {
  const originalFetch = global.fetch;
  const originalPexelsKey = process.env.PEXELS_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    process.env.PEXELS_API_KEY = 'test_pexels_key';
    db.query.mockResolvedValue([]);
  });

  afterEach(() => {
    global.fetch = originalFetch;

    if (originalPexelsKey === undefined) {
      delete process.env.PEXELS_API_KEY;
    } else {
      process.env.PEXELS_API_KEY = originalPexelsKey;
    }
  });

  test('builds stronger fallback candidates for specific car queries', () => {
    expect(buildQueryCandidates('red-ford-mustang-sports-car', 'Ford Mustang')).toEqual(
      expect.arrayContaining([
        'red ford mustang sports car',
        'ford mustang car',
        'mustang sports car',
        'classic muscle car',
        'sports car'
      ])
    );
  });

  test('deduplicates restaurant image queries and injects Pexels CDN URLs', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          photos: [{ src: { landscape: 'https://images.pexels.com/photos/pasta.jpeg' } }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          photos: [{ src: { landscape: 'https://images.pexels.com/photos/chef.jpeg' } }]
        })
      });

    const html = `<!doctype html>
      <html>
        <body>
          <main>
            <img data-query="restaurant pasta menu" alt="Pasta menu" width="1200" height="600" />
            <img data-query="restaurant pasta menu" alt="Signature pasta" width="1200" height="600" />
            <img data-query="chef plating dish" alt="Chef plating" width="1200" height="600" />
          </main>
          <footer>Restaurant footer</footer>
        </body>
      </html>`;

    const result = await injectImages(html);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(String(global.fetch.mock.calls[0][0])).toContain('query=restaurant+pasta+menu');
    expect(String(global.fetch.mock.calls[1][0])).toContain('query=chef+plating+dish');
    expect(result).toContain('src="https://images.pexels.com/photos/pasta.jpeg"');
    expect(result).toContain('src="https://images.pexels.com/photos/chef.jpeg"');
    expect(result).not.toContain('data-query=');
    expect(result).toContain('Photos provided by Pexels');
    expect(result).toContain('https://www.pexels.com');
  });

  test('uses a loading fallback when Pexels is unavailable', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({})
    });

    const result = await injectImages(
      '<!doctype html><html><body><img data-query="red ford mustang sports car" alt="Ford Mustang" width="1200" height="600" /></body></html>'
    );

    expect(result).toContain('src="https://picsum.photos/seed/red%20ford%20mustang%20sports%20car/1200/600"');
    expect(result).toContain('Photos provided by Pexels');
  });

  test('replaces old random image URLs when alt text gives a useful query', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        photos: [{ src: { large2x: 'https://images.pexels.com/photos/mustang-large.jpeg' } }]
      })
    });

    const result = await injectImages(
      '<!doctype html><html><body><section><h2>Ford Mustang</h2><img src="https://picsum.photos/seed/mustang/1200/600" alt="Ford Mustang sports car" width="1200" height="600" /></section></body></html>'
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(global.fetch.mock.calls[0][0])).toContain('query=ford+mustang+sports+car');
    expect(result).toContain('src="https://images.pexels.com/photos/mustang-large.jpeg"');
    expect(result).not.toContain('picsum.photos');
  });
});
