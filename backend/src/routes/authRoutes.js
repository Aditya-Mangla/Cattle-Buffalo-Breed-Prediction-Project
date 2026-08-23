import {Router} from 'express';
import { 
    registerUser, 
    loginUser, 
    getProfile } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getProfile);

export default router;
