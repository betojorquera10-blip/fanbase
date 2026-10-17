// Regiones de Chile y sus comunas (de norte a sur), para filtrar por región
// y unificar los nombres de comuna que cada fuente escribe distinto
// ("Santiago Centro" / "Santiago", "Chillan" / "Chillán").
// Archivo aparte para que el navegador lo pueda usar sin cargar la base.

import { normalizar } from "@/lib/fechas";

export const REGIONES: { nombre: string; comunas: string[] }[] = [
  { nombre: "Arica y Parinacota", comunas: ["Arica", "Camarones", "Putre", "General Lagos"] },
  { nombre: "Tarapacá", comunas: ["Iquique", "Alto Hospicio", "Pozo Almonte", "Camiña", "Colchane", "Huara", "Pica"] },
  {
    nombre: "Antofagasta",
    comunas: ["Antofagasta", "Mejillones", "Sierra Gorda", "Taltal", "Calama", "Ollagüe", "San Pedro de Atacama", "Tocopilla", "María Elena"],
  },
  {
    nombre: "Atacama",
    comunas: ["Copiapó", "Caldera", "Tierra Amarilla", "Chañaral", "Diego de Almagro", "Vallenar", "Alto del Carmen", "Freirina", "Huasco"],
  },
  {
    nombre: "Coquimbo",
    comunas: [
      "La Serena", "Coquimbo", "Andacollo", "La Higuera", "Paihuano", "Vicuña", "Illapel", "Canela", "Los Vilos", "Salamanca",
      "Ovalle", "Combarbalá", "Monte Patria", "Punitaqui", "Río Hurtado",
    ],
  },
  {
    nombre: "Valparaíso",
    comunas: [
      "Valparaíso", "Casablanca", "Concón", "Juan Fernández", "Puchuncaví", "Quintero", "Viña del Mar", "Isla de Pascua", "Los Andes",
      "Calle Larga", "Rinconada", "San Esteban", "La Ligua", "Cabildo", "Papudo", "Petorca", "Zapallar", "Quillota", "La Calera",
      "Hijuelas", "La Cruz", "Nogales", "San Antonio", "Algarrobo", "Cartagena", "El Quisco", "El Tabo", "Santo Domingo", "San Felipe",
      "Catemu", "Llaillay", "Panquehue", "Putaendo", "Santa María", "Quilpué", "Limache", "Olmué", "Villa Alemana",
    ],
  },
  {
    nombre: "Metropolitana",
    comunas: [
      "Santiago", "Cerrillos", "Cerro Navia", "Conchalí", "El Bosque", "Estación Central", "Huechuraba", "Independencia", "La Cisterna",
      "La Florida", "La Granja", "La Pintana", "La Reina", "Las Condes", "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú",
      "Ñuñoa", "Pedro Aguirre Cerda", "Peñalolén", "Providencia", "Pudahuel", "Quilicura", "Quinta Normal", "Recoleta", "Renca",
      "San Joaquín", "San Miguel", "San Ramón", "Vitacura", "Puente Alto", "Pirque", "San José de Maipo", "Colina", "Lampa", "Tiltil",
      "San Bernardo", "Buin", "Calera de Tango", "Paine", "Melipilla", "Alhué", "Curacaví", "María Pinto", "San Pedro", "Talagante",
      "El Monte", "Isla de Maipo", "Padre Hurtado", "Peñaflor",
    ],
  },
  {
    nombre: "O'Higgins",
    comunas: [
      "Rancagua", "Codegua", "Coinco", "Coltauco", "Doñihue", "Graneros", "Las Cabras", "Machalí", "Malloa", "Mostazal", "Olivar",
      "Peumo", "Pichidegua", "Quinta de Tilcoco", "Rengo", "Requínoa", "San Vicente", "Pichilemu", "La Estrella", "Litueche",
      "Marchigüe", "Navidad", "Paredones", "San Fernando", "Chépica", "Chimbarongo", "Lolol", "Nancagua", "Palmilla", "Peralillo",
      "Placilla", "Pumanque", "Santa Cruz",
    ],
  },
  {
    nombre: "Maule",
    comunas: [
      "Talca", "Constitución", "Curepto", "Empedrado", "Maule", "Pelarco", "Pencahue", "Río Claro", "San Clemente", "San Rafael",
      "Cauquenes", "Chanco", "Pelluhue", "Curicó", "Hualañé", "Licantén", "Molina", "Rauco", "Romeral", "Sagrada Familia", "Teno",
      "Vichuquén", "Linares", "Colbún", "Longaví", "Parral", "Retiro", "San Javier", "Villa Alegre", "Yerbas Buenas",
    ],
  },
  {
    nombre: "Ñuble",
    comunas: [
      "Chillán", "Bulnes", "Chillán Viejo", "El Carmen", "Pemuco", "Pinto", "Quillón", "San Ignacio", "Yungay", "Quirihue",
      "Cobquecura", "Coelemu", "Ninhue", "Portezuelo", "Ránquil", "Treguaco", "San Carlos", "Coihueco", "Ñiquén", "San Fabián",
      "San Nicolás",
    ],
  },
  {
    nombre: "Biobío",
    comunas: [
      "Concepción", "Coronel", "Chiguayante", "Florida", "Hualqui", "Lota", "Penco", "San Pedro de la Paz", "Santa Juana", "Talcahuano",
      "Tomé", "Hualpén", "Lebu", "Arauco", "Cañete", "Contulmo", "Curanilahue", "Los Álamos", "Tirúa", "Los Ángeles", "Antuco",
      "Cabrero", "Laja", "Mulchén", "Nacimiento", "Negrete", "Quilaco", "Quilleco", "San Rosendo", "Santa Bárbara", "Tucapel",
      "Yumbel", "Alto Biobío",
    ],
  },
  {
    nombre: "La Araucanía",
    comunas: [
      "Temuco", "Carahue", "Cunco", "Curarrehue", "Freire", "Galvarino", "Gorbea", "Lautaro", "Loncoche", "Melipeuco", "Nueva Imperial",
      "Padre Las Casas", "Perquenco", "Pitrufquén", "Pucón", "Saavedra", "Teodoro Schmidt", "Toltén", "Vilcún", "Villarrica",
      "Cholchol", "Angol", "Collipulli", "Curacautín", "Ercilla", "Lonquimay", "Los Sauces", "Lumaco", "Purén", "Renaico",
      "Traiguén", "Victoria",
    ],
  },
  {
    nombre: "Los Ríos",
    comunas: ["Valdivia", "Corral", "Lanco", "Los Lagos", "Máfil", "Mariquina", "Paillaco", "Panguipulli", "La Unión", "Futrono", "Lago Ranco", "Río Bueno"],
  },
  {
    nombre: "Los Lagos",
    comunas: [
      "Puerto Montt", "Calbuco", "Cochamó", "Fresia", "Frutillar", "Los Muermos", "Llanquihue", "Maullín", "Puerto Varas", "Castro",
      "Ancud", "Chonchi", "Curaco de Vélez", "Dalcahue", "Puqueldón", "Queilén", "Quellón", "Quemchi", "Quinchao", "Osorno",
      "Puerto Octay", "Purranque", "Puyehue", "Río Negro", "San Juan de la Costa", "San Pablo", "Chaitén", "Futaleufú", "Hualaihué",
      "Palena",
    ],
  },
  {
    nombre: "Aysén",
    comunas: ["Coyhaique", "Lago Verde", "Aysén", "Cisnes", "Guaitecas", "Cochrane", "O'Higgins", "Tortel", "Chile Chico", "Río Ibáñez"],
  },
  {
    nombre: "Magallanes",
    comunas: [
      "Punta Arenas", "Laguna Blanca", "Río Verde", "San Gregorio", "Cabo de Hornos", "Antártica", "Porvenir", "Primavera", "Timaukel",
      "Natales", "Torres del Paine",
    ],
  },
];

// Otras formas en que las fuentes escriben algunas comunas.
const ALIAS: Record<string, string> = {
  "santiago centro": "Santiago",
  "santiago de chile": "Santiago",
  calera: "La Calera",
  "puerto aysen": "Aysén",
  "puerto natales": "Natales",
  "til til": "Tiltil",
  "llay llay": "Llaillay",
  "san jose de maipo": "San José de Maipo",
};

const POR_NOMBRE = new Map<string, { comuna: string; region: string }>();
for (const r of REGIONES) for (const c of r.comunas) POR_NOMBRE.set(normalizar(c), { comuna: c, region: r.nombre });

// "Santiago Centro" → { comuna: "Santiago", region: "Metropolitana" }. Una
// comuna desconocida se devuelve tal cual, sin región.
export function ubicarComuna(nombre: string | null | undefined): { comuna: string | null; region: string | null } {
  if (!nombre?.trim()) return { comuna: null, region: null };
  const clave = normalizar(nombre).replace(/\s+/g, " ");
  const conocida = POR_NOMBRE.get(clave) ?? POR_NOMBRE.get(normalizar(ALIAS[clave] ?? ""));
  return conocida ?? { comuna: nombre.trim(), region: null };
}

export const ORDEN_REGIONES = REGIONES.map((r) => r.nombre);
