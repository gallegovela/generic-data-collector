import { z } from "zod";

/** Cubre: RF-SUB-05, RF-SUB-06, RF-SUB-07 */
export const submissionFiltersSchema = z.object({
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  submittedBy: z.string().trim().min(1).optional(),
  fieldId: z.string().min(1).optional(),
  fieldValue: z.string().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  version: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
});
export type SubmissionFiltersInput = z.infer<typeof submissionFiltersSchema>;
export const SUBMISSIONS_PAGE_SIZE = 20;
