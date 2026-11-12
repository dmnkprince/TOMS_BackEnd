import { z } from 'zod';

export const createCorrectionSchema = z.object({
  incident_id: z.string().uuid('Valid incident UUID is required'),
  reason: z.string().min(10, 'Reason must be at least 10 characters explaining the correction'),
  proposed_changes: z.record(z.any()).refine(
    (obj) => Object.keys(obj).length > 0,
    { message: 'proposed_changes must contain at least one field to update' }
  ),
});

export const reviewCorrectionSchema = z.object({
  status: z.enum(['approved', 'rejected'], {
    errorMap: () => ({ message: "Status must be either 'approved' or 'rejected'" }),
  }),
  rejection_reason: z.string().optional(),
}).refine(
  (data) => data.status !== 'rejected' || (data.rejection_reason && data.rejection_reason.trim().length > 0),
  {
    message: 'A rejection reason is required when rejecting a correction request',
    path: ['rejection_reason'],
  }
);
