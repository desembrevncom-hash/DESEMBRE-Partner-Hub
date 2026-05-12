export type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
};

export type RoleRow = {
  user_id: string;
  role: "admin" | "sale";
};
