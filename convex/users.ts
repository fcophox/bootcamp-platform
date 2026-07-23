import { query, mutation, action, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Scrypt } from "lucia";
import bcrypt from "bcryptjs";
import { internal } from "./_generated/api";

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

/**
 * Internal mutation para crear usuario desde legacy.
 */
export const createUserFromLegacyInternal = internalMutation({
  args: {
    email: v.string(),
    scryptHash: v.string(),
    bcryptHash: v.string(),
  },
  handler: async (ctx, { email, scryptHash, bcryptHash }) => {
    // Verificar si ya existe en users
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    
    if (existingUser) {
      throw new Error("El usuario ya existe en Convex Auth");
    }
    
    // Buscar en legacyAuth para obtener el rol
    const legacyUser = await ctx.db
      .query("legacyAuth")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    
    if (!legacyUser) {
      throw new Error("Usuario no encontrado en legacyAuth");
    }
    
    // Crear usuario en users
    const userId = await ctx.db.insert("users", {
      email: email,
      name: email.split("@")[0],
      role: legacyUser.role || "alumno",
    });
    
    // Crear cuenta de auth
    await ctx.db.insert("authAccounts", {
      userId: userId,
      provider: "password",
      providerAccountId: email,
      secret: scryptHash,
    } as any);
    
    // Actualizar legacyAuth
    await ctx.db.patch(legacyUser._id, {
      passwordHash: bcryptHash,
      migrated: true,
    });
    
    return { userId: userId.toString() };
  },
});

/**
 * ADMIN: Crea un usuario en Convex Auth desde legacyAuth con una contraseña temporal.
 * Útil para migrar usuarios que estaban en Supabase.
 */
export const createUserFromLegacy = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { email, password }): Promise<{ success: boolean; message: string }> => {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Crear hashes
    const scrypt = new Scrypt();
    const scryptHash = await scrypt.hash(password);
    const bcryptHash = await bcrypt.hash(password, 10);
    
    // Crear usuario usando mutation interna
    await ctx.runMutation(internal.users.createUserFromLegacyInternal, {
      email: normalizedEmail,
      scryptHash,
      bcryptHash,
    });
    
    return { success: true, message: `Usuario ${normalizedEmail} creado exitosamente con contraseña temporal` };
  },
});
