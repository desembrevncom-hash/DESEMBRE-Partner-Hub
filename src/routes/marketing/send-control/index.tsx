// @ts-nocheck
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import SendControlDashboard from "@/pages/Marketing/SendControl/SendControlDashboard";

export const Route = createFileRoute("/marketing/send-control/")({
  component: SendControlRoute,
});

function SendControlRoute() {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !isAdmin && !isSubAdmin) {
      // Block sale/telesale/tele_lead
      navigate({ to: "/" });
    }
  }, [user, isAdmin, isSubAdmin, navigate]);

  if (!isAdmin && !isSubAdmin) {
    return null; // or a blocking screen
  }

  return <SendControlDashboard />;
}
