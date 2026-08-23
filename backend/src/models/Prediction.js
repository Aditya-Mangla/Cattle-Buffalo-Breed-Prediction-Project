import mongoose from 'mongoose';

const predictionSchema = new mongoose.Schema(
  {
    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    }, // optional, supports anonymous use
    imageUrl: { 
      type: String, 
      required: true 
    },
    imagePath: { 
      type: String, 
      required: true 
    },
    predictedBreed: { 
      type: String, 
      required: true 
    },
    confidence: { 
      type: Number, 
      required: true 
    }, // 0-1
    isConfident: { 
      type: Boolean 
    },
    confidenceNote: { 
      type: String 
    },
    topPredictions: [
      {
        breed: String,
        confidence: Number,
      },
    ],
    status: {
      type: String,
      enum: ['success', 'failed'],
      default: 'success',
    },
    errorMessage: { 
      type: String 
    },
  },
  { timestamps: true }
);

export const Prediction = mongoose.model('Prediction', predictionSchema);
