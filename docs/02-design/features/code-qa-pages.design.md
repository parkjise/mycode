# Code Q&A deployment design

Both frontends use the same public Supabase project and an explicit HTTPS answer URL. The `vue-answers` Edge Function verifies the user's bearer token, generates a mock answer, and writes only the answer and owner metadata. The authenticated read path uses that same user token and a row-level owner policy. The browser makes one request per paste. A production MyCode build without an API URL cannot send a request to a loopback server.

## Deployment configuration

1. Apply `supabase/migrations/20261122000000_mycode_vue_answers.sql` to the same Supabase project used by MyCode. Deploy the `vue-answers` function with JWT verification enabled. Supabase supplies the server-side environment values. Keep the service-role key inside the function runtime.
2. Set the public Vite production configuration in `.env.production` `VITE_VUE_ANSWER_NOTE_ID` to the ID of `VUE → s` and `VITE_VUE_ANSWER_API_URL` to `https://<project>.supabase.co/functions/v1/vue-answers`.
3. Build Vue Guide for GitHub Pages with that same API URL and the same public Supabase configuration. Add `https://parkjise.github.io/vue-guide/` to Supabase's authentication redirect allow list.
4. Open both published apps with the same test account. Paste a synthetic Vue question into `s`. Confirm that Code Q&A displays its mock answer and an unrelated account cannot see it.
