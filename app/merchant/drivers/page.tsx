"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";

type DriverStatus = "active" | "suspended" | "deleted" | string;

type DriverMeta = {
  merchant_id?: string;
  chat_id?: string | null;
  is_activated?: boolean;
  step?: string;
};

type Driver = {
  id: string;
  name: string;
  phone_number: string;
  status: DriverStatus;
  role?: string;
  meta_data?: DriverMeta;
  created_at?: string;
  updated_at?: string;
};

type DriverCreateResponse =
  | {
      success: boolean;
      message: string;
    }
  | Driver;

const REGIONS = [
  { value: "YE", label: "اليمن (+967)", code: "+967" },
  { value: "SA", label: "السعودية (+966)", code: "+966" },
  { value: "AE", label: "الإمارات (+971)", code: "+971" },
] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "الكل" },
  { value: "active", label: "نشط" },
  { value: "suspended", label: "معلّق" },
  { value: "deleted", label: "محذوف" },
] as const;

function getStatusLabel(status: string) {
  switch (status) {
    case "active":
      return "نشط";
    case "suspended":
      return "معلّق";
    case "deleted":
      return "محذوف";
    default:
      return status;
  }
}

function getStatusClasses(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "suspended":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "deleted":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export default function DriversPage() {
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState<(typeof REGIONS)[number]["value"]>("YE");

  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]["value"]>("all");

  async function loadDrivers() {
    setLoadingList(true);
    setError("");

    try {
      const res = await api.get<Driver[]>("/merchant/drivers");
      setDrivers(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر تحميل قائمة السائقين");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    void loadDrivers();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSuccess(null);
    setError("");
    setLoadingCreate(true);

    try {
      const res = await api.post<DriverCreateResponse>("/merchant/drivers", {
        phone_number: phone.trim(),
        region,
      });

      if (res && typeof res === "object" && "success" in res && "message" in res) {
        setSuccess(res.message || "تم تسجيل السائق بنجاح");
      } else {
        setSuccess("تم تسجيل السائق بنجاح");
      }

      setPhone("");
      await loadDrivers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "فشل تسجيل السائق");
    } finally {
      setLoadingCreate(false);
    }
  }

  async function activateDriver(driverId: string) {
    setError("");
    setSuccess(null);
    setActionId(driverId);

    try {
      await api.patch<{ success: boolean; message?: string }>(`/merchant/drivers/${driverId}/activate`, {});
      setSuccess("تم تفعيل السائق بنجاح");
      await loadDrivers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "فشل تفعيل السائق");
    } finally {
      setActionId(null);
    }
  }

  async function suspendDriver(driverId: string) {
    setError("");
    setSuccess(null);
    setActionId(driverId);

    try {
      await api.patch<{ success: boolean; message?: string }>(`/merchant/drivers/${driverId}/suspend`, {});
      setSuccess("تم تعليق السائق بنجاح");
      await loadDrivers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "فشل تعليق السائق");
    } finally {
      setActionId(null);
    }
  }

  async function deleteDriver(driverId: string) {
    const confirmed = window.confirm("هل تريد حذف السائق؟ سيتم تنفيذ حذف/أرشفة بحسب إعدادات الخادم.");
    if (!confirmed) return;

    setError("");
    setSuccess(null);
    setActionId(driverId);

    try {
      await api.delete<{ success: boolean; message?: string }>(`/merchant/drivers/${driverId}`);
      setSuccess("تم حذف السائق بنجاح");
      await loadDrivers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "فشل حذف السائق");
    } finally {
      setActionId(null);
    }
  }

  const filteredDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return drivers.filter((driver) => {
      const matchesSearch =
        !q ||
        driver.name?.toLowerCase().includes(q) ||
        driver.phone_number?.toLowerCase().includes(q) ||
        driver.id?.toLowerCase().includes(q);

      const matchesStatus = statusFilter === "all" ? true : driver.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [drivers, search, statusFilter]);

  const stats = useMemo(() => {
    const active = drivers.filter((d) => d.status === "active").length;
    const suspended = drivers.filter((d) => d.status === "suspended").length;
    const deleted = drivers.filter((d) => d.status === "deleted").length;

    return { total: drivers.length, active, suspended, deleted };
  }, [drivers]);

  const inp =
    "w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 bg-slate-50 text-sm";
  const actionBtn =
    "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-slate-800 font-bold text-2xl">إدارة السائقين</h2>
        <p className="text-slate-500 text-sm">
          تسجيل السائقين، عرض القائمة، التفعيل، التعليق، والحذف مع التوافق مع التحديثات الجديدة.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500">الإجمالي</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500">النشطون</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500">المعلّقون</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{stats.suspended}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500">المحذوفون</p>
          <p className="text-2xl font-bold text-slate-600 mt-1">{stats.deleted}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
            {success}
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">المنطقة / الدولة</label>
            <select value={region} onChange={(e) => setRegion(e.target.value as (typeof REGIONS)[number]["value"])} className={inp}>
              {REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">رقم الهاتف</label>
            <div className="relative">
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                {REGIONS.find((r) => r.value === region)?.code}
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="7XXXXXXXX"
                className={`${inp} pr-16`}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">أدخل الرقم بدون رمز الدولة.</p>
          </div>

          <button
            type="submit"
            disabled={loadingCreate}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            {loadingCreate ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                جاري التسجيل...
              </>
            ) : (
              "تسجيل السائق"
            )}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">بحث</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الرقم أو المعرّف"
              className={inp}
            />
          </div>

          <div className="md:w-56">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">الحالة</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className={inp}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:self-end">
            <button
              type="button"
              onClick={() => void loadDrivers()}
              disabled={loadingList}
              className={`${actionBtn} bg-slate-900 text-white hover:bg-slate-800 px-4 py-3`}
            >
              {loadingList ? "جاري التحديث..." : "تحديث القائمة"}
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-slate-700 font-semibold text-sm">قائمة السائقين</h4>
            <span className="text-xs text-slate-500">{filteredDrivers.length} نتيجة</span>
          </div>

          {loadingList ? (
            <div className="text-sm text-slate-500 py-10 text-center">جاري تحميل البيانات...</div>
          ) : filteredDrivers.length === 0 ? (
            <div className="text-sm text-slate-500 py-10 text-center">لا توجد نتائج مطابقة.</div>
          ) : (
            <div className="space-y-3">
              {filteredDrivers.map((driver) => {
                const isBusy = actionId === driver.id;
                const isActivated = Boolean(driver.meta_data?.is_activated);

                return (
                  <div
                    key={driver.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="font-semibold text-slate-800">{driver.name}</h5>
                        <span className={`text-xs px-2 py-1 rounded-full border ${getStatusClasses(driver.status)}`}>
                          {getStatusLabel(driver.status)}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full border ${
                            isActivated
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {isActivated ? "مفعّل عبر البوت" : "غير مفعّل"}
                        </span>
                      </div>

                      <div className="text-sm text-slate-600 space-y-1">
                        <p>
                          <span className="font-medium">الهاتف:</span> {driver.phone_number}
                        </p>
                        <p className="break-all">
                          <span className="font-medium">ID:</span> {driver.id}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {driver.status !== "active" && (
                        <button
                          type="button"
                          onClick={() => void activateDriver(driver.id)}
                          disabled={isBusy}
                          className={`${actionBtn} bg-emerald-600 text-white hover:bg-emerald-700`}
                        >
                          {isBusy ? "..." : "تفعيل"}
                        </button>
                      )}

                      {driver.status !== "suspended" && driver.status !== "deleted" && (
                        <button
                          type="button"
                          onClick={() => void suspendDriver(driver.id)}
                          disabled={isBusy}
                          className={`${actionBtn} bg-amber-500 text-white hover:bg-amber-600`}
                        >
                          {isBusy ? "..." : "تعليق"}
                        </button>
                      )}

                      {driver.status !== "deleted" && (
                        <button
                          type="button"
                          onClick={() => void deleteDriver(driver.id)}
                          disabled={isBusy}
                          className={`${actionBtn} bg-rose-600 text-white hover:bg-rose-700`}
                        >
                          {isBusy ? "..." : "حذف"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h4 className="text-slate-700 font-semibold text-sm mb-4">آلية العمل</h4>
        <div className="space-y-3">
          {[
            {
              n: "١",
              title: "تسجيل الرقم",
              desc: "يتم إنشاء حساب السائق بحالة معلّقة وربطه بالتاجر داخل النظام.",
            },
            {
              n: "٢",
              title: "التفعيل عبر البوت",
              desc: "يكمل السائق ربط حسابه من خلال بوت التيليجرام والتحقق من الرقم.",
            },
            {
              n: "٣",
              title: "تغيير الحالة",
              desc: "يمكن للتاجر تفعيل السائق أو تعليقه حسب الحاجة من نفس الصفحة.",
            },
            {
              n: "٤",
              title: "الإدارة الكاملة",
              desc: "يمكن البحث، التحديث، والحذف/الأرشفة من القائمة مباشرة.",
            },
          ].map(({ n, title, desc }) => (
            <div key={n} className="flex items-start gap-3">
              <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0 mt-0.5">
                {n}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">{title}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}