const express = require('express');
const { body, param, query } = require('express-validator');
const publicController = require('../controllers/public.controller');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

router.get(
  '/api/public/projects',
  [
    query('sort')
      .optional({ nullable: true, checkFalsy: true })
      .isIn(['favorites', 'recent', 'random'])
      .withMessage('Sort must be favorites, recent or random.'),
    query('limit')
      .optional({ nullable: true, checkFalsy: true })
      .isInt({ min: 1, max: 60 })
      .withMessage('Limit must be between 1 and 60.'),
    query('visitorId')
      .optional({ nullable: true, checkFalsy: true })
      .matches(/^[a-zA-Z0-9_-]{8,80}$/)
      .withMessage('Visitor id is invalid.')
  ],
  validateRequest,
  publicController.listPublicProjects
);

router.post(
  '/api/public/projects/:id/like',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Project id must be a positive integer.'),
    body('visitorId')
      .matches(/^[a-zA-Z0-9_-]{8,80}$/)
      .withMessage('A valid visitor id is required.')
  ],
  validateRequest,
  publicController.likeProject
);

router.delete(
  '/api/public/projects/:id/like',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Project id must be a positive integer.'),
    body('visitorId')
      .matches(/^[a-zA-Z0-9_-]{8,80}$/)
      .withMessage('A valid visitor id is required.')
  ],
  validateRequest,
  publicController.unlikeProject
);

router.get(
  '/p/:id',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Project id must be a positive integer.')
  ],
  validateRequest,
  publicController.showPublicProject
);

module.exports = router;
