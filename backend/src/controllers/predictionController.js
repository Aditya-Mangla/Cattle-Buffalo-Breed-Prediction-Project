import { AsyncHandler } from '../utils/AsyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import fs from 'fs';
import { Prediction } from '../models/Prediction.js';
import { Breed } from '../models/Breed.js';
import { classifyImage } from '../services/mlService.js';

// @desc  Upload a cattle image and get a breed prediction
// @route POST /api/predictions
// Auth optional: logged-in users get predictions tied to their account,
// anonymous users still get a result but nothing is linked to a profile.
const createPrediction = AsyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No image file uploaded. Attach it under field name "image".');
  }

  const imagePath = req.file.path;
  const imageUrl = `http://${req.get('host')}/uploads/${req.file.filename}`;

  try {
    const result = await classifyImage(imagePath);
    const { predictions, isConfident, note } = result;
    const [top, ...rest] = predictions;

    const record = await Prediction.create({
      user: req.user ? req.user._id : undefined,
      imageUrl,
      imagePath,
      predictedBreed: top.breed,
      confidence: top.confidence,
      topPredictions: predictions,
      isConfident,
      confidenceNote: note || undefined,
      status: 'success',
    });

    // Enrich with breed metadata if we have it in the catalogue
    const breedInfo = await Breed.findOne({
      $or: [{ name: top.breed }, { labelKey: top.breed }],
    });

    const predictionRecord = {predictionId: record._id,
      imageUrl,
      predictedBreed: top.breed,
      confidence: top.confidence,
      isConfident,
      confidenceNote: note,
      alternatives: rest,
      breedInfo: breedInfo || null}

    return res
    .status(201)
    .json(
      new ApiResponse(200, predictionRecord, "Success")
    );
  } catch (err) {
    // Log the failed attempt, then clean up the uploaded file and re-throw
    await Prediction.create({
      user: req.user ? req.user._id : undefined,
      imageUrl,
      imagePath,
      predictedBreed: 'unknown',
      confidence: 0,
      status: 'failed',
      errorMessage: err.message,
    });
    fs.unlink(imagePath, () => {});

    throw new ApiError(502, `Breed recognition failed: ${err.message}`);
  }
});

// @desc  Get prediction history for the logged-in user
// @route GET /api/predictions/history
const getMyPredictions = AsyncHandler(async (req, res) => {
  const predictions = await Prediction.find({ user: req.user._id }).sort({
    createdAt: -1,
  });

  res.json({
    predictions
});
});

// @desc  Get a single prediction by id
// @route GET /api/predictions/:id
const getPredictionById = AsyncHandler(async (req, res) => {
  const prediction = await Prediction.findById(req.params.id);
  if (!prediction) {
    throw new ApiError(404, 'Prediction not found');
  }

  return res
  .status(200)
  .json(
    new ApiResponse(200, prediction, "Success")
  );
});


export { 
  createPrediction, 
  getMyPredictions, 
  getPredictionById 
};
