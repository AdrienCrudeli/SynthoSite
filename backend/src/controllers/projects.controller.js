const db = require('../config/db');
const { AI_PROVIDERS } = require('../config/aiProviders');
const { AppError } = require('../middleware/errorHandler');
const aiService = require('../services/ai.service');
const { injectImages } = require('../services/image.service');
const modelSettings = require('../services/modelSettings.service');
const { recordAiUsage } = require('../services/usage.service');

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
    isPublic: Boolean(row.is_public),
    is_public: Boolean(row.is_public),
    viewCount: Number(row.view_count || 0),
    likeCount: Number(row.like_count || 0),
    apiCalls: Number(row.api_calls || 1),
    styleOptions: parseStyleOptions(row.style_options),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  if (Object.prototype.hasOwnProperty.call(row, 'generated_code')) {
    project.generatedCode = row.generated_code;
  }

  return project;
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function serializeVersion(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    versionNumber: Number(row.version_number),
    label: row.label,
    changeSummary: row.change_summary,
    modelUsed: row.model_used,
    createdAt: row.created_at
  };
}

async function createProjectVersion(projectId, generatedCode, modelUsed, label, changeSummary) {
  const rows = await db.query(
    `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
     FROM project_versions
     WHERE project_id = ?`,
    [projectId]
  );
  const versionNumber = Number(rows[0]?.next_version || 1);

  await db.query(
    `INSERT INTO project_versions
      (project_id, version_number, label, change_summary, model_used, generated_code)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [projectId, versionNumber, label, changeSummary || null, modelUsed || null, generatedCode]
  );

  return versionNumber;
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
      `SELECT id, user_id, title, description, site_type, prompt, model_used, is_public, view_count, like_count, api_calls, style_options, created_at, updated_at
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
      `SELECT id, user_id, title, description, site_type, prompt, model_used, is_public, view_count, like_count, api_calls, style_options, generated_code, created_at, updated_at
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
    const { title, description, siteType, styleOptions = {}, model, isPublic = false, mode = 'single' } = req.body;
    const shouldPublish = parseBoolean(isPublic);

    if (!AI_PROVIDERS[model]) {
      throw new AppError('Selected AI model is not available.', 400);
    }

    if (mode === 'multipage' && !AI_PROVIDERS[model].supportsMultiPage) {
      throw new AppError('Multi-page generation is available only with Groq and Cerebras models.', 400);
    }

    if (!(await modelSettings.isModelEnabled(model))) {
      throw new AppError('Selected AI model is disabled by an administrator.', 400);
    }

    if (!(await modelSettings.isModelAvailable(model))) {
      throw new AppError('Selected AI model is temporarily saturated. Please choose another model.', 400);
    }

    const enabledModelIds = (await modelSettings.getEnabledModelIds()).filter((id) => (
      mode === 'multipage' ? AI_PROVIDERS[id]?.supportsMultiPage : true
    ));

    if (enabledModelIds.length === 0) {
      throw new AppError('No AI model is currently available for this generation mode.', 503);
    }

    const prompt = buildGenerationPrompt({ title, description, siteType, styleOptions });
    const { code, modelUsed, apiCalls = 1 } = await aiService.generateSite(prompt, styleOptions, model, {
      allowedModelIds: enabledModelIds,
      mode
    });
    const generatedCode = await injectImages(code);
    await recordAiUsage(modelUsed, 'generation');
    const result = await db.query(
      `INSERT INTO projects
        (user_id, title, description, site_type, prompt, model_used, is_public, api_calls, style_options, generated_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        title,
        description || null,
        siteType,
        prompt,
        modelUsed,
        shouldPublish ? 1 : 0,
        apiCalls,
        JSON.stringify(styleOptions),
        generatedCode
      ]
    );
    await createProjectVersion(
      result.insertId,
      generatedCode,
      modelUsed,
      'Initial generation',
      'Website generated from the original prompt.'
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
        isPublic: shouldPublish,
        is_public: shouldPublish,
        viewCount: 0,
        likeCount: 0,
        apiCalls,
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
      `SELECT id, user_id, title, description, site_type, prompt, model_used, is_public, view_count, like_count, api_calls, style_options, generated_code, created_at, updated_at
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

async function reviseProject(req, res, next) {
  try {
    const { modification } = req.body;
    const rows = await db.query(
      `SELECT id, user_id, title, description, site_type, prompt, model_used, is_public, view_count, like_count, api_calls, style_options, generated_code, created_at, updated_at
       FROM projects
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      throw new AppError('Project not found.', 404);
    }

    const project = serializeProject(rows[0]);

    if (!project.generatedCode) {
      throw new AppError('This project has no generated HTML to revise.', 400);
    }

    const enabledModelIds = await modelSettings.getEnabledModelIds();
    const { code, modelUsed } = await aiService.reviseSite(
      project.generatedCode,
      modification,
      project.styleOptions || {},
      project.modelUsed,
      {
        allowedModelIds: enabledModelIds
      }
    );
    const generatedCode = await injectImages(code);
    await recordAiUsage(modelUsed, 'revision');

    await db.query(
      'UPDATE projects SET generated_code = ?, model_used = ? WHERE id = ? AND user_id = ?',
      [generatedCode, modelUsed, req.params.id, req.user.id]
    );
    await createProjectVersion(
      req.params.id,
      generatedCode,
      modelUsed,
      'Prompt revision',
      modification
    );

    const updatedRows = await db.query(
      `SELECT id, user_id, title, description, site_type, prompt, model_used, is_public, view_count, like_count, api_calls, style_options, generated_code, created_at, updated_at
       FROM projects
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [req.params.id, req.user.id]
    );

    return res.json({
      project: serializeProject(updatedRows[0])
    });
  } catch (error) {
    return next(error);
  }
}

async function updateVisibility(req, res, next) {
  try {
    const isPublic = parseBoolean(req.body.isPublic);
    const result = await db.query(
      'UPDATE projects SET is_public = ? WHERE id = ? AND user_id = ?',
      [isPublic ? 1 : 0, req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      throw new AppError('Project not found.', 404);
    }

    const rows = await db.query(
      `SELECT id, user_id, title, description, site_type, prompt, model_used, is_public, view_count, like_count, api_calls, style_options, generated_code, created_at, updated_at
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

async function listProjectVersions(req, res, next) {
  try {
    const rows = await db.query(
      `SELECT
         v.id,
         v.project_id,
         v.version_number,
         v.label,
         v.change_summary,
         v.model_used,
         v.created_at
       FROM project_versions v
       INNER JOIN projects p ON p.id = v.project_id
       WHERE v.project_id = ? AND p.user_id = ?
       ORDER BY v.version_number DESC`,
      [req.params.id, req.user.id]
    );

    return res.json({
      versions: rows.map(serializeVersion)
    });
  } catch (error) {
    return next(error);
  }
}

async function restoreProjectVersion(req, res, next) {
  try {
    const rows = await db.query(
      `SELECT
         v.id,
         v.project_id,
         v.version_number,
         v.generated_code,
         v.model_used
       FROM project_versions v
       INNER JOIN projects p ON p.id = v.project_id
       WHERE v.id = ? AND v.project_id = ? AND p.user_id = ?
       LIMIT 1`,
      [req.params.versionId, req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      throw new AppError('Project version not found.', 404);
    }

    const version = rows[0];
    await db.query(
      'UPDATE projects SET generated_code = ?, model_used = ? WHERE id = ? AND user_id = ?',
      [version.generated_code, version.model_used || null, req.params.id, req.user.id]
    );

    const updatedRows = await db.query(
      `SELECT id, user_id, title, description, site_type, prompt, model_used, is_public, view_count, like_count, api_calls, style_options, generated_code, created_at, updated_at
       FROM projects
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [req.params.id, req.user.id]
    );

    return res.json({
      project: serializeProject(updatedRows[0]),
      restoredVersion: serializeVersion(version)
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
  reviseProject,
  updateVisibility,
  listProjectVersions,
  restoreProjectVersion,
  deleteProject,
  serializeProject,
  serializeVersion
};
