import { and, eq } from "drizzle-orm";
import { db } from "../index.js";
import { plantillas } from "../schema.js";

type NewPlantilla = typeof plantillas.$inferInsert;

export class PlantillasQueries {
  static async findPlantillas(estudioId: number) {
    return await db
      .select()
      .from(plantillas)
      .where(and(eq(plantillas.estudioId, estudioId), eq(plantillas.activo, true)));
  }

  static async findPlantillaById(id: number, estudioId: number) {
    const [row] = await db
      .select()
      .from(plantillas)
      .where(and(eq(plantillas.id, id), eq(plantillas.estudioId, estudioId), eq(plantillas.activo, true)))
      .limit(1);
    return row ?? null;
  }

  static async insertPlantilla(data: NewPlantilla) {
    const [row] = await db.insert(plantillas).values(data).returning();
    return row;
  }

  static async updatePlantilla(id: number, estudioId: number, data: Partial<NewPlantilla>) {
    const [row] = await db
      .update(plantillas)
      .set(data)
      .where(and(eq(plantillas.id, id), eq(plantillas.estudioId, estudioId), eq(plantillas.activo, true)))
      .returning();
    return row ?? null;
  }

  static async deletePlantilla(id: number, estudioId: number) {
    const [row] = await db
      .update(plantillas)
      .set({ activo: false })
      .where(and(eq(plantillas.id, id), eq(plantillas.estudioId, estudioId), eq(plantillas.activo, true)))
      .returning();
    return row ?? null;
  }
}
