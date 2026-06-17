/**
 * uploadService.ts — Handles the image upload pipeline.
 *
 * Flow:
 *  1. requestUploadSession()  → gets pre-signed URLs from backend
 *  2. uploadSingleFile()      → PUT directly to storage with XHR (for progress)
 *  3. uploadAllFiles()        → parallel upload of all files
 *
 * Retries up to MAX_RETRIES times with exponential back-off on network errors.
 */

import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UploadFileSlot {
  file_key: string;
  upload_url: string;
}

export interface UploadSession {
  session_id: string;
  files: UploadFileSlot[];
}

export type UploadProgressCallback = (fileIndex: number, percent: number) => void;

// ─── Config ───────────────────────────────────────────────────────────────────
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 800;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Request upload session ───────────────────────────────────────────────────
/**
 * Calls the backend to create a temporary upload session.
 * Returns pre-signed PUT URLs for each file — no file data is sent here.
 */
export async function requestUploadSession(files: File[]): Promise<UploadSession> {
  return api.post<UploadSession>("/merchant/products/prepare-images", {
    files: files.map((f) => ({
      filename: f.name,
      content_type: f.type || "image/jpeg",
    })),
  });
}

// ─── Upload a single file ─────────────────────────────────────────────────────
/**
 * PUT a single file to a pre-signed URL using XHR (for real upload progress).
 * Retries on network errors with exponential back-off.
 */
export async function uploadSingleFile(
  file: File,
  uploadUrl: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "image/jpeg");

        if (onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              onProgress(Math.round((e.loaded / e.total) * 100));
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            onProgress?.(100);
            resolve();
          } else {
            reject(new Error(`Upload failed with HTTP ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.onabort = () => reject(new Error("Upload aborted"));
        xhr.send(file);
      });
      return; // success
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      await sleep(BASE_RETRY_DELAY_MS * attempt);
    }
  }
}

// ─── Upload all files in parallel ────────────────────────────────────────────
/**
 * Uploads all files in parallel to their respective pre-signed URLs.
 * Calls onProgress(fileIndex, percent) as each file progresses.
 */
export async function uploadAllFiles(
  files: File[],
  slots: UploadFileSlot[],
  onProgress?: UploadProgressCallback
): Promise<void> {
  await Promise.all(
    files.map((file, i) =>
      uploadSingleFile(file, slots[i].upload_url, (pct) =>
        onProgress?.(i, pct)
      )
    )
  );
}

// ─── Cleanup helper ───────────────────────────────────────────────────────────
/**
 * Revoke object URLs created for image previews to avoid memory leaks.
 */
export function revokePreviewUrls(urls: string[]): void {
  urls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  });
}
