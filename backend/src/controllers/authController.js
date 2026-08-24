import { AsyncHandler } from '../utils/AsyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {User} from '../models/User.js';
import generateToken from '../utils/generateToken.js';

// @desc  Register a new user
// @route POST /api/auth/register
const registerUser = AsyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email, and password are all required');
  }

  const userExists = await User.findOne({ email: email.toLowerCase() });
  if (userExists) {
    res.status(400);
    throw new Error('A user with that email already exists');
  }

  const user = await User.create({ name, email, password });

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id),
  });
});

// @desc  Login and receive a JWT
// @route POST /api/auth/login
const loginUser = AsyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  const token = await generateToken(user._id)

  if (user && (await user.matchPassword(password))) {
    res
    .cookie("token", token)
    .json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } else {
    throw new ApiError(401, 'Invalid email or password');
  }
});

// @desc  Get logged-in user's profile
// @route GET /api/auth/me
const getProfile = AsyncHandler(async (req, res) => {
  return res
  .status(200)
  .json(
    new ApiResponse(200, req.user, "Success")
  )
});

export { 
  registerUser, 
  loginUser, 
  getProfile 
};
