export type UserRole = "admin" | "sale" | "guest";

export function canAccessAdminPage(role: UserRole) {
  return role === "admin";
}

export function canCreateOrder(role: UserRole) {
  return role === "admin" || role === "sale";
}

export function canManageUsers(role: UserRole) {
  return role === "admin";
}

export function canEditProduct(role: UserRole) {
  return role === "admin";
}

export function canViewOrdersMenu(role: UserRole) {
  return role === "admin" || role === "sale";
}

export function getRouteAccessDecision(route: string, role: UserRole) {
  if (route.startsWith("/admin")) {
    return {
      allowed: role === "admin",
      redirectTo: role === "guest" ? "/login" : "/",
    };
  }

  if (route.startsWith("/orders")) {
    return {
      allowed: role === "admin" || role === "sale",
      redirectTo: "/login",
    };
  }

  return { allowed: true };
}
