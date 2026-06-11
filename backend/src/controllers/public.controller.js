const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

async function showPublicProject(req, res, next) {
  try {
    const rows = await db.query(
      'SELECT generated_code FROM projects WHERE id = ? LIMIT 1',
      [req.params.id]
    );

    if (rows.length === 0 || !rows[0].generated_code) {
      throw new AppError('Public site not found.', 404);
    }

    return res.type('html').send(rows[0].generated_code);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  showPublicProject
};
