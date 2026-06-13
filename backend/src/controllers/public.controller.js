const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

const SORTS = {
  favorites: 'p.like_count DESC, p.view_count DESC, p.updated_at DESC',
  recent: 'p.created_at DESC, p.updated_at DESC',
  random: 'RAND()'
};

function serializePublicProject(row, likedProjectIds = new Set()) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    siteType: row.site_type,
    ownerUsername: row.owner_username,
    modelUsed: row.model_used,
    viewCount: Number(row.view_count || 0),
    likeCount: Number(row.like_count || 0),
    isLiked: likedProjectIds.has(Number(row.id)),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function parseLimit(value) {
  const limit = Number(value || 6);

  if (!Number.isInteger(limit) || limit < 1) {
    return 6;
  }

  return Math.min(limit, 60);
}

function isValidVisitorId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(value);
}

async function getLikedProjectIds(projectIds, visitorId) {
  if (!isValidVisitorId(visitorId) || projectIds.length === 0) {
    return new Set();
  }

  const placeholders = projectIds.map(() => '?').join(', ');
  const rows = await db.query(
    `SELECT project_id
     FROM project_likes
     WHERE visitor_id = ? AND project_id IN (${placeholders})`,
    [visitorId, ...projectIds]
  );

  return new Set(rows.map((row) => Number(row.project_id)));
}

async function listPublicProjects(req, res, next) {
  try {
    const sort = SORTS[req.query.sort] ? req.query.sort : 'recent';
    const limit = parseLimit(req.query.limit);
    const rows = await db.query(
      `SELECT
         p.id,
         p.title,
         p.description,
         p.site_type,
         p.model_used,
         p.view_count,
         p.like_count,
         p.created_at,
         p.updated_at,
         u.username AS owner_username
       FROM projects p
       INNER JOIN users u ON u.id = p.user_id
       WHERE p.is_public = 1 AND p.generated_code IS NOT NULL
       ORDER BY ${SORTS[sort]}
       LIMIT ${limit}`
    );
    const likedProjectIds = await getLikedProjectIds(
      rows.map((row) => Number(row.id)),
      req.query.visitorId
    );

    return res.json({
      projects: rows.map((row) => serializePublicProject(row, likedProjectIds))
    });
  } catch (error) {
    return next(error);
  }
}

async function showPublicProject(req, res, next) {
  try {
    const rows = await db.query(
      'SELECT generated_code FROM projects WHERE id = ? AND is_public = 1 LIMIT 1',
      [req.params.id]
    );

    if (rows.length === 0 || !rows[0].generated_code) {
      throw new AppError('Public site not found.', 404);
    }

    await db.query(
      'UPDATE projects SET view_count = view_count + 1 WHERE id = ? AND is_public = 1',
      [req.params.id]
    );

    return res.type('html').send(rows[0].generated_code);
  } catch (error) {
    return next(error);
  }
}

async function likeProject(req, res, next) {
  try {
    const visitorId = req.body.visitorId;

    if (!isValidVisitorId(visitorId)) {
      throw new AppError('A valid visitor id is required.', 400);
    }

    const projects = await db.query(
      'SELECT id FROM projects WHERE id = ? AND is_public = 1 AND generated_code IS NOT NULL LIMIT 1',
      [req.params.id]
    );

    if (projects.length === 0) {
      throw new AppError('Public site not found.', 404);
    }

    const result = await db.query(
      'INSERT IGNORE INTO project_likes (project_id, visitor_id) VALUES (?, ?)',
      [req.params.id, visitorId]
    );

    if (Number(result.affectedRows || 0) > 0) {
      await db.query(
        'UPDATE projects SET like_count = like_count + 1 WHERE id = ?',
        [req.params.id]
      );
    }

    const rows = await db.query(
      'SELECT id, like_count FROM projects WHERE id = ? LIMIT 1',
      [req.params.id]
    );

    return res.json({
      project: {
        id: Number(req.params.id),
        likeCount: Number(rows[0]?.like_count || 0),
        isLiked: true
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function unlikeProject(req, res, next) {
  try {
    const visitorId = req.body.visitorId;

    if (!isValidVisitorId(visitorId)) {
      throw new AppError('A valid visitor id is required.', 400);
    }

    const result = await db.query(
      `DELETE l
       FROM project_likes l
       INNER JOIN projects p ON p.id = l.project_id
       WHERE l.project_id = ? AND l.visitor_id = ? AND p.is_public = 1`,
      [req.params.id, visitorId]
    );

    if (Number(result.affectedRows || 0) > 0) {
      await db.query(
        'UPDATE projects SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?',
        [req.params.id]
      );
    }

    const rows = await db.query(
      'SELECT id, like_count FROM projects WHERE id = ? LIMIT 1',
      [req.params.id]
    );

    if (rows.length === 0) {
      throw new AppError('Public site not found.', 404);
    }

    return res.json({
      project: {
        id: Number(req.params.id),
        likeCount: Number(rows[0]?.like_count || 0),
        isLiked: false
      }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listPublicProjects,
  showPublicProject,
  likeProject,
  unlikeProject,
  serializePublicProject
};
