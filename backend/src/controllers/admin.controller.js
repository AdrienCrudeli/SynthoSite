const db = require('../config/db');
const { AI_PROVIDERS } = require('../config/aiProviders');
const { AppError } = require('../middleware/errorHandler');
const { getPexelsUsage } = require('../services/image.service');
const modelSettings = require('../services/modelSettings.service');
const { getAiUsageByModel } = require('../services/usage.service');

function serializeAdminUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    projectCount: Number(row.project_count || 0),
    createdAt: row.created_at
  };
}

function serializeAdminProject(row) {
  return {
    id: row.id,
    userId: row.user_id,
    ownerUsername: row.owner_username,
    ownerEmail: row.owner_email,
    title: row.title,
    description: row.description,
    siteType: row.site_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function listUsers(req, res, next) {
  try {
    const rows = await db.query(
      `SELECT
         u.id,
         u.username,
         u.email,
         u.role,
         u.created_at,
         COUNT(p.id) AS project_count
       FROM users u
       LEFT JOIN projects p ON p.user_id = u.id
       GROUP BY u.id, u.username, u.email, u.role, u.created_at
       ORDER BY u.created_at DESC`
    );

    return res.json({
      users: rows.map(serializeAdminUser)
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const userId = Number(req.params.id);

    if (userId === Number(req.user.id)) {
      throw new AppError('You cannot delete your own admin account.', 400);
    }

    const result = await db.query(
      'DELETE FROM users WHERE id = ?',
      [userId]
    );

    if (result.affectedRows === 0) {
      throw new AppError('User not found.', 404);
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function listProjects(req, res, next) {
  try {
    const rows = await db.query(
      `SELECT
         p.id,
         p.user_id,
         u.username AS owner_username,
         u.email AS owner_email,
         p.title,
         p.description,
         p.site_type,
         p.created_at,
         p.updated_at
       FROM projects p
       INNER JOIN users u ON u.id = p.user_id
       ORDER BY p.updated_at DESC, p.created_at DESC`
    );

    return res.json({
      projects: rows.map(serializeAdminProject)
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteProject(req, res, next) {
  try {
    const result = await db.query(
      'DELETE FROM projects WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      throw new AppError('Project not found.', 404);
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function listModels(req, res, next) {
  try {
    const [models, usageByModel] = await Promise.all([
      modelSettings.listModels({ includeDisabled: true }),
      getAiUsageByModel()
    ]);

    return res.json({
      models: models.map((model) => ({
        ...model,
        used: usageByModel.get(model.id) || 0
      }))
    });
  } catch (error) {
    return next(error);
  }
}

async function updateModel(req, res, next) {
  try {
    const { id } = req.params;

    if (!AI_PROVIDERS[id]) {
      throw new AppError('AI model not found.', 404);
    }

    const enabled = Boolean(req.body.enabled);
    const enabledModelIds = await modelSettings.getEnabledModelIds();

    if (!enabled && enabledModelIds.length <= 1 && enabledModelIds.includes(id)) {
      throw new AppError('At least one AI model must remain enabled.', 400);
    }

    const model = await modelSettings.setModelEnabled(id, enabled);

    return res.json({
      model
    });
  } catch (error) {
    return next(error);
  }
}

async function getAdminUsage(req, res, next) {
  try {
    return res.json({
      pexels: await getPexelsUsage()
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listUsers,
  deleteUser,
  listProjects,
  deleteProject,
  listModels,
  updateModel,
  getAdminUsage
};
