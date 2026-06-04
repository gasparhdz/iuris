import { and, eq, isNull } from "drizzle-orm";
import { db } from "../index.js";
import { casos, clientes, estudios, parametros } from "../schema.js";

export class DocumentosQueries {
  static async findCasoContext(casoId: number, estudioId: number) {
    const [row] = await db
      .select({
        estudio: {
          id: estudios.id,
          nombre: estudios.nombre,
        },
        cliente: {
          id: clientes.id,
          nombre: clientes.nombre,
          apellido: clientes.apellido,
          razonSocial: clientes.razonSocial,
          dni: clientes.dni,
          cuit: clientes.cuit,
        },
        caso: {
          id: casos.id,
          caratula: casos.caratula,
          nroExpte: casos.nroExpte,
          driveFolderId: casos.driveFolderId,
        },
        juzgado: {
          nombre: parametros.nombre,
        },
      })
      .from(casos)
      .innerJoin(estudios, eq(casos.estudioId, estudios.id))
      .innerJoin(clientes, eq(casos.clienteId, clientes.id))
      .leftJoin(parametros, eq(casos.radicacionId, parametros.id))
      .where(and(eq(casos.id, casoId), eq(casos.estudioId, estudioId), isNull(casos.deletedAt)))
      .limit(1);

    return row ?? null;
  }
}
