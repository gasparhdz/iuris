import { PlantillasQueries } from "../db/queries/plantillas.queries.js";
import { serializeDates } from "../utils/serialize.js";
import type { CreatePlantillaInput, UpdatePlantillaInput } from "../schemas/plantillas.schema.js";

export class PlantillasService {
  static async findAll(estudioId: number) {
    return serializeDates(await PlantillasQueries.findPlantillas(estudioId));
  }

  static async create(estudioId: number, data: CreatePlantillaInput) {
    return serializeDates(await PlantillasQueries.insertPlantilla({ ...data, estudioId }));
  }

  static async update(id: number, estudioId: number, data: UpdatePlantillaInput) {
    const plantilla = await PlantillasQueries.updatePlantilla(id, estudioId, data);
    if (!plantilla) throw new Error("PLANTILLA_NOT_FOUND");
    return serializeDates(plantilla);
  }

  static async delete(id: number, estudioId: number) {
    const plantilla = await PlantillasQueries.deletePlantilla(id, estudioId);
    if (!plantilla) throw new Error("PLANTILLA_NOT_FOUND");
  }
}
