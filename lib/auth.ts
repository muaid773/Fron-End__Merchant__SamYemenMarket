export interface AuthUser {
  name: string;
  phone_number: string;
  access_token: string;
  refresh_token?: string;
  region?: string;
}

const AUTH_KEYS = {
  accessToken: "access_token",
  refreshToken: "refresh_token",
  userName: "user_name",
  userPhone: "user_phone",
  userRegion: "user_region",
};

export function saveAuth(data: AuthUser, region = data.region ?? "YE") {
  if (typeof window === "undefined") return;

  localStorage.setItem(AUTH_KEYS.accessToken, data.access_token);

  if (data.refresh_token) {
    localStorage.setItem(AUTH_KEYS.refreshToken, data.refresh_token);
  }

  localStorage.setItem(AUTH_KEYS.userName, data.name || "");
  localStorage.setItem(AUTH_KEYS.userPhone, data.phone_number || "");
  localStorage.setItem(AUTH_KEYS.userRegion, region.toUpperCase());
}

export function clearAuth() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(AUTH_KEYS.accessToken);
  localStorage.removeItem(AUTH_KEYS.refreshToken);
  localStorage.removeItem(AUTH_KEYS.userName);
  localStorage.removeItem(AUTH_KEYS.userPhone);
  localStorage.removeItem(AUTH_KEYS.userRegion);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_KEYS.accessToken);
}

export function getRefreshToken(): string {
  if (typeof window === "undefined") {
    throw new Error("Refresh token is only available in the browser");
  }

  const token = localStorage.getItem(AUTH_KEYS.refreshToken);
  if (!token) {
    throw new Error("Missing refresh token");
  }

  return token;
}

export function getRegion(): string {
  if (typeof window === "undefined") return "YE";
  return localStorage.getItem(AUTH_KEYS.userRegion) || "YE";
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;

  const access_token = localStorage.getItem(AUTH_KEYS.accessToken);
  if (!access_token) return null;

  return {
    access_token,
    refresh_token: localStorage.getItem(AUTH_KEYS.refreshToken) ?? undefined,
    name: localStorage.getItem(AUTH_KEYS.userName) || "",
    phone_number: localStorage.getItem(AUTH_KEYS.userPhone) || "",
    region: localStorage.getItem(AUTH_KEYS.userRegion) || "YE",
  };
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(AUTH_KEYS.accessToken);
}