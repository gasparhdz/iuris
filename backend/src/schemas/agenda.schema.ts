import { z } from "zod";

export const agendaQuerySchema = z.object({
  from: z.string().datetime().describe("Fecha inicio (ISO 8601)"),
  to: z.string().datetime().describe("Fecha fin (ISO 8601)"),
}).strict();

export const agendaItemSchema = z.object({
  id: z.number(),
  tipo: z.string(),
  titulo: z.string().nullable(),
  fecha: z.string().nullable(),
  fechaFin: z.string().nullable(),
  allDay: z.boolean(),
  subtipoId: z.number().nullable(),
  estadoId: z.number().nullable(),
  color: z.string(),
  link: z.string(),
});

export const agendaResponseSchema = z.object({
  data: z.array(agendaItemSchema),
});
