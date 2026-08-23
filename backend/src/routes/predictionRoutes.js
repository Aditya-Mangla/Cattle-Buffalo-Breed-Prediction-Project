const express = require('express');
const router = express.Router();
const {
  createPrediction,
  getMyPredictions,
  getPredictionById,
} = require('../../controllers/predictionController');
const { protect, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Anyone can submit an image; if logged in, it's tied to their account
router.post('/', optionalAuth, upload.single('image'), createPrediction);

router.get('/history', protect, getMyPredictions);
router.get('/:id', protect, getPredictionById);

module.exports = router;
