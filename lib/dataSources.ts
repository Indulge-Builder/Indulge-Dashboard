/**
 * lib/dataSources.ts
 *
 * Central registry of every external data source feeding the dashboard.
 * When adding a new integration (Salesforce, HubSpot, etc.):
 *   1. Add its DataSourceId to the union below
 *   2. Add its config entry to DATA_SOURCES
 *   3. Create its webhook route under app/api/webhooks/<id>/route.ts
 *   4. Register any new widgets that consume it in lib/widgetRegistry.ts
 */

export type DataSourceId =
  | "freshdesk"
  | "zoho-leads"
  | "zoho-deals"
  | "zoho-calls";

export interface DataSourceConfig {
  id: DataSourceId;
  webhookPath: string;
  supabaseTable: string;
  realtimeChannel: string;
  description: string;
  /** False = route scaffold exists but POST handler is not yet built. */
  implemented: boolean;
}

export const DATA_SOURCES: Record<DataSourceId, DataSourceConfig> = {
  freshdesk: {
    id: "freshdesk",
    webhookPath: "/api/webhooks/freshdesk",
    supabaseTable: "tickets",
    realtimeChannel: "dashboard-tickets",
    description:
      "Freshdesk support ticket events for Queendom concierge panels",
    implemented: true,
  },
  "zoho-leads": {
    id: "zoho-leads",
    webhookPath: "/api/webhooks/zoho-leads",
    supabaseTable: "leads",
    realtimeChannel: "leads-touches-live",
    description:
      "Zoho CRM lead create/update events for the Revenue Dashboard",
    implemented: true,
  },
  "zoho-deals": {
    id: "zoho-deals",
    webhookPath: "/api/webhooks/zoho-deals",
    supabaseTable: "deals",
    realtimeChannel: "deals-live",
    description:
      "Zoho CRM deal-closed events; dual-writes to onboarding_conversion_ledger",
    implemented: true,
  },
  "zoho-calls": {
    id: "zoho-calls",
    webhookPath: "/api/webhooks/zoho-calls",
    supabaseTable: "zoho_calls",
    realtimeChannel: "zoho-calls-live",
    description:
      "Zoho CRM call-log events — UNIMPLEMENTED. Route stub exists but has no handler.",
    implemented: false,
  },
};
