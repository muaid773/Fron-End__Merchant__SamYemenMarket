"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface WalletBalance {
  currency: string;
  balance: string;
  pending_balance: string;
}

interface WalletResponse {
  status: "ok" | "bad";
  wallet_id: string;
  user_id: string;
  created_at: string;
  balances: WalletBalance[];
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWallet = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await api.get<WalletResponse>("/wallet");
      setWallet(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "فشل تحميل المحفظة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center">
        {error}
      </div>
    );
  }

  if (!wallet || wallet.status !== "ok") {
    return (
      <div className="text-center text-slate-500">
        لا توجد محفظة لهذا المستخدم
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">المحفظة المالية</h1>
        <p className="text-sm text-slate-500">إدارة أرصدة الحساب والعملات</p>
      </div>

      {/* Wallet Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border rounded-2xl p-4">
          <p className="text-xs text-slate-500">رقم المحفظة</p>
          <p className="font-bold text-slate-800">{wallet.wallet_id}</p>
        </div>

        <div className="bg-white border rounded-2xl p-4">
          <p className="text-xs text-slate-500">المستخدم</p>
          <p className="font-bold text-slate-800">{wallet.user_id}</p>
        </div>

        <div className="bg-white border rounded-2xl p-4">
          <p className="text-xs text-slate-500">عدد العملات</p>
          <p className="font-bold text-indigo-600">
            {wallet.balances.length}
          </p>
        </div>
      </div>

      {/* Balances */}
      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-slate-800">الأرصدة</h2>
        </div>

        <div className="divide-y">
          {wallet.balances.map((b) => (
            <div
              key={b.currency}
              className="flex items-center justify-between p-4 hover:bg-slate-50"
            >
              <div>
                <p className="font-bold text-slate-800">{b.currency}</p>
                <p className="text-xs text-slate-500">
                  متاح + معلق
                </p>
              </div>

              <div className="text-right">
                <p className="text-lg font-bold text-slate-800">
                  {b.balance}
                </p>
                <p className="text-xs text-amber-600">
                  pending: {b.pending_balance}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl p-5">
        <p className="text-sm opacity-80">ملخص المحفظة</p>
        <p className="text-2xl font-bold mt-1">
          {wallet.balances.reduce((acc, b) => acc + parseFloat(b.balance), 0).toFixed(2)}
        </p>
        <p className="text-xs opacity-80 mt-1">
          إجمالي الأرصدة (بدون تحويل عملات)
        </p>
      </div>
    </div>
  );
}