const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

router.post(
  '/signup',
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters.')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Username can only contain letters, numbers, underscores and hyphens.'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('A valid email is required.')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters.')
  ],
  validateRequest,
  authController.signup
);

router.post(
  '/login',
  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('A valid email is required.')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required.')
  ],
  validateRequest,
  authController.login
);

module.exports = router;
