"use client";

import React, { DragEvent, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { CURRENCIES, CURRENCY_LABEL, CURRENCY_FLAG } from "@/lib/currency";

type Address = {
  id: number;
  note?: string;
  label?: string;
  street?: string;
  city?: string;
  latitude?: string;
  longitude?: string;
};

type Category = {
  id: number;
  name: string;
};

type FormState = {
  name: string;
  description: string;
  price: string;
  currency: string;
  stock: string;
  weight: string;
  storage_address_id: string;
  category_id: string;
  is_active: boolean;
};

type LocalImage = {
  file: File;
  previewUrl: string;
};

type StepErrors = Partial<
  Record<keyof FormState | "images" | "submit", string>
>;

type PrepareImageItem = {
  file_key: string;
  upload_url: string;
};

type PrepareImagesResponse = {
  success?: boolean;
  session_id: string;
  files: PrepareImageItem[];
};

type ProductCreatePayload = {
  name: string;
  description: string | null;
  price: number;
  currency: string;
  stock: number;
  weight: number;
  storage_address_id: number;
  category_id: number | null;
  upload_session_id: string;
  image_keys: string[];
  is_active: boolean;
};

type SubmitStage = "idle" | "preparing" | "uploading" | "creating" | "done" | "error";

const API = {
  prepareImages: "/merchant/products/prepare-images",
  createProduct: "/merchant/products",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";

function toNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isValidInteger(value: number | null): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function formatAddress(a: Address) {
  return (
    a.label ||
    a.note ||
    [a.street, a.city].filter(Boolean).join(", ") ||
    `Address ${a.id}`
  );
}

function getErrorMessage(err: unknown): string {
  if (!err) return "حدث خطأ غير معروف";

  if (typeof err === "string") return err;

  if (err instanceof Error) return err.message;

  if (typeof err === "object" && err !== null) {
    const anyErr = err as Record<string, unknown>;

    const detail = anyErr.detail;
    if (typeof detail === "string") return detail;

    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as Record<string, unknown>;
      const msg = first?.msg;
      if (typeof msg === "string") return msg;
    }

    const message = anyErr.message;
    if (typeof message === "string") return message;
  }

  return "تعذر إكمال العملية";
}

function revokeImages(items: LocalImage[]) {
  for (const item of items) {
    try {
      URL.revokeObjectURL(item.previewUrl);
    } catch {}
  }
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-[11px] text-red-500">{msg}</p>;
}

function PipelineOverlay({
  stage,
  message,
  errors,
  onRetry,
  onReset,
  onGoToList,
  onClose,
}: {
  stage: SubmitStage;
  message: string;
  errors: string[];
  onRetry: () => void;
  onReset: () => void;
  onGoToList: () => void;
  onClose: () => void;
}) {
  const isDone = stage === "done";
  const isError = stage === "error";
  const progress = stage === "preparing" ? 20 : stage === "uploading" ? 55 : stage === "creating" ? 85 : isDone ? 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 text-center">
          {isDone ? (
            <>
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-800">تم نشر المنتج</h2>
              <p className="mt-1 text-sm text-slate-500">{message || "تمت العملية بنجاح"}</p>
            </>
          ) : isError ? (
            <>
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-800">حدث خطأ</h2>
              <p className="mt-1 text-sm text-red-500">{message || "تعذر إكمال العملية"}</p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
                <svg className="h-8 w-8 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-800">جاري التنفيذ</h2>
              <p className="mt-1 text-sm text-slate-500">{message || "يرجى الانتظار"}</p>
            </>
          )}
        </div>

        {!isError && !isDone && (
          <div className="mb-5">
            <div className="mb-1.5 flex justify-between text-xs text-slate-400">
              <span>التقدم</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errors.slice(0, 3).map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {isDone ? (
            <>
              <button
                type="button"
                onClick={onGoToList}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                عرض المنتجات
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
              >
                إغلاق
              </button>
            </>
          ) : isError ? (
            <>
              <button
                type="button"
                onClick={onRetry}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                إعادة المحاولة
              </button>
              <button
                type="button"
                onClick={onReset}
                className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
              >
                إلغاء
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function NewProductPage() {
  const router = useRouter();

  const [loadingInit, setLoadingInit] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [images, setImages] = useState<LocalImage[]>([]);
  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    price: "",
    currency: "YER",
    stock: "",
    weight: "",
    storage_address_id: "",
    category_id: "",
    is_active: true,
  });
  const [errors, setErrors] = useState<StepErrors>({});
  const [submitStage, setSubmitStage] = useState<SubmitStage>("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const [lastAction, setLastAction] = useState<"submit" | "none">("none");

  const fileCount = images.length;
  const showOverlay = submitStage !== "idle";

  const currentAddress = useMemo(() => {
    const id = toNumber(form.storage_address_id);
    if (!id) return null;
    return addresses.find((a) => a.id === id) || null;
  }, [addresses, form.storage_address_id]);

  const currentCategory = useMemo(() => {
    const id = toNumber(form.category_id);
    if (!id) return null;
    return categories.find((c) => c.id === id) || null;
  }, [categories, form.category_id]);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      api.get<Address[]>("/user/addresses").catch(() => [] as Address[]),
      api.get<Category[]>("/categories").catch(() => [] as Category[]),
    ])
      .then(([addrList, catList]) => {
        if (!mounted) return;

        const safeAddresses = Array.isArray(addrList) ? addrList : [];
        const safeCategories = Array.isArray(catList) ? catList : [];

        setAddresses(safeAddresses);
        setCategories(safeCategories);

        if (safeAddresses.length === 1) {
          setForm((prev) => ({
            ...prev,
            storage_address_id: String(safeAddresses[0].id),
          }));
        }
      })
      .finally(() => {
        if (mounted) setLoadingInit(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      revokeImages(images);
    };
  }, [images]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, submit: undefined }));
  }

  function addSelectedFiles(fileList: FileList | null) {
    if (!fileList) return;

    const picked = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (picked.length === 0) return;

    setImages((prev) => {
      const spaceLeft = 5 - prev.length;
      const nextFiles = picked.slice(0, Math.max(spaceLeft, 0));
      const nextItems: LocalImage[] = nextFiles.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...prev, ...nextItems];
    });

    setErrors((prev) => ({ ...prev, images: undefined, submit: undefined }));
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1);
      revokeImages(removed);
      return next;
    });
  }

  function validateStep(step: number) {
    const next: StepErrors = {};
    const name = form.name.trim();
    const description = form.description.trim();
    const price = toNumber(form.price);
    const stock = toNumber(form.stock);
    const weight = toNumber(form.weight);
    const addressId = toNumber(form.storage_address_id);
    const categoryId = form.category_id === "" ? null : toNumber(form.category_id);

    if (step === 1) {
      if (name.length < 2) next.name = "اسم المنتج مطلوب";
      if (description.length > 2000) next.description = "الوصف طويل جداً";
    }

    if (step === 2) {
      if (price === null || price <= 0) next.price = "السعر غير صحيح";
      if (stock === null || stock < 0 || !Number.isInteger(stock)) next.stock = "الكمية غير صحيحة";
      if (weight === null || weight <= 0) next.weight = "الوزن غير صحيح";
      if (addressId === null || addressId <= 0) next.storage_address_id = "عنوان التخزين مطلوب";
      if (form.category_id !== "" && categoryId === null) next.category_id = "التصنيف غير صحيح";
    }

    if (step === 3) {
      if (images.length === 0) next.images = "يجب إضافة صورة واحدة على الأقل";
      if (images.length > 5) next.images = "الحد الأقصى 5 صور";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function nextStep() {
    if (validateStep(currentStep)) {
      setCurrentStep((s) => Math.min(s + 1, 4));
    }
  }

  function prevStep() {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    addSelectedFiles(e.dataTransfer.files);
  }

  async function prepareImages(): Promise<PrepareImagesResponse> {
    const payload = {
      files: images.map((item) => ({
        filename: item.file.name,
        content_type: item.file.type || "application/octet-stream",
      })),
    };

    const res = await api.post<PrepareImagesResponse>(API.prepareImages, payload);
    if (!res || !res.session_id || !Array.isArray(res.files)) {
      throw new Error("تعذر تجهيز جلسة الرفع");
    }
    if (res.files.length !== images.length) {
      throw new Error("عدد الملفات الراجعة لا يطابق الملفات المختارة");
    }
    return res;
  }

  async function uploadFileToUrl(file: File, uploadUrl: string) {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(`فشل رفع الصورة (${response.status})`);
    }
  }

  function buildProductPayload(sessionId: string, imageKeys: string[]): ProductCreatePayload {
    const price = toNumber(form.price);
    const stock = toNumber(form.stock);
    const weight = toNumber(form.weight);
    const storageAddressId = toNumber(form.storage_address_id);
    const categoryId = form.category_id === "" ? null : toNumber(form.category_id);

    if (price === null || stock === null || weight === null || storageAddressId === null) {
      throw new Error("قيم النموذج غير صحيحة");
    }

    return {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      currency: form.currency,
      stock: Math.trunc(stock),
      weight,
      storage_address_id: Math.trunc(storageAddressId),
      category_id: categoryId === null ? null : Math.trunc(categoryId),
      upload_session_id: sessionId,
      image_keys: imageKeys,
      is_active: form.is_active,
    };
  }

  function validateAll() {
    const allErrors: StepErrors = {};
    const s1 = validateStep(1);
    const s2 = validateStep(2);
    const s3 = validateStep(3);

    if (!(s1 && s2 && s3)) {
      setCurrentStep((prev) => {
        if (!s1) return 1;
        if (!s2) return 2;
        if (!s3) return 3;
        return prev;
      });
      return false;
    }

    const price = toNumber(form.price);
    const stock = toNumber(form.stock);
    const weight = toNumber(form.weight);
    const addressId = toNumber(form.storage_address_id);

    if (form.name.trim().length < 2) allErrors.name = "اسم المنتج مطلوب";
    if (price === null || price <= 0) allErrors.price = "السعر غير صحيح";
    if (stock === null || stock < 0 || !Number.isInteger(stock)) allErrors.stock = "الكمية غير صحيحة";
    if (weight === null || weight <= 0) allErrors.weight = "الوزن غير صحيح";
    if (addressId === null || addressId <= 0) allErrors.storage_address_id = "عنوان التخزين مطلوب";
    if (images.length === 0) allErrors.images = "يجب إضافة صورة واحدة على الأقل";

    setErrors((prev) => ({ ...prev, ...allErrors }));
    return Object.keys(allErrors).length === 0;
  }

  async function submitProduct() {
    if (submitStage !== "idle") return;
    if (!validateAll()) return;

    setLastAction("submit");
    setSubmitErrors([]);
    setSubmitMessage("");
    setSubmitStage("preparing");

    try {
      const prepared = await prepareImages();

      setSubmitStage("uploading");
      for (let i = 0; i < images.length; i += 1) {
        const file = images[i].file;
        const upload = prepared.files[i];
        if (!upload?.upload_url || !upload?.file_key) {
          throw new Error("بيانات الرفع غير مكتملة");
        }
        await uploadFileToUrl(file, upload.upload_url);
      }

      const payload = buildProductPayload(
        prepared.session_id,
        prepared.files.map((f) => f.file_key)
      );

      setSubmitStage("creating");
      await api.post(API.createProduct, payload);

      setSubmitMessage("تم نشر المنتج بنجاح");
      setSubmitStage("done");
      setSubmitErrors([]);
    } catch (err) {
      setSubmitErrors([getErrorMessage(err)]);
      setSubmitMessage(getErrorMessage(err));
      setSubmitStage("error");
    }
  }

  async function retrySubmit() {
    setSubmitStage("idle");
    setTimeout(() => {
      void submitProduct();
    }, 0);
  }

  function resetAll() {
    revokeImages(images);
    setImages([]);
    setForm({
      name: "",
      description: "",
      price: "",
      currency: "YER",
      stock: "",
      weight: "",
      storage_address_id: addresses.length === 1 ? String(addresses[0].id) : "",
      category_id: "",
      is_active: true,
    });
    setErrors({});
    setCurrentStep(1);
    setSubmitErrors([]);
    setSubmitMessage("");
    setSubmitStage("idle");
    setLastAction("none");
  }

  const stepLabel = submitStage === "preparing"
    ? "جاري تجهيز جلسة الرفع"
    : submitStage === "uploading"
      ? "جاري رفع الصور"
      : submitStage === "creating"
        ? "جاري إنشاء المنتج"
        : submitStage === "done"
          ? "تم الإنهاء"
          : submitStage === "error"
            ? "فشل التنفيذ"
            : "";

  const STEPS = [
    { n: 1, title: "المعلومات الأساسية" },
    { n: 2, title: "السعر والمخزون" },
    { n: 3, title: "الصور" },
    { n: 4, title: "المراجعة والنشر" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 rtl" dir="rtl">
      {showOverlay && (
        <PipelineOverlay
          stage={submitStage}
          message={submitMessage || stepLabel}
          errors={submitErrors}
          onRetry={retrySubmit}
          onReset={resetAll}
          onGoToList={() => router.push("/merchant/products")}
          onClose={() => setSubmitStage("idle")}
        />
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800">إضافة منتج جديد</h1>
        <p className="mt-1 text-slate-500">أضف منتجاً جديداً إلى متجرك في بضع خطوات بسيطة.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center">
          {STEPS.map((s, i) => {
            const done = currentStep > s.n;
            const active = currentStep === s.n;
            return (
              <React.Fragment key={s.n}>
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      done
                        ? "bg-emerald-500 text-white"
                        : active
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                          : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {done ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      s.n
                    )}
                  </div>
                  <span
                    className={`hidden text-[10px] font-medium sm:block ${
                      active
                        ? "text-indigo-600"
                        : done
                          ? "text-emerald-600"
                          : "text-slate-400"
                    }`}
                  >
                    {s.title}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`mx-2 h-0.5 flex-1 rounded transition-colors ${done ? "bg-emerald-400" : "bg-slate-200"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {currentStep === 1 && (
        <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-700">المعلومات الأساسية</h2>

          <div>
            <label className={labelClass}>اسم المنتج *</label>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="مثال: تمر مجدول فاخر"
              maxLength={100}
            />
            <FieldError msg={errors.name} />
          </div>

          <div>
            <label className={labelClass}>وصف المنتج</label>
            <textarea
              className={`${inputClass} min-h-[120px] resize-y`}
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="اكتب وصفاً تفصيلياً للمنتج..."
              maxLength={2000}
            />
            <FieldError msg={errors.description} />
          </div>

          {!loadingInit && categories.length > 0 && (
            <div>
              <label className={labelClass}>التصنيف</label>
              <select
                className={inputClass}
                value={form.category_id}
                onChange={(e) => updateField("category_id", e.target.value)}
              >
                <option value="">— بدون تصنيف —</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
              <FieldError msg={errors.category_id} />
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-700">نشر المنتج فوراً</p>
              <p className="text-xs text-slate-400">إذا كان غير نشط، يمكنك تفعيله لاحقاً</p>
            </div>
            <button
              type="button"
              onClick={() => updateField("is_active", !form.is_active)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.is_active ? "bg-indigo-600" : "bg-slate-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  form.is_active ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={nextStep}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition-colors hover:bg-indigo-700"
            >
              التالي
              <svg className="h-4 w-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </section>
      )}

      {currentStep === 2 && (
        <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-700">السعر والمخزون</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>السعر *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.price}
                onChange={(e) => updateField("price", e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
              <FieldError msg={errors.price} />
            </div>

            <div>
              <label className={labelClass}>العملة *</label>
              <select
                className={inputClass}
                value={form.currency}
                onChange={(e) => updateField("currency", e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {CURRENCY_FLAG[c]} {CURRENCY_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>الكمية في المخزون *</label>
              <input
                type="number"
                min="0"
                step="1"
                className={inputClass}
                value={form.stock}
                onChange={(e) => updateField("stock", e.target.value)}
                placeholder="0"
                inputMode="numeric"
              />
              <FieldError msg={errors.stock} />
            </div>

            <div>
              <label className={labelClass}>الوزن (جرام) *</label>
              <input
                type="number"
                min="0"
                step="0.1"
                className={inputClass}
                value={form.weight}
                onChange={(e) => updateField("weight", e.target.value)}
                placeholder="0.0"
                inputMode="decimal"
              />
              <FieldError msg={errors.weight} />
            </div>
          </div>

          <div>
            <label className={labelClass}>عنوان التخزين *</label>
            {loadingInit ? (
              <div className="flex h-10 items-center gap-2 text-sm text-slate-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
                جاري التحميل...
              </div>
            ) : addresses.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                لا يوجد عنوان مسجل.{" "}
                <a href="/merchant/settings" className="font-semibold underline">
                  أضف عنواناً من الإعدادات أولاً
                </a>
              </div>
            ) : (
              <select
                className={inputClass}
                value={form.storage_address_id}
                onChange={(e) => updateField("storage_address_id", e.target.value)}
              >
                <option value="">— اختر عنوان التخزين —</option>
                {addresses.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {formatAddress(a)}
                  </option>
                ))}
              </select>
            )}
            <FieldError msg={errors.storage_address_id} />
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={prevStep}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-6 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              السابق
            </button>
            <button
              type="button"
              onClick={nextStep}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              التالي
              <svg className="h-4 w-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </section>
      )}

      {currentStep === 3 && (
        <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-700">صور المنتج</h2>
            <span className="text-xs text-slate-400">{images.length}/5 صور</span>
          </div>

          {images.length < 5 && (
            <div
              className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
                isDragging
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input-new")?.click()}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100">
                <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">اسحب الصور هنا أو انقر للتحميل</p>
                <p className="mt-1 text-xs text-slate-400">PNG، JPG، WEBP — حتى 5 صور</p>
              </div>
              <input
                id="file-input-new"
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={(e) => addSelectedFiles(e.target.files)}
              />
            </div>
          )}

          <FieldError msg={errors.images} />
          <FieldError msg={errors.submit} />

          {images.length > 0 && (
            <div className="grid grid-cols-5 gap-3">
              {images.map((item, i) => (
                <div key={`${item.file.name}-${i}`} className="group relative aspect-square">
                  <img
                    src={item.previewUrl}
                    alt={`preview-${i}`}
                    className="h-full w-full rounded-xl border border-slate-200 object-cover"
                  />
                  {i === 0 && (
                    <span className="absolute left-1 top-1 rounded-md bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      رئيسية
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={prevStep}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-6 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              السابق
            </button>
            <button
              type="button"
              onClick={nextStep}
              disabled={images.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              مراجعة المنتج
              <svg className="h-4 w-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </section>
      )}

      {currentStep === 4 && (
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-700">مراجعة المنتج قبل النشر</h2>

          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">المعلومات الأساسية</span>
                <button type="button" onClick={() => setCurrentStep(1)} className="text-xs text-indigo-600 hover:underline">
                  تعديل
                </button>
              </div>
              <dl className="space-y-2">
                <div>
                  <dt className="text-[11px] text-slate-400">الاسم</dt>
                  <dd className="text-sm font-semibold text-slate-800">{form.name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-400">الوصف</dt>
                  <dd className="line-clamp-3 text-sm text-slate-600">{form.description || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-400">التصنيف</dt>
                  <dd className="text-sm text-slate-700">{currentCategory?.name || "—"}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">السعر والمخزون</span>
                <button type="button" onClick={() => setCurrentStep(2)} className="text-xs text-indigo-600 hover:underline">
                  تعديل
                </button>
              </div>
              <dl className="grid grid-cols-3 gap-x-4 gap-y-2">
                <div>
                  <dt className="text-[11px] text-slate-400">السعر</dt>
                  <dd className="text-sm font-bold text-slate-800">
                    {form.price || "—"} {form.currency}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-400">الكمية</dt>
                  <dd className="text-sm font-semibold text-slate-700">{form.stock || "0"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-400">الوزن</dt>
                  <dd className="text-sm text-slate-700">{form.weight || "—"} غ</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">الصور ({images.length})</span>
                <button type="button" onClick={() => setCurrentStep(3)} className="text-xs text-indigo-600 hover:underline">
                  تعديل
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {images.map((item, i) => (
                  <div key={`${item.file.name}-${i}`} className="relative h-16 w-16 flex-shrink-0">
                    <img
                      src={item.previewUrl}
                      alt="preview"
                      className="h-full w-full rounded-lg border border-slate-200 object-cover"
                    />
                    {i === 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600">
                        <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className={`h-2.5 w-2.5 rounded-full ${form.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />
              <span className="text-sm text-slate-600">
                {form.is_active ? "سيُنشر المنتج فوراً بعد الإضافة" : "سيبقى مخفياً حتى تفعيله"}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p>عنوان التخزين: {currentAddress?.label || currentAddress?.note || formatAddress(currentAddress || { id: 0 })}</p>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={prevStep}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-6 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              السابق
            </button>

            <button
              type="button"
              onClick={submitProduct}
              disabled={images.length === 0 || submitStage !== "idle"}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-10 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
              </svg>
              إطلاق المنتج
            </button>
          </div>
        </section>
      )}
    </div>
  );
}