import { Router } from 'express';
import { getBreeds,
  getBreedByIdOrLabel,
  createBreed,
  updateBreed,
  deleteBreed } from '../controllers/breedController.js';
import { protect, admin } from '../middleware/auth.js';

const router = Router();

router
  .route('/')
  .get(getBreeds)
  .post(protect, admin, createBreed);

router
  .route('/:id')
  .put(protect, admin, updateBreed)
  .delete(protect, admin, deleteBreed);

router.get('/:idOrLabel', getBreedByIdOrLabel);

export default router;
