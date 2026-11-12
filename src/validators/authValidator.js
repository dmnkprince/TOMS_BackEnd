import { z } from 'zod';
import { ALL_ROLES } from '../constants/roles.js';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export const registerUserSchema = z.object({
  full_name: z.string().min(3, 'Full name must have at least 3 characters'),
  badge_number: z.string().min(2, 'Badge number must be provided'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['agent', 'supervisor', 'admin'], {
    errorMap: () => ({ message: `Role must be one of: ${ALL_ROLES.join(', ')}` }),
  }),
  phone_number: z.string().optional(),
});

export const updateProfileSchema = z.object({
  full_name: z.string().min(3).optional(),
  phone_number: z.string().optional(),
});

export const updateRoleSchema = z.object({
  role: z.enum(['agent', 'supervisor', 'admin']),
  status: z.enum(['active', 'suspended', 'inactive']).optional(),
});
