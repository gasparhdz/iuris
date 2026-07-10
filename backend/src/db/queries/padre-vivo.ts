import { SQL, and, isNull, or, type AnyColumn } from "drizzle-orm";

/** Sin FK → visible; con FK → el padre debe tener deletedAt IS NULL (vía left join). */
export function padreVivoOrNull(fkColumn: AnyColumn, deletedAtColumn: AnyColumn): SQL {
  return or(isNull(fkColumn), isNull(deletedAtColumn))!;
}

/** Caso y cliente vinculados deben estar vivos; items huérfanos (sin padre) siguen visibles. */
export function padresCasoClienteVivos(opts: {
  casoId: AnyColumn;
  casoDeletedAt: AnyColumn;
  clienteId: AnyColumn;
  clienteDeletedAt: AnyColumn;
}): SQL {
  return and(
    padreVivoOrNull(opts.casoId, opts.casoDeletedAt),
    padreVivoOrNull(opts.clienteId, opts.clienteDeletedAt),
  )!;
}
