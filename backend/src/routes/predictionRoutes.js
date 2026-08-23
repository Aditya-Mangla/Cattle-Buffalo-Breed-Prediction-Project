import express from 'express';
import {
  createPrediction,
  getMyPredictions,
  getPredictionById,
} from '../controllers/predictionController.js';
import { protect, optionalAuth } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Anyone can submit an image; if logged in, it's tied to their account
router.post('/', optionalAuth, upload.single('image'), createPrediction);

router.get('/history', protect, getMyPredictions);
router.get('/:id', protect, getPredictionById);

export default router;
