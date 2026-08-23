import express from "express";
import morgan from "morgan";
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
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


export {app}
