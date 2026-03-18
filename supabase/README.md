# Supabase Migrations

## Running migrations

Apply migrations via the Supabase Dashboard SQL Editor or CLI.

### Add `is_escalated` column (SLA escalation tracking)

Run the SQL in `migrations/20250318000000_add_is_escalated.sql`:

```sql
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN NOT NULL DEFAULT false;
```

The `tickets` table is already in the `supabase_realtime` publication, so the new column is automatically included in replication — no additional `ALTER PUBLICATION` is needed.
