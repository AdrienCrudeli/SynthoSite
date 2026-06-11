const express = require('express');
const { param } = require('express-validator');
const publicController = require('../controllers/public.controller');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

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
