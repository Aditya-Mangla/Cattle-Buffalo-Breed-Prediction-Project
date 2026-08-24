import jwt from 'jsonwebtoken';
import { AsyncHandler } from '../utils/AsyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { User } from '../models/User.js';

// Verifies JWT if present; required routes reject missing/invalid tokens.
const protect = AsyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new ApiError(401,'Not authorized, no token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      throw new ApiError(401, 'Not authorized, user not found');
    }
    next();

  } catch (err) {
    throw new ApiError(401, 'Not authorized, token invalid or expired');
  }
});

// Attaches req.user if a valid token is present, but doesn't block the request
// if there isn't one. Useful for allowing anonymous breed recognition.
const optionalAuth = AsyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (err) {
      // ignore invalid token for optional auth
    }
  }
  next();
});

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    throw new ApiError(403, 'Not authorized as an admin');
  }
};


export { 
  protect, 
  optionalAuth, 
  admin 
};
