import { createVueAnswerHandler } from './handler.mjs';

Deno.serve(createVueAnswerHandler({
  supabaseUrl: Deno.env.get('SUPABASE_URL'),
  anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  codexOwnerId: Deno.env.get('VUE_CODEX_OWNER_ID'),
}));
