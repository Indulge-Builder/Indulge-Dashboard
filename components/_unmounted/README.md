# _unmounted/ — Staging for disconnected components

Components here are fully functional but not currently mounted in any screen.

| File | Purpose | Mount in | Notes |
|------|---------|----------|-------|
| `ActiveOutlays.tsx` | Live finance outlay tracker (Supabase Realtime) | `QueendomPanel.tsx` wrapped in `<ErrorBoundary>` | Registered in `lib/widgetRegistry.ts` as `mounted: false` |
| `OutlayLedger.tsx` | CSS-marquee scrolling outlay list | Imported by `ActiveOutlays` | Dependency of `ActiveOutlays` |
| `finance-utils.ts` | Finance helpers (PAID_EXIT_MS, parseAmount, rowToDisplay) | Imported by `ActiveOutlays` | Dependency of `ActiveOutlays` |
| `LeadVelocityChart.tsx` | Dual-series "leads attended" SVG chart (Onboarding vs Shop) | `OnboardingLayout.tsx` | Its data pipeline (`leadTrendline`/`teamAttendedTrend` in `/api/onboarding` + `performanceData` in `useOnboardingPanelData`) was removed; rebuild it before re-mounting. `TeamAttendedDay` type now lives in this file. |
| `AgentVerticalBarChart.tsx` | Per-agent stacked pipeline bar chart | `OnboardingLayout.tsx` (DepartmentColumn area) | Uses the `PipelineStatus*` types from `lib/onboardingTypes.ts`, which the live UI no longer renders. |

**To mount `ActiveOutlays`:**
1. Import `ActiveOutlays` in `components/QueendomPanel.tsx`
2. Render it wrapped: `<ErrorBoundary label="Finance"><ActiveOutlays queendomId={queendomId} /></ErrorBoundary>`
3. Update `lib/widgetRegistry.ts`: `"finance-outlays": { mounted: true, ... }`
4. Update import paths (`finance-utils.ts` back to `finance/utils.ts` etc.)
