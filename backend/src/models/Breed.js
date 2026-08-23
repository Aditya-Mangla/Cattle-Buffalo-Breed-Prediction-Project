import mongoose from "mongoose";

// Reference/catalogue data about each cattle breed the model can recognize.
// Keeping this in the DB lets you show rich info once the ML service returns
// a breed label, without hardcoding text in the frontend.
const breedSchema = new mongoose.Schema({
    name: 
      { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true 
      },
    // Must match the exact class label your ML model outputs
    labelKey: 
    { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true 
    },
    origin: 
    { 
      type: String, 
      trim: true 
    },
    primaryUse: {
      type: String,
      enum: ["dairy", "beef", "dual-purpose", "draught", "other"],
      default: "other",
    },
    avgMilkYieldLitersPerDay: 
    { 
      type: Number 
    },
    description: 
    { 
      type: String 
    },
    characteristics: [
      { 
        type: String 
      }
    ],
    imageUrl: 
    { 
      type: String
    },
  },{ timestamps: true });


export const Breed = mongoose.model("Breed", breedSchema)
