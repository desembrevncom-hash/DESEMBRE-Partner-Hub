import { createFileRoute } from "@tanstack/react-router";
import ConsentDashboard from "@/pages/Marketing/Consent";

export const Route = createFileRoute("/marketing/consent")({
  component: ConsentDashboard,
});
