"use client";
/**
 * useProductCreationPipeline.ts — State machine hook for the product creation
 * pipeline.
 *
 * State machine diagram:
 *
 *   idle
 *    │  run()
 *    ▼
 *   validating
 *    │  ok          │  fail
 *    ▼              ▼
 *   preparing_session ──► error
 *    │  ok
 *    ▼
 *   uploading_images ──► error  (retryable via retryUpload())
 *    │  ok
 *    ▼
 *   creating_product ──► error
 *    │  ok
 *    ▼
 *   done
 *
 *  reset() → idle (from any state)
 */

import { useReducer, useCallback, useRef, useEffect } from "react";
import {
  validateProductForm,
  prepareProductUploadSession,
  uploadProductImages,
  submitCreateProduct,
  type ProductFormData,
} from "@/lib/productCreationService";
import type { UploadSession } from "@/lib/uploadService";

// ─── Types ────────────────────────────────────────────────────────────────────
export type PipelineStep =
  | "idle"
  | "validating"
  | "preparing_session"
  | "uploading_images"
  | "creating_product"
  | "done"
  | "error";

export const STEP_LABELS: Record<PipelineStep, string> = {
  idle: "جاهز",
  validating: "التحقق من البيانات",
  preparing_session: "تحضير جلسة الرفع",
  uploading_images: "رفع الصور",
  creating_product: "إنشاء المنتج",
  done: "تم بنجاح",
  error: "خطأ",
};

// Overall progress % for each step (for the progress bar)
const STEP_PROGRESS: Record<PipelineStep, number> = {
  idle: 0,
  validating: 10,
  preparing_session: 25,
  uploading_images: 60,
  creating_product: 85,
  done: 100,
  error: 0,
};

export interface FileUploadProgress {
  [fileIndex: number]: number; // 0–100
}

export interface PipelineState {
  step: PipelineStep;
  errors: string[];
  overallProgress: number;
  fileProgress: FileUploadProgress;
  uploadSession: UploadSession | null;
  productId: number | null;
  files: File[];
  previewUrls: string[];
}

type PipelineAction =
  | { type: "SET_STEP"; step: PipelineStep }
  | { type: "SET_ERROR"; message: string }
  | { type: "SET_SESSION"; session: UploadSession }
  | { type: "SET_FILE_PROGRESS"; index: number; pct: number }
  | { type: "SET_PRODUCT_ID"; id: number }
  | { type: "SET_FILES"; files: File[]; previewUrls: string[] }
  | { type: "REMOVE_FILE"; index: number }
  | { type: "RESET" };

const INITIAL_STATE: PipelineState = {
  step: "idle",
  errors: [],
  overallProgress: 0,
  fileProgress: {},
  uploadSession: null,
  productId: null,
  files: [],
  previewUrls: [],
};

function reducer(state: PipelineState, action: PipelineAction): PipelineState {
  switch (action.type) {
    case "SET_STEP":
      return {
        ...state,
        step: action.step,
        overallProgress: STEP_PROGRESS[action.step],
        errors: action.step !== "error" ? [] : state.errors,
      };

    case "SET_ERROR":
      return { ...state, step: "error", errors: [action.message] };

    case "SET_SESSION":
      return { ...state, uploadSession: action.session };

    case "SET_FILE_PROGRESS": {
      const fp = { ...state.fileProgress, [action.index]: action.pct };
      const values = Object.values(fp);
      const avg = values.reduce((a, b) => a + b, 0) / Math.max(state.files.length, 1);
      // map 0–100 of upload to 25–85 of overall
      const overall = Math.round(25 + avg * 0.6);
      return { ...state, fileProgress: fp, overallProgress: overall };
    }

    case "SET_PRODUCT_ID":
      return { ...state, productId: action.id };

    case "SET_FILES":
      return {
        ...state,
        files: action.files,
        previewUrls: action.previewUrls,
        fileProgress: {},
        // Reset errors if user fixed files
        errors: state.errors.filter(
          (e) => !e.includes("صورة") && !e.includes("صور")
        ),
      };

    case "REMOVE_FILE": {
      const files = state.files.filter((_, i) => i !== action.index);
      const previewUrls = state.previewUrls.filter((_, i) => i !== action.index);
      // Revoke the removed URL
      try { URL.revokeObjectURL(state.previewUrls[action.index]); } catch { /* ok */ }
      return { ...state, files, previewUrls, fileProgress: {} };
    }

    case "RESET":
      // Revoke all preview URLs on reset
      state.previewUrls.forEach((url) => {
        try { URL.revokeObjectURL(url); } catch { /* ok */ }
      });
      return INITIAL_STATE;

    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useProductCreationPipeline() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Revoke any remaining preview URLs
      state.previewUrls.forEach((url) => {
        try { URL.revokeObjectURL(url); } catch { /* ok */ }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── File management ──────────────────────────────────────────────────────────
  const addFiles = useCallback((incoming: FileList | File[] | null) => {
    if (!incoming) return;
    const combined = [...state.files, ...Array.from(incoming)].slice(0, 5);
    const previews = combined.map((f, i) =>
      i < state.files.length ? state.previewUrls[i] : URL.createObjectURL(f)
    );
    dispatch({ type: "SET_FILES", files: combined, previewUrls: previews });
  }, [state.files, state.previewUrls]);

  const removeFile = useCallback((index: number) => {
    dispatch({ type: "REMOVE_FILE", index });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  // ── Core pipeline runner ────────────────────────────────────────────────────
  const _runPipeline = useCallback(async (
    form: ProductFormData,
    startFromSession?: UploadSession
  ) => {
    if (!mountedRef.current) return;

    // ── Step: validating ───────────────────────────────────────────────────
    dispatch({ type: "SET_STEP", step: "validating" });
    await new Promise((r) => setTimeout(r, 80)); // brief pause for visual feedback

    const { valid, errors } = validateProductForm(form, state.files);
    if (!valid) {
      dispatch({ type: "SET_ERROR", message: errors[0] });
      return;
    }
    if (!mountedRef.current) return;

    // ── Step: preparing_session ────────────────────────────────────────────
    let session = startFromSession ?? null;
    if (!session) {
      dispatch({ type: "SET_STEP", step: "preparing_session" });
      try {
        session = await prepareProductUploadSession(state.files);
        if (!mountedRef.current) return;
        dispatch({ type: "SET_SESSION", session });
      } catch (err) {
        if (mountedRef.current)
          dispatch({ type: "SET_ERROR", message: err instanceof Error ? err.message : "فشل إنشاء جلسة الرفع — تحقق من اتصالك" });
        return;
      }
    }

    // ── Step: uploading_images ────────────────────────────────────────────
    dispatch({ type: "SET_STEP", step: "uploading_images" });
    try {
      await uploadProductImages(state.files, session, (i, pct) => {
        if (mountedRef.current)
          dispatch({ type: "SET_FILE_PROGRESS", index: i, pct });
      });
      if (!mountedRef.current) return;
    } catch (err) {
      if (mountedRef.current)
        dispatch({ type: "SET_ERROR", message: err instanceof Error ? err.message : "فشل رفع الصور — يمكن إعادة المحاولة" });
      return;
    }

    // ── Step: creating_product ────────────────────────────────────────────
    dispatch({ type: "SET_STEP", step: "creating_product" });
    try {
      const result = await submitCreateProduct(form, session);
      if (!mountedRef.current) return;
      dispatch({ type: "SET_PRODUCT_ID", id: result.product_id });
      dispatch({ type: "SET_STEP", step: "done" });
    } catch (err) {
      if (mountedRef.current)
        dispatch({ type: "SET_ERROR", message: err instanceof Error ? err.message : "فشل إنشاء المنتج" });
    }
  }, [state.files]);

  // ── Public API ───────────────────────────────────────────────────────────────
  const run = useCallback(
    (form: ProductFormData) => _runPipeline(form),
    [_runPipeline]
  );

  /** Retry only the upload step (reuses existing session) */
  const retryUpload = useCallback(
    (form: ProductFormData) => {
      if (state.uploadSession) {
        _runPipeline(form, state.uploadSession);
      } else {
        _runPipeline(form);
      }
    },
    [_runPipeline, state.uploadSession]
  );

  const isRunning = !["idle", "done", "error"].includes(state.step);
  const canRetryUpload =
    state.step === "error" && state.uploadSession !== null;

  return {
    state,
    addFiles,
    removeFile,
    reset,
    run,
    retryUpload,
    isRunning,
    canRetryUpload,
  };
}
