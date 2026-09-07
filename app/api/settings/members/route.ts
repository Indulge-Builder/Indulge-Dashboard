/**
 * /api/settings/members — add / list / edit / remove rows in the `members` table.
 *
 * This is the "new client" path: a row here is what the Queendom panel's
 * "Latest Assignments" list reads via /api/renewals-panel. It deliberately does
 * NOT write the `clients` table — that one is owned by the external membership
 * sync, and duplicating a subscription record here would double-count the
 * Active/Expired tiles on /api/clients.
 */

import { createClientRowRoutes } from "@/lib/settingsClientRows";

export const { GET, POST, PATCH, DELETE } = createClientRowRoutes("members");
