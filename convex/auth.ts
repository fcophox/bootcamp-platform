import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      validatePasswordRequirements(password: string) {
        if (!password) {
          throw new Error("La contraseña no puede estar vacía.");
        }
      },
      profile(params) {
        return {
          email: (params.email as string) || "",
          name: (params.name as string) || (params.email as string)?.split("@")[0] || "Usuario",
          role: (params.role as string) || "alumno",
        };
      },
    }),
  ],
});
