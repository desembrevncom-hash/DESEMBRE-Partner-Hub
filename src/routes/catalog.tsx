import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/catalog")({
  component: () => <Navigate to="/san-pham" replace />,
});
