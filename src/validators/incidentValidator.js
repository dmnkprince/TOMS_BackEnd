import { z } from 'zod';

const offenceItemSchema = z.object({
  offence_type_id: z.string().uuid('Invalid offence type ID format'),
  fine_amount: z.number().nonnegative('Fine amount must be greater than or equal to 0').optional(),
  notes: z.string().optional(),
});

export const registerIncidentSchema = z
  .object({
    plate_number: z.string().min(2, 'Plate number is required (min 2 characters)').trim().toUpperCase(),
    body_number: z.string().optional().nullable(),
    vehicle_make: z.string().min(1, 'Vehicle make is required').trim(),
    vehicle_model: z.string().min(1, 'Vehicle model is required').trim(),
    vehicle_color: z.string().min(1, 'Vehicle color is required').trim(),
    vehicle_type: z.string().min(1, 'Vehicle type is required (e.g. sedan, truck, motorcycle)').trim(),
    vehicle_owner_name: z.string().optional().nullable(),
    vehicle_owner_phone: z.string().optional().nullable(),
    driver_license_number: z.string().optional().nullable(),
    driver_name: z.string().optional().nullable(),
    
    location_id: z.string().uuid('Invalid location UUID').optional().nullable(),
    manual_location: z.string().optional().nullable(),
    location_description: z.string().optional().nullable(),

    incident_date: z.string().datetime({ offset: true }).optional().nullable(),
    remarks: z.string().optional().nullable(),

    offences: z
      .array(offenceItemSchema)
      .min(1, 'An incident must contain at least one offence.'),
  })
  .refine(
    (data) => Boolean(data.location_id || (data.manual_location && data.manual_location.trim().length > 0)),
    {
      message: 'Either a predefined location_id or a manual_location must be provided.',
      path: ['location_id'],
    }
  );

export const incidentSearchQuerySchema = z.object({
  plate_number: z.string().optional(),
  body_number: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  vehicle_type: z.string().optional(),
  vehicle_make: z.string().optional(),
  vehicle_model: z.string().optional(),
  category: z.string().optional(),
  agent_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
  reference_number: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
