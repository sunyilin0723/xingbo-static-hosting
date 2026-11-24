import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const me = trpc.files.me.useQuery(undefined, { retry: false });

  useEffect(() => {
    if (!me.isLoading) setLoading(false);
  }, [me.isLoading]);

  return { user: me.data ?? null, loading };
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}
