import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";
import { Scrypt } from "lucia";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Genera un token de recuperación de contraseña para un email.
 * Invalida tokens anteriores para el mismo email.
 */
export const createResetToken = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, { email }) => {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Verificar si el usuario existe (en users o legacyAuth)
    const users = await ctx.db.query("users").collect();
    const legacyUsers = await ctx.db.query("legacyAuth").collect();
    
    const userExists = users.some(u => u.email?.toLowerCase().trim() === normalizedEmail) ||
                       legacyUsers.some(u => u.email?.toLowerCase().trim() === normalizedEmail);
    
    if (!userExists) {
      // No revelamos si el email existe o no por seguridad
      // Pero retornamos un resultado que indica que se "envió" el email
      return { success: true, token: null, userExists: false };
    }
    
    // Invalidar tokens anteriores para este email
    const existingTokens = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .collect();
    
    for (const token of existingTokens) {
      if (!token.usedAt) {
        await ctx.db.patch(token._id, { usedAt: Date.now() });
      }
    }
    
    // Generar nuevo token (64 caracteres aleatorios)
    const token = generateSecureToken();
    
    // Token expira en 1 hora
    const expiresAt = Date.now() + 60 * 60 * 1000;
    
    await ctx.db.insert("passwordResetTokens", {
      email: normalizedEmail,
      token,
      expiresAt,
      createdAt: Date.now(),
    });
    
    return { success: true, token, userExists: true };
  },
});

/**
 * Valida un token de recuperación de contraseña.
 */
export const validateResetToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    console.log("[validateResetToken] Validating token:", token.substring(0, 10) + "...");
    
    const resetToken = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    
    if (!resetToken) {
      console.log("[validateResetToken] Token not found in database");
      return { valid: false, error: "El enlace no es válido." };
    }
    
    console.log("[validateResetToken] Token found, usedAt:", resetToken.usedAt, "expiresAt:", resetToken.expiresAt, "now:", Date.now());
    
    if (resetToken.usedAt) {
      return { valid: false, error: "Este enlace ya fue utilizado." };
    }
    
    if (resetToken.expiresAt < Date.now()) {
      return { valid: false, error: "El enlace ha expirado. Solicita uno nuevo." };
    }
    
    return { valid: true, email: resetToken.email };
  },
});

/**
 * Marca un token como usado después de restablecer la contraseña.
 */
export const markTokenAsUsed = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    console.log("[markTokenAsUsed] CALLED with token:", token.substring(0, 10) + "...");
    console.log("[markTokenAsUsed] Stack trace attempt");
    
    const resetToken = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    
    if (!resetToken) {
      throw new Error("Token no encontrado");
    }
    
    await ctx.db.patch(resetToken._id, { usedAt: Date.now() });
    
    return { success: true };
  },
});

/**
 * Obtiene el email asociado a un token válido (para usar en el reset).
 */
export const getEmailFromToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    const resetToken = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < Date.now()) {
      return null;
    }
    
    return resetToken.email;
  },
});

/**
 * Genera un token seguro de 64 caracteres.
 */
function generateSecureToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Internal mutation para actualizar la contraseña en authAccounts.
 */
export const updatePasswordInternal = internalMutation({
  args: {
    email: v.string(),
    passwordHash: v.string(),      // Scrypt hash para Convex Auth
    bcryptHash: v.optional(v.string()),  // Bcrypt hash para legacyAuth
  },
  handler: async (ctx, { email, passwordHash, bcryptHash }) => {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Buscar el usuario en la tabla users
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalizedEmail))
      .first();
    
    if (!user) {
      throw new Error("Usuario no encontrado");
    }
    
    // Buscar la cuenta de autenticación asociada
    const authAccounts = await ctx.db.query("authAccounts").collect();
    const account = authAccounts.find(
      (a: any) => a.userId?.toString() === user._id.toString() && a.provider === "password"
    );
    
    if (account) {
      // Actualizar el hash de la contraseña en authAccounts (Scrypt)
      await ctx.db.patch(account._id, { secret: passwordHash });
    } else {
      // Si no existe cuenta password, crear una nueva
      await ctx.db.insert("authAccounts", {
        userId: user._id,
        provider: "password",
        providerAccountId: normalizedEmail,
        secret: passwordHash,
      } as any);
    }
    
    // También actualizar en legacyAuth si existe (con bcrypt hash)
    const legacyUser = await ctx.db
      .query("legacyAuth")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();
    
    if (legacyUser && bcryptHash) {
      await ctx.db.patch(legacyUser._id, { 
        passwordHash: bcryptHash,
        migrated: true 
      });
    }
    
    return { success: true };
  },
});

/**
 * Action para resetear la contraseña usando un token válido.
 * Hashea la nueva contraseña y la guarda.
 */
export const resetPassword = action({
  args: {
    token: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { token, newPassword }): Promise<{ success: boolean; email: string }> => {
    // Validar el token
    const resetToken = await ctx.runQuery(internal.passwordReset.getResetTokenInternal, { token }) as {
      email: string;
      token: string;
      expiresAt: number;
      usedAt?: number;
      createdAt: number;
    } | null;
    
    if (!resetToken) {
      throw new Error("El enlace no es válido.");
    }
    
    if (resetToken.usedAt) {
      throw new Error("Este enlace ya fue utilizado.");
    }
    
    if (resetToken.expiresAt < Date.now()) {
      throw new Error("El enlace ha expirado. Solicita uno nuevo.");
    }
    
    // Validar la contraseña
    if (!newPassword || newPassword.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres.");
    }
    
    // Hashear la nueva contraseña con Scrypt (mismo algoritmo que usa Convex Auth)
    const scrypt = new Scrypt();
    const passwordHash = await scrypt.hash(newPassword);
    
    // También crear hash bcrypt para legacyAuth (compatibilidad)
    const bcryptHash = await bcrypt.hash(newPassword, 10);
    
    // Actualizar la contraseña en la base de datos
    await ctx.runMutation(internal.passwordReset.updatePasswordInternal, {
      email: resetToken.email,
      passwordHash,        // Scrypt hash para authAccounts
      bcryptHash,          // Bcrypt hash para legacyAuth
    });
    
    // Marcar el token como usado
    await ctx.runMutation(internal.passwordReset.markTokenAsUsedInternal, { token });
    
    return { success: true, email: resetToken.email };
  },
});

/**
 * Internal query para obtener el token de reset.
 */
export const getResetTokenInternal = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    return await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
  },
});

/**
 * Internal mutation para marcar el token como usado.
 */
export const markTokenAsUsedInternal = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    console.log("[markTokenAsUsedInternal] CALLED with token:", token.substring(0, 10) + "...");
    
    const resetToken = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    
    if (resetToken) {
      await ctx.db.patch(resetToken._id, { usedAt: Date.now() });
    }
  },
});

/**
 * TEMPORAL: Limpiar todos los tokens de un email para testing
 */
export const clearTokensForEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalizedEmail = email.toLowerCase().trim();
    const tokens = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .collect();
    
    for (const token of tokens) {
      await ctx.db.delete(token._id);
    }
    
    return { deleted: tokens.length };
  },
});

/**
 * TEMPORAL: Debug - ver estructura de authAccounts para un email
 */
export const debugAuthAccounts = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Buscar usuario
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalizedEmail))
      .first();
    
    if (!user) {
      return { error: "Usuario no encontrado", user: null, accounts: [], legacy: null };
    }
    
    // Buscar cuentas de auth
    const allAccounts = await ctx.db.query("authAccounts").collect();
    const userAccounts = allAccounts.filter((a: any) => a.userId?.toString() === user._id.toString());
    
    // Buscar en legacyAuth
    const legacyUser = await ctx.db
      .query("legacyAuth")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();
    
    return {
      user: { id: user._id, email: user.email, name: user.name },
      accounts: userAccounts.map((a: any) => ({
        id: a._id,
        provider: a.provider,
        providerAccountId: a.providerAccountId,
        hasSecret: !!a.secret,
        secretPrefix: a.secret?.substring(0, 15),
        secretLength: a.secret?.length,
      })),
      legacy: legacyUser ? {
        hasHash: !!legacyUser.passwordHash,
        hashPrefix: legacyUser.passwordHash?.substring(0, 15),
        hashLength: legacyUser.passwordHash?.length,
        role: legacyUser.role,
      } : null,
    };
  },
});

/**
 * Internal query para obtener el email del usuario autenticado.
 */
export const getAuthenticatedUserEmail = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    
    const user = await ctx.db.get(userId);
    return user?.email || null;
  },
});

/**
 * Internal query para verificar la contraseña actual del usuario.
 */
export const verifyCurrentPassword = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Buscar el usuario en la tabla users
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalizedEmail))
      .first();
    
    if (!user) return null;
    
    // Buscar la cuenta de auth
    const authAccounts = await ctx.db.query("authAccounts").collect();
    const account = authAccounts.find(
      (a: any) => a.userId?.toString() === user._id.toString() && a.provider === "password"
    );
    
    return account?.secret || null;
  },
});

/**
 * Action para cambiar la contraseña del usuario autenticado.
 * Requiere la contraseña actual para verificar la identidad.
 */
export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { currentPassword, newPassword }): Promise<{ success: boolean; message: string }> => {
    // Obtener el email del usuario autenticado
    const email = await ctx.runQuery(internal.passwordReset.getAuthenticatedUserEmail, {});
    
    if (!email) {
      throw new Error("No estás autenticado. Por favor, inicia sesión nuevamente.");
    }
    
    // Validar la nueva contraseña
    if (!newPassword || newPassword.length < 6) {
      throw new Error("La nueva contraseña debe tener al menos 6 caracteres.");
    }
    
    if (currentPassword === newPassword) {
      throw new Error("La nueva contraseña debe ser diferente a la actual.");
    }
    
    // Obtener el hash actual de la contraseña
    const currentHash = await ctx.runQuery(internal.passwordReset.verifyCurrentPassword, { email });
    
    if (!currentHash) {
      throw new Error("No se encontró tu cuenta. Contacta al administrador.");
    }
    
    // Verificar la contraseña actual con Scrypt
    const scrypt = new Scrypt();
    const isValid = await scrypt.verify(currentHash, currentPassword);
    
    if (!isValid) {
      throw new Error("La contraseña actual es incorrecta.");
    }
    
    // Hashear la nueva contraseña
    const newScryptHash = await scrypt.hash(newPassword);
    const newBcryptHash = await bcrypt.hash(newPassword, 10);
    
    // Actualizar la contraseña
    await ctx.runMutation(internal.passwordReset.updatePasswordInternal, {
      email,
      passwordHash: newScryptHash,
      bcryptHash: newBcryptHash,
    });
    
    return { success: true, message: "Contraseña actualizada correctamente." };
  },
});
