import type { MetadataRoute } from "next";
import { permitirIndexacion } from "@/lib/indexacion";

// robots.txt: en staging pide a los buscadores no entrar a ninguna página.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: permitirIndexacion ? { userAgent: "*", allow: "/", disallow: "/api/" } : { userAgent: "*", disallow: "/" },
  };
}
