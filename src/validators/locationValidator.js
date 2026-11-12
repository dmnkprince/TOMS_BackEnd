import { z } from 'zod';

export const createLocationSchema = z.object({
  name: z.string().min(3, 'Location name is required').trim(),
  code: z.string().min(2, 'Location code is required (e.g. LOC-CBD-01)').trim().toUpperCase(),
  area_or_zone: z.string().min(2, 'Area or zone is required').trim(),
  is_active: z.boolean().default(true),
});

export const updateLocationSchema = z.object({
  name: z.string().min(3).trim().optional(),
  area_or_zone: z.string().min(2).trim().optional(),
  is_active: z.boolean().optional(),
});
