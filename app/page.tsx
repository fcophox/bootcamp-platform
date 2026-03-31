import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getRoleFromEmail } from "@/utils/roles";
import { getUserRoleFromDB } from "@/utils/roles-server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const dbRole = await getUserRoleFromDB(user.id);
    const fallbackRole = getRoleFromEmail(user.email, user.user_metadata);
    const role = (dbRole && dbRole !== 'alumno') ? dbRole : fallbackRole;
    if (role === 'superadmin' || role === 'docente') {
      redirect('/cms');
    } else {
      redirect('/dashboard');
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/30">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-lg">
              <Image
                src="/brand/logotipoacademy.png"
                alt="CleverX Academy"
                fill
                className="object-cover"
              />
            </div>
            <div className="flex flex-col items-start -space-y-1">
              <span className="text-xl font-bold text-foreground tracking-tight">CleverX</span>
              <span className="text-[10px] font-medium text-muted uppercase tracking-[0.2em] ml-0.5">Academy</span>
            </div>
          </div>

          {/* Nav Actions */}
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="h-6 w-px bg-white/10 hidden sm:block"></div>
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-foreground transition-colors hover:text-primary hover:bg-white/5"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/login?mode=signup"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(var(--primary),0.3)]"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
          <div className="w-[800px] h-[500px] bg-primary/10 blur-[120px] rounded-full translate-y-[-20%]"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-8 flex flex-col items-center">
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary backdrop-blur-md mb-4">
            <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
            Acelera tu carrera tecnológica
          </div>
          
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-foreground">
            El futuro del aprendizaje <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">
              comienza aquí.
            </span>
          </h1>
          
          <p className="text-xl sm:text-2xl text-muted max-w-2xl leading-relaxed">
            Domina las habilidades más demandadas de la actualidad. Nuestra plataforma de bootcamps ofrece una experiencia inmersiva, enfocada en la práctica y proyectos reales.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-8 w-full sm:w-auto">
            <Link
              href="/login?mode=signup"
              className="inline-flex h-14 items-center justify-center rounded-xl bg-primary px-8 text-base font-semibold text-white transition-all hover:bg-primary/90 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(var(--primary),0.4)] active:scale-[0.98]"
            >
              Comenzar a aprender
            </Link>
            <Link
              href="/login"
              className="inline-flex h-14 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-md px-8 text-base font-medium text-foreground transition-all hover:bg-white/10 hover:border-white/20"
            >
              Ya tengo una cuenta
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-8 border-t border-white/5 relative z-10 text-center text-sm text-muted">
         © {new Date().getFullYear()} CleverX Academy. Todos los derechos reservados.
      </footer>
    </div>
  );
}

