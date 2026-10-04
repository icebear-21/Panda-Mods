import { listVersions } from "@/lib/db";
import { downloadArchive } from "@/lib/download";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return downloadArchive(listVersions(id)[0]);
}
