import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Role } from "./roles";

export async function getUserRoleFromDB(email: string): Promise<Role> {
  try {
    const role = await fetchQuery(api.legacyAuth.getRoleByEmail, { email });
    return (role as Role) || "alumno";
  } catch (error) {
    console.error("Error fetching user role from Convex:", error);
    return "alumno";
  }
}
