import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>
      <main className="flex flex-col items-center justify-center text-center px-6">
        <div className="mb-8">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="relative h-20 w-20 overflow-hidden rounded-xl">
              <Image
                src="/brand/logotipoacademy.png"
                alt="CleverX Academy"
                fill
                className="object-cover"
              />
            </div>
            <div className="flex flex-col items-start -space-y-2">
              <span className="text-5xl font-bold text-foreground tracking-tight pb-2">CleverX</span>
              <span className="text-sm font-medium text-muted uppercase tracking-[0.3em] ml-1">Academy</span>
            </div>
          </div>
          <p className="text-xl text-muted max-w-md">
            Plataforma de gestión del conocimiento para bootcamps de tecnología
          </p>
        </div>

        <div className="flex gap-4">
          <Link
            href="/login"
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-white transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-border bg-card-bg px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-hover-bg"
          >
            Registrarse
          </Link>
        </div>
      </main>
    </div>
  );
}
