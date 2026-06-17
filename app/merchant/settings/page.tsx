"use client";

import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";

interface Address {
  id: number;
  latitude: string;
  longitude: string;
  note: string;
  is_default?: boolean;
}

type AuthUser = {
  name?: string;
  phone_number?: string;
};

type ToastState = { msg: string; type: "success" | "error" } | null;

type GeoFeature = {
  place_name: string;
  lat: string;
  lon: string;
};

const ADDR_EMPTY = { latitude: "", longitude: "", note: "" };
const DEFAULT_LAT = 15.3547;
const DEFAULT_LNG = 44.2066;

function Toast({
  msg,
  type,
  onClose,
}: {
  msg: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-medium ${
        type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
      }`}
    >
      {type === "success" ? "✓" : "✗"} {msg}
    </div>
  );
}

function MapPicker({
  initialLat,
  initialLng,
  onConfirm,
  onClose,
}: {
  initialLat: number;
  initialLng: number;
  onConfirm: (lat: number, lng: number, label?: string) => void;
  onClose: () => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<GeoFeature[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string>("");

  function round7(n: number) {
    return Math.round(n * 1e7) / 1e7;
  }

  function syncMarker(newLat: number, newLng: number, zoom = 14) {
    const safeLat = round7(newLat);
    const safeLng = round7(newLng);

    setLat(safeLat);
    setLng(safeLng);

    if (markerRef.current) {
      markerRef.current.setLatLng([safeLat, safeLng]);
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.easeTo({
        center: [safeLng, safeLat],
        zoom,
        duration: 350,
      });
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      try {
        const L = await import("leaflet");

        if (cancelled || !mapRef.current || mapInstanceRef.current) return;

        const markerIcon = L.divIcon({
          className: "",
          html: `
            <div style="
              width: 18px;
              height: 18px;
              border-radius: 9999px;
              background: #4f46e5;
              border: 3px solid white;
              box-shadow: 0 8px 18px rgba(79, 70, 229, 0.35);
            "></div>
          `,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        const map = L.map(mapRef.current, {
          zoomControl: true,
        }).setView([initialLat, initialLng], 13);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([initialLat, initialLng], {
          draggable: true,
          icon: markerIcon,
        }).addTo(map);

        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          setLat(round7(pos.lat));
          setLng(round7(pos.lng));
        });

        map.on("click", (e: any) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          setLat(round7(lat));
          setLng(round7(lng));
        });

        map.on("load", () => {
          if (cancelled) return;
          setMapReady(true);
          setTimeout(() => map.invalidateSize(), 50);
        });

        setTimeout(() => {
          map.invalidateSize();
          setMapReady(true);
        }, 80);

        mapInstanceRef.current = map;
        markerRef.current = marker;
      } catch {
        setLoadError("تعذر تحميل الخريطة.");
      }
    }

    void initMap();

    return () => {
      cancelled = true;
      searchAbortRef.current?.abort();

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [initialLat, initialLng]);

  async function performSearch(query: string) {
    const q = query.trim();
    if (!q) return;

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setSearchLoading(true);
    setSearchError(null);

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error("Search failed");
      }

      const data = (await res.json()) as { features?: GeoFeature[] };
      const features = Array.isArray(data.features) ? data.features : [];

      setResults(features);

      if (features[0]) {
        const first = features[0];
        const foundLat = parseFloat(first.lat);
        const foundLng = parseFloat(first.lon);

        if (!Number.isNaN(foundLat) && !Number.isNaN(foundLng)) {
          syncMarker(foundLat, foundLng, 15);
          setSelectedLabel(first.place_name);
        }
      } else {
        setSearchError("لم يتم العثور على موقع مطابق.");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setSearchError("تعذر البحث عن هذا الموقع.");
      }
    } finally {
      setSearchLoading(false);
    }
  }

  useEffect(() => {
    const q = searchQuery.trim();

    if (q.length < 3) {
      setResults([]);
      setSearchError(null);
      searchAbortRef.current?.abort();
      return;
    }

    const t = setTimeout(() => {
      void performSearch(q);
    }, 350);

    return () => clearTimeout(t);
  }, [searchQuery]);

  function pickResult(result: GeoFeature) {
    const foundLat = parseFloat(result.lat);
    const foundLng = parseFloat(result.lon);

    if (Number.isNaN(foundLat) || Number.isNaN(foundLng)) return;

    syncMarker(foundLat, foundLng, 15);
    setSelectedLabel(result.place_name);
    setSearchQuery(result.place_name);
    setResults([]);
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setSearchError("الموقع الجغرافي غير متاح في هذا المتصفح.");
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        syncMarker(pos.coords.latitude, pos.coords.longitude, 15);
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
        setSearchError("تعذر الحصول على موقعك الحالي.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">تحديد الموقع على الخريطة</h3>
            <p className="text-xs text-slate-500 mt-1">
              اكتب شارعًا أو مدينة ثم اختر النتيجة، أو حرّك الدبوس مباشرة.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void performSearch(searchQuery);
            }}
            className="space-y-3"
          >
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن شارع، حي، مدينة، أو معلم..."
                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
              <button
                type="submit"
                disabled={searchLoading}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
              >
                {searchLoading ? "..." : "بحث"}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={geoLoading}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                {geoLoading ? "..." : "موقعي الحالي"}
              </button>
              <div className="flex-1 text-xs text-slate-500 flex items-center">
                {selectedLabel ? selectedLabel : "يمكنك البحث ثم اختيار النتيجة أو تحريك الدبوس عند الحاجة."}
              </div>
            </div>

            {searchError && <p className="text-xs text-red-600">{searchError}</p>}

            {results.length > 0 && (
              <div className="max-h-44 overflow-auto rounded-xl border border-slate-200 bg-white">
                {results.map((r, idx) => (
                  <button
                    key={`${r.place_name}-${idx}`}
                    type="button"
                    onClick={() => pickResult(r)}
                    className="w-full text-right px-3 py-2.5 hover:bg-slate-50 border-b last:border-b-0 border-slate-100"
                  >
                    <div className="text-sm text-slate-800 line-clamp-2">{r.place_name}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-1">
                      {r.lat}, {r.lon}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>

        <div className="relative">
          {!mapReady && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
                تحميل الخريطة...
              </div>
            </div>
          )}

          {loadError && (
            <div className="flex h-64 items-center justify-center bg-slate-50 text-sm text-red-500 px-4 text-center">
              تعذر تحميل الخريطة. تحقق من اتصال الإنترنت أو من حظر ملفات الخرائط.
            </div>
          )}

          <div ref={mapRef} className="w-full" style={{ height: "340px" }} />
        </div>

        <div className="px-5 py-2 bg-blue-50 border-y border-blue-100">
          <p className="text-xs text-blue-700">اضغط على الخريطة أو اسحب الدبوس لتعديل الموقع بدقة.</p>
        </div>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">خط العرض</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v)) syncMarker(v, lng);
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">خط الطول</label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v)) syncMarker(lat, v);
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              onClick={() => onConfirm(lat, lng, selectedLabel || searchQuery)}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700"
            >
              تأكيد الموقع
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addrLoading, setAddrLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(ADDR_EMPTY);
  const [addLoading, setAddLoading] = useState(false);

  const [editAddr, setEditAddr] = useState<Address | null>(null);
  const [editForm, setEditForm] = useState(ADDR_EMPTY);
  const [editLoading, setEditLoading] = useState(false);

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [showMap, setShowMap] = useState<"add" | "edit" | null>(null);
  const [search, setSearch] = useState("");

  const inp =
    "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white";

  useEffect(() => {
    setUser(getAuthUser());
  }, []);

  async function loadAddresses() {
    setAddrLoading(true);
    try {
      const res = await api.get<Address[]>("/user/addresses");
      setAddresses(Array.isArray(res) ? res : []);
    } catch {
      setAddresses([]);
    } finally {
      setAddrLoading(false);
    }
  }

  useEffect(() => {
    void loadAddresses();
  }, []);

  const filteredAddresses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return addresses;

    return addresses.filter((a) => {
      const text = `${a.note} ${a.latitude} ${a.longitude} ${a.id}`.toLowerCase();
      return text.includes(q);
    });
  }, [addresses, search]);

  async function createAddress(e: FormEvent) {
    e.preventDefault();
    setAddLoading(true);

    try {
      await api.post("/user/addresses", {
        latitude: parseFloat(addForm.latitude),
        longitude: parseFloat(addForm.longitude),
        note: addForm.note.trim(),
      });

      setToast({ msg: "تم إضافة العنوان", type: "success" });
      setAddForm(ADDR_EMPTY);
      setShowAdd(false);
      await loadAddresses();
    } catch (err) {
      setToast({
        msg: err instanceof ApiError ? err.message : "فشل الإضافة",
        type: "error",
      });
    } finally {
      setAddLoading(false);
    }
  }

  async function updateAddress() {
    if (!editAddr) return;

    setEditLoading(true);
    try {
      await api.put(`/user/addresses/${editAddr.id}`, {
        latitude: editForm.latitude ? parseFloat(editForm.latitude) : parseFloat(editAddr.latitude),
        longitude: editForm.longitude ? parseFloat(editForm.longitude) : parseFloat(editAddr.longitude),
        note: editForm.note.trim() || editAddr.note,
      });

      setToast({ msg: "تم تحديث العنوان", type: "success" });
      setEditAddr(null);
      await loadAddresses();
    } catch (err) {
      setToast({
        msg: err instanceof ApiError ? err.message : "فشل التحديث",
        type: "error",
      });
    } finally {
      setEditLoading(false);
    }
  }

  async function deleteAddress(id: number) {
    try {
      await api.delete(`/user/addresses/${id}`);
      setToast({ msg: "تم حذف العنوان", type: "success" });
      setDeleteId(null);
      await loadAddresses();
    } catch (err) {
      setToast({
        msg: err instanceof ApiError ? err.message : "فشل الحذف",
        type: "error",
      });
    }
  }

  async function setDefault(id: number) {
    try {
      await api.patch(`/user/addresses/${id}/default`, {});
      setToast({ msg: "تم تعيين العنوان الافتراضي", type: "success" });
      await loadAddresses();
    } catch (err) {
      setToast({
        msg: err instanceof ApiError ? err.message : "فشل التعيين",
        type: "error",
      });
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {showMap === "add" && (
        <MapPicker
          initialLat={parseFloat(addForm.latitude) || DEFAULT_LAT}
          initialLng={parseFloat(addForm.longitude) || DEFAULT_LNG}
          onConfirm={(lat, lng, label) => {
            setAddForm((p) => ({
              ...p,
              latitude: String(lat),
              longitude: String(lng),
              note: p.note || label || "",
            }));
            setShowMap(null);
          }}
          onClose={() => setShowMap(null)}
        />
      )}

      {showMap === "edit" && editAddr && (
        <MapPicker
          initialLat={parseFloat(editForm.latitude) || parseFloat(editAddr.latitude) || DEFAULT_LAT}
          initialLng={parseFloat(editForm.longitude) || parseFloat(editAddr.longitude) || DEFAULT_LNG}
          onConfirm={(lat, lng, label) => {
            setEditForm((p) => ({
              ...p,
              latitude: String(lat),
              longitude: String(lng),
              note: p.note || label || "",
            }));
            setShowMap(null);
          }}
          onClose={() => setShowMap(null)}
        />
      )}

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-semibold text-slate-800 text-lg">معلومات الحساب</h3>
            <p className="text-slate-500 text-sm mt-1">
              يتم تحميل الاسم بعد تثبيت الصفحة لتجنب أي اختلاف بين السيرفر والمتصفح.
            </p>
          </div>

          <div className="px-3 py-1.5 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-200">
            {addresses.length} عنوان
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {user?.name ? user.name.trim().charAt(0) : "—"}
          </div>

          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-lg truncate">{user?.name || "—"}</p>
            <p className="text-slate-500 text-sm truncate">{user?.phone_number || "—"}</p>
            <span className="inline-flex mt-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              تاجر
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-slate-800">عناوين التخزين</h3>
            <p className="text-slate-500 text-sm mt-1">بحث سريع، إضافة، تعديل، وتحديد افتراضي.</p>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            إضافة عنوان
          </button>
        </div>

        <div className="p-5 border-b border-slate-100 bg-slate-50/70">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم العنوان أو الإحداثيات..."
            className={inp}
          />
        </div>

        {showAdd && (
          <div className="p-5 bg-slate-50 border-b border-slate-100">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">عنوان جديد</h4>
            <form onSubmit={createAddress} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  step="any"
                  value={addForm.latitude}
                  onChange={(e) => setAddForm((p) => ({ ...p, latitude: e.target.value }))}
                  required
                  placeholder="خط العرض"
                  className={inp}
                />
                <input
                  type="number"
                  step="any"
                  value={addForm.longitude}
                  onChange={(e) => setAddForm((p) => ({ ...p, longitude: e.target.value }))}
                  required
                  placeholder="خط الطول"
                  className={inp}
                />
              </div>

              <button
                type="button"
                onClick={() => setShowMap("add")}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-indigo-200 rounded-xl text-sm text-indigo-600 hover:bg-indigo-50 transition-colors font-medium"
              >
                تحديد الموقع على الخريطة
              </button>

              <input
                value={addForm.note}
                onChange={(e) => setAddForm((p) => ({ ...p, note: e.target.value }))}
                required
                placeholder="اسم العنوان أو وصفه"
                className={inp}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdd(false);
                    setAddForm(ADDR_EMPTY);
                  }}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 py-2 bg-indigo-600 text-white text-sm rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-60"
                >
                  {addLoading ? "جاري الحفظ..." : "إضافة العنوان"}
                </button>
              </div>
            </form>
          </div>
        )}

        {addrLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredAddresses.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-slate-500 text-sm">لا توجد نتائج مطابقة.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredAddresses.map((a) => (
              <div key={a.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                {editAddr?.id === a.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        step="any"
                        value={editForm.latitude}
                        onChange={(e) => setEditForm((p) => ({ ...p, latitude: e.target.value }))}
                        placeholder={a.latitude}
                        className={inp}
                      />
                      <input
                        type="number"
                        step="any"
                        value={editForm.longitude}
                        onChange={(e) => setEditForm((p) => ({ ...p, longitude: e.target.value }))}
                        placeholder={a.longitude}
                        className={inp}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowMap("edit")}
                      className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-indigo-200 rounded-xl text-sm text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      فتح الخريطة لتعديل الموقع
                    </button>

                    <input
                      value={editForm.note}
                      onChange={(e) => setEditForm((p) => ({ ...p, note: e.target.value }))}
                      placeholder={a.note}
                      className={inp}
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditAddr(null)}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100"
                      >
                        إلغاء
                      </button>
                      <button
                        onClick={updateAddress}
                        disabled={editLoading}
                        className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {editLoading ? "جاري الحفظ..." : "حفظ"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-800 text-sm">{a.note || `عنوان ${a.id}`}</p>
                        {a.is_default && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">
                            افتراضي
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5 font-mono">
                        {a.latitude}, {a.longitude}
                      </p>
                    </div>

                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {!a.is_default && (
                        <button
                          onClick={() => setDefault(a.id)}
                          title="تعيين كافتراضي"
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          ☆
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditAddr(a);
                          setEditForm({ latitude: a.latitude, longitude: a.longitude, note: a.note });
                        }}
                        title="تعديل"
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => setDeleteId(a.id)}
                        title="حذف"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <h3 className="font-semibold text-slate-800 mb-1">حذف العنوان؟</h3>
            <p className="text-slate-500 text-sm mb-5">سيتم حذف هذا العنوان نهائياً.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                onClick={() => deleteAddress(deleteId)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}