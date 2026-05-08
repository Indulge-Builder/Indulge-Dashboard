# zoho-calls webhook — UNIMPLEMENTED

This directory is a scaffold for Zoho CRM call-log events.

**Status:** No `route.ts` exists. The data source is registered in `lib/dataSources.ts`
with `implemented: false`.

**To implement:**
1. Create `route.ts` in this directory.
2. Use `withWebhookGuard` from `lib/webhookGuard.ts` with a body validator.
3. Create the target Supabase table and migration.
4. Update `lib/dataSources.ts`: `implemented: true`.
5. Add a Realtime subscription in the appropriate hook.
6. Add a widget entry in `lib/widgetRegistry.ts`.
