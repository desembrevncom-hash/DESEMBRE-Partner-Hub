import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/products/")({
  component: () => <Navigate to="/san-pham" replace />,
});
