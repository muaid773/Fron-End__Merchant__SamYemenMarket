"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api";

interface Order {
  order_id: string; short_code: string; product_name: string; quantity: number;
  subtotal_price: string; total_price: string; discount_amount: string;
  merchant_amount: string | null; currency: string; status: string;
  payment_status: string; created_at: string | null; paid_at: string | null;
}
interface FeedState { total: number; has_more: boolean; next_cursor: string | null; }

const POLL_INTERVAL_MS = 30_000;

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-slate-100 text-slate-600",
  paid:      "bg-blue-100 text-blue-700",
  shipped:   "bg-violet-100 text-violet-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};
const STATUS_LABEL: Record<string, string> = { pending:"معلق", paid:"مدفوع", shipped:"مشحون", delivered:"مُسلَّم", cancelled:"ملغي" };
const PAYMENT_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700", success: "bg-green-50 text-green-700", failed: "bg-red-50 text-red-600", refunded: "bg-purple-50 text-purple-700",
};
const PAYMENT_LABEL: Record<string, string> = { pending:"معلق", success:"مكتمل", failed:"فشل", refunded:"مُسترد" };

const STATUS_TABS = [
  { v: "",           l: "الكل" },
  { v: "pending",    l: "معلق" },
  { v: "paid",       l: "مدفوع" },
  { v: "shipped",    l: "مشحون" },
  { v: "delivered",  l: "مُسلَّم" },
  { v: "cancelled",  l: "ملغي" },
];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ar-YE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtShort(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ar-YE", { day: "numeric", month: "short" });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString("ar-YE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ─── Order Detail Slide-over ─────────────────────────────────
function OrderDetail({ order, onClose }: { order: Order; onClose: () => void }) {
  const steps = ["pending", "paid", "shipped", "delivered"];
  const currentStep = steps.indexOf(order.status);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-[slideInRight_0.25s_ease-out]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-bold">{order.short_code}</span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[order.status]}`}>{STATUS_LABEL[order.status]}</span>
            </div>
            <p className="text-slate-400 text-xs mt-1">{fmtDate(order.created_at)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {order.status !== "cancelled" && (
            <div>
              <h4 className="text-xs text-slate-500 font-semibold mb-3 uppercase tracking-wide">حالة الطلب</h4>
              <div className="flex items-center gap-0">
                {steps.map((s, i) => (
                  <div key={s} className="flex items-center flex-1 last:flex-none">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${i <= currentStep ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                      {i < currentStep ? "✓" : i + 1}
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 rounded ${i < currentStep ? "bg-indigo-600" : "bg-slate-100"}`} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                {steps.map((s) => <span key={s} className="text-[10px] text-slate-400 flex-1 text-center first:text-right last:text-left">{STATUS_LABEL[s]}</span>)}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs text-slate-500 font-semibold mb-2 uppercase tracking-wide">المنتج</h4>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="font-semibold text-slate-800">{order.product_name}</p>
              <p className="text-slate-500 text-sm mt-1">الكمية: <span className="font-medium text-slate-700">{order.quantity}</span></p>
            </div>
          </div>

          <div>
            <h4 className="text-xs text-slate-500 font-semibold mb-2 uppercase tracking-wide">تفاصيل السعر</h4>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">السعر الأساسي</span>
                <span className="font-medium text-slate-800">{order.subtotal_price} {order.currency}</span>
              </div>
              {parseFloat(order.discount_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">الخصم</span>
                  <span className="font-medium text-amber-600">-{order.discount_amount} {order.currency}</span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-2.5 flex justify-between text-sm font-semibold">
                <span className="text-slate-700">المجموع الكلي</span>
                <span className="text-slate-900">{order.total_price} {order.currency}</span>
              </div>
              {order.merchant_amount && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">صافي التاجر</span>
                  <span className="font-bold text-green-700">{order.merchant_amount} {order.currency}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-xs text-slate-500 font-semibold mb-2 uppercase tracking-wide">الدفع</h4>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">حالة الدفع</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PAYMENT_STYLE[order.payment_status] || "bg-slate-100 text-slate-600"}`}>
                  {PAYMENT_LABEL[order.payment_status] || order.payment_status}
                </span>
              </div>
              {order.paid_at && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">تاريخ الدفع</span>
                  <span className="text-slate-700">{fmtDate(order.paid_at)}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-xs text-slate-500 font-semibold mb-2 uppercase tracking-wide">المعرّفات</h4>
            <div className="bg-slate-50 rounded-xl p-4 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">رمز الطلب</span>
                <span className="font-mono text-xs text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded">{order.short_code}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">UUID</span>
                <span className="font-mono text-[10px] text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded truncate max-w-[180px]">{order.order_id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [feed, setFeed] = useState<FeedState>({ total: 0, has_more: false, next_cursor: null });
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [polling, setPolling] = useState(true);

  const statusRef = useRef(status);
  statusRef.current = status;

  const loadPage = useCallback(async (stat: string, cursor: string | null, append = false) => {
    if (append) setLoadingMore(true);
    else { setLoading(true); setError(""); }
    try {
      const params = new URLSearchParams({ limit: "10" });
      if (stat) params.set("status", stat);
      if (cursor) params.set("cursor", cursor);
      const res = await api.get<{ items: Order[]; total: number; has_more: boolean; next_cursor: string | null }>(
        `/merchant/dashboard/orders?${params}`
      );
      const items = res.items || [];
      setOrders((prev) => append ? [...prev, ...items] : items);
      setFeed({ total: res.total ?? 0, has_more: res.has_more ?? false, next_cursor: res.next_cursor ?? null });
      setLastRefreshed(new Date());
    } catch (e) {
      if (!append) setError(e instanceof ApiError ? e.message : "فشل تحميل الطلبات");
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  const silentRefresh = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "10" });
      if (statusRef.current) params.set("status", statusRef.current);
      const res = await api.get<{ items: Order[]; total: number; has_more: boolean; next_cursor: string | null }>(
        `/merchant/dashboard/orders?${params}`
      );
      setOrders(res.items || []);
      setFeed({ total: res.total ?? 0, has_more: res.has_more ?? false, next_cursor: res.next_cursor ?? null });
      setLastRefreshed(new Date());
    } catch {
      // silent — don't disrupt UI on background poll error
    }
  }, []);

  // Load tab counts
  useEffect(() => {
    Promise.all(
      ["pending","paid","shipped","delivered","cancelled"].map((s) =>
        api.get<{ total: number }>(`/merchant/dashboard/orders?status=${s}&limit=1`)
          .then((r) => [s, r.total || 0] as [string, number])
          .catch(() => [s, 0] as [string, number])
      )
    ).then((results) => {
      const c: Record<string, number> = {};
      results.forEach(([s, n]) => { c[s] = n; });
      setCounts(c);
    });
  }, []);

  // Initial load when status tab changes
  useEffect(() => {
    setOrders([]);
    setFeed({ total: 0, has_more: false, next_cursor: null });
    loadPage(status, null, false);
  }, [status, loadPage]);

  // Polling interval
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(() => {
      silentRefresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [polling, silentRefresh]);

  const displayed = search
    ? orders.filter((o) => o.short_code.toLowerCase().includes(search.toLowerCase()) || o.product_name.toLowerCase().includes(search.toLowerCase()))
    : orders;

  return (
    <div className="space-y-4">
      {selected && <OrderDetail order={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-slate-800 font-bold text-lg">الطلبات</h2>
          {!loading && <span className="text-slate-400 text-sm bg-slate-100 px-2 py-0.5 rounded-full">{feed.total}</span>}
        </div>
        <div className="flex items-center gap-2">
          {lastRefreshed && (
            <span className="text-xs text-slate-400">
              آخر تحديث: {fmtTime(lastRefreshed)}
            </span>
          )}
          <button
            onClick={() => setPolling((p) => !p)}
            title={polling ? "إيقاف التحديث التلقائي" : "تفعيل التحديث التلقائي"}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${polling ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${polling ? "bg-green-500 animate-pulse" : "bg-slate-400"}`} />
            {polling ? "تحديث تلقائي" : "متوقف"}
          </button>
          <button
            onClick={() => loadPage(status, null, false)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            تحديث
          </button>
        </div>
      </div>

      {/* Status summary */}
      {Object.keys(counts).length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {["pending","paid","shipped","delivered","cancelled"].map((s) => (
            <button key={s} onClick={() => setStatus(s === status ? "" : s)}
              className={`text-center p-3 rounded-xl border transition-colors ${status === s ? "border-indigo-400 bg-indigo-50" : "bg-white border-slate-100 hover:border-slate-200"}`}>
              <p className={`text-lg font-bold ${status === s ? "text-indigo-700" : "text-slate-800"}`}>{counts[s] ?? 0}</p>
              <p className={`text-xs ${status === s ? "text-indigo-600" : "text-slate-500"}`}>{STATUS_LABEL[s]}</p>
            </button>
          ))}
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث برمز الطلب أو اسم المنتج..."
            className="w-full pr-9 pl-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
          {search && <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">×</button>}
        </div>
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto">
          {STATUS_TABS.map((t) => (
            <button key={t.v} onClick={() => { setStatus(t.v); setSearch(""); }}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors whitespace-nowrap ${status === t.v ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : displayed.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            </div>
            <p className="text-slate-500">{search ? "لا نتائج للبحث" : "لا توجد طلبات"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {["رمز الطلب","المنتج","الكمية","الإجمالي","صافي التاجر","الحالة","التاريخ"].map((h) => (
                    <th key={h} className="text-right text-xs text-slate-500 font-semibold px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {displayed.map((o) => (
                  <tr key={o.order_id} onClick={() => setSelected(o)}
                    className="hover:bg-indigo-50/40 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-bold">{o.short_code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 max-w-[160px] truncate">{o.product_name}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-center">{o.quantity}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                      {o.total_price} <span className="text-xs text-slate-400">{o.currency}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-green-700 whitespace-nowrap">
                      {o.merchant_amount ?? <span className="text-slate-300 font-normal">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[o.status] || "bg-slate-100 text-slate-600"}`}>
                        {STATUS_LABEL[o.status] || o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtShort(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !search && feed.has_more && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-center">
            <button
              onClick={() => loadPage(status, feed.next_cursor, true)}
              disabled={loadingMore}
              className="px-5 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-2"
            >
              {loadingMore && <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />}
              تحميل المزيد
            </button>
          </div>
        )}
      </div>

      {search && displayed.length > 0 && (
        <p className="text-xs text-slate-400 text-center">البحث في الصفحة الحالية فقط ({orders.length} طلب)</p>
      )}
    </div>
  );
}
