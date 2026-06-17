"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api";

type Category = {
  id: number;
  name: string;
};

type StorageAddress = {
  id: number;
  latitude: number;
  longitude: number;
  note: string | null;
};

type Product = {
  id: number;
  category?: { id: number; name: string } | null;
  category_id?: number | null;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  stock: number;
  sku: string;
  weight: string;
  is_active: boolean;
  created_at: string | null;
  images_urls: string[];
  storage_address_id?: number | null;
};

type ProductListResponse = Product[] | { items: Product[]; total?: number };

type ProductDetailsResponse = Product & {
  category?: { id: number; name: string } | null;
  merchant_id?: string;
  is_approved?: boolean;
  deleted_at?: string | null;
  updated_at?: string | null;
  storage_address_id?: number | null;
};

type ProductFormState = {
  name: string;
  description: string;
  price: string;
  currency: string;
  stock: string;
  sku: string;
  weight: string;
  storage_address_id: string;
  is_active: boolean;
  category_id: string;
};

type ActionResponse = {
  ok?: boolean;
  description?: string;
  message?: string;
};

type FeedbackState = {
  type: "success" | "error";
  message: string;
} | null;

function formatDate(dateString: string | null) {
  if (!dateString) return "-";
  try {
    return new Intl.DateTimeFormat("ar", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

function normalizeListResponse(data: ProductListResponse): Product[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.items)) return data.items;
  return [];
}

function buildProductQuery(params: {
  limit?: number;
  search?: string;
  min_price?: string;
  max_price?: string;
  sort?: string;
  cursor?: string | null;
}) {
  const qs = new URLSearchParams();

  if (params.limit) qs.set("limit", String(params.limit));
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.min_price?.trim()) qs.set("min_price", params.min_price.trim());
  if (params.max_price?.trim()) qs.set("max_price", params.max_price.trim());
  if (params.sort?.trim()) qs.set("sort", params.sort.trim());
  if (params.cursor) qs.set("cursor", params.cursor);

  return qs.toString();
}

function productToForm(product: ProductDetailsResponse): ProductFormState {
  return {
    name: product.name ?? "",
    description: product.description ?? "",
    price: product.price ?? "",
    currency: product.currency ?? "",
    stock: product.stock !== undefined && product.stock !== null ? String(product.stock) : "",
    sku: product.sku ?? "",
    weight: product.weight ?? "",
    storage_address_id:
      product.storage_address_id !== undefined && product.storage_address_id !== null
        ? String(product.storage_address_id)
        : "",
    is_active: Boolean(product.is_active),
    category_id: String(product.category_id ?? product.category?.id ?? ""),
  };
}

function buildUpdatePayload(form: ProductFormState) {
  const payload: Record<string, unknown> = {};

  if (form.name.trim()) payload.name = form.name.trim();
  if (form.description.trim()) payload.description = form.description.trim();
  if (form.price.trim()) payload.price = form.price.trim();
  if (form.currency.trim()) payload.currency = form.currency.trim();
  if (form.stock.trim() !== "") payload.stock = Number(form.stock);
  if (form.sku.trim()) payload.sku = form.sku.trim();
  if (form.weight.trim()) payload.weight = form.weight.trim();
  if (form.storage_address_id.trim() !== "") {
    payload.storage_address_id = Number(form.storage_address_id);
  }
  payload.is_active = form.is_active;
  if (form.category_id.trim() !== "") payload.category_id = Number(form.category_id);

  return payload;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message || fallback;
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string" && error.trim()) return error;

  if (error && typeof error === "object") {
    const maybe = error as Record<string, unknown>;
    const candidate = maybe.description ?? maybe.detail ?? maybe.message;
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }

  return fallback;
}

function getResponseMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const maybe = data as Record<string, unknown>;
    const candidate = maybe.description ?? maybe.message;
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return fallback;
}

function formatAddress(address: StorageAddress) {
  const note = address.note?.trim();
  const coords = `${address.latitude}, ${address.longitude}`;
  return note ? `${note} — ${coords}` : `#${address.id} — ${coords}`;
}

function Thumbnail({ src, alt }: { src?: string; alt: string }) {
  return src ? (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
    />
  ) : (
    <div className="flex h-full items-center justify-center bg-slate-100">
      <svg
        className="h-7 w-7 text-slate-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-semibold text-slate-600">{children}</label>;
}

function ProductRow({
  product,
  onOpen,
  onEdit,
  onDelete,
}: {
  product: Product;
  onOpen: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}) {
  const image = product.images_urls?.[0];

  return (
    <tr className="border-b border-slate-50 transition-colors hover:bg-slate-50/70">
      <td className="cursor-pointer px-4 py-3" onClick={() => onOpen(product)}>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
            <Thumbnail src={image} alt={product.name} />
          </div>

          <div className="min-w-0">
            <p className="max-w-[240px] truncate text-sm font-semibold text-slate-800">
              {product.name}
            </p>
            <p className="font-mono text-[10px] text-slate-400">SKU: {product.sku || "—"}</p>
            {product.category?.name && (
              <p className="mt-0.5 text-[11px] text-slate-500">{product.category.name}</p>
            )}
          </div>
        </div>
      </td>

      <td className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800 whitespace-nowrap">
        {product.price} <span className="text-xs font-normal text-slate-400">{product.currency}</span>
      </td>

      <td className="cursor-pointer px-4 py-3 text-center">
        <span className={`text-xs font-semibold ${product.stock > 0 ? "text-slate-700" : "text-red-500"}`}>
          {product.stock}
        </span>
      </td>

      <td className="cursor-pointer px-4 py-3 text-center text-xs text-slate-500 whitespace-nowrap">
        {product.weight} غ
      </td>

      <td className="cursor-pointer px-4 py-3">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            product.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {product.is_active ? "نشط" : "معطل"}
        </span>
      </td>

      <td className="cursor-pointer px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
        {formatDate(product.created_at)}
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onEdit(product)}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            عرض
          </button>
          <button
            type="button"
            onClick={() => onDelete(product)}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            حذف
          </button>
        </div>
      </td>
    </tr>
  );
}

function ProductDetailsModal({
  product,
  loading,
  error,
  categories,
  addresses,
  metaLoading,
  metaError,
  onRefreshMeta,
  onClose,
  onSave,
  onDelete,
}: {
  product: ProductDetailsResponse | null;
  loading: boolean;
  error: string;
  categories: Category[];
  addresses: StorageAddress[];
  metaLoading: boolean;
  metaError: string;
  onRefreshMeta: () => Promise<void>;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [activeImage, setActiveImage] = useState(0);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [form, setForm] = useState<ProductFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!product) return;
    setActiveImage(0);
    setMode("view");
    setForm(productToForm(product));
    setLocalError("");
  }, [product?.id]);

  useEffect(() => {
    if (mode === "edit" && (categories.length === 0 || addresses.length === 0)) {
      void onRefreshMeta();
    }
  }, [mode, categories.length, addresses.length, onRefreshMeta]);

  if (!product) return null;

  const images = product.images_urls || [];
  const currentImage = images[activeImage] || images[0] || "";
  const selectedCategory = categories.find((c) => c.id === product.category_id || c.id === product.category?.id);
  const selectedAddress = addresses.find((a) => a.id === product.storage_address_id);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form) return;

    try {
      setSaving(true);
      setLocalError("");
      await onSave(buildUpdatePayload(form));
      setMode("view");
    } catch (err) {
      setLocalError(getErrorMessage(err, "فشل حفظ التعديلات"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const ok = window.confirm("هل تريد حذف هذا المنتج بشكل نهائي؟");
    if (!ok) return;

    try {
      setDeleting(true);
      setLocalError("");
      await onDelete();
    } catch (err) {
      setLocalError(getErrorMessage(err, "فشل حذف المنتج"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{product.name}</h3>
            <p className="font-mono text-xs text-slate-400">SKU: {product.sku || "—"}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setMode("view")}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  mode === "view" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                }`}
              >
                عرض
              </button>
              <button
                type="button"
                onClick={() => setMode("edit")}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  mode === "edit" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                }`}
              >
                تعديل
              </button>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : (
          <div className="grid gap-0 lg:grid-cols-[1.25fr_0.95fr]">
            <div className="border-b border-slate-100 lg:border-b-0 lg:border-l lg:border-slate-100">
              <div className="relative aspect-[4/3] bg-slate-100">
                {currentImage ? (
                  <img
                    src={currentImage}
                    alt={product.name}
                    className="h-full w-full bg-slate-50 object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <svg
                      className="h-16 w-16 text-slate-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveImage((prev) => (prev - 1 + images.length) % images.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                    >
                      <svg
                        className="h-5 w-5 text-slate-700"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveImage((prev) => (prev + 1) % images.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                    >
                      <svg
                        className="h-5 w-5 text-slate-700"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}
              </div>

              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto border-t border-slate-100 p-3">
                  {images.map((img, idx) => (
                    <button
                      key={`${img}-${idx}`}
                      type="button"
                      onClick={() => setActiveImage(idx)}
                      className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl ring-2 transition ${
                        idx === activeImage ? "ring-indigo-500" : "ring-transparent"
                      }`}
                    >
                      <img src={img} alt={`${product.name}-${idx}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5">
              {(localError || metaError) && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {localError || metaError}
                </div>
              )}

              {mode === "view" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <InfoBox label="السعر" value={`${product.price} ${product.currency}`} />
                    <InfoBox label="المخزون" value={String(product.stock)} />
                    <InfoBox label="الوزن" value={`${product.weight} غ`} />
                    <InfoBox label="الحالة" value={product.is_active ? "نشط" : "معطل"} />
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">الوصف</p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">
                      {product.description || "لا يوجد وصف"}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <InfoBox label="التصنيف" value={selectedCategory?.name || product.category?.name || "—"} />
                    <InfoBox label="عنوان التخزين" value={selectedAddress ? formatAddress(selectedAddress) : "—"} />
                    <InfoBox label="تاريخ الإضافة" value={formatDate(product.created_at)} />
                    <InfoBox label="آخر تحديث" value={formatDate(product.updated_at ?? null)} />
                    <InfoBox label="عدد الصور" value={String(images.length)} />
                    <InfoBox label="معرف المنتج" value={String(product.id)} />
                    <InfoBox label="الحذف" value={product.deleted_at ? "محذوف" : "غير محذوف"} />
                    <InfoBox label="حالة التفعيل" value={product.is_active ? "مفعل" : "غير مفعل"} />
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMode("edit")}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      تعديل المنتج
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      {deleting ? "جاري الحذف..." : "حذف المنتج"}
                    </button>
                  </div>
                </>
              ) : (
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <FieldLabel>اسم المنتج</FieldLabel>
                      <input
                        value={form?.name ?? ""}
                        onChange={(e) =>
                          setForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>

                    <div>
                      <FieldLabel>SKU</FieldLabel>
                      <input
                        value={form?.sku ?? ""}
                        onChange={(e) =>
                          setForm((prev) => (prev ? { ...prev, sku: e.target.value } : prev))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>

                    <div>
                      <FieldLabel>السعر</FieldLabel>
                      <input
                        type="number"
                        step="0.01"
                        value={form?.price ?? ""}
                        onChange={(e) =>
                          setForm((prev) => (prev ? { ...prev, price: e.target.value } : prev))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>

                    <div>
                      <FieldLabel>العملة</FieldLabel>
                      <input
                        value={form?.currency ?? ""}
                        onChange={(e) =>
                          setForm((prev) => (prev ? { ...prev, currency: e.target.value } : prev))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>

                    <div>
                      <FieldLabel>المخزون</FieldLabel>
                      <input
                        type="number"
                        value={form?.stock ?? ""}
                        onChange={(e) =>
                          setForm((prev) => (prev ? { ...prev, stock: e.target.value } : prev))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>

                    <div>
                      <FieldLabel>الوزن</FieldLabel>
                      <input
                        type="number"
                        step="0.01"
                        value={form?.weight ?? ""}
                        onChange={(e) =>
                          setForm((prev) => (prev ? { ...prev, weight: e.target.value } : prev))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>

                    <div>
                      <FieldLabel>التصنيف</FieldLabel>
                      <select
                        value={form?.category_id ?? ""}
                        onChange={(e) =>
                          setForm((prev) => (prev ? { ...prev, category_id: e.target.value } : prev))
                        }
                        disabled={metaLoading && categories.length === 0}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50"
                      >
                        <option value="">
                          {metaLoading && categories.length === 0 ? "جاري تحميل التصنيفات..." : "اختر تصنيفًا"}
                        </option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      {categories.length === 0 && !metaLoading && (
                        <p className="mt-1 text-[11px] text-amber-600">لا توجد تصنيفات متاحة حاليًا.</p>
                      )}
                    </div>

                    <div>
                      <FieldLabel>عنوان التخزين</FieldLabel>
                      <select
                        value={form?.storage_address_id ?? ""}
                        onChange={(e) =>
                          setForm((prev) =>
                            prev ? { ...prev, storage_address_id: e.target.value } : prev
                          )
                        }
                        disabled={metaLoading && addresses.length === 0}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50"
                      >
                        <option value="">
                          {metaLoading && addresses.length === 0
                            ? "جاري تحميل العناوين..."
                            : "اختر عنوان تخزين"}
                        </option>
                        {addresses.map((address) => (
                          <option key={address.id} value={address.id}>
                            {formatAddress(address)}
                          </option>
                        ))}
                      </select>
                      {addresses.length === 0 && !metaLoading && (
                        <p className="mt-1 text-[11px] text-amber-600">لا توجد عناوين تخزين متاحة.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <FieldLabel>الوصف</FieldLabel>
                    <textarea
                      rows={5}
                      value={form?.description ?? ""}
                      onChange={(e) =>
                        setForm((prev) => (prev ? { ...prev, description: e.target.value } : prev))
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">حالة المنتج</p>
                      <p className="text-xs text-slate-500">يمكن تفعيل أو تعطيل المنتج من هنا</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => (prev ? { ...prev, is_active: !prev.is_active } : prev))
                      }
                      className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                        form?.is_active
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-slate-500 hover:bg-slate-600"
                      }`}
                    >
                      {form?.is_active ? "نشط" : "معطل"}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("view")}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      رجوع
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      {deleting ? "جاري الحذف..." : "حذف المنتج"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [view, setView] = useState<"table" | "grid">("table");
  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("");
  const [limit] = useState(10);

  const [products, setProducts] = useState<Product[]>([]);
  console.log(products)
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const [selectedProduct, setSelectedProduct] = useState<ProductDetailsResponse | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [addresses, setAddresses] = useState<StorageAddress[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState("");

  useEffect(() => {
    if (!feedback) return;

    const timer = window.setTimeout(() => setFeedback(null), 4500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const buildParams = useCallback(
    (cursor: string | null) => {
      return buildProductQuery({
        limit,
        search,
        min_price: minPrice,
        max_price: maxPrice,
        sort,
        cursor,
      });
    },
    [limit, search, minPrice, maxPrice, sort]
  );

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const qs = buildParams(null);
      const res = await api.get<ProductListResponse>(`/products${qs ? `?${qs}` : ""}`);
      const items = normalizeListResponse(res);

      setProducts(items);
      setTotal(Array.isArray(res) ? items.length : res.total ?? items.length);
    } catch (err) {
      setError(getErrorMessage(err, "فشل تحميل المنتجات"));
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    setMetaError("");

    try {
      const [categoriesResult, addressesResult] = await Promise.allSettled([
        api.get<Category[]>("/categories"),
        api.get<StorageAddress[]>("/user/addresses"),
      ]);

      const messages: string[] = [];

      if (categoriesResult.status === "fulfilled") {
        setCategories(Array.isArray(categoriesResult.value) ? categoriesResult.value : []);
      } else {
        setCategories([]);
        messages.push(getErrorMessage(categoriesResult.reason, "فشل جلب التصنيفات"));
      }

      if (addressesResult.status === "fulfilled") {
        setAddresses(Array.isArray(addressesResult.value) ? addressesResult.value : []);
      } else {
        setAddresses([]);
        messages.push(getErrorMessage(addressesResult.reason, "فشل جلب العناوين"));
      }

      setMetaError(messages.join(" · "));
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
    void loadMeta();
  }, [loadProducts, loadMeta]);

  async function openProduct(product: Product) {
    setDetailsLoading(true);
    setDetailsError("");
    setSelectedProduct(product as ProductDetailsResponse);

    try {
      const params = new URLSearchParams();
      params.set("product_id", String(product.id));

      const data = await api.get<ProductDetailsResponse>(`/products/product?${params.toString()}`);
      setSelectedProduct(data);
    } catch (err) {
      setDetailsError(getErrorMessage(err, "فشل جلب تفاصيل المنتج"));
    } finally {
      setDetailsLoading(false);
    }
  }

  async function openEditProduct(product: Product) {
    await openProduct(product);
  }

  async function deleteProductById(product: ProductDetailsResponse | Product) {
    const params = new URLSearchParams();
    params.set("product_id", String(product.id));

    const response = await api.delete<ActionResponse>(`/merchant/products?${params.toString()}`);

    if (response && response.ok === false) {
      throw new Error(response.description || "فشل حذف المنتج");
    }

    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    setTotal((prev) => Math.max(prev - 1, 0));

    if (selectedProduct?.id === product.id) {
      setSelectedProduct(null);
      setDetailsError("");
      setDetailsLoading(false);
    }

    setFeedback({
      type: "success",
      message: getResponseMessage(response, "تم حذف المنتج والصور المرتبطة به بنجاح"),
    });
  }

  async function saveProductChanges(payload: Record<string, unknown>) {
    if (!selectedProduct) return;

    const params = new URLSearchParams();
    params.set("product_id", String(selectedProduct.id));

    const response = await api.patch<ActionResponse>(`/merchant/products?${params.toString()}`, payload);

    if (response && response.ok === false) {
      throw new Error(response.description || "فشل حفظ التعديلات");
    }

    const refreshed = await api.get<ProductDetailsResponse>(
      `/products/product?product_id=${selectedProduct.id}`
    );

    setSelectedProduct(refreshed);
    setProducts((prev) =>
      prev.map((item) =>
        item.id === refreshed.id
          ? {
              ...item,
              ...refreshed,
            }
          : item
      )
    );

    setFeedback({
      type: "success",
      message: getResponseMessage(response, "تم حفظ التعديلات بنجاح"),
    });
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    void loadProducts();
  }

  function clearFilters() {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setSort("");
    window.setTimeout(() => {
      void loadProducts();
    }, 0);
  }

  const stats = useMemo(() => {
    const active = products.filter((p) => p.is_active).length;
    const outOfStock = products.filter((p) => p.stock <= 0).length;
    return { total, active, outOfStock };
  }, [products, total]);

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 rtl" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">المنتجات</h1>
          <p className="mt-0.5 text-sm text-slate-500">إدارة المنتجات واستعراضها وتعديلها وحذفها</p>
        </div>

        <Link
          href="/merchant/products/new"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          منتج جديد
        </Link>
      </div>

      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { label: "إجمالي المنتجات", value: stats.total },
          { label: "النشطة", value: stats.active },
          { label: "نفد المخزون", value: stats.outOfStock },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{s.value}</p>
          </div>
        ))}
      </div>

      {(metaError || (metaLoading && categories.length === 0 && addresses.length === 0)) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {metaError || "جاري تحميل التصنيفات والعناوين..."}
        </div>
      )}

      <form onSubmit={handleSearch} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم..."
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 lg:col-span-2"
          />
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="أقل سعر"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="أعلى سعر"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">الافتراضي</option>
            <option value="price_asc">السعر ↑</option>
            <option value="price_desc">السعر ↓</option>
            <option value="newest">الأحدث</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            بحث
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            مسح
          </button>
          <button
            type="button"
            onClick={() => void loadProducts()}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            تحديث
          </button>
          <button
            type="button"
            onClick={() => void loadMeta()}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            تحديث التصنيفات والعناوين
          </button>

          <div className="mr-auto flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setView("table")}
              title="جدول"
              className={`rounded-lg p-1.5 transition-colors ${
                view === "table"
                  ? "bg-white shadow-sm text-indigo-600"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              title="شبكة"
              className={`rounded-lg p-1.5 transition-colors ${
                view === "grid"
                  ? "bg-white shadow-sm text-indigo-600"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </button>
          </div>
        </div>
      </form>

      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => void loadProducts()}
            className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <svg
              className="h-7 w-7 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <p className="text-slate-500">لا توجد منتجات.</p>
          <Link
            href="/merchant/products/new"
            className="mt-4 inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            إضافة منتج
          </Link>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {products.map((p) => (
            <div
              key={p.id}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <button type="button" onClick={() => void openProduct(p)} className="block w-full text-right">
                <div className="relative h-44 w-full bg-slate-100">
                  <Thumbnail src={p.images_urls?.[0]} alt={p.name} />
                  <div className="absolute left-2 top-2 flex gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        p.is_active ? "bg-green-500 text-white" : "bg-slate-400 text-white"
                      }`}
                    >
                      {p.is_active ? "نشط" : "معطل"}
                    </span>
                  </div>
                </div>

                <div className="p-3.5">
                  <h3 className="truncate text-sm font-bold text-slate-800">{p.name}</h3>
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{p.description || "—"}</p>
                  <div className="mt-2.5 flex items-center justify-between">
                    <p className="text-base font-bold text-slate-800">
                      {p.price} <span className="text-xs font-medium text-slate-400">{p.currency}</span>
                    </p>
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {p.stock} وحدة
                    </span>
                  </div>
                </div>
              </button>

              <div className="flex items-center justify-between border-t border-slate-100 px-3 py-3">
                <button
                  type="button"
                  onClick={() => void openEditProduct(p)}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  تعديل
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = window.confirm("هل تريد حذف هذا المنتج بشكل نهائي؟");
                    if (!ok) return;

                    try {
                      await deleteProductById(p);
                    } catch (err) {
                      setFeedback({
                        type: "error",
                        message: getErrorMessage(err, "فشل حذف المنتج"),
                      });
                    }
                  }}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {["المنتج", "السعر", "المخزون", "الوزن", "الحالة", "التاريخ", "الإجراءات"].map((h) => (
                    <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    onOpen={(product) => void openProduct(product)}
                    onEdit={(product) => void openEditProduct(product)}
                    onDelete={async (product) => {
                      const ok = window.confirm("هل تريد حذف هذا المنتج بشكل نهائي؟");
                      if (!ok) return;

                      try {
                        await deleteProductById(product);
                      } catch (err) {
                        setFeedback({
                          type: "error",
                          message: getErrorMessage(err, "فشل حذف المنتج"),
                        });
                      }
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          loading={detailsLoading}
          error={detailsError}
          categories={categories}
          addresses={addresses}
          metaLoading={metaLoading}
          metaError={metaError}
          onRefreshMeta={loadMeta}
          onClose={() => {
            setSelectedProduct(null);
            setDetailsError("");
            setDetailsLoading(false);
          }}
          onSave={async (payload) => {
            try {
              await saveProductChanges(payload);
            } catch (err) {
              throw new Error(getErrorMessage(err, "فشل حفظ التعديلات"));
            }
          }}
          onDelete={async () => {
            if (!selectedProduct) return;
            await deleteProductById(selectedProduct);
          }}
        />
      )}
    </div>
  );
}