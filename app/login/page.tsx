"use client";

import { useMemo, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

type CountryOption = {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
};

const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "YE", name: "اليمن", flag: "🇾🇪", dialCode: "+967" },
  { code: "SA", name: "السعودية", flag: "🇸🇦", dialCode: "+966" },
  { code: "AE", name: "الإمارات", flag: "🇦🇪", dialCode: "+971" },
  { code: "OM", name: "عُمان", flag: "🇴🇲", dialCode: "+968" },
  { code: "QA", name: "قطر", flag: "🇶🇦", dialCode: "+974" },
  { code: "KW", name: "الكويت", flag: "🇰🇼", dialCode: "+965" },
  { code: "BH", name: "البحرين", flag: "🇧🇭", dialCode: "+973" },
  { code: "EG", name: "مصر", flag: "🇪🇬", dialCode: "+20" },
  { code: "JO", name: "الأردن", flag: "🇯🇴", dialCode: "+962" },
  { code: "IQ", name: "العراق", flag: "🇮🇶", dialCode: "+964" },
  { code: "SD", name: "السودان", flag: "🇸🇩", dialCode: "+249" },
  { code: "SY", name: "سوريا", flag: "🇸🇾", dialCode: "+963" },
  { code: "LB", name: "لبنان", flag: "🇱🇧", dialCode: "+961" },
  { code: "PS", name: "فلسطين", flag: "🇵🇸", dialCode: "+970" },
  { code: "LY", name: "ليبيا", flag: "🇱🇾", dialCode: "+218" },
  { code: "TN", name: "تونس", flag: "🇹🇳", dialCode: "+216" },
  { code: "DZ", name: "الجزائر", flag: "🇩🇿", dialCode: "+213" },
  { code: "MA", name: "المغرب", flag: "🇲🇦", dialCode: "+212" },
  { code: "SO", name: "الصومال", flag: "🇸🇴", dialCode: "+252" },
  { code: "DJ", name: "جيبوتي", flag: "🇩🇯", dialCode: "+253" },
  { code: "KM", name: "جزر القمر", flag: "🇰🇲", dialCode: "+269" },
  { code: "MR", name: "موريتانيا", flag: "🇲🇷", dialCode: "+222" },
  { code: "TR", name: "تركيا", flag: "🇹🇷", dialCode: "+90" },
  { code: "IR", name: "إيران", flag: "🇮🇷", dialCode: "+98" },
  { code: "PK", name: "باكستان", flag: "🇵🇰", dialCode: "+92" },
  { code: "IN", name: "الهند", flag: "🇮🇳", dialCode: "+91" },
  { code: "AF", name: "أفغانستان", flag: "🇦🇫", dialCode: "+93" },
  { code: "US", name: "United States", flag: "🇺🇸", dialCode: "+1" },
  { code: "CA", name: "Canada", flag: "🇨🇦", dialCode: "+1" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", dialCode: "+44" },
  { code: "DE", name: "Germany", flag: "🇩🇪", dialCode: "+49" },
  { code: "FR", name: "France", flag: "🇫🇷", dialCode: "+33" },
  { code: "IT", name: "Italy", flag: "🇮🇹", dialCode: "+39" },
  { code: "ES", name: "Spain", flag: "🇪🇸", dialCode: "+34" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", dialCode: "+31" },
  { code: "BE", name: "Belgium", flag: "🇧🇪", dialCode: "+32" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭", dialCode: "+41" },
  { code: "AT", name: "Austria", flag: "🇦🇹", dialCode: "+43" },
  { code: "SE", name: "Sweden", flag: "🇸🇪", dialCode: "+46" },
  { code: "NO", name: "Norway", flag: "🇳🇴", dialCode: "+47" },
  { code: "DK", name: "Denmark", flag: "🇩🇰", dialCode: "+45" },
  { code: "FI", name: "Finland", flag: "🇫🇮", dialCode: "+358" },
  { code: "PL", name: "Poland", flag: "🇵🇱", dialCode: "+48" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", dialCode: "+351" },
  { code: "GR", name: "Greece", flag: "🇬🇷", dialCode: "+30" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿", dialCode: "+420" },
  { code: "HU", name: "Hungary", flag: "🇭🇺", dialCode: "+36" },
  { code: "RO", name: "Romania", flag: "🇷🇴", dialCode: "+40" },
  { code: "SK", name: "Slovakia", flag: "🇸🇰", dialCode: "+421" },
  { code: "HR", name: "Croatia", flag: "🇭🇷", dialCode: "+385" },
  { code: "BG", name: "Bulgaria", flag: "🇧🇬", dialCode: "+359" },
  { code: "RS", name: "Serbia", flag: "🇷🇸", dialCode: "+381" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦", dialCode: "+380" },
  { code: "RU", name: "Russia", flag: "🇷🇺", dialCode: "+7" },
  { code: "KZ", name: "Kazakhstan", flag: "🇰🇿", dialCode: "+7" },
  { code: "AU", name: "Australia", flag: "🇦🇺", dialCode: "+61" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿", dialCode: "+64" },
  { code: "JP", name: "Japan", flag: "🇯🇵", dialCode: "+81" },
  { code: "CN", name: "China", flag: "🇨🇳", dialCode: "+86" },
  { code: "KR", name: "South Korea", flag: "🇰🇷", dialCode: "+82" },
  { code: "TH", name: "Thailand", flag: "🇹🇭", dialCode: "+66" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", dialCode: "+84" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", dialCode: "+62" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾", dialCode: "+60" },
  { code: "SG", name: "Singapore", flag: "🇸🇬", dialCode: "+65" },
  { code: "PH", name: "Philippines", flag: "🇵🇭", dialCode: "+63" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", dialCode: "+880" },
  { code: "LK", name: "Sri Lanka", flag: "🇱🇰", dialCode: "+94" },
  { code: "NP", name: "Nepal", flag: "🇳🇵", dialCode: "+977" },
  { code: "MM", name: "Myanmar", flag: "🇲🇲", dialCode: "+95" },
  { code: "KH", name: "Cambodia", flag: "🇰🇭", dialCode: "+855" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰", dialCode: "+852" },
  { code: "TW", name: "Taiwan", flag: "🇹🇼", dialCode: "+886" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", dialCode: "+234" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", dialCode: "+233" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", dialCode: "+254" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", dialCode: "+27" },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹", dialCode: "+251" },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿", dialCode: "+255" },
  { code: "UG", name: "Uganda", flag: "🇺🇬", dialCode: "+256" },
  { code: "CM", name: "Cameroon", flag: "🇨🇲", dialCode: "+237" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", dialCode: "+225" },
  { code: "SN", name: "Senegal", flag: "🇸🇳", dialCode: "+221" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", dialCode: "+52" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", dialCode: "+55" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", dialCode: "+54" },
  { code: "CL", name: "Chile", flag: "🇨🇱", dialCode: "+56" },
  { code: "CO", name: "Colombia", flag: "🇨🇴", dialCode: "+57" },
  { code: "PE", name: "Peru", flag: "🇵🇪", dialCode: "+51" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪", dialCode: "+58" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨", dialCode: "+593" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴", dialCode: "+591" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾", dialCode: "+595" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾", dialCode: "+598" },
  { code: "IL", name: "Israel", flag: "🇮🇱", dialCode: "+972" },
  { code: "AZ", name: "Azerbaijan", flag: "🇦🇿", dialCode: "+994" },
  { code: "GE", name: "Georgia", flag: "🇬🇪", dialCode: "+995" },
  { code: "AM", name: "Armenia", flag: "🇦🇲", dialCode: "+374" },
  { code: "UZ", name: "Uzbekistan", flag: "🇺🇿", dialCode: "+998" },
  { code: "TM", name: "Turkmenistan", flag: "🇹🇲", dialCode: "+993" },
  { code: "TJ", name: "Tajikistan", flag: "🇹🇯", dialCode: "+992" },
  { code: "KG", name: "Kyrgyzstan", flag: "🇰🇬", dialCode: "+996" },
  { code: "MN", name: "Mongolia", flag: "🇲🇳", dialCode: "+976" },
  { code: "ER", name: "Eritrea", flag: "🇪🇷", dialCode: "+291" },
  { code: "RW", name: "Rwanda", flag: "🇷🇼", dialCode: "+250" },
  { code: "ZM", name: "Zambia", flag: "🇿🇲", dialCode: "+260" },
  { code: "ZW", name: "Zimbabwe", flag: "🇿🇼", dialCode: "+263" },
  { code: "MZ", name: "Mozambique", flag: "🇲🇿", dialCode: "+258" },
  { code: "MW", name: "Malawi", flag: "🇲🇼", dialCode: "+265" },
  { code: "AO", name: "Angola", flag: "🇦🇴", dialCode: "+244" },
  { code: "CD", name: "DR Congo", flag: "🇨🇩", dialCode: "+243" },
  { code: "CG", name: "Congo", flag: "🇨🇬", dialCode: "+242" },
  { code: "SL", name: "Sierra Leone", flag: "🇸🇱", dialCode: "+232" },
  { code: "LR", name: "Liberia", flag: "🇱🇷", dialCode: "+231" },
  { code: "ML", name: "Mali", flag: "🇲🇱", dialCode: "+223" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫", dialCode: "+226" },
  { code: "NE", name: "Niger", flag: "🇳🇪", dialCode: "+227" },
  { code: "TD", name: "Chad", flag: "🇹🇩", dialCode: "+235" },
  { code: "MG", name: "Madagascar", flag: "🇲🇬", dialCode: "+261" },
  { code: "MU", name: "Mauritius", flag: "🇲🇺", dialCode: "+230" },
];

export default function LoginPage() {
  const router = useRouter();

  const [region, setRegion] = useState("YE");
  const [search, setSearch] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const selectedCountry = useMemo(
    () => COUNTRY_OPTIONS.find((c) => c.code === region) ?? COUNTRY_OPTIONS[0],
    [region]
  );

  const filteredCountries = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [search]);

  function selectCountry(code: string) {
    setRegion(code);
    setSearch("");
    setDropdownOpen(false);
  }

  function normalizePhone(value: string) {
    return value.replace(/\s+/g, "").replace(/-/g, "");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cleanedPhone = normalizePhone(phone);
      const data = await api.post<{
        access_token: string;
        refresh_token?: string;
        name: string;
        phone_number: string;
      }>("/auth/login", {
        phone_number: cleanedPhone,
        password,
        region,
      });
      saveAuth(data, region);
      router.replace("/merchant");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4"
      onClick={() => dropdownOpen && setDropdownOpen(false)}
    >
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-600/30">
            <span className="text-2xl">🛒</span>
          </div>
          <h1 className="text-2xl font-bold text-white">SamYemenMarket</h1>
          <p className="text-slate-400 mt-1 text-sm">مركز التجار</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-2 text-center">
            تسجيل الدخول
          </h2>
          <p className="text-sm text-slate-500 text-center mb-6">
            أدخل بيانات التاجر للوصول إلى لوحة التحكم
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                الدولة
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-800 flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-lg leading-none shrink-0">{selectedCountry.flag}</span>
                    <span className="truncate text-sm">{selectedCountry.name}</span>
                    <span className="text-slate-400 text-sm shrink-0 font-mono">
                      ({selectedCountry.code}) {selectedCountry.dialCode}
                    </span>
                  </span>
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${dropdownOpen ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-slate-100 bg-white sticky top-0">
                      <input
                        autoFocus
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="بحث... / Search..."
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                      />
                    </div>
                    <ul className="max-h-56 overflow-y-auto">
                      {filteredCountries.length === 0 ? (
                        <li className="px-4 py-3 text-sm text-slate-400 text-center">
                          لا توجد نتائج
                        </li>
                      ) : (
                        filteredCountries.map((c) => (
                          <li key={c.code}>
                            <button
                              type="button"
                              onClick={() => selectCountry(c.code)}
                              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 flex items-center gap-3 transition-colors ${
                                region === c.code
                                  ? "bg-indigo-50 text-indigo-700 font-medium"
                                  : "text-slate-700"
                              }`}
                            >
                              <span className="text-lg leading-none shrink-0">{c.flag}</span>
                              <span className="flex-1 truncate">{c.name}</span>
                              <span className="text-slate-400 shrink-0 font-mono text-xs">
                                {c.dialCode}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>

              <p className="mt-1 text-xs text-slate-500">
                رمز الدولة: <span className="font-semibold">{selectedCountry.code}</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                رقم الهاتف
              </label>
              <div className="flex items-stretch gap-2">
                <div className="min-w-[72px] px-3 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 text-sm flex items-center justify-center font-mono">
                  {selectedCountry.dialCode}
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="XXXXXXXXX"
                  autoComplete="tel"
                  inputMode="tel"
                  required
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800 bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                كلمة المرور
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800 bg-slate-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  جاري الدخول...
                </>
              ) : (
                "دخول"
              )}
            </button>
          </form>

          <div className="mt-6 text-xs text-slate-400 text-center leading-5">
            سيتم إرسال البيانات إلى الخادم باستخدام{" "}
            <span className="font-semibold">رمز الدولة الحرفي</span> فقط.
          </div>
        </div>
      </div>
    </div>
  );
}
