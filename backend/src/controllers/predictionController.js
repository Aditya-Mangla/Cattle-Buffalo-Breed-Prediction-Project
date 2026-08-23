const asyncHandler = require('express-async-handler');
const path = require('path');
const fs = require('fs');
const Prediction = require('../../models/Prediction');
const Breed = require('../../models/Breed');
const { classifyImage } = require('../../services/mlService');

// @desc  Upload a cattle image and get a breed prediction
// @route POST /api/predictions
// Auth optional: logged-in users get predictions tied to their account,
// anonymous users still get a result but nothing is linked to a profile.
const createPrediction = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No image file uploaded. Attach it under field name "image".');
  }

  const imagePath = req.file.path;
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

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

    res.status(201).json({
      predictionId: record._id,
      imageUrl,
      predictedBreed: top.breed,
      confidence: top.confidence,
      isConfident,
      confidenceNote: note,
      alternatives: rest,
      breedInfo: breedInfo || null,
    });
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
    res.status(502);
    throw new Error(`Breed recognition failed: ${err.message}`);
  }
});

// @desc  Get prediction history for the logged-in user
// @route GET /api/predictions/history
const getMyPredictions = asyncHandler(async (req, res) => {
  const predictions = await Prediction.find({ user: req.user._id }).sort({
    createdAt: -1,
  });
  res.json(predictions);
});

// @desc  Get a single prediction by id
// @route GET /api/predictions/:id
const getPredictionById = asyncHandler(async (req, res) => {
  const prediction = await Prediction.findById(req.params.id);
  if (!prediction) {
    res.status(404);
    throw new Error('Prediction not found');
  }
  res.json(prediction);
});

module.exports = { createPrediction, getMyPredictions, getPredictionById };
