"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { api, ApiError } from "@/lib/api";

type DiscountType = "percentage" | "fixed";

interface Coupon {
  id: string;
  code: string;
  name: string;
  discount_type: DiscountType;
  discount_value: string;
  currency: string | null;
  max_uses: number | null;
  max_uses_per_user: number | null;
  min_order_amount: string | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string | null;
}

interface Stats {
  coupon_id: string;
  code: string;
  used_count: number;
  max_uses: number | null;
  unique_users: number;
  remaining_uses: number | null;
}

type CreateFormState = {
  name: string;
  discount_type: DiscountType;
  discount_value: string;
  currency: string;
  max_uses: string;
  max_uses_per_user: string;
  min_order_amount: string;
  expires_at: string;
};

type EditFormState = {
  name: string;
  discount_type: DiscountType;
  discount_value: string;
  currency: string;
  max_uses: string;
  max_uses_per_user: string;
  min_order_amount: string;
  expires_at: string;
};

const CURRENCIES = ["YER", "USD", "SAR"];

const EMPTY_CREATE: CreateFormState = {
  name: "",
  discount_type: "percentage",
  discount_value: "",
  currency: "YER",
  max_uses: "",
  max_uses_per_user: "",
  min_order_amount: "",
  expires_at: "",
};

function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
  if (!navigator.clipboard) return;
  navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
}

function expiryStatus(expires_at: string | null): { label: string; color: string } | null {
  if (!expires_at) return null;

  const ms = new Date(expires_at).getTime() - Date.now();
  const days = Math.ceil(ms / 86400000);

  if (ms < 0) return { label: "منتهية الصلاحية", color: "text-red-600 bg-red-50" };
  if (days <= 3) return { label: `تنتهي خلال ${days} أيام`, color: "text-amber-600 bg-amber-50" };
  if (days <= 14) return { label: `${days} يوم متبقي`, color: "text-indigo-600 bg-indigo-50" };

  return {
    label: new Date(expires_at).toLocaleDateString("ar-YE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    color: "text-slate-500 bg-slate-50",
  };
}

function toDatetimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function CouponCard({
  coupon,
  onEdit,
  onStats,
  onactivate,
  onDeactivate,
}: {
  coupon: Coupon;
  onEdit: () => void;
  onStats: () => void;
  onactivate: () => void
  onDeactivate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const usage = coupon.max_uses ? Math.min(100, (coupon.used_count / coupon.max_uses) * 100) : 0;
  const expiry = expiryStatus(coupon.expires_at);
  const isPercentage = coupon.discount_type === "percentage";

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
        coupon.is_active ? "border-slate-100" : "border-slate-200 opacity-70"
      }`}
    >
      <div
        className={`h-1.5 ${
          isPercentage ? "bg-gradient-to-r from-indigo-500 to-purple-500" : "bg-gradient-to-r from-emerald-400 to-teal-500"
        }`}
      />

      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex flex-col gap-1">
            <button
              onClick={() => copyToClipboard(coupon.code, setCopied)}
              className="group flex items-center gap-1.5 font-mono text-lg font-bold text-slate-800 hover:text-indigo-600 transition-colors text-right"
              title="نسخ الكود"
            >
              {coupon.code}
              <span
                className={`text-xs px-1.5 py-0.5 rounded transition-all ${
                  copied
                    ? "bg-green-100 text-green-600"
                    : "bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-500"
                }`}
              >
                {copied ? "✓ نُسخ" : "نسخ"}
              </span>
            </button>

            <span className="text-xs text-slate-500">{coupon.name}</span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`text-2xl font-bold ${isPercentage ? "text-indigo-600" : "text-emerald-600"}`}>
              {isPercentage ? `${coupon.discount_value}%` : `${coupon.discount_value} ${coupon.currency || ""}`}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              coupon.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {coupon.is_active ? "● نشطة" : "● معطلة"}
          </span>

          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {isPercentage ? "نسبة مئوية" : "مبلغ ثابت"}
          </span>

          {coupon.min_order_amount && parseFloat(coupon.min_order_amount) > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              حد أدنى: {coupon.min_order_amount}
            </span>
          )}

          {coupon.max_uses_per_user && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              {coupon.max_uses_per_user}× للمستخدم
            </span>
          )}
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-slate-500">الاستخدام</span>
            <span className="text-xs font-semibold text-slate-700">
              {coupon.used_count} / {coupon.max_uses ?? "∞"}
            </span>
          </div>

          {coupon.max_uses ? (
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usage >= 90 ? "bg-red-400" : usage >= 70 ? "bg-amber-400" : "bg-indigo-500"
                }`}
                style={{ width: `${usage}%` }}
              />
            </div>
          ) : (
            <div className="h-2 bg-slate-100 rounded-full">
              <div className="h-full w-full rounded-full bg-gradient-to-r from-indigo-200 to-indigo-100 opacity-60" />
            </div>
          )}
        </div>

        {expiry && (
          <div className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg mb-4 inline-flex items-center gap-1.5 ${expiry.color}`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {expiry.label}
          </div>
        )}

        <div className="flex items-center gap-1.5 pt-3 border-t border-slate-100">
          <button
            onClick={onStats}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            إحصائيات
          </button>

          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            تعديل
          </button>

          {coupon.is_active && (
            <button
              onClick={onDeactivate}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              تعطيل
            </button>
          )}
          {!(coupon.is_active) && (
            <button
              onClick={onactivate}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-green-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              تفعيل
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [activeOnly, setActiveOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateFormState>(EMPTY_CREATE);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    name: "",
    discount_type: "percentage",
    discount_value: "",
    currency: "YER",
    max_uses: "",
    max_uses_per_user: "",
    min_order_amount: "",
    expires_at: "",
  });
  const [editLoading, setEditLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const query = activeOnly ? "?active_only=true" : "";
      const res = await api.get<Coupon[]>(`/merchant/coupons${query}`);
      setCoupons(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "فشل التحميل");
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    load();
  }, [load]);

  async function createCoupon(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      await api.post("/merchant/coupons", {
        name: form.name.trim(),
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value),
        currency: form.discount_type === "fixed" ? form.currency : null,
        max_uses: form.max_uses ? parseInt(form.max_uses, 10) : null,
        max_uses_per_user: form.max_uses_per_user ? parseInt(form.max_uses_per_user, 10) : null,
        min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null,
        expires_at: form.expires_at || null,
      });

      setForm(EMPTY_CREATE);
      setShowCreate(false);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "فشل الإنشاء");
    } finally {
      setFormLoading(false);
    }
  }

  async function activate(id: string) {
    try {
      await api.post(`/merchant/coupons/${id}/activate`);
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "فشل التعطيل");
    }
  }

  async function deactivate(id: string) {
    try {
      await api.delete(`/merchant/coupons/${id}/deactivate`);
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "فشل التعطيل");
    }
  }

  async function loadStats(id: string) {
    setStatsLoading(true);
    setStats(null);

    try {
      setStats(await api.get<Stats>(`/merchant/coupons/${id}/stats`));
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }

  async function saveEdit() {
    if (!editCoupon) return;

    setEditLoading(true);

    try {
      const payload: Record<string, unknown> = {
        name: editForm.name.trim(),
        discount_type: editForm.discount_type,
        discount_value: parseFloat(editForm.discount_value),
        currency: editForm.discount_type === "fixed" ? editForm.currency : null,
        max_uses: editForm.max_uses ? parseInt(editForm.max_uses, 10) : null,
        max_uses_per_user: editForm.max_uses_per_user ? parseInt(editForm.max_uses_per_user, 10) : null,
        min_order_amount: editForm.min_order_amount ? parseFloat(editForm.min_order_amount) : null,
        expires_at: editForm.expires_at || null,
      };

      await api.patch(`/merchant/coupons/${editCoupon.id}`, payload);
      setEditCoupon(null);
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "فشل التعديل");
    } finally {
      setEditLoading(false);
    }
  }

  const inp =
    "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-slate-800 font-bold text-lg">القسائم</h2>

          {!loading && (
            <span className="text-slate-400 text-sm bg-slate-100 px-2 py-0.5 rounded-full">{coupons.length}</span>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded"
            />
            النشطة فقط
          </label>
        </div>

        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          قسيمة جديدة
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-4 border-b border-indigo-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">إنشاء قسيمة جديدة</h3>
            <button
              onClick={() => {
                setShowCreate(false);
                setFormError("");
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-5">
            {formError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{formError}</div>}

            <form onSubmit={createCoupon} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">اسم القسيمة *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  placeholder="خصم العودة للمدرسة"
                  className={inp}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">نوع الخصم *</label>
                <select
                  value={form.discount_type}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, discount_type: e.target.value as DiscountType }))
                  }
                  className={inp}
                >
                  <option value="percentage">نسبة مئوية %</option>
                  <option value="fixed">مبلغ ثابت</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">قيمة الخصم *</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discount_value}
                    onChange={(e) => setForm((p) => ({ ...p, discount_value: e.target.value }))}
                    required
                    placeholder={form.discount_type === "percentage" ? "20" : "500"}
                    className={inp}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    {form.discount_type === "percentage" ? "%" : form.currency}
                  </span>
                </div>
              </div>

              {form.discount_type === "fixed" && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">العملة</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                    className={inp}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">أقصى استخدام</label>
                <input
                  type="number"
                  min="1"
                  value={form.max_uses}
                  onChange={(e) => setForm((p) => ({ ...p, max_uses: e.target.value }))}
                  placeholder="غير محدود"
                  className={inp}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">مرات/مستخدم</label>
                <input
                  type="number"
                  min="1"
                  value={form.max_uses_per_user}
                  onChange={(e) => setForm((p) => ({ ...p, max_uses_per_user: e.target.value }))}
                  placeholder="غير محدود"
                  className={inp}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">حد أدنى للطلب</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.min_order_amount}
                  onChange={(e) => setForm((p) => ({ ...p, min_order_amount: e.target.value }))}
                  placeholder="اختياري"
                  className={inp}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">تاريخ الانتهاء</label>
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value }))}
                  className={inp}
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setFormError("");
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60 hover:bg-indigo-700 flex items-center gap-1.5"
                >
                  {formLoading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  إنشاء القسيمة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-500">{error}</div>
      ) : coupons.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-100">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <p className="text-slate-500 font-medium mb-1">لا توجد قسائم بعد</p>
          <button onClick={() => setShowCreate(true)} className="text-indigo-600 text-sm hover:underline">
            أنشئ قسيمتك الأولى
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {coupons.map((c) => (
            <CouponCard
              key={c.id}
              coupon={c}
              onEdit={() => {
                setEditCoupon(c);
                setEditForm({
                  name: c.name,
                  discount_type: c.discount_type,
                  discount_value: c.discount_value,
                  currency: c.currency || "YER",
                  max_uses: c.max_uses ? String(c.max_uses) : "",
                  max_uses_per_user: c.max_uses_per_user ? String(c.max_uses_per_user) : "",
                  min_order_amount: c.min_order_amount || "",
                  expires_at: toDatetimeLocal(c.expires_at),
                });
              }}
              onStats={() => loadStats(c.id)}
              onactivate={() => {
                activate(c.id);
              }}
              onDeactivate={() => {
                if (confirm(`تعطيل "${c.code}"؟`)) deactivate(c.id);
              }}
            />
          ))}
        </div>
      )}

      {editCoupon && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">
                تعديل: <span className="font-mono text-indigo-600">{editCoupon.code}</span>
              </h3>
              <button onClick={() => setEditCoupon(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">اسم القسيمة</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  className={inp}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">نوع الخصم</label>
                <select
                  value={editForm.discount_type}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, discount_type: e.target.value as DiscountType }))
                  }
                  className={inp}
                >
                  <option value="percentage">نسبة مئوية %</option>
                  <option value="fixed">مبلغ ثابت</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">قيمة الخصم</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.discount_value}
                  onChange={(e) => setEditForm((p) => ({ ...p, discount_value: e.target.value }))}
                  className={inp}
                />
              </div>

              {editForm.discount_type === "fixed" && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">العملة</label>
                  <select
                    value={editForm.currency}
                    onChange={(e) => setEditForm((p) => ({ ...p, currency: e.target.value }))}
                    className={inp}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">أقصى استخدام</label>
                <input
                  type="number"
                  value={editForm.max_uses}
                  onChange={(e) => setEditForm((p) => ({ ...p, max_uses: e.target.value }))}
                  className={inp}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">مرات/مستخدم</label>
                <input
                  type="number"
                  value={editForm.max_uses_per_user}
                  onChange={(e) => setEditForm((p) => ({ ...p, max_uses_per_user: e.target.value }))}
                  className={inp}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">حد أدنى للطلب</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.min_order_amount}
                  onChange={(e) => setEditForm((p) => ({ ...p, min_order_amount: e.target.value }))}
                  className={inp}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">تاريخ الانتهاء</label>
                <input
                  type="datetime-local"
                  value={editForm.expires_at}
                  onChange={(e) => setEditForm((p) => ({ ...p, expires_at: e.target.value }))}
                  className={inp}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setEditCoupon(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
              >
                إلغاء
              </button>

              <button
                onClick={saveEdit}
                disabled={editLoading}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {editLoading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {(statsLoading || stats) && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setStats(null)}>
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-800">إحصائيات الاستخدام</h3>
              <button onClick={() => setStats(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {statsLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-7 h-7 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              stats && (
                <>
                  <div className="text-center mb-5">
                    <span className="font-mono text-xl font-bold bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl inline-block">
                      {stats.code}
                    </span>
                  </div>

                  <div className="space-y-0 divide-y divide-slate-50">
                    {[
                      ["إجمالي الاستخدامات", stats.used_count, "text-slate-800"],
                      ["المستخدمون الفريدون", stats.unique_users, "text-indigo-700"],
                      ["أقصى استخدامات", stats.max_uses ?? "∞", "text-slate-800"],
                      [
                        "الاستخدامات المتبقية",
                        stats.remaining_uses ?? "∞",
                        stats.remaining_uses === 0 ? "text-red-600" : "text-green-700",
                      ],
                    ].map(([l, v, c]) => (
                      <div key={String(l)} className="flex justify-between items-center py-3">
                        <span className="text-sm text-slate-500">{l}</span>
                        <span className={`font-bold ${c}`}>{v}</span>
                      </div>
                    ))}
                  </div>

                  {stats.max_uses && (
                    <div className="mt-4">
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${(stats.used_count / stats.max_uses) >= 0.9 ? "bg-red-400" : "bg-indigo-500"}`}
                          style={{ width: `${Math.min(100, (stats.used_count / stats.max_uses) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 text-center mt-1">
                        {Math.round((stats.used_count / stats.max_uses) * 100)}% مستخدم
                      </p>
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}