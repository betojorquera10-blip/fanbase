// Fotos subidas desde el panel de administración (tabla imagenes).
// Una foto nunca cambia (cambiarla crea otra), así que se guarda en caché un año.

import { prisma } from "@/lib/db";

export async function GET(_req: Request, ctx: RouteContext<"/imagenes/[id]">) {
  const { id } = await ctx.params;
  const n = Number(id);
  const img = Number.isInteger(n) && n > 0 ? await prisma.imagen.findUnique({ where: { id: n } }) : null;
  if (!img) return new Response("Foto no encontrada", { status: 404 });
  return new Response(new Uint8Array(img.datos), {
    headers: { "Content-Type": img.tipo, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
