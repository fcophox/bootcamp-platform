import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getRoleFromEmail } from "@/utils/roles";
import { getUserRoleFromDB } from "@/utils/roles-server";
import { Network, ArrowRight, Zap, GitMerge, BrainCircuit } from 'lucide-react';

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
    <div className="min-h-screen flex flex-col bg-background selection:bg-cyan-500/30">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <div className="relative h-10 w-64 overflow-hidden">
              <Image
                src="/brand/logotipo-synaptia-vertical.png"
                alt="Synaptia"
                fill
                className="object-contain object-left"
              />
            </div>
          </div>

          {/* Nav Actions */}
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="h-6 w-px bg-white/10 hidden sm:block"></div>
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/login?mode=signup"
              className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-all hover:scale-105"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center px-6 pb-24 w-full">
        
        {/* HERO */}
        <section className="relative w-full max-w-6xl mx-auto pt-24 pb-20 md:pt-32 md:pb-28 flex flex-col items-center text-center">
          {/* Background Gradient Orbs */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-violet-600/20 to-cyan-400/20 rounded-full blur-[100px] pointer-events-none -z-10"></div>
          
          <div className="mb-2 p-2 rounded-3xl flex items-center justify-center">
             <div className="relative h-40 w-40">
               <Image
                 src="/brand/logotipoacademy.png"
                 alt="Logo"
                 fill
                 className="object-contain"
               />
             </div>
          </div>

          <h1 className="text-5xl md:text-6xl font-light tracking-tight text-foreground mb-6 max-w-6xl">
            Conectar, Aprender y <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-cyan-400">
              Evolucionar.
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-muted max-w-2xl mb-10 leading-relaxed font-light">
            La plataforma definitiva para la gestión del conocimiento y la evolución profesional.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Link
              href="/login?mode=signup"
              className="group inline-flex h-14 items-center justify-center rounded-full bg-foreground px-8 text-base font-medium text-background transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]"
            >
              Comenzar Evolución
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-14 items-center justify-center rounded-full border border-border bg-transparent px-8 text-base font-medium text-foreground transition-all hover:bg-white/5 hover:border-white/20"
            >
              Saber más
            </Link>
          </div>
        </section>

        {/* MANIFIESTO */}
        <section className="w-full max-w-5xl mx-auto py-20 md:py-32 text-center border-t border-border/30">
          <h2 className="text-xs md:text-sm font-semibold tracking-[0.4em] text-cyan-400 uppercase mb-8">El Manifiesto</h2>
          <p className="text-3xl md:text-5xl font-light leading-tight text-foreground/90">
            "Transformamos la sobrecarga de información en <span className="font-medium text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-cyan-400">evolución real</span>, conectando los puntos entre lo que sabes y lo que necesitas ser."
          </p>
        </section>

        {/* PILARES (Bento Grid) */}
        <section className="w-full max-w-6xl mx-auto py-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Tarjeta Conecta */}
            <div className="group relative overflow-hidden rounded-[2rem] border border-border/50 bg-card-bg/30 backdrop-blur-sm p-10 transition-all hover:border-violet-500/30 hover:bg-card-bg flex flex-col h-full">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10 mb-8 h-16 w-16 rounded-2xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20 text-violet-400 group-hover:scale-110 transition-transform duration-500">
                <GitMerge size={32} strokeWidth={1.5} />
              </div>
              <h3 className="relative z-10 text-2xl font-medium mb-4">Conecta</h3>
              <p className="relative z-10 text-muted leading-relaxed font-light text-lg">
                Integra todo tu conocimiento disperso en un solo núcleo. Crea sinapsis perfectas entre recursos, notas y proyectos.
              </p>
            </div>

            {/* Tarjeta Aprende */}
            <div className="group relative overflow-hidden rounded-[2rem] border border-border/50 bg-card-bg/30 backdrop-blur-sm p-10 transition-all hover:border-cyan-500/30 hover:bg-card-bg flex flex-col h-full">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10 mb-8 h-16 w-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400 group-hover:scale-110 transition-transform duration-500">
                <BrainCircuit size={32} strokeWidth={1.5} />
              </div>
              <h3 className="relative z-10 text-2xl font-medium mb-4">Aprende</h3>
              <p className="relative z-10 text-muted leading-relaxed font-light text-lg">
                Rutas de aprendizaje inteligentes y estructuradas, eliminando el ruido y enfocando la atención en lo verdaderamente esencial.
              </p>
            </div>

            {/* Tarjeta Evoluciona */}
            <div className="group relative overflow-hidden rounded-[2rem] border border-border/50 bg-card-bg/30 backdrop-blur-sm p-10 transition-all hover:border-purple-500/30 hover:bg-card-bg flex flex-col h-full">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10 mb-8 h-16 w-16 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400 group-hover:scale-110 transition-transform duration-500">
                <Zap size={32} strokeWidth={1.5} />
              </div>
              <h3 className="relative z-10 text-2xl font-medium mb-4">Evoluciona</h3>
              <p className="relative z-10 text-muted leading-relaxed font-light text-lg">
                Construye un perfil dinámico. Mide tu progreso en tiempo real y demuestra tus capacidades profesionales al mundo.
              </p>
            </div>

          </div>
        </section>

        {/* CTA FINAL */}
        <section className="w-full max-w-5xl mx-auto pt-20 pb-10 text-center">
          <div className="relative overflow-hidden rounded-[3rem] border border-white/10 bg-card-bg p-12 md:p-24 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 via-background to-cyan-400/10 opacity-80"></div>
            <div className="relative z-10 flex flex-col items-center">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">¿Listo para el siguiente nivel?</h2>
              <p className="text-xl text-muted font-light mb-10 max-w-2xl">
                Únete a Synaptia hoy y transforma la manera en que adquieres, organizas y demuestras tu conocimiento.
              </p>
              <button
                disabled
                className="inline-flex h-16 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-10 text-lg font-semibold text-white opacity-50 cursor-not-allowed"
              >
                Crea tu cuenta gratuita
              </button>
            </div>
          </div>
        </section>

      </main>

      <footer className="py-8 border-t border-border/40 relative z-10 text-center text-sm text-muted">
         © {new Date().getFullYear()} Synaptia. Todos los derechos reservados.
      </footer>
    </div>
  );
}


