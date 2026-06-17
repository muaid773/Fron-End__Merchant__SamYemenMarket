/**
 * productCreationService.ts — Service layer for the product creation pipeline.
 *
 * Separates API calls and business logic from UI components and hooks.
 * All functions are pure async — no React state involved.
 */

import { api } from "@/lib/api";
import {
  requestUploadSession,
  uploadAllFiles,
  UploadSession,
  UploadProgressCallback,
} from "@/lib/uploadService";
import type { Currency } from "@/lib/currency";

// ─── Form Data Model ──────────────────────────────────────────────────────────
export interface ProductFormData {
  name: string;
  description: string;
  price: string;
  currency: Currency;
  stock: string;
  weight: string;
  storage_address_id: string;
  category_id: string;
  is_active: boolean;
}

export interface CreatedProductResult {
  success: boolean;
  product_id: number;
  images_count: number;
}

// ─── Validation ───────────────────────────────────────────────────────────────
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateProductForm(
  form: ProductFormData,
  files: File[]
): ValidationResult {
  const errors: string[] = [];

  if (!form.name.trim()) errors.push("اسم المنتج مطلوب");
  if (form.name.trim().length > 100)
    errors.push("اسم المنتج يجب أن لا يتجاوز 100 حرف");

  const price = Number(form.price);
  if (!form.price || isNaN(price) || price <= 0)
    errors.push("السعر يجب أن يكون رقماً أكبر من صفر");

  const stock = Number(form.stock);
  if (form.stock === "" || isNaN(stock) || stock < 0 || !Number.isInteger(stock))
    errors.push("الكمية يجب أن تكون رقماً صحيحاً غير سالب");

  const weight = Number(form.weight);
  if (!form.weight || isNaN(weight) || weight <= 0)
    errors.push("الوزن يجب أن يكون أكبر من صفر");

  if (!form.storage_address_id)
    errors.push("عنوان التخزين مطلوب");

  if (files.length === 0)
    errors.push("يجب إضافة صورة واحدة على الأقل");

  if (files.length > 5)
    errors.push("الحد الأقصى للصور هو 5");

  return { valid: errors.length === 0, errors };
}

// ─── Pipeline steps ───────────────────────────────────────────────────────────

/** Step A: Create upload session — returns pre-signed URLs */
export async function prepareProductUploadSession(
  files: File[]
): Promise<UploadSession> {
  return requestUploadSession(files);
}

/** Step B: Upload images directly to storage */
export async function uploadProductImages(
  files: File[],
  session: UploadSession,
  onProgress?: UploadProgressCallback
): Promise<void> {
  return uploadAllFiles(files, session.files, onProgress);
}

/** Step C: Create the product record with committed image keys */
export async function submitCreateProduct(
  form: ProductFormData,
  session: UploadSession
): Promise<CreatedProductResult> {
  const fd = new FormData();
  fd.append("name", form.name.trim());
  if (form.description.trim()) fd.append("description", form.description.trim());
  fd.append("price", form.price);
  fd.append("currency", form.currency);
  fd.append("stock", form.stock);
  fd.append("weight", form.weight);
  fd.append("storage_address_id", form.storage_address_id);
  fd.append("is_active", String(form.is_active));
  if (form.category_id) fd.append("category_id", form.category_id);
  fd.append("upload_session_id", session.session_id);
  fd.append(
    "image_keys",
    JSON.stringify(session.files.map((f) => f.file_key))
  );
  return api.postForm<CreatedProductResult>("/merchant/products", fd);
}