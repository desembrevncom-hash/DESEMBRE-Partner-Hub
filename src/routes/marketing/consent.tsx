import { createFileRoute, redirect } from "@tanstack/react-router";
import ConsentDashboard from "@/pages/Marketing/Consent";

export const Route = createFileRoute("/marketing/consent")({
  beforeLoad: ({ context }) => {
    // Only admin and sub_admin are allowed to access M8 Consent Registry
    const { isAdmin, isSubAdmin } = context.auth;
    if (!isAdmin && !isSubAdmin) {
      throw redirect({
        to: "/marketing",
      });
    }
  },
  component: ConsentDashboard,
});
