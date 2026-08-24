import express from "express";
import morgan from "morgan";
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN === '*' ? true : process.env.CORS_ORIGIN,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// '/health' route to check the status of api as OK
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
});


// Importing routes
import authRoutes from './routes/authRoutes.js'
import breedRoutes from './routes/breedRoutes.js'
import predictionRoutes from './routes/predictionRoutes.js'

// route declaration
app.use('/api/auth', authRoutes)
app.use('/api/breeds', breedRoutes);
app.use('/api/predictions', predictionRoutes)

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || (err.name === 'MulterError' ? 400 : 500);
  const message = err.message || 'Internal server error';

  if (res.headersSent) {
    return next(err);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    message,
  });
});

app.use(express.static(path.join(__dirname, '../../frontend')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: 'Route not found',
  });
});


export {app}
