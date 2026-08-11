/**
 * /api/settings/renewals — add / list / remove rows in the `renewals` table.
 *
 * Feeds the Queendom panel's "Renewals This Month" count and latest-renewals
 * list via /api/renewals-panel. `created_at` is the renewal DATE, not the
 * insert time — see lib/settingsClientRows.ts.
 */

import { createClientRowRoutes } from "@/lib/settingsClientRows";

export const { GET, POST, DELETE } = createClientRowRoutes("renewals");
