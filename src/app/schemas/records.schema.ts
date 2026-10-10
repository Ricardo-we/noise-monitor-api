import { z } from "zod";

// Mantiene skip dentro del rango admitido por el cliente Prisma instalado.
const MAX_OFFSET = 2_147_483_647;
const positiveInteger = (max: number) => z.string()
  .regex(/^[1-9]\d*$/, "Debe ser un entero positivo sin decimales")
  .transform(Number)
  .pipe(z.number().int().min(1).max(max));

export const recordsQuerySchema = z.object({
  page: positiveInteger(MAX_OFFSET).default(1),
  limit: positiveInteger(100).default(20),
}).strict().refine(({ page, limit }) => (page - 1) * limit <= MAX_OFFSET, {
  path: ["page"],
  message: "El desplazamiento solicitado supera el límite técnico de paginación",
});

export type RecordsQuery = z.infer<typeof recordsQuerySchema>;
