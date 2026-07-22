import { action, internalQuery, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";
import { internal } from "./_generated/api";

export const getLegacyUserInternal = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const emailLower = args.email.toLowerCase().trim();
    const user = await ctx.db
      .query("legacyAuth")
      .withIndex("by_email", (q) => q.eq("email", emailLower))
      .first();
    return user;
  },
});

export const markLegacyMigrated = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const emailLower = args.email.toLowerCase().trim();
    const user = await ctx.db
      .query("legacyAuth")
      .withIndex("by_email", (q) => q.eq("email", emailLower))
      .first();
    if (user) {
      await ctx.db.patch(user._id, { migrated: true });
    }
  },
});

export const checkLegacyUser = action({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args): Promise<{ isLegacy: boolean; valid: boolean; role?: string; supabaseUserId?: string }> => {
    const emailLower = args.email.toLowerCase().trim();
    const internalApi: any = internal;
    const legacyUser: any = await ctx.runQuery(internalApi.legacyAuth.getLegacyUserInternal, { email: emailLower });

    // 1. If bcrypt hash exists in legacyAuth, compare via bcrypt
    if (legacyUser && legacyUser.passwordHash && legacyUser.passwordHash.length > 0) {
      try {
        const isValidBcrypt = await bcrypt.compare(args.password, legacyUser.passwordHash);
        if (isValidBcrypt) {
          await ctx.runMutation(internalApi.legacyAuth.markLegacyMigrated, { email: emailLower });
          return {
            isLegacy: true,
            valid: true,
            role: legacyUser.role || "alumno",
            supabaseUserId: legacyUser.supabaseUserId,
          };
        }
      } catch (e) {
        console.error("Bcrypt compare error:", e);
      }
    }

    // 2. Direct Supabase Auth API verification (for legacy users exported via API)
    const supaUrl = "https://yqforywzwrdfzpcuqjuw.supabase.co";
    const supaAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZm9yeXd6d3JkZnpwY3VxanV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDgwMzAsImV4cCI6MjA4NTE4NDAzMH0.FS0sB1ClTwEAC7gJU-0p7SsCHAoGC1_mB4AMFPl8PBo";

    try {
      const response = await fetch(`${supaUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supaAnonKey,
        },
        body: JSON.stringify({ email: emailLower, password: args.password }),
      });

      if (response.ok) {
        const supaData = await response.json();
        const role = legacyUser?.role || supaData.user?.user_metadata?.role || "alumno";
        await ctx.runMutation(internalApi.legacyAuth.markLegacyMigrated, { email: emailLower });
        return {
          isLegacy: true,
          valid: true,
          role,
          supabaseUserId: legacyUser?.supabaseUserId || supaData.user?.id,
        };
      }
    } catch (err) {
      console.error("Error verifying password against Supabase Auth API:", err);
    }

    if (legacyUser) {
      return { isLegacy: true, valid: false };
    }

    return { isLegacy: false, valid: false };
  },
});

export const getRoleByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const term = args.email.toLowerCase().trim();
    
    // 0. VIP hardcoded emails (fallback for superadmins)
    if (term === 'fcojhormazabalh@gmail.com') return 'superadmin';
    if (term === 'docente@cleverex.com') return 'docente';
    
    // 1. Try legacyAuth by email, supabaseUserId, or _id
    const legacyUsers = await ctx.db.query("legacyAuth").collect();
    const legacyUser = legacyUsers.find(
      (u) =>
        u.email?.toLowerCase().trim() === term ||
        u.supabaseUserId === args.email ||
        u._id.toString() === args.email
    );

    if (legacyUser && legacyUser.role) {
      return legacyUser.role;
    }

    // 2. Try native users table by email or _id
    const nativeUsers = await ctx.db.query("users").collect();
    const nativeUser = nativeUsers.find(
      (u) =>
        u.email?.toLowerCase().trim() === term ||
        u._id.toString() === args.email
    );

    return (nativeUser as any)?.role || "alumno";
  },
});
