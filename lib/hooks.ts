"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

export interface Notification {
  id: string;
  title?: string;
  body?: string;
  message?: string;
  is_read: boolean;
  created_at: string;
}

type NotificationsResponse = {
  count?: number;
  notifications?: Notification[];
};

export function useNotifications(pollIntervalMs = 60_000) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const lastFetch = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const fetchNotifications = useCallback(
    async (markRead = false) => {
      try {
        const params = new URLSearchParams({
          unread_only: "false",
          limit: "15",
        });

        if (markRead) {
          params.set("mark_as_read", "true");
        }

        if (lastFetch.current && !markRead) {
          params.set("since_timestamp", lastFetch.current);
        }

        const res = await api.get<NotificationsResponse>(
          `/notifications/poll?${params.toString()}`
        );

        if (!mountedRef.current) return;

        lastFetch.current = new Date().toISOString();

        const incoming = res.notifications ?? [];

        if (incoming.length) {
          setNotifications((prev) => {
            const ids = new Set(prev.map((n) => n.id));
            const fresh = incoming.filter((n) => !ids.has(n.id));
            return [...fresh, ...prev].slice(0, 30);
          });
        }

        if (typeof res.count === "number") {
          setUnreadCount(res.count);
        } else {
          setUnreadCount(incoming.filter((n) => !n.is_read).length);
        }
      } catch {
        // Silent failure for notifications to avoid breaking the UI
      }
    },
    []
  );

  const markAllRead = useCallback(async () => {
    await fetchNotifications(true);

    if (!mountedRef.current) return;

    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, [fetchNotifications]);

  useEffect(() => {
    mountedRef.current = true;

    fetchNotifications();

    if (pollIntervalMs > 0) {
      const timer = setInterval(() => {
        fetchNotifications();
      }, pollIntervalMs);

      return () => {
        mountedRef.current = false;
        clearInterval(timer);
      };
    }

    return () => {
      mountedRef.current = false;
    };
  }, [fetchNotifications, pollIntervalMs]);

  return {
    notifications,
    unreadCount,
    open,
    setOpen,
    markAllRead,
    refetch: fetchNotifications,
  };
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}