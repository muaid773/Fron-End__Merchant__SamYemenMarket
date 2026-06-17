"use client";
import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

interface RevenueRow { period: string; currency: string; orders_count: number; gross_revenue: string; net_revenue: string; }
interface TopProduct { product_id: number; product_name: string; currency: string; orders_count: number; units_sold: number; gross_revenue: string; net_revenue: string; }
interface Analytics { product_id: number; product_name: string; currency: string; orders_count: number; units_sold: number; gross_revenue: string; net_revenue: string; discounts_given: string; }

const PERIODS = [["daily","يومي"],["weekly","أسبوعي"],["monthly","شهري"]] as const;
const DAYS_OPTIONS = [[7,"٧ أيام"],[30,"٣٠ يوم"],[90,"٩٠ يوم"],[365,"سنة"]] as const;

function MetricCard({ label, value, sub, color = "text-slate-800" }: { label:string; value:string|number; sub?:string; color?:string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <p className="text-slate-500 text-xs font-medium mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-slate-400 text-[11px] mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<"daily"|"weekly"|"monthly">("daily");
  const [days, setDays] = useState(30);
  const [revenue, setRevenue] = useState<RevenueRow[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [analytics, setAnalytics] = useState<Analytics[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [productAnalytics, setProductAnalytics] = useState<Analytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartType, setChartType] = useState<"area"|"bar">("area");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [rev, top, ana] = await Promise.all([
        api.get<{ data: RevenueRow[] }>(`/merchant/dashboard/revenue?period=${period}&days=${days}`),
        api.get<{ products: TopProduct[] }>(`/merchant/dashboard/top-products?limit=10&period_days=${days}`),
        api.get<Analytics[]>("/merchant/dashboard/product-analytics?limit=10&offset=0"),
      ]);
      setRevenue(rev.data || []);
      setTopProducts(top.products || []);
      setAnalytics(ana || []);
      setProductAnalytics([]);
      setSelectedProduct(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "فشل تحميل التحليلات");
    } finally { setLoading(false); }
  }, [period, days]);

  useEffect(() => { load(); }, [load]);

  async function drillDown(productId: number) {
    if (selectedProduct === productId) { setSelectedProduct(null); setProductAnalytics([]); return; }
    setSelectedProduct(productId);
    try {
      const res = await api.get<Analytics[]>(`/merchant/dashboard/product-analytics?product_id=${productId}`);
      setProductAnalytics(res || []);
    } catch { setProductAnalytics([]); }
  }

  // Aggregate revenue metrics
  const totalGross = revenue.reduce((s, r) => s + parseFloat(r.gross_revenue), 0);
  const totalNet = revenue.reduce((s, r) => s + parseFloat(r.net_revenue), 0);
  const totalOrders = revenue.reduce((s, r) => s + r.orders_count, 0);
  const avgOrder = totalOrders > 0 ? (totalGross / totalOrders).toFixed(2) : "0";

  // Build chart data (group by period label)
  const chartMap: Record<string, Record<string, number>> = {};
  revenue.forEach((r) => {
    const label = r.period
      ? new Date(r.period).toLocaleDateString("ar-YE", period === "monthly" ? { month: "short" } : { month: "short", day: "numeric" })
      : "";
    if (!chartMap[label]) chartMap[label] = {};
    chartMap[label][`إجمالي`] = (chartMap[label][`إجمالي`] || 0) + parseFloat(r.gross_revenue);
    chartMap[label][`صافي`] = (chartMap[label][`صافي`] || 0) + parseFloat(r.net_revenue);
  });
  const chartData = Object.entries(chartMap).map(([label, vals]) => ({ label, ...vals }));

  // Top product bar chart
  const topChartData = topProducts.slice(0, 8).map((p) => ({
    name: p.product_name.length > 12 ? p.product_name.slice(0, 12) + "…" : p.product_name,
    إجمالي: parseFloat(p.gross_revenue),
    صافي: parseFloat(p.net_revenue),
  }));

  const currencies = [...new Set(revenue.map(r => r.currency))];

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          {PERIODS.map(([v, l]) => (
            <button key={v} onClick={() => setPeriod(v)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${period===v ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>{l}</button>
          ))}
        </div>
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          {DAYS_OPTIONS.map(([v, l]) => (
            <button key={v} onClick={() => setDays(v as number)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${days===v ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>{l}</button>
          ))}
        </div>
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          {[["area","منطقة"],["bar","أعمدة"]].map(([v,l]) => (
            <button key={v} onClick={() => setChartType(v as "area"|"bar")}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${chartType===v ? "bg-slate-800 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-600">{error}</div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="إجمالي الإيرادات" value={totalGross.toLocaleString()} sub={currencies.join(" / ")} />
            <MetricCard label="صافي الإيرادات" value={totalNet.toLocaleString()} color="text-green-700" sub="بعد العمولة" />
            <MetricCard label="عدد المعاملات" value={totalOrders.toLocaleString()} sub={`آخر ${days} يوم`} />
            <MetricCard label="متوسط قيمة الطلب" value={avgOrder} sub={currencies[0] || ""} />
          </div>

          {/* Revenue Chart */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-4">الإيرادات عبر الزمن</h3>
            {chartData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-slate-400">لا توجد بيانات للفترة المحددة</div>
            ) : chartType === "area" ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top:5, right:5, left:-10, bottom:0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize:10, fill:"#94a3b8" }} tickLine={false} />
                  <YAxis tick={{ fontSize:10, fill:"#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius:"12px", border:"1px solid #e2e8f0", fontSize:"12px" }} formatter={(v:number)=>v.toLocaleString()} />
                  <Legend wrapperStyle={{ fontSize:"12px" }} />
                  <Area type="monotone" dataKey="إجمالي" stroke="#6366f1" strokeWidth={2} fill="url(#g1)" dot={false} />
                  <Area type="monotone" dataKey="صافي" stroke="#22c55e" strokeWidth={2} fill="url(#g2)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top:5, right:5, left:-10, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize:10, fill:"#94a3b8" }} tickLine={false} />
                  <YAxis tick={{ fontSize:10, fill:"#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius:"12px", border:"1px solid #e2e8f0", fontSize:"12px" }} formatter={(v:number)=>v.toLocaleString()} />
                  <Legend wrapperStyle={{ fontSize:"12px" }} />
                  <Bar dataKey="إجمالي" fill="#6366f1" radius={[4,4,0,0]} />
                  <Bar dataKey="صافي" fill="#22c55e" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Products Chart */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-800 mb-4">أكثر المنتجات مبيعاً</h3>
              {topChartData.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-slate-400 text-sm">لا توجد بيانات</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topChartData} layout="vertical" margin={{ top:0, right:10, left:0, bottom:0 }}>
                    <XAxis type="number" tick={{ fontSize:10, fill:"#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize:10, fill:"#64748b" }} tickLine={false} width={80} />
                    <Tooltip contentStyle={{ borderRadius:"10px", border:"1px solid #e2e8f0", fontSize:"11px" }} formatter={(v:number)=>v.toLocaleString()} />
                    <Bar dataKey="إجمالي" fill="#6366f1" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top Products Table */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-800 mb-4">تفاصيل المنتجات (اضغط للتفصيل)</h3>
              {topProducts.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-slate-400 text-sm">لا توجد بيانات</div>
              ) : (
                <div className="space-y-1.5 overflow-y-auto max-h-52">
                  {topProducts.map((p, i) => (
                    <button key={p.product_id} onClick={() => drillDown(p.product_id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors ${selectedProduct === p.product_id ? "bg-indigo-50 border border-indigo-200" : "hover:bg-slate-50"}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs text-slate-400 font-bold w-5 flex-shrink-0">#{i+1}</span>
                        <span className="text-sm font-medium text-slate-800 truncate">{p.product_name}</span>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="text-sm font-semibold text-slate-800">{p.gross_revenue}</p>
                        <p className="text-[11px] text-slate-400">{p.orders_count} طلب</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Product Drilldown */}
          {selectedProduct && productAnalytics.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-indigo-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">
                  تفاصيل: <span className="text-indigo-600">{productAnalytics[0]?.product_name}</span>
                </h3>
                <button onClick={() => { setSelectedProduct(null); setProductAnalytics([]); }} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {productAnalytics.map((a) => (
                  <div key={`${a.product_id}-${a.currency}`} className="bg-indigo-50 rounded-xl p-3.5">
                    <p className="text-xs text-indigo-600 font-semibold mb-2">{a.currency}</p>
                    <p className="text-lg font-bold text-indigo-800">{a.gross_revenue}</p>
                    <p className="text-[11px] text-indigo-600 mt-1">
                      {a.orders_count} طلب · {a.units_sold} وحدة
                    </p>
                    <p className="text-[11px] text-green-700 mt-0.5">صافي: {a.net_revenue}</p>
                    {parseFloat(a.discounts_given) > 0 && <p className="text-[11px] text-amber-600 mt-0.5">خصومات: {a.discounts_given}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Analytics Table */}
          {analytics.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800">جدول المنتجات الكامل</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>{["المنتج","طلبات","وحدات","إجمالي","صافي","خصومات","العملة"].map((h)=>(
                      <th key={h} className="text-right text-xs text-slate-500 font-semibold px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {analytics.map((a,i) => (
                      <tr key={`${a.product_id}-${a.currency}-${i}`} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800 max-w-[160px] truncate">{a.product_name}</td>
                        <td className="px-4 py-3 text-slate-600 text-center">{a.orders_count}</td>
                        <td className="px-4 py-3 text-slate-600 text-center">{a.units_sold}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{a.gross_revenue}</td>
                        <td className="px-4 py-3 font-semibold text-green-700">{a.net_revenue}</td>
                        <td className="px-4 py-3 text-amber-600">{a.discounts_given}</td>
                        <td className="px-4 py-3"><span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{a.currency}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
