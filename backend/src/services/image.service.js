const cheerio = require('cheerio');
require('../config/env');
const db = require('../config/db');

const RANDOM_IMAGE_HOSTS = [
  'picsum.photos',
  'image.pollinations.ai'
];

const COLOR_WORDS = new Set([
  'black',
  'blue',
  'brown',
  'green',
  'grey',
  'gray',
  'orange',
  'pink',
  'purple',
  'red',
  'silver',
  'white',
  'yellow'
]);

const GENERIC_WORDS = new Set([
  'background',
  'banner',
  'hero',
  'image',
  'photo',
  'picture',
  'section',
  'site',
  'website',
  'with',
  'from',
  'for',
  'and',
  'the'
]);

const IMAGE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EMPTY_IMAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeQuery(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addCandidate(candidates, value, maxWords = 6) {
  const query = normalizeQuery(value)
    .split(' ')
    .filter(Boolean)
    .slice(0, maxWords)
    .join(' ');

  if (query && query.split(' ').length >= 2 && !candidates.includes(query)) {
    candidates.push(query);
  }
}

function addDomainCandidates(candidates, queryText) {
  if (/\bford\b/.test(queryText) && /\bmustang\b/.test(queryText)) {
    addCandidate(candidates, 'ford mustang car');
    addCandidate(candidates, 'mustang sports car');
    addCandidate(candidates, 'classic muscle car');
    addCandidate(candidates, 'red sports car');
  }

  if (/\bsports?\b/.test(queryText) && /\bcar\b/.test(queryText)) {
    addCandidate(candidates, 'sports car');
  }

  if (/\bmuscle\b/.test(queryText) && /\bcar\b/.test(queryText)) {
    addCandidate(candidates, 'muscle car');
  }

  if (/\b(restaurant|menu|chef|dish|dining|bistro|food)\b/.test(queryText)) {
    addCandidate(candidates, 'restaurant food');
    addCandidate(candidates, 'chef plating dish');
    addCandidate(candidates, 'restaurant dining table');
  }

  if (/\b(portfolio|designer|artist|studio|creative)\b/.test(queryText)) {
    addCandidate(candidates, 'creative studio');
    addCandidate(candidates, 'designer workspace');
  }
}

function buildQueryCandidates(query, alt = '') {
  const candidates = [];
  const normalizedQuery = normalizeQuery(query);
  const normalizedAlt = normalizeQuery(alt);
  const combined = `${normalizedQuery} ${normalizedAlt}`.trim();
  const words = normalizedQuery.split(' ').filter(Boolean);
  const meaningfulWords = words.filter((word) => !GENERIC_WORDS.has(word));
  const withoutColors = meaningfulWords.filter((word) => !COLOR_WORDS.has(word));

  addCandidate(candidates, normalizedQuery);
  addCandidate(candidates, normalizedAlt);
  addDomainCandidates(candidates, combined);

  if (meaningfulWords.length >= 2) {
    addCandidate(candidates, meaningfulWords.join(' '));
  }

  if (withoutColors.length >= 2) {
    addCandidate(candidates, withoutColors.join(' '));
  }

  if (words.length > 4) {
    addCandidate(candidates, words.slice(0, 4).join(' '));
    addCandidate(candidates, words.slice(-4).join(' '));
  }

  return candidates;
}

function isMissingImageCacheTableError(error) {
  return error?.code === 'ER_NO_SUCH_TABLE' || error?.errno === 1146;
}

function parseCachedUrls(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (error) {
    return [];
  }
}

function isCacheEntryFresh(row, urls) {
  const createdAt = new Date(row.created_at).getTime();

  if (!Number.isFinite(createdAt)) {
    return true;
  }

  const ttl = urls.length > 0 ? IMAGE_CACHE_TTL_MS : EMPTY_IMAGE_CACHE_TTL_MS;
  return Date.now() - createdAt <= ttl;
}

async function getCachedImageUrls(query) {
  try {
    const rows = await db.query(
      'SELECT urls, created_at FROM image_cache WHERE query = ? LIMIT 1',
      [query]
    );

    if (rows.length === 0) {
      return null;
    }

    const urls = parseCachedUrls(rows[0].urls);

    if (!isCacheEntryFresh(rows[0], urls)) {
      return null;
    }

    return urls;
  } catch (error) {
    if (isMissingImageCacheTableError(error)) {
      return null;
    }

    return null;
  }
}

async function saveImageCache(query, urls) {
  try {
    await db.query(
      `INSERT INTO image_cache (query, urls)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE urls = VALUES(urls), created_at = CURRENT_TIMESTAMP`,
      [query, JSON.stringify(urls)]
    );
  } catch (error) {
    // Image generation should not fail if the cache table is unavailable.
  }
}

async function fetchPexelsCandidateUrls(query) {
  if (!process.env.PEXELS_API_KEY) {
    return { urls: [], quotaExhausted: false, shouldCache: false };
  }

  try {
    const url = new URL('https://api.pexels.com/v1/search');
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', '10');
    url.searchParams.set('orientation', 'landscape');
    url.searchParams.set('locale', 'en-US');

    const res = await fetch(url, {
      headers: {
        Authorization: process.env.PEXELS_API_KEY,
        'User-Agent': 'SynthoSite/1.0'
      }
    });

    if (!res.ok) {
      await recordPexelsRequest(query, res.status, false);
      return {
        urls: [],
        quotaExhausted: res.status === 429,
        shouldCache: res.status === 429
      };
    }

    const data = await res.json();
    const urls = [...new Set((data.photos || [])
      .map((item) => item.src?.large2x || item.src?.landscape || item.src?.large)
      .filter(Boolean))];

    await recordPexelsRequest(query, res.status, urls.length > 0);
    return { urls, quotaExhausted: false, shouldCache: true };
  } catch (error) {
    await recordPexelsRequest(query, 0, false);
    return { urls: [], quotaExhausted: false, shouldCache: false };
  }
}

async function getCandidateUrls(candidate, cache) {
  if (!cache.has(candidate)) {
    cache.set(candidate, (async () => {
      const cachedUrls = await getCachedImageUrls(candidate);

      if (cachedUrls !== null) {
        return {
          urls: cachedUrls,
          quotaExhausted: false
        };
      }

      const result = await fetchPexelsCandidateUrls(candidate);

      if (result.shouldCache) {
        await saveImageCache(candidate, result.urls);
      }

      return result;
    })());
  }

  return cache.get(candidate);
}

function pickUrlForQuery(query, urls, selectionState) {
  if (!Array.isArray(urls) || urls.length === 0) {
    return null;
  }

  let remaining = selectionState.get(query);

  if (!remaining || remaining.length === 0) {
    remaining = [...urls];
  }

  const selectedIndex = Math.floor(Math.random() * remaining.length);
  const [imageUrl] = remaining.splice(selectedIndex, 1);
  selectionState.set(query, remaining);

  return imageUrl || null;
}

async function searchPexels(query, alt = '', cache = new Map(), selectionState = new Map()) {
  const candidates = buildQueryCandidates(query, alt);

  for (const candidate of candidates) {
    const result = await getCandidateUrls(candidate, cache);
    const imageUrl = pickUrlForQuery(candidate, result.urls, selectionState);

    if (imageUrl) {
      return imageUrl;
    }

    if (result.quotaExhausted) {
      return null;
    }
  }

  return null;
}

function getFallbackImageUrl(query) {
  return `https://picsum.photos/seed/${encodeURIComponent(normalizeQuery(query) || 'synthosite')}/1200/600`;
}

function emptyPexelsUsage() {
  return {
    id: 'pexels',
    label: 'Pexels API',
    used: 0,
    matched: 0,
    fallback: 0,
    limit: Number(process.env.PEXELS_DAILY_LIMIT) || 200
  };
}

function isMissingUsageTableError(error) {
  return error?.code === 'ER_NO_SUCH_TABLE' || error?.errno === 1146;
}

async function recordPexelsRequest(query, statusCode, matched) {
  try {
    await db.query(
      'INSERT INTO pexels_usage (query, status_code, matched) VALUES (?, ?, ?)',
      [query, statusCode, matched ? 1 : 0]
    );
  } catch (error) {
    // Image generation should still succeed if the local usage counter is unavailable.
  }
}

async function getPexelsUsage() {
  const usage = emptyPexelsUsage();

  try {
    const rows = await db.query(
      `SELECT
         COUNT(*) AS used_today,
         SUM(CASE WHEN matched = 1 THEN 1 ELSE 0 END) AS matched_today,
         SUM(CASE WHEN matched = 0 THEN 1 ELSE 0 END) AS fallback_today
       FROM pexels_usage
       WHERE DATE(created_at) = CURDATE()`
    );
    const row = rows[0] || {};

    return {
      ...usage,
      used: Number(row.used_today || 0),
      matched: Number(row.matched_today || 0),
      fallback: Number(row.fallback_today || 0)
    };
  } catch (error) {
    if (isMissingUsageTableError(error)) {
      return usage;
    }

    throw error;
  }
}

function ensurePexelsAttribution($) {
  const hasAttribution = $('a[href="https://www.pexels.com"]').toArray().some((el) => (
    $(el).text().includes('Photos provided by Pexels') ||
    $(el).parent().text().includes('Photos provided by Pexels')
  ));

  if (hasAttribution) {
    return;
  }

  const attribution = '<p><a href="https://www.pexels.com" target="_blank" rel="noreferrer">Photos provided by Pexels</a></p>';
  const footer = $('footer').first();

  if (footer.length > 0) {
    footer.append(attribution);
    return;
  }

  $('body').append(`<footer>${attribution}</footer>`);
}

function isRandomImageSource(src) {
  if (!src) {
    return true;
  }

  return RANDOM_IMAGE_HOSTS.some((host) => src.includes(host));
}

function getElementQuery($, el) {
  const image = $(el);
  const directQuery = image.attr('data-query') || image.attr('alt') || image.attr('title') || '';

  if (normalizeQuery(directQuery)) {
    return directQuery;
  }

  const figureText = image.closest('figure').find('figcaption').first().text();

  if (normalizeQuery(figureText)) {
    return figureText;
  }

  return image
    .closest('section, article, div')
    .find('h1, h2, h3')
    .first()
    .text();
}

async function injectImages(html) {
  const $ = cheerio.load(html);
  const imgs = $('img').toArray().filter((el) => {
    const image = $(el);
    return Boolean(image.attr('data-query')) || isRandomImageSource(image.attr('src'));
  });

  const cache = new Map();
  const selectionState = new Map();
  await Promise.all(
    imgs.map(async (el) => {
      const image = $(el);
      const query = getElementQuery($, el);
      const alt = image.attr('alt') || '';

      if (!normalizeQuery(query)) {
        image.removeAttr('data-query');
        return;
      }

      const imageUrl = (await searchPexels(query, alt, cache, selectionState)) || getFallbackImageUrl(query);
      image.attr('src', imageUrl).removeAttr('data-query');
    })
  );

  ensurePexelsAttribution($);

  return $.html();
}

module.exports = {
  searchPexels,
  buildQueryCandidates,
  getPexelsUsage,
  injectImages,
  normalizeQuery
};
