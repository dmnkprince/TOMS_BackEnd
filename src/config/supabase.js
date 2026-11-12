import { createClient } from '@supabase/supabase-js';
import { ENV } from './env.js';

// Public Supabase Client (uses anon key)
export const supabase = createClient(
  ENV.SUPABASE_URL,
  ENV.SUPABASE_ANON_KEY || 'dummy_anon_key'
);

// Admin Supabase Client (uses service_role secret key - server side only!)
export const supabaseAdmin = createClient(
  ENV.SUPABASE_URL,
  ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_ANON_KEY || 'dummy_service_role_key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
