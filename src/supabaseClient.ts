import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wsgsfkgqrkfijcgxhzxp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vFMUEfpjB1RJQm47xrealwg_3wf2h3wf';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);