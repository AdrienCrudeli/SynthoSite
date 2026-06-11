const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param, query } = require('express-validator');
const projectsController = require('../controllers/projects.controller');
const { verifyToken } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many generation requests. Please try again later.'
  }
});

const projectIdValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Project id must be a positive integer.')
];

router.use(verifyToken);

router.get(
  '/',
  [
    query('search')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .isLength({ max: 150 })
      .withMessage('Search query must be 150 characters or less.'),
    query('sort')
      .optional({ nullable: true, checkFalsy: true })
      .isIn(['recent', 'oldest', 'title'])
      .withMessage('Sort must be recent, oldest or title.'),
    query('type')
      .optional({ nullable: true, checkFalsy: true })
      .isIn(['business', 'portfolio', 'blog', 'restaurant'])
      .withMessage('Type must be business, portfolio, blog or restaurant.')
  ],
  validateRequest,
  projectsController.listProjects
);

router.post(
  '/generate',
  generateLimiter,
  [
    body('title')
      .trim()
      .isLength({ min: 2, max: 150 })
      .withMessage('Title must be between 2 and 150 characters.'),
    body('description')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be 500 characters or less.'),
    body('siteType')
      .isIn(['business', 'portfolio', 'blog', 'restaurant'])
      .withMessage('Site type must be business, portfolio, blog or restaurant.'),
    body('styleOptions')
      .optional({ nullable: true })
      .isObject()
      .withMessage('Style options must be an object.')
  ],
  validateRequest,
  projectsController.generateProject
);

router.get(
  '/:id',
  projectIdValidator,
  validateRequest,
  projectsController.getProject
);

router.put(
  '/:id',
  projectIdValidator,
  [
    body('title')
      .trim()
      .isLength({ min: 2, max: 150 })
      .withMessage('Title must be between 2 and 150 characters.'),
    body('description')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be 500 characters or less.')
  ],
  validateRequest,
  projectsController.updateProject
);

router.delete(
  '/:id',
  projectIdValidator,
  validateRequest,
  projectsController.deleteProject
);

module.exports = router;
