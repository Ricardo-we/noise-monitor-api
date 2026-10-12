import type { Request, Response } from "express";
import { noiseReadingRepository } from "../../repositories/noise-reading.repository";
import type { RecordsQuery } from "../schemas/records.schema";

export async function getRecords(
  _req: Request,
  res: Response<unknown, { query: RecordsQuery }>,
): Promise<void> {
  const { page, limit } = res.locals.query;
  const { rows, total } = await noiseReadingRepository.list({ page, limit });
  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    data: rows.map((row) => ({
      reading_id: row.readingId,
      timestamp: row.timestamp.toISOString(),
      latitude: row.latitude,
      longitude: row.longitude,
      student_id: row.studentId,
      domain_data: row.domainData,
      created_at: row.createdAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_previous: total > 0 && page > 1,
    },
  });
}
