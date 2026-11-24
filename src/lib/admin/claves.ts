// Huellas de contraseñas con scrypt (incluido en Node, sin dependencias).
// La contraseña nunca se guarda: solo "scrypt$N$r$p$sal$huella". Lo usan el
// inicio de sesión del panel y el comando `npm run admin:cuenta`.

import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 32768; // costo: unos 32 MB y una fracción de segundo por intento
const R = 8;
const P = 1;
const LARGO = 64;

function scrypt(clave: string, sal: Buffer, opciones: ScryptOptions): Promise<Buffer> {
  return new Promise((ok, mal) =>
    scryptCb(clave.normalize("NFKC"), sal, LARGO, { ...opciones, maxmem: 128 * opciones.N! * opciones.r! * 2 }, (err, h) =>
      err ? mal(err) : ok(h),
    ),
  );
}

export async function huellaClave(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const h = await scrypt(clave, sal, { N, r: R, p: P });
  return ["scrypt", N, R, P, sal.toString("base64"), h.toString("base64")].join("$");
}

export async function claveCorrecta(clave: string, guardada: string): Promise<boolean> {
  const [alg, n, r, p, sal, h] = guardada.split("$");
  if (alg !== "scrypt" || !sal || !h) return false;
  const esperada = Buffer.from(h, "base64");
  const calculada = await scrypt(clave, Buffer.from(sal, "base64"), { N: Number(n), r: Number(r), p: Number(p) });
  return calculada.length === esperada.length && timingSafeEqual(calculada, esperada);
}

// Reglas mínimas para una contraseña nueva.
export function problemaConClave(clave: string): string | null {
  if (clave.length < 10) return "La contraseña debe tener al menos 10 caracteres.";
  if (clave.length > 200) return "La contraseña es demasiado larga.";
  return null;
}
