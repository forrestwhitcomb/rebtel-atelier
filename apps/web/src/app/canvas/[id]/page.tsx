import { CanvasEditor } from "@/components/CanvasEditor/CanvasEditor";

export default function CanvasPage() {
  // Session 1 renders a single demo canvas from in-memory state.
  // The `id` param is accepted but not yet read — Supabase-backed canvases
  // arrive in a later session. For now any /canvas/* path shows the demo.
  return <CanvasEditor />;
}
