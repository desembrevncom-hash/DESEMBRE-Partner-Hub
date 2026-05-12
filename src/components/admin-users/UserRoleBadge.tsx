interface UserRoleBadgeProps {
  role: "admin" | "sale";
}

export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary text-primary-foreground tracking-wider uppercase">
        Admin
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-600 text-white tracking-wider uppercase">
      Sale
    </span>
  );
}
