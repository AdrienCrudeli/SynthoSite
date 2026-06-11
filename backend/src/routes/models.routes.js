const express = require('express');
const modelsController = require('../controllers/models.controller');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/models', verifyToken, modelsController.listModels);
router.get('/usage', verifyToken, modelsController.getUsage);

module.exports = router;
