import dotenv from 'dotenv'
dotenv.config({
  path: './.env'
})
import { connectDB } from './DB/db.js'
import {app} from './app.js'

connectDB()
.then(() => {
  app.listen(process.env.PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${process.env.PORT}`);
  });
})
.catch((err) => {
  console.log("MongoDB connection failed", err);
})
