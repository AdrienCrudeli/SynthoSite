const express = require('express');
const { param } = require('express-validator');
const adminController = require('../controllers/admin.controller');
const { requireAdmin, verifyToken } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

const idValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Id must be a positive integer.')
];

router.use(verifyToken, requireAdmin);

router.get('/users', adminController.listUsers);

router.delete(
  '/users/:id',
  idValidator,
  validateRequest,
  adminController.deleteUser
);

router.get('/projects', adminController.listProjects);

router.delete(
  '/projects/:id',
  idValidator,
  validateRequest,
  adminController.deleteProject
);

module.exports = router;
