import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("invitations").collect();
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
  },
});

export const create = mutation({
  args: {
    email: v.string(),
    role: v.string(),
    token: v.string(),
    bootcampId: v.optional(v.id("bootcamps")),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("invitations", {
      email: args.email.toLowerCase().trim(),
      role: args.role,
      token: args.token,
      bootcampId: args.bootcampId,
      status: "pending",
      expiresAt: args.expiresAt,
    });
  },
});

export const updateStatus = mutation({
  args: { id: v.id("invitations"), status: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

// Validate a token and return bootcamp info if valid
export const validateToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    
    if (!invitation) {
      return { valid: false, error: "Enlace inválido" };
    }
    
    if (invitation.isUsed) {
      return { valid: false, error: "Este enlace ya fue utilizado" };
    }
    
    if (invitation.expiresAt && invitation.expiresAt < Date.now()) {
      return { valid: false, error: "Este enlace ha expirado" };
    }
    
    // Get bootcamp info - handle both Convex IDs and legacy numeric IDs
    let bootcamp = null;
    const bootcamps = await ctx.db.query("bootcamps").collect();
    
    if (invitation.bootcampId) {
      // Try as Convex ID first
      try {
        const convexId = ctx.db.normalizeId("bootcamps", String(invitation.bootcampId));
        if (convexId) {
          bootcamp = await ctx.db.get(convexId);
        }
      } catch {
        // Not a valid Convex ID, try as legacy ID
      }
      
      // If not found, try as legacy ID
      if (!bootcamp) {
        const numericId = typeof invitation.bootcampId === 'number' 
          ? invitation.bootcampId 
          : parseInt(String(invitation.bootcampId), 10);
        if (!isNaN(numericId)) {
          bootcamp = bootcamps.find((b) => b.legacyId === numericId);
        }
      }
    }
    
    // Fallback to legacyBootcampId
    if (!bootcamp && invitation.legacyBootcampId) {
      bootcamp = bootcamps.find((b) => b.legacyId === invitation.legacyBootcampId);
    }
    
    return {
      valid: true,
      invitationId: invitation._id,
      bootcampId: bootcamp?._id,
      bootcampTitle: bootcamp?.title || "Bootcamp",
      legacyBootcampId: invitation.legacyBootcampId || bootcamp?.legacyId,
    };
  },
});

// Accept invitation and enroll user in bootcamp
export const acceptInvitation = mutation({
  args: { 
    token: v.string(),
    userEmail: v.string(),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find invitation by token
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    
    if (!invitation) {
      throw new Error("Enlace de invitación inválido");
    }
    
    if (invitation.isUsed) {
      throw new Error("Este enlace ya fue utilizado");
    }
    
    if (invitation.expiresAt && invitation.expiresAt < Date.now()) {
      throw new Error("Este enlace ha expirado");
    }
    
    // Find bootcamp - handle both Convex IDs and legacy numeric IDs
    let bootcamp = null;
    let bootcampId = null;
    const bootcamps = await ctx.db.query("bootcamps").collect();
    
    if (invitation.bootcampId) {
      // Try as Convex ID first
      try {
        const convexId = ctx.db.normalizeId("bootcamps", String(invitation.bootcampId));
        if (convexId) {
          bootcamp = await ctx.db.get(convexId);
          bootcampId = convexId;
        }
      } catch {
        // Not a valid Convex ID, try as legacy ID
      }
      
      // If not found, try as legacy ID
      if (!bootcamp) {
        const numericId = typeof invitation.bootcampId === 'number' 
          ? invitation.bootcampId 
          : parseInt(String(invitation.bootcampId), 10);
        if (!isNaN(numericId)) {
          bootcamp = bootcamps.find((b) => b.legacyId === numericId);
          if (bootcamp) {
            bootcampId = bootcamp._id;
          }
        }
      }
    }
    
    // Fallback to legacyBootcampId
    if (!bootcamp && invitation.legacyBootcampId) {
      bootcamp = bootcamps.find((b) => b.legacyId === invitation.legacyBootcampId);
      if (bootcamp) {
        bootcampId = bootcamp._id;
      }
    }
    
    if (!bootcampId) {
      throw new Error("No se encontró el bootcamp asociado a esta invitación");
    }
    
    const email = args.userEmail.toLowerCase().trim();
    
    // Check if user is already enrolled
    const existingEnrollment = await ctx.db
      .query("bootcampStudents")
      .filter((q) => 
        q.and(
          q.eq(q.field("bootcampId"), bootcampId),
          q.eq(q.field("email"), email)
        )
      )
      .first();
    
    if (!existingEnrollment) {
      // Get next legacyId for bootcampStudents
      const allStudents = await ctx.db.query("bootcampStudents").collect();
      const maxLegacyId = allStudents.reduce((max, s) => {
        const lid = typeof s.legacyId === "number" ? s.legacyId : 0;
        return lid > max ? lid : max;
      }, 0);
      
      // Enroll user in bootcamp
      await ctx.db.insert("bootcampStudents", {
        bootcampId: bootcampId,
        email: email,
        name: args.userName || email.split("@")[0],
        status: "active",
        enrolledAt: Date.now(),
        invitedAt: Date.now(),
        legacyId: maxLegacyId + 1,
        legacyBootcampId: bootcamp?.legacyId || invitation.legacyBootcampId,
      });
    }
    
    // Mark invitation as used
    await ctx.db.patch(invitation._id, {
      isUsed: true,
      usedBy: email,
      status: "accepted",
      updatedAt: Date.now(),
    });
    
    // Note: We don't need to create a legacyAuth record here because
    // the user is registering through Convex Auth, which handles user creation.
    // The role will be determined by the getRoleFromEmail function or from
    // the users table.
    
    return {
      success: true,
      bootcampId: bootcampId,
      bootcampTitle: bootcamp?.title || "Bootcamp",
    };
  },
});
