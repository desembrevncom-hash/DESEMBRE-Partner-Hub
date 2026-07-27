import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

import type { AuthCtx } from "./hooks/useAuth";

export interface RouterContext {
  queryClient: QueryClient;
  auth: AuthCtx | undefined;
}

export const getRouter = (queryClient: QueryClient) => {
  const router = createRouter({
    routeTree,
    context: { 
      queryClient,
      auth: undefined, // Initialized in main.tsx via InnerApp
    } as RouterContext,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
