import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ApiError } from '../utils/ApiError.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {      // This is temporary code, it is not necessary to add this.
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const allowedTypes = ['.jpg', '.jpeg', '.png', '.bmp', '.webp'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new ApiError(402, 'Only .jpg, .jpeg, .png, .bmp, and .webp image files are allowed'));
  }
};

const maxSizeBytes = (Number(process.env.MAX_UPLOAD_MB) || 8) * 1024 * 1024;

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSizeBytes },
});

export default upload;
