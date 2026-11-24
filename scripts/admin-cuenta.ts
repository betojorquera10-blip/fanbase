// Crea una cuenta del panel de administración, o le cambia la contraseña si ya
// existe. La contraseña se escribe acá en la terminal (no se ve al tipear) y
// solo se guarda su huella.
//
//   npm run admin:cuenta -- <usuario> "<Nombre>"                 (base del .env: staging)
//   npm run admin:cuenta -- <usuario> "<Nombre>" --produccion    (base de producción)
//   npm run admin:cuenta -- <usuario> --desactivar               (ya no puede entrar)
//
// Cambiar la contraseña o desactivar una cuenta cierra todas sus sesiones.

import "dotenv/config";
import { createInterface } from "node:readline";
import { Client } from "pg";
import { huellaClave, problemaConClave } from "../src/lib/admin/claves";

function preguntarOculto(texto: string): Promise<string> {
  return new Promise((ok) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let mostrar = true;
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
      if (mostrar) process.stdout.write(s);
    };
    rl.question(texto, (r) => {
      rl.close();
      process.stdout.write("\n");
      ok(r);
    });
    mostrar = false;
  });
}

async function main() {
  const args = process.argv.slice(2);
  const produccion = args.includes("--produccion");
  const desactivar = args.includes("--desactivar");
  const [usuarioArg, nombre] = args.filter((a) => !a.startsWith("--"));
  const usuario = usuarioArg?.trim().toLowerCase();
  if (!usuario || !/^[a-z0-9._-]{3,40}$/.test(usuario)) {
    throw new Error('Indica el usuario (3 a 40 letras, números, punto o guion), ej.: npm run admin:cuenta -- beto "Beto"');
  }

  const url = produccion ? process.env.PRODUCCION_DATABASE_URL : process.env.DATABASE_URL;
  if (!url) throw new Error(produccion ? "Falta PRODUCCION_DATABASE_URL en el .env" : "Falta DATABASE_URL en el .env");
  const proyecto = url.match(/postgres\.([a-z0-9]+):/)?.[1] ?? "?";
  console.log(`Base: ${produccion ? "PRODUCCIÓN" : "la del .env (staging)"} (${proyecto})`);

  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    const existente = (await db.query("select id, nombre from admin_usuarios where usuario = $1", [usuario])).rows[0] as
      | { id: number; nombre: string }
      | undefined;

    if (desactivar) {
      if (!existente) throw new Error(`No existe la cuenta "${usuario}".`);
      await db.query("update admin_usuarios set activo = false where id = $1", [existente.id]);
      await db.query("delete from admin_sesiones where usuario_id = $1", [existente.id]);
      console.log(`Cuenta "${usuario}" desactivada y sus sesiones cerradas.`);
      return;
    }

    if (!existente && !nombre?.trim()) throw new Error(`La cuenta es nueva: indica también el nombre, ej.: npm run admin:cuenta -- ${usuario} "Nombre"`);
    console.log(existente ? `La cuenta "${usuario}" ya existe: se le cambiará la contraseña.` : `Se creará la cuenta "${usuario}" (${nombre.trim()}).`);

    const clave = await preguntarOculto("Contraseña nueva (no se ve al escribir): ");
    const problema = problemaConClave(clave);
    if (problema) throw new Error(problema);
    if ((await preguntarOculto("Repítela: ")) !== clave) throw new Error("Las contraseñas no coinciden. No se cambió nada.");
    const huella = await huellaClave(clave);

    if (existente) {
      await db.query(
        `update admin_usuarios set clave_hash = $1, activo = true, intentos_fallidos = 0, bloqueado_hasta = null${nombre?.trim() ? ", nombre = $3" : ""} where id = $2`,
        nombre?.trim() ? [huella, existente.id, nombre.trim()] : [huella, existente.id],
      );
      await db.query("delete from admin_sesiones where usuario_id = $1", [existente.id]);
      console.log(`Listo: contraseña de "${usuario}" cambiada; sus sesiones abiertas se cerraron.`);
    } else {
      await db.query("insert into admin_usuarios (usuario, nombre, clave_hash) values ($1, $2, $3)", [usuario, nombre.trim(), huella]);
      console.log(`Listo: cuenta "${usuario}" creada.`);
    }
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error("[admin:cuenta] ERROR:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
