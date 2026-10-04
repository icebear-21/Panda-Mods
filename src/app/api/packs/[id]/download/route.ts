import { getPack } from "@/lib/db";
import { downloadArchive } from "@/lib/download";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return downloadArchive(getPack((await params).id));
}

