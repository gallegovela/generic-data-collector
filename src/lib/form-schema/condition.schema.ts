import { z } from "zod";

export const CONDITION_OPERATORS = ["equals", "notEquals", "includes", "isAnswered"] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export const VisibleIfSchema = z
  .object({
    fieldId: z.string().min(1),
    operator: z.enum(CONDITION_OPERATORS),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  })
  .superRefine((condition, ctx) => {
    if (condition.operator !== "isAnswered" && condition.value === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "El valor es obligatorio para este operador.",
      });
    }
  });
export type VisibleIf = z.infer<typeof VisibleIfSchema>;

export function isAnswered(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function evaluateCondition(condition: VisibleIf, answers: Record<string, unknown>): boolean {
  const answer = answers[condition.fieldId];
  switch (condition.operator) {
    case "equals":
      return answer === condition.value;
    case "notEquals":
      return answer !== condition.value;
    case "includes":
      return Array.isArray(answer) && answer.includes(condition.value);
    case "isAnswered":
      return isAnswered(answer);
  }
}
