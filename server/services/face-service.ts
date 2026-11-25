import axios, { AxiosError } from 'axios';
import { getDb } from '../db.ts';

const PYTHON_URL = process.env.PYTHON_SERVICE_URL || 'http://face-api:8000';
const MAX_BODY_BYTES = 50 * 1024 * 1024;

export interface FaceRecognitionMatch {
  matched: boolean;
  user_id: string | null;
  distance: number | null;
  confidence: number | null;
}

export class FaceServiceError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'FaceServiceError';
    this.status = status;
  }
}

const toServiceError = (error: unknown, fallback: string): FaceServiceError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: string }>;
    const status = axiosError.response?.status ?? 502;
    const detail = axiosError.response?.data?.detail;
    return new FaceServiceError(detail || fallback, status);
  }
  return new FaceServiceError(error instanceof Error ? error.message : fallback, 502);
};

const imageFormData = (
  buffer: Buffer,
  filename: string,
  contentType: string,
  userId?: string
): FormData => {
  const formData = new FormData();
  if (userId) formData.append('user_id', userId);
  formData.append('file', buffer, { filename, contentType });
  return formData;
};

/** Register face images for a user. Forwards each image to Python /register,
 * which extracts SFace embeddings and stores them in face_references.json.
 * Images are never saved to disk here. */
export const registerFace = async (
  userId: string,
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<{ status: string; user_id: string; total_samples: number }> => {
  const formData = imageFormData(buffer, filename, contentType, userId);
  try {
    const response = await axios.post(`${PYTHON_URL}/register`, formData, {
      headers: formData.getHeaders(),
      maxContentLength: MAX_BODY_BYTES,
      maxBodyLength: MAX_BODY_BYTES,
    });
    return response.data;
  } catch (error) {
    throw toServiceError(error, 'Face registration failed.');
  }
};

/** Compare one live frame against stored templates for a user (1:N).
 * Forwards the frame to Python /recognize which runs SFace against
 * stored embeddings in face_references.json. */
export const recognizeFace = async (
  buffer: Buffer,
  filename: string,
  contentType: string,
  userId?: string
): Promise<FaceRecognitionMatch> => {
  const formData = imageFormData(buffer, filename, contentType, userId);
  try {
    const response = await axios.post(`${PYTHON_URL}/recognize`, formData, {
      headers: formData.getHeaders(),
      maxContentLength: MAX_BODY_BYTES,
      maxBodyLength: MAX_BODY_BYTES,
    });
    const data = response.data as {
      matched?: boolean;
      user_id?: string | null;
      distance?: number | null;
      confidence?: number | null;
    };
    return {
      matched: data.matched === true,
      user_id: data.user_id ?? null,
      distance: typeof data.distance === 'number' ? data.distance : null,
      confidence: typeof data.confidence === 'number' ? data.confidence : null,
    };
  } catch (error) {
    throw toServiceError(error, 'Face recognition failed.');
  }
};

/** Number of stored face templates for a user; 0 when the user is unknown. */
export const getFaceSampleCount = async (userId: string): Promise<number> => {
  try {
    const response = await axios.get(`${PYTHON_URL}/register/${encodeURIComponent(userId)}`);
    const data = response.data as { total_samples?: number };
    return typeof data.total_samples === 'number' ? data.total_samples : 0;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return 0;
    }
    throw toServiceError(error, 'Failed to read face registration state.');
  }
};

/** Remove every stored template for a user. */
export const deleteFace = async (userId: string): Promise<void> => {
  try {
    await axios.delete(`${PYTHON_URL}/register/${encodeURIComponent(userId)}`);
  } catch (error) {
    throw toServiceError(error, 'Failed to delete face data.');
  }
};

/** Cosine similarity between two face descriptors (-1..1, higher = more similar). */
export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
};
