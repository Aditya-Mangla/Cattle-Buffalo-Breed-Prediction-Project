import express from 'express'
import {Router} from 'express';
import {getBreeds,
  getBreedByIdOrLabel,
  createBreed,
  updateBreed,
  deleteBreed} from '../controllers/breedController.js'
const { protect, admin } = require('../middleware/auth');

router
  .route('/')
  .get(getBreeds)
  .post(protect, admin, createBreed);

router
  .route('/:id')
  .put(protect, admin, updateBreed)
  .delete(protect, admin, deleteBreed);

router.get('/:idOrLabel', getBreedByIdOrLabel);

module.exports = router;
