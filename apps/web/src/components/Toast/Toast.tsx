"use client";

import { useEffect } from "react";
import { useCanvasStore } from "@/stores/canvas";

const DURATION_MS = 2500;

export function Toast() {
  const toast = useCanvasStore((s) => s.toast);
  const clearToast = useCanvasStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => clearToast(), DURATION_MS);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  if (!toast) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(20, 22, 30, 0.98)",
        color: "var(--atelier-panel-text)",
        border: "1px solid var(--atelier-panel-border)",
        borderRadius: 999,
        padding: "8px 16px",
        fontSize: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        zIndex: 200,
        pointerEvents: "none",
      }}
    >
      {toast.message}
    </div>
  );
}
