const db = require('../config/db');
const { AI_PROVIDERS } = require('../config/aiProviders');
const { AppError } = require('../middleware/errorHandler');
const aiService = require('../services/ai.service');

function parseStyleOptions(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function serializeProject(row) {
  const project = {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    siteType: row.site_type,
    prompt: row.prompt,
    modelUsed: row.model_used,
    model_used: row.model_used,
    styleOptions: parseStyleOptions(row.style_options),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  if (Object.prototype.hasOwnProperty.call(row, 'generated_code')) {
    project.generatedCode = row.generated_code;
  }

  return project;
}

function buildGenerationPrompt({ title, description, siteType, styleOptions }) {
  return [
    `Create a complete ${siteType} website named "${title}".`,
    `Business/site description: ${description || 'No extra description provided.'}`,
    `Primary color: ${styleOptions?.primaryColor || 'not specified'}.`,
    `Theme or mood: ${styleOptions?.mood || 'modern and professional'}.`,
    'Return only a complete standalone HTML document.'
  ].join('\n');
}

async function listProjects(req, res, next) {
  try {
    const search = req.query.search || null;
    const type = req.query.type || null;
    const sort = req.query.sort || 'recent';
    const searchLike = search ? `%${search}%` : null;
    const rows = await db.query(
      `SELECT id, user_id, title, description, site_type, prompt, model_used, style_options, created_at, updated_at
       FROM projects
       WHERE user_id = ?
         AND (? IS NULL OR title LIKE ? OR description LIKE ?)
         AND (? IS NULL OR site_type = ?)
       ORDER BY
         CASE WHEN ? = 'title' THEN title END ASC,
         CASE WHEN ? = 'oldest' THEN created_at END ASC,
         CASE WHEN ? = 'recent' THEN updated_at END DESC,
         CASE WHEN ? = 'recent' THEN created_at END DESC`,
      [
        req.user.id,
        search,
        searchLike,
        searchLike,
        type,
        type,
        sort,
        sort,
        sort,
        sort
      ]
    );

    return res.json({
      projects: rows.map(serializeProject)
    });
  } catch (error) {
    return next(error);
  }
}

async function getProject(req, res, next) {
  try {
    const rows = await db.query(
      `SELECT id, user_id, title, description, site_type, prompt, model_used, style_options, generated_code, created_at, updated_at
       FROM projects
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      throw new AppError('Project not found.', 404);
    }

    return res.json({
      project: serializeProject(rows[0])
    });
  } catch (error) {
    return next(error);
  }
}

async function generateProject(req, res, next) {
  try {
    const { title, description, siteType, styleOptions = {}, model } = req.body;

    if (!AI_PROVIDERS[model]) {
      throw new AppError('Selected AI model is not available.', 400);
    }

    const prompt = buildGenerationPrompt({ title, description, siteType, styleOptions });
    const { code: generatedCode, modelUsed } = await aiService.generateSite(prompt, styleOptions, model);
    const result = await db.query(
      `INSERT INTO projects
        (user_id, title, description, site_type, prompt, model_used, style_options, generated_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        title,
        description || null,
        siteType,
        prompt,
        modelUsed,
        JSON.stringify(styleOptions),
        generatedCode
      ]
    );

    return res.status(201).json({
      project: {
        id: result.insertId,
        userId: req.user.id,
        title,
        description: description || null,
        siteType,
        prompt,
        modelUsed,
        model_used: modelUsed,
        styleOptions,
        generatedCode
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function updateProject(req, res, next) {
  try {
    const { title, description } = req.body;
    const result = await db.query(
      'UPDATE projects SET title = ?, description = ? WHERE id = ? AND user_id = ?',
      [title, description || null, req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      throw new AppError('Project not found.', 404);
    }

    const rows = await db.query(
      `SELECT id, user_id, title, description, site_type, prompt, model_used, style_options, generated_code, created_at, updated_at
       FROM projects
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [req.params.id, req.user.id]
    );

    return res.json({
      project: serializeProject(rows[0])
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteProject(req, res, next) {
  try {
    const result = await db.query(
      'DELETE FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      throw new AppError('Project not found.', 404);
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listProjects,
  getProject,
  generateProject,
  updateProject,
  deleteProject,
  serializeProject
};
