import { createFileRoute } from "@tanstack/react-router";
import { CustomerImportPage } from "@/pages/customers/CustomerImportPage";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/customers/import")({
  component: CustomerImportRoute,
});

function CustomerImportRoute() {
  const { session } = useAuth();
  if (!session) return null;
  return <CustomerImportPage />;
}
