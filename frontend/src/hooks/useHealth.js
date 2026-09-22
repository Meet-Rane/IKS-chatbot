import { useState, useEffect } from "react";
import { fetchHealth, fetchProviders } from "../api/chat";

export function useHealth() {
  const [status, setStatus]     = useState("checking"); // checking | online | offline
  const [health, setHealth]     = useState(null);
  const [providers, setProviders] = useState(null);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const [h, p] = await Promise.all([fetchHealth(), fetchProviders()]);
        if (!mounted) return;
        setHealth(h);
        setProviders(p);
        setStatus("online");
      } catch {
        if (mounted) setStatus("offline");
      }
    };
    check();
    const id = setInterval(check, 30_000); // re-check every 30s
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return { status, health, providers };
}
