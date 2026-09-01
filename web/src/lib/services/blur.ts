/**
 * Blur Detection Service
 *
 * Uses the Laplacian operator (second derivative of image intensity) to
 * estimate image sharpness. Sharp images have high variance; blurry images
 * have low variance.
 *
 * Implementation: draws image to an off-screen canvas, reads raw pixel data,
 * applies a 3×3 Laplacian kernel, and computes the variance of the result.
 *
 * NO external libraries. NO AI enhancement. NO server calls.
 * Pure client-side Canvas API.
 */

import { BLUR_THRESHOLD } from '@/lib/config';

export interface BlurResult {
  blurScore: number;
  isBlurry: boolean;
  threshold: number;
}

/**
 * Draws a File (image) to a hidden canvas and computes the Laplacian variance.
 */
export async function computeBlurScore(file: File): Promise<BlurResult> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        // Downscale to max 256×256 for performance
        const MAX = 256;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);

        const { data } = ctx.getImageData(0, 0, w, h);

        // Convert to greyscale luminance
        const grey = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          grey[i] = 0.299 * r + 0.587 * g + 0.114 * b;
        }

        // Apply 3×3 Laplacian kernel:
        //  0  1  0
        //  1 -4  1
        //  0  1  0
        const laplacian = new Float32Array((w - 2) * (h - 2));
        let idx = 0;
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const val =
              grey[y * w + x] * (-4) +
              grey[(y - 1) * w + x] +
              grey[(y + 1) * w + x] +
              grey[y * w + (x - 1)] +
              grey[y * w + (x + 1)];
            laplacian[idx++] = val;
          }
        }

        // Compute variance
        const n = laplacian.length;
        let mean = 0;
        for (let i = 0; i < n; i++) mean += laplacian[i];
        mean /= n;

        let variance = 0;
        for (let i = 0; i < n; i++) {
          const diff = laplacian[i] - mean;
          variance += diff * diff;
        }
        variance /= n;

        URL.revokeObjectURL(url);

        const blurScore = Math.round(variance * 10) / 10;
        resolve({
          blurScore,
          isBlurry: blurScore < BLUR_THRESHOLD,
          threshold: BLUR_THRESHOLD,
        });
      } catch (err) {
        console.error('Blur detection failed, treating as clear:', err);
        URL.revokeObjectURL(url);
        resolve({ blurScore: 999, isBlurry: false, threshold: BLUR_THRESHOLD });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ blurScore: 999, isBlurry: false, threshold: BLUR_THRESHOLD });
    };

    img.src = url;
  });
}
