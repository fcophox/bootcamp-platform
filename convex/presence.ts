import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const ONLINE_TTL_MS = 60 * 1000; // 60 seconds TTL

export const heartbeat = mutation({
  args: {
    userId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        role: args.role,
        updated: now,
      });
    } else {
      await ctx.db.insert("presence", {
        userId: args.userId,
        email: args.email,
        name: args.name,
        role: args.role,
        updated: now,
      });
    }
  },
});

export const listOnline = query({
  handler: async (ctx) => {
    const cutoff = Date.now() - ONLINE_TTL_MS;
    const records = await ctx.db
      .query("presence")
      .withIndex("by_updated", (q) => q.gt("updated", cutoff))
      .collect();

    const activeUsers: Record<string, any> = {};
    for (const r of records) {
      activeUsers[r.userId] = {
        online_at: new Date(r.updated).toISOString(),
        name: r.name,
        email: r.email,
        role: r.role,
      };
    }
    return activeUsers;
  },
});
