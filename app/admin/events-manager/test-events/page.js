// Re-export of the shared implementation in the dashboard tree.
// admin and dashboard render identical UI; role routing lives in proxy.ts.
// Single source of truth avoids the two trees drifting apart.
export { default } from "@/app/dashboard/events-manager/test-events/page";
export * from "@/app/dashboard/events-manager/test-events/page";
