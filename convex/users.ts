import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

/**
 * Returns the currently authenticated user's document from the "users" table.
 * Returns null if not authenticated.
 */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

/**
 * Returns the current user's email and role.
 * Checks both native users table and legacyAuth.
 */
export const getCurrentUserWithRole = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    
    // Get the user from the users table
    const user = await ctx.db.get(userId);
    if (!user) return null;
    
    const email = user.email?.toLowerCase().trim() || "";
    
    // VIP hardcoded emails (fallback for superadmins)
    if (email === 'fcojhormazabalh@gmail.com') {
      return { email, role: 'superadmin', name: user.name };
    }
    if (email === 'docente@cleverex.com') {
      return { email, role: 'docente', name: user.name };
    }
    
    // Check if user has a role in native users table
    if (user.role) {
      return { email, role: user.role, name: user.name };
    }
    
    // Check legacyAuth for role
    const legacyUsers = await ctx.db.query("legacyAuth").collect();
    const legacyUser = legacyUsers.find(
      (u) => u.email?.toLowerCase().trim() === email
    );
    
    if (legacyUser?.role) {
      return { email, role: legacyUser.role, name: user.name };
    }
    
    return { email, role: 'alumno', name: user.name };
  },
});

/**
 * Updates the profile fields of the currently authenticated user.
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    bio: v.optional(v.string()),
    location: v.optional(v.string()),
    skills: v.optional(v.string()),
    avatar: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("No autorizado");
    }
    
    // Patch user fields
    await ctx.db.patch(userId, args);
    return { success: true };
  },
});

/**
 * Returns all users (native and legacy) merged with their roles and bootcamp enrollments.
 */
export const listAllUsersWithRoles = query({
  args: {},
  handler: async (ctx) => {
    // 1. Get all native Convex users
    const nativeUsers = await ctx.db.query("users").collect();
    
    // 2. Get all legacy users
    const legacyUsers = await ctx.db.query("legacyAuth").collect();

    // 3. Get all bootcamp student enrollments and bootcamps
    const enrollments = await ctx.db.query("bootcampStudents").collect();
    const bootcamps = await ctx.db.query("bootcamps").collect();

    // Map bootcampId to bootcamp info for quick lookup
    const bootcampMap = new Map<string, { title: string; icon?: string }>();
    for (const b of bootcamps) {
      bootcampMap.set(b._id.toString(), { title: b.title, icon: b.icon });
    }

    // Map email to enrollments list
    const enrollmentMap = new Map<string, Array<{ name: string; status: string; icon?: string }>>();
    for (const e of enrollments) {
      if (!e.email) continue;
      const emailLower = e.email.toLowerCase().trim();
      const bootcampInfo = bootcampMap.get(e.bootcampId.toString());
      const title = bootcampInfo?.title || "Bootcamp";
      const icon = bootcampInfo?.icon;
      const list = enrollmentMap.get(emailLower) || [];
      list.push({ name: title, status: e.status || "active", icon });
      enrollmentMap.set(emailLower, list);
    }

    const mergedUsersMap = new Map<string, { id: string; email: string; role: string; bootcamps: Array<{ name: string; status: string; icon?: string }> }>();

    // Process legacy users first
    for (const u of legacyUsers) {
      const emailLower = u.email.toLowerCase().trim();
      mergedUsersMap.set(emailLower, {
        id: u._id.toString(),
        email: u.email,
        role: u.role || "alumno",
        bootcamps: enrollmentMap.get(emailLower) || [],
      });
    }

    // Process native users (overwrite or add new)
    for (const u of nativeUsers) {
      if (!u.email) continue;
      const emailLower = u.email.toLowerCase().trim();
      const existing = mergedUsersMap.get(emailLower);
      
      mergedUsersMap.set(emailLower, {
        id: u._id.toString(),
        email: u.email,
        role: u.role || existing?.role || "alumno",
        bootcamps: enrollmentMap.get(emailLower) || existing?.bootcamps || [],
      });
    }

    return Array.from(mergedUsersMap.values());
  },
});
