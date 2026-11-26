import { connection, NextResponse } from "next/server";
import { loadEnv } from "@/lib/env";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { buildFormLink } from "@/lib/form-publishing/form-link";
import { qrQuerySchema } from "@/lib/form-publishing/form-publishing.schema";
import { renderQr } from "@/lib/form-publishing/qr";
import { requireSession } from "@/server/auth/session";
import { getPublishingState } from "@/server/form-publishing/form-publishing.service";

export const runtime = "nodejs";

/**
 * Imagen del QR del enlace de un formulario publicado (solo admin).
 *
 * Cubre: RF-PUB-05, CA-PUB-02, CA-PUB-05
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  await connection();
  const { id } = await params;

  try {
    const user = await requireSession({ role: "admin" });

    const url = new URL(request.url);
    const query = qrQuerySchema.safeParse({
      format: url.searchParams.get("format") ?? undefined,
      download: url.searchParams.get("download") ?? undefined,
    });
    if (!query.success) {
      return NextResponse.json({ error: "invalid-params" }, { status: 400 });
    }

    const state = await getPublishingState(user.organizationId, id);
    if (!state.slug || state.status !== "published") throw new NotFoundError();

    const link = buildFormLink(loadEnv().AUTH_URL, state.slug);
    const { format, download } = query.data;
    const disposition: Record<string, string> = download
      ? { "Content-Disposition": `attachment; filename="${state.slug}.${format}"` }
      : {};

    if (format === "svg") {
      const svg = await renderQr(link, "svg");
      return new Response(svg, {
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store", ...disposition },
      });
    }
    const png = await renderQr(link, "png");
    return new Response(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store", ...disposition },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "login-required" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    }
    throw error;
  }
}
