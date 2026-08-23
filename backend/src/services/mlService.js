import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

/**
 * This Node backend does not itself run the cattle-breed image-recognition
 * model. Training and serving a CNN (e.g. a fine-tuned ResNet/EfficientNet)
 * is normally done in Python. The pattern used here is:
 *
 *   Node/Express (this file)  --image-->  Python model-serving endpoint
 *                             <--JSON---   (Flask/FastAPI + TensorFlow/PyTorch)
 *
 * Set ML_SERVICE_URL in .env to point at the /predict endpoint. The Python
 * service accepts a multipart field named "file" and returns { breed,
 * confidence, is_confident, top_k, note }.
 *
 * If ML_SERVICE_URL is unreachable and NODE_ENV=development, a mock response
 * is returned instead so you can build/test the rest of the app before the
 * model-serving service exists.
 */
const classifyImage = async (filePath) => {
  const url = process.env.ML_SERVICE_URL;
  const timeout = Number(process.env.ML_SERVICE_TIMEOUT_MS) || 15000;

  try {
    if (!url) {
      throw new Error('ML_SERVICE_URL is not configured');
    }

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    const response = await axios.post(url, form, {
      headers: form.getHeaders(),
      timeout,
    });

    const predictions = response.data?.top_k;
    if (!Array.isArray(predictions) || predictions.length === 0) {
      throw new Error('ML service returned no top_k predictions');
    }

    const normalizedPredictions = predictions.map((prediction) => {
      const confidence = Number(prediction.confidence);
      if (!prediction.breed || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        throw new Error('ML service returned an invalid prediction');
      }
      return { breed: prediction.breed, confidence };
    });

    normalizedPredictions.sort((a, b) => b.confidence - a.confidence);
    return {
      predictions: normalizedPredictions,
      isConfident: Boolean(response.data.is_confident),
      note: response.data.note || null,
    };
  } catch (err) {
    const isNetworkFailure = !err.response &&
      ['ECONNABORTED', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(err.code);
    if (process.env.NODE_ENV === 'development' && isNetworkFailure) {
      console.warn(
        `[mlService] Could not reach ML_SERVICE_URL (${url}). Returning mock prediction. Reason: ${err.message}`
      );
      return {
        predictions: getMockPredictions(),
        isConfident: true,
        note: null,
      };
    }
    const serviceMessage = err.response?.data?.error || err.message;
    throw new Error(`Image classification failed: ${serviceMessage}`);
  }
};

const getMockPredictions = () => {
  const mockBreeds = ['Gir', 'Sahiwal', 'Red Sindhi', 'Holstein Friesian', 'Jersey'];
  const shuffled = [...mockBreeds].sort(() => Math.random() - 0.5);
  const top = 0.6 + Math.random() * 0.35;
  const remainder = 1 - top;
  return [
    { breed: shuffled[0], confidence: Number(top.toFixed(3)) },
    { breed: shuffled[1], confidence: Number((remainder * 0.6).toFixed(3)) },
    { breed: shuffled[2], confidence: Number((remainder * 0.4).toFixed(3)) },
  ];
};

export { classifyImage };
