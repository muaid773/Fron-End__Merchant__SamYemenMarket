"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ─── Types ───────────────────────────────────────────────────
interface StatsData {
  product_count: number; total_stock: number; out_of_stock_count: number;
  low_stock_threshold: number;
  low_stock_list: { product_id: number; name: string; sku: string; stock: number }[];
  completed_sales: Record<string, { orders_count: number; gross_revenue: string; net_revenue_after_commission: string; total_discounts_given: string }>;
  pending_payments: Record<string, { orders_count: number; pending_amount: string }>;
  refunds: Record<string, { count: number; amount: string }>;
}
interface Order { order_id: string; short_code: string; product_name: string; quantity: number; total_price: string; currency: string; status: string; created_at: string | null; }
interface RevenueRow { period: string; currency: string; orders_count: number; gross_revenue: string; net_revenue: string; }

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-slate-100 text-slate-600",
  paid:      "bg-blue-100 text-blue-700",
  shipped:   "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};
const STATUS_LABEL: Record<string, string> = { pending:"معلق", paid:"مدفوع", shipped:"مشحون", delivered:"مُسلَّم", cancelled:"ملغي" };

// ─── KPI Card ────────────────────────────────────────────────
function KpiCard({ label, value, sub, trend, icon, accent }: {
  label: string; value: string | number; sub?: string; trend?: "up"|"down"|"neutral"; icon: React.ReactNode; accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-slate-500 text-xs font-medium mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-slate-800 leading-tight">{value}</p>
        {sub && <p className="text-slate-400 text-[11px] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [chartData, setChartData] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<StatsData>("/merchant/dashboard/stats"),
      api.get<{ items: Order[] }>("/merchant/dashboard/orders?limit=5"),
      api.get<{ data: RevenueRow[] }>("/merchant/dashboard/revenue?period=daily&days=30"),
    ])
      .then(([s, o, r]) => { setStats(s); setRecentOrders(o.items || []); setChartData(r.data || []); })
      .catch((e) => setError(e instanceof ApiError ? e.message : "فشل تحميل البيانات"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error) return <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-600">{error}</div>;
  if (!stats) return null;

  // Process chart data
  const processedChart = chartData.map((r) => ({
    day: r.period ? new Date(r.period).toLocaleDateString("ar-YE", { month: "short", day: "numeric" }) : "",
    إجمالي: parseFloat(r.gross_revenue) || 0,
    صافي: parseFloat(r.net_revenue) || 0,
  }));

  // Total pending orders value
  const totalPending = Object.entries(stats.pending_payments).map(([cur, p]) => `${p.pending_amount} ${cur}`).join(" | ") || null;
  const totalDelivered = Object.entries(stats.completed_sales).reduce((s, [, v]) => s + v.orders_count, 0);

  return (
    <div className="space-y-5">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Link href="/merchant/products/new" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          منتج جديد
        </Link>
        <Link href="/merchant/coupons" className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
          إنشاء قسيمة
        </Link>
        <Link href="/merchant/orders" className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          كل الطلبات
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="إجمالي المنتجات" value={stats.product_count}
          sub={`${stats.total_stock.toLocaleString()} وحدة في المخزون`}
          accent="bg-indigo-100" icon={<svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
        />
        <KpiCard
          label="طلبات مُسلَّمة" value={totalDelivered.toLocaleString()}
          sub="إجمالي المبيعات المكتملة"
          accent="bg-green-100" icon={<svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
        />
        <KpiCard
          label="نفد المخزون" value={stats.out_of_stock_count}
          sub="منتج نشط"
          accent={stats.out_of_stock_count > 0 ? "bg-red-100" : "bg-slate-100"}
          icon={<svg className={`w-5 h-5 ${stats.out_of_stock_count > 0 ? "text-red-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
        <KpiCard
          label="مخزون منخفض" value={stats.low_stock_list.length}
          sub={`أقل من ${stats.low_stock_threshold} وحدات`}
          accent={stats.low_stock_list.length > 0 ? "bg-amber-100" : "bg-slate-100"}
          icon={<svg className={`w-5 h-5 ${stats.low_stock_list.length > 0 ? "text-amber-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>}
        />
      </div>

      {/* Chart + Pending */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">الإيرادات (آخر 30 يوماً)</h3>
            <Link href="/merchant/analytics" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">عرض التحليلات ←</Link>
          </div>
          {processedChart.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">لا توجد بيانات للرسم</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={processedChart} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px", boxShadow: "0 4px 20px rgba(0,0,0,.08)" }} formatter={(v: number) => v.toLocaleString()} />
                <Area type="monotone" dataKey="إجمالي" stroke="#6366f1" strokeWidth={2} fill="url(#gTotal)" dot={false} />
                <Area type="monotone" dataKey="صافي" stroke="#22c55e" strokeWidth={2} fill="url(#gNet)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Revenue Summary by Currency */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col">
          <h3 className="font-semibold text-slate-800 mb-3">ملخص المبيعات</h3>
          {Object.keys(stats.completed_sales).length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">لا توجد مبيعات بعد</div>
          ) : (
            <div className="space-y-3 flex-1">
              {Object.entries(stats.completed_sales).map(([cur, s]) => (
                <div key={cur} className="rounded-xl border border-slate-100 p-3 bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{cur}</span>
                    <span className="text-slate-400 text-xs">{s.orders_count} طلب</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">إجمالي</span>
                      <span className="font-semibold text-slate-800">{s.gross_revenue}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">صافي (بعد العمولة)</span>
                      <span className="font-semibold text-green-700">{s.net_revenue_after_commission}</span>
                    </div>
                    {parseFloat(s.total_discounts_given) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">خصومات</span>
                        <span className="font-semibold text-amber-600">{s.total_discounts_given}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {totalPending && (
                <div className="rounded-xl border border-amber-200 p-3 bg-amber-50">
                  <p className="text-[11px] text-amber-700 font-medium mb-0.5">قيد التسليم</p>
                  <p className="text-sm font-bold text-amber-800">{totalPending}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Orders */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">آخر الطلبات</h3>
            <Link href="/merchant/orders" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">عرض الكل ←</Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">لا توجد طلبات بعد</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentOrders.map((o) => (
                <div key={o.order_id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{o.short_code}</span>
                      <span className="text-sm text-slate-700 font-medium truncate max-w-[130px]">{o.product_name}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {o.created_at ? new Date(o.created_at).toLocaleDateString("ar-YE", { day: "numeric", month: "short" }) : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-semibold text-slate-800">{o.total_price} <span className="text-xs text-slate-400">{o.currency}</span></span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[o.status] || "bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABEL[o.status] || o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock + Refunds */}
        <div className="space-y-4">
          {stats.low_stock_list.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-amber-200/60 flex items-center justify-between">
                <h3 className="text-amber-800 font-semibold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  مخزون منخفض
                </h3>
                <Link href="/merchant/products" className="text-[11px] text-amber-700 hover:underline font-medium">إدارة ←</Link>
              </div>
              <div className="divide-y divide-amber-200/40">
                {stats.low_stock_list.map((p) => (
                  <div key={p.product_id} className="px-5 py-2.5 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-amber-900">{p.name}</span>
                      <span className="text-amber-600 text-[11px] mr-1.5">({p.sku})</span>
                    </div>
                    <span className="text-xs font-bold bg-amber-200 text-amber-800 px-2.5 py-1 rounded-full">{p.stock} متبقي</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(stats.refunds).length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-800 mb-3 text-sm flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                مستردات ملغاة
              </h3>
              {Object.entries(stats.refunds).map(([cur, r]) => (
                <div key={cur} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                  <span className="text-sm text-slate-600">{r.count} طلب ({cur})</span>
                  <span className="font-semibold text-red-600 text-sm">{r.amount}</span>
                </div>
              ))}
            </div>
          )}

          {stats.low_stock_list.length === 0 && Object.keys(stats.refunds).length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
              <div className="text-2xl mb-2">✅</div>
              <p className="text-green-700 font-medium text-sm">كل شيء على ما يرام!</p>
              <p className="text-green-600 text-xs mt-1">لا تنبيهات أو مشاكل</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
