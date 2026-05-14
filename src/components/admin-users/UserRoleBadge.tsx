interface UserRoleBadgeProps {
  role: "admin" | "sub_admin" | "sale" | "tele_lead" | "telesale" | string;
}

export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary text-primary-foreground tracking-wider uppercase">
        ADMIN
      </span>
    );
  }

  if (role === "sub_admin") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-600 text-white tracking-wider uppercase">
        PHÓ ADMIN
      </span>
    );
  }

  if (role === "tele_lead") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white tracking-wider uppercase">
        TRƯỞNG TELE
      </span>
    );
  }

  if (role === "telesale") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 tracking-wider uppercase">
        TELESALE
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-600 text-white tracking-wider uppercase">
      SALE
    </span>
  );
}
