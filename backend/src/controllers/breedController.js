import {AsyncHandler} from '../utils/AsyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import {ApiResponse} from '../utils/ApiResponse.js'
import {Breed} from '../models/Breed.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const classNamesPath = path.resolve(__dirname, '../../../ML/class_names.json')
const breedPhotosPath = path.resolve(__dirname, '../../breeds_photo.txt')

const getBreedPhotos = () => {
  if (!fs.existsSync(breedPhotosPath)) {
    return {}
  }

  return JSON.parse(fs.readFileSync(breedPhotosPath, 'utf8'))
}

const getModelBreeds = () => {
  if (!fs.existsSync(classNamesPath)) {
    return []
  }

  const classNames = JSON.parse(fs.readFileSync(classNamesPath, 'utf8'))
  const breedPhotos = getBreedPhotos()
  return classNames.map((name) => ({
    name,
    labelKey: name,
    primaryUse: 'other',
    characteristics: [],
    imageUrl: breedPhotos[name] || null,
  }))
}

// @desc  Get all breeds (with optional search)
// @route GET /api/breeds?search=&primaryUse=
const getBreeds = AsyncHandler(async (req, res) => {
  const { search, primaryUse } = req.query;
  const filter = {};

  if (search) {
    filter.name = { $regex: search, $options: 'i' };
  }
  if (primaryUse) {
    filter.primaryUse = primaryUse;
  }

  const breeds = await Breed.find(filter).sort({ name: 1 });
  const breedList = (breeds.length ? breeds : getModelBreeds())
    .filter((breed) => !search || breed.name.toLowerCase().includes(search.toLowerCase()))
    .map((breed) => ({
      ...breed.toObject?.() || breed,
      imageUrl: breed.imageUrl || getBreedPhotos()[breed.name || breed.labelKey] || null,
    }))

  return res
  .status(200)
  .json(new ApiResponse(200, breedList, "Fetched all breeds successfully"));
});

// @desc  Get a single breed by id or labelKey
// @route GET /api/breeds/:idOrLabel
const getBreedByIdOrLabel = AsyncHandler(async (req, res) => {
  const { idOrLabel } = req.params;
  const isObjectId = idOrLabel.match(/^[0-9a-fA-F]{24}$/);

  const breed = isObjectId
    ? await Breed.findById(idOrLabel)
    : await Breed.findOne({ labelKey: idOrLabel });

  if (!breed) {
    res.status(404);
    throw new Error('Breed not found');
  }
  res.json(breed);
});

// @desc  Create a breed entry (admin)
// @route POST /api/breeds
const createBreed = AsyncHandler(async (req, res) => {
  const breed = await Breed.create(req.body);
  res.status(201).json(breed);
});

// @desc  Update a breed entry (admin)
// @route PUT /api/breeds/:id
const updateBreed = AsyncHandler(async (req, res) => {
  const breed = await Breed.findById(req.params.id);
  if (!breed) {
    throw new ApiError(404, 'Breed not found');
  }
  Object.assign(breed, req.body);
  const updated = await breed.save();
  res.json(updated);
});

// @desc  Delete a breed entry (admin)
// @route DELETE /api/breeds/:id
const deleteBreed = AsyncHandler(async (req, res) => {
  const breed = await Breed.findById(req.params.id);
  if (!breed) {
    throw new ApiError(404, 'Breed not found');
  }
  await breed.deleteOne();
  res.json({ message: 'Breed deleted' });
});


export {
  getBreeds,
  getBreedByIdOrLabel,
  createBreed,
  updateBreed,
  deleteBreed,
};
