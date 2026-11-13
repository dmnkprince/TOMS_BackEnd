import { z } from 'zod';

const offenceItemSchema = z.object({
  offence_type_id: z.string().min(1, 'Offence type ID format required'),
  fine_amount: z.number().nonnegative('Fine amount must be greater than or equal to 0').optional(),
  notes: z.string().optional().nullable(),
});

export const registerIncidentSchema = z
  .object({
    plate_number: z.string().min(2, 'Plate number is required').trim().toUpperCase().optional(),
    vehiclePlate: z.string().min(2, 'Plate number is required').trim().toUpperCase().optional(),
    body_number: z.string().optional().nullable(),
    vehicle_make: z.string().optional().default('Standard'),
    vehicleMake: z.string().optional(),
    vehicle_model: z.string().optional().default('Standard'),
    vehicleModel: z.string().optional(),
    vehicle_color: z.string().optional().default('Standard'),
    vehicleColor: z.string().optional(),
    vehicle_type: z.string().optional().default('Car'),
    vehicleType: z.string().optional(),
    vehicle_owner_name: z.string().optional().nullable(),
    vehicle_owner_phone: z.string().optional().nullable(),
    driver_license_number: z.string().optional().nullable(),
    driver_name: z.string().optional().nullable(),
    driverName: z.string().optional().nullable(),
    time: z.string().optional().nullable(),
    
    location_id: z.string().optional().nullable(),
    manual_location: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    location_description: z.string().optional().nullable(),

    incident_date: z.string().optional().nullable(),
    date: z.string().optional().nullable(),
    remarks: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    offenceType: z.string().optional().nullable(),

    offences: z
      .array(offenceItemSchema)
      .optional()
      .default([]),
  })
  .refine(
    (data) => Boolean(data.plate_number || data.vehiclePlate),
    {
      message: 'Vehicle Plate / Body Number is required.',
      path: ['plate_number'],
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
  agent_id: z.string().optional(),
  location_id: z.string().optional(),
  reference_number: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
