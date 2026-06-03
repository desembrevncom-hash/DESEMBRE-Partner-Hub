import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./hooks/useAuth";
import { getRouter } from "./router";
import "./styles.css";

// Safe conditional Geolocation mock for headless browser test verification
if (typeof window !== "undefined" && navigator.geolocation) {
  const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
  navigator.geolocation.getCurrentPosition = function (success, error, options) {
    const mockLat = localStorage.getItem("mock_gps_lat");
    const mockLng = localStorage.getItem("mock_gps_lng");
    if (mockLat && mockLng) {
      setTimeout(() => {
        success({
          coords: {
            latitude: Number(mockLat),
            longitude: Number(mockLng),
            accuracy: 15,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          } as GeolocationCoordinates,
          timestamp: Date.now(),
        } as GeolocationPosition);
      }, 200);
    } else if (originalGetCurrentPosition) {
      originalGetCurrentPosition.call(navigator.geolocation, success, error, options);
    }
  };
}

const queryClient = new QueryClient();
const router = getRouter(queryClient);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
