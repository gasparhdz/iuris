import { db } from "../../db/index.js";
import { planesSuscripcion } from "../../db/schema.js";

export const PLANES_SUSCRIPCION_SEED = [
  {
    codigo: "SOLO",
    nombre: "Solo / Independiente",
    maxUsuarios: 1,
    almacenamientoGb: 5,
    precioMensualArs: "13200.00",
    precioMensualJus: "0.1000",
  },
  {
    codigo: "PRO",
    nombre: "Pro / Estudio Boutique",
    maxUsuarios: 3,
    almacenamientoGb: 15,
    precioMensualArs: "29040.00",
    precioMensualJus: "0.2200",
  },
  {
    codigo: "PREMIUM",
    nombre: "Premium / Corporativo",
    maxUsuarios: 10,
    almacenamientoGb: 100,
    precioMensualArs: "76560.00",
    precioMensualJus: "0.5800",
  },
] as const;

export async function upsertPlanesSuscripcion() {
  const rows = [];
  for (const plan of PLANES_SUSCRIPCION_SEED) {
    const [row] = await db
      .insert(planesSuscripcion)
      .values({ ...plan, activo: true })
      .onConflictDoUpdate({
        target: planesSuscripcion.codigo,
        set: {
          nombre: plan.nombre,
          maxUsuarios: plan.maxUsuarios,
          almacenamientoGb: plan.almacenamientoGb,
          precioMensualArs: plan.precioMensualArs,
          precioMensualJus: plan.precioMensualJus,
          activo: true,
        },
      })
      .returning();
    rows.push(row);
  }
  return rows;
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("seedPlanesSuscripcion.ts")) {
  upsertPlanesSuscripcion()
    .then(() => {
      console.log("Planes de suscripción sembrados correctamente");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error sembrando planes de suscripción:", error);
      process.exit(1);
    });
}
