import { Role } from './roles';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export interface UserWithRole {
    id: string;
    email: string;
    role: Role;
    created_at?: string;
    updated_at?: string;
    bootcamps?: Array<{
        name: string;
        status: string;
        icon?: string;
    }>;
}

export async function getUserRoleFromDBClient(email: string): Promise<Role> {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://tame-finch-608.convex.cloud";
    const client = new ConvexHttpClient(convexUrl);
    try {
        const role = await client.query(api.legacyAuth.getRoleByEmail, { email });
        return (role as Role) || 'alumno';
    } catch {
        return 'alumno';
    }
}

export async function getAllUsersWithRoles(): Promise<UserWithRole[]> {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://tame-finch-608.convex.cloud";
    const client = new ConvexHttpClient(convexUrl);
    try {
        const users = await client.query(api.users.listAllUsersWithRoles);
        return (users as any[]) || [];
    } catch (e) {
        console.error("Error in getAllUsersWithRoles client:", e);
        return [];
    }
}
