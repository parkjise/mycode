# Code Q&A deployment design

Both frontends use the same public Supabase project and an explicit HTTPS answer URL. The `vue-answers` Edge Function verifies the user's bearer token, generates a mock answer, and writes only the answer and owner metadata. The authenticated read path uses that same user token and a row-level owner policy. The browser makes one request per paste. A production MyCode build without an API URL cannot send a request to a loopback server.

## Deployment configuration

1. Apply `supabase/migrations/20261122000000_mycode_vue_answers.sql` to the same Supabase project used by MyCode. Deploy the `vue-answers` function with JWT verification enabled. Supabase supplies the server-side environment values. Keep the service-role key inside the function runtime.
2. Set the public Vite production configuration in `.env.production` `VITE_VUE_ANSWER_NOTE_ID` to the ID of `VUE → s` and `VITE_VUE_ANSWER_API_URL` to `https://<project>.supabase.co/functions/v1/vue-answers`.
3. Build Vue Guide for GitHub Pages with that same API URL and the same public Supabase configuration. Add `https://parkjise.github.io/vue-guide/` to Supabase's authentication redirect allow list.
4. Open both published apps with the same test account. Paste a synthetic Vue question into `s`. Confirm that Code Q&A displays its mock answer and an unrelated account cannot see it.

## Personal Codex mode

Run `codex login status` on the Mac with the intended ChatGPT account, then `npm run codex:bridge` from the MyCode folder. Keep the bridge running while using Code Q&A. It listens on `127.0.0.1:8798`. When the browser asks for local network permission, allow the connection only for the official MyCode site on the Mac running the bridge.

The hosted `VUE_CODEX_OWNER_ID` setting identifies the one approved Supabase user. The bridge checks this identity before running Codex, passes the question on standard input of an ephemeral session, and sends only the generated answer back to the hosted service. Production Code Q&A uses `VITE_VUE_ANSWER_MODE=codex` to route pastes to the bridge. The existing Vue Guide page reads the results through its current answer endpoint. Paste only public code or personal examples. The Mac and bridge must be available at the time of the paste.
