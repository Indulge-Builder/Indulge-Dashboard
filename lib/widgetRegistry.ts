/**
 * lib/widgetRegistry.ts
 *
 * Central registry of every dashboard widget.
 * When adding a new widget:
 *   1. Add its WidgetId to the union below
 *   2. Add its config entry to WIDGETS (mark mounted: false until ready to mount)
 *   3. Create its component file
 *   4. Mount it in the appropriate screen component (QueendomPanel or OnboardingLayout)
 */

import type { DataSourceId } from "./dataSources";

export type WidgetId =
  | "queendom-panel"
  | "agent-leaderboard"
  | "joker-metrics"
  | "renewals-panel"
  | "special-dates"
  | "recommendation-ticker"
  | "onboarding-panel"
  | "conversion-ledger"
  | "performance-graph"
  | "lead-status-bar"
  | "finance-outlays";

export interface WidgetConfig {
  id: WidgetId;
  screen: "concierge" | "onboarding" | "both";
  dataSources: DataSourceId[];
  /** False = component exists but is not mounted in any screen. */
  mounted: boolean;
  description: string;
}

export const WIDGETS: Record<WidgetId, WidgetConfig> = {
  "queendom-panel": {
    id: "queendom-panel",
    screen: "concierge",
    dataSources: ["freshdesk"],
    mounted: true,
    description:
      "Full concierge panel per Queendom (tickets + agents + jokers + renewals)",
  },
  "agent-leaderboard": {
    id: "agent-leaderboard",
    screen: "concierge",
    dataSources: ["freshdesk"],
    mounted: true,
    description: "Per-agent task stats table with SVG ring icons",
  },
  "joker-metrics": {
    id: "joker-metrics",
    screen: "concierge",
    dataSources: ["freshdesk"],
    mounted: true,
    description: "Joker suggestion stats strip",
  },
  "renewals-panel": {
    id: "renewals-panel",
    screen: "concierge",
    dataSources: ["freshdesk"],
    mounted: true,
    description: "Renewals and new member assignments widget",
  },
  "special-dates": {
    id: "special-dates",
    screen: "concierge",
    dataSources: [],
    mounted: true,
    description: "Static client birthday and anniversary calendar",
  },
  "recommendation-ticker": {
    id: "recommendation-ticker",
    screen: "both",
    dataSources: ["freshdesk"],
    mounted: true,
    description: "Horizontal scrolling joker recommendation ticker",
  },
  "onboarding-panel": {
    id: "onboarding-panel",
    screen: "onboarding",
    dataSources: ["zoho-leads", "zoho-deals"],
    mounted: true,
    description:
      "Revenue dashboard with agent cards, ledger, performance graph",
  },
  "conversion-ledger": {
    id: "conversion-ledger",
    screen: "onboarding",
    dataSources: ["zoho-deals"],
    mounted: true,
    description: "Live scrolling sales conversion ledger",
  },
  "performance-graph": {
    id: "performance-graph",
    screen: "onboarding",
    dataSources: ["zoho-leads", "zoho-deals"],
    mounted: true,
    description: "SVG multi-line performance graph by business vertical",
  },
  "lead-status-bar": {
    id: "lead-status-bar",
    screen: "onboarding",
    dataSources: ["zoho-leads"],
    mounted: true,
    description: "Segmented pipeline health bar by lead status",
  },
  "finance-outlays": {
    id: "finance-outlays",
    screen: "concierge",
    dataSources: [],
    mounted: false,
    description:
      "UNMOUNTED — Finance outlay tracker (components/finance/ActiveOutlays.tsx). " +
      "Mount in QueendomPanel wrapped in <ErrorBoundary> when product requires it.",
  },
};
