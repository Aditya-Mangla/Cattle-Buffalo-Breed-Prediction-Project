import mongoose from "mongoose";
import { DB_NAME } from '../constants.js';

export const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(`${"mongodb://127.0.0.1:27017"}/${DB_NAME}`)
    console.log(`\n MongoDB connected || connection host : ${connectionInstance.connection.host}`);
  } catch (error) {
    console.log("MongoDB connection error", error);
    process.exit(1)
  }
}
