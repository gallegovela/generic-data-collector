import { z } from "zod";
import { submissionFiltersSchema } from "@/lib/submissions-dashboard/submission-filters.schema";

export const EXPORT_FORMATS = ["xlsx", "csv"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export const EXPORT_MAX_ROWS = 10_000;

/** Cubre: RF-OUT-05, RF-OUT-11 */
export const submissionExportQuerySchema = submissionFiltersSchema
  .omit({ page: true })
  .extend({ format: z.enum(EXPORT_FORMATS) });
export type SubmissionExportQuery = z.infer<typeof submissionExportQuerySchema>;
