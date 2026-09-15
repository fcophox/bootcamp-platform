import { query, mutation, action, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Scrypt } from "lucia";
import bcrypt from "bcryptjs";
import { internal } from "./_generated/api";
import { getVipRole } from "../lib/vipEmails";

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
    
    // VIP hardcoded emails (fallback for superadmins). Shared with
    // utils/roles.ts via lib/vipEmails.ts -- this list used to be a separate
    // literal here and had drifted out of sync with that one.
    const vipRole = getVipRole(email);
    if (vipRole) {
      return { email, role: vipRole, name: user.name };
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

export const deleteUserEverywhere = mutation({
  args: {
    userId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const requesterId = await getAuthUserId(ctx);
    if (!requesterId) {
      throw new Error("No autorizado");
    }

    const requester = await ctx.db.get(requesterId);
    const requesterEmail = requester?.email?.toLowerCase().trim() || "";
    const requesterVipRole = getVipRole(requesterEmail);
    let requesterRole = requesterVipRole || requester?.role || null;

    if (!requesterRole) {
      const legacyUsers = await ctx.db.query("legacyAuth").collect();
      const legacyRequester = legacyUsers.find(
        (user) => user.email.toLowerCase().trim() === requesterEmail
      );
      requesterRole = legacyRequester?.role || null;
    }

    if (requesterRole !== "superadmin") {
      throw new Error("No autorizado");
    }

    const normalizedEmail = args.email.toLowerCase().trim();
    if (!normalizedEmail) {
      throw new Error("Email inválido");
    }

    let nativeUserId = ctx.db.normalizeId("users", args.userId);
    if (!nativeUserId) {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", normalizedEmail))
        .first();
      nativeUserId = user?._id || null;
    }

    if (nativeUserId === requesterId) {
      throw new Error("No puedes eliminar tu propio usuario.");
    }

    const nativeUserIdString = nativeUserId?.toString();

    const legacyUsers = await ctx.db.query("legacyAuth").collect();
    for (const legacyUser of legacyUsers) {
      if (
        legacyUser._id.toString() === args.userId ||
        legacyUser.supabaseUserId === args.userId ||
        legacyUser.email.toLowerCase().trim() === normalizedEmail
      ) {
        await ctx.db.delete(legacyUser._id);
      }
    }

    const enrollments = await ctx.db.query("bootcampStudents").collect();
    for (const enrollment of enrollments) {
      if (
        enrollment.userId === args.userId ||
        (nativeUserIdString && enrollment.userId === nativeUserIdString) ||
        enrollment.email?.toLowerCase().trim() === normalizedEmail
      ) {
        await ctx.db.delete(enrollment._id);
      }
    }

    const presenceRows = await ctx.db.query("presence").collect();
    for (const presence of presenceRows) {
      if (
        presence.userId === args.userId ||
        (nativeUserIdString && presence.userId === nativeUserIdString) ||
        presence.email.toLowerCase().trim() === normalizedEmail
      ) {
        await ctx.db.delete(presence._id);
      }
    }

    if (nativeUserId) {
      const sessions = await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", nativeUserId))
        .collect();
      for (const session of sessions) {
        const refreshTokens = await ctx.db
          .query("authRefreshTokens")
          .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
          .collect();
        for (const refreshToken of refreshTokens) {
          await ctx.db.delete(refreshToken._id);
        }
        await ctx.db.delete(session._id);
      }

      const accounts = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", nativeUserId))
        .collect();
      for (const account of accounts) {
        const verificationCodes = await ctx.db
          .query("authVerificationCodes")
          .withIndex("accountId", (q) => q.eq("accountId", account._id))
          .collect();
        for (const code of verificationCodes) {
          await ctx.db.delete(code._id);
        }
        await ctx.db.delete(account._id);
      }

      const verifiers = await ctx.db.query("authVerifiers").collect();
      for (const verifier of verifiers) {
        if (sessions.some((session) => session._id === verifier.sessionId)) {
          await ctx.db.delete(verifier._id);
        }
      }

      await ctx.db.delete(nativeUserId);
    }

    return { success: true };
  },
});

export const associateUserToBootcamp = mutation({
  args: {
    userId: v.string(),
    email: v.string(),
    bootcampId: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim();
    if (!normalizedEmail) {
      throw new Error("Email inválido");
    }

    let bootcampId = ctx.db.normalizeId("bootcamps", args.bootcampId);
    let bootcamp = bootcampId ? await ctx.db.get(bootcampId) : null;

    if (!bootcamp) {
      const legacyId = parseInt(args.bootcampId, 10);
      if (!Number.isNaN(legacyId)) {
        const bootcamps = await ctx.db.query("bootcamps").collect();
        bootcamp = bootcamps.find((item) => item.legacyId === legacyId) || null;
        bootcampId = bootcamp?._id || null;
      }
    }

    if (!bootcamp || !bootcampId) {
      throw new Error("Bootcamp no encontrado");
    }

    let nativeUserId = ctx.db.normalizeId("users", args.userId);
    if (!nativeUserId) {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", normalizedEmail))
        .first();
      nativeUserId = user?._id || null;
    }

    const existingEnrollment = await ctx.db
      .query("bootcampStudents")
      .filter((q) =>
        q.and(
          q.eq(q.field("bootcampId"), bootcampId),
          q.eq(q.field("email"), normalizedEmail)
        )
      )
      .first();

    if (existingEnrollment) {
      throw new Error("Este usuario ya está asociado a ese bootcamp.");
    }

    const enrollments = await ctx.db.query("bootcampStudents").collect();
    const maxLegacyId = enrollments.reduce((max, enrollment) => {
      const legacyId = typeof enrollment.legacyId === "number" ? enrollment.legacyId : 0;
      return legacyId > max ? legacyId : max;
    }, 0);

    const enrollment: {
      bootcampId: typeof bootcampId;
      userId?: string;
      email: string;
      name: string;
      status: string;
      invitedAt: number;
      enrolledAt: number;
      legacyId: number;
      legacyBootcampId?: unknown;
    } = {
      bootcampId,
      email: normalizedEmail,
      name: normalizedEmail.split("@")[0],
      status: "active",
      invitedAt: Date.now(),
      enrolledAt: Date.now(),
      legacyId: maxLegacyId + 1,
    };

    if (nativeUserId) {
      enrollment.userId = nativeUserId.toString();
    } else {
      enrollment.userId = args.userId;
    }

    if (bootcamp.legacyId !== undefined) {
      enrollment.legacyBootcampId = bootcamp.legacyId;
    }

    await ctx.db.insert("bootcampStudents", enrollment);

    return {
      success: true,
      bootcamp: {
        id: bootcampId.toString(),
        title: bootcamp.title,
        icon: bootcamp.icon,
      },
    };
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
