import { z } from 'zod';

export const createOffenceSchema = z.object({
  code: z.string().min(2, 'Code is required (e.g. OFF-SPD-01)').trim().toUpperCase(),
  title: z.string().min(3, 'Title is required').trim(),
  description: z.string().optional(),
  category: z.string().min(2, 'Category is required (e.g. Speeding, Safety)').trim(),
  penalty_amount: z.number().nonnegative('Penalty amount must be non-negative'),
  demerit_points: z.number().int().nonnegative('Demerit points must be non-negative integer').default(0),
  is_active: z.boolean().default(true),
});

export const updateOffenceSchema = z.object({
  title: z.string().min(3).trim().optional(),
  description: z.string().optional(),
  category: z.string().min(2).trim().optional(),
  penalty_amount: z.number().nonnegative().optional(),
  demerit_points: z.number().int().nonnegative().optional(),
  is_active: z.boolean().optional(),
});
