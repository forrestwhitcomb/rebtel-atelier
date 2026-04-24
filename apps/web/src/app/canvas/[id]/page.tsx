import { CanvasEditor } from "@/components/CanvasEditor/CanvasEditor";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CanvasPage({ params }: PageProps) {
  const { id } = await params;
  return <CanvasEditor canvasId={id} />;
}
