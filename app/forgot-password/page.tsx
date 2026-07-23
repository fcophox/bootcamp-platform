'use client';

import { useState, useTransition, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemeLogo } from '@/components/theme-logo';
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

const translations = {
  es: {
    title: "Recuperar contraseña",
    subtitle: "Ingresa tu correo y te enviaremos instrucciones para restablecer tu contraseña.",
    emailLabel: "Correo Electrónico",
    emailPlaceholder: "tu@email.com",
    buttonSend: "Enviar instrucciones",
    buttonSending: "Enviando...",
    backToLogin: "Volver al inicio de sesión",
    successTitle: "¡Revisa tu correo!",
    successMessage: "Si tu correo está registrado, recibirás instrucciones para restablecer tu contraseña en los próximos minutos.",
    successTip: "Revisa también la carpeta de spam si no lo encuentras.",
    sendAnother: "¿No recibiste el correo?",
    sendAnotherAction: "Enviar de nuevo",
    errorGeneric: "Ocurrió un error. Por favor, inténtalo de nuevo.",
  },
  en: {
    title: "Reset password",
    subtitle: "Enter your email and we'll send you instructions to reset your password.",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    buttonSend: "Send instructions",
    buttonSending: "Sending...",
    backToLogin: "Back to login",
    successTitle: "Check your email!",
    successMessage: "If your email is registered, you'll receive instructions to reset your password in the next few minutes.",
    successTip: "Also check your spam folder if you can't find it.",
    sendAnother: "Didn't receive the email?",
    sendAnotherAction: "Send again",
    errorGeneric: "An error occurred. Please try again.",
  }
};

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const lang = (searchParams.get('lang') === 'en') ? 'en' : 'es';
  const t = translations[lang];

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  const createQueryString = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(name, value);
    return '?' + params.toString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    startTransition(async () => {
      try {
        const response = await fetch('/api/password-reset', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        });

        if (response.ok) {
          setStatus('success');
        } else {
          setStatus('error');
          setErrorMessage(t.errorGeneric);
        }
      } catch {
        setStatus('error');
        setErrorMessage(t.errorGeneric);
      }
    });
  };

  const handleSendAgain = () => {
    setStatus('idle');
    setEmail('');
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Theme & Language Toggle */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-4">
        <Link
          href={createQueryString('lang', lang === 'es' ? 'en' : 'es')}
          className="text-xs font-semibold text-muted hover:text-foreground px-2 py-1 border border-border/50 rounded-md transition-colors"
          title="Cambiar idioma / Change language"
        >
          {lang === 'es' ? 'EN' : 'ES'}
        </Link>
        <ThemeToggle />
      </div>

      {/* Left Side - Form */}
      <div className="flex w-full flex-col justify-center px-8 py-12 lg:w-1/2 lg:px-24">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo */}
          <div className="mb-16">
            <div className="flex items-center">
              <div className="relative h-10 w-64 overflow-hidden">
                <ThemeLogo />
              </div>
            </div>
          </div>

          {status === 'success' ? (
            // Success State
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-6 flex justify-center">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
              </div>
              
              <h1 className="text-2xl font-medium text-foreground text-center mb-3">
                {t.successTitle}
              </h1>
              
              <p className="text-sm text-muted text-center mb-6">
                {t.successMessage}
              </p>
              
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-8">
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                  {t.successTip}
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-muted text-center">
                  {t.sendAnother}{' '}
                  <button
                    onClick={handleSendAgain}
                    className="font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    {t.sendAnotherAction}
                  </button>
                </p>
                
                <Link
                  href={`/login${lang === 'en' ? '?lang=en' : ''}`}
                  className="flex items-center justify-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
                >
                  <ArrowLeft size={16} />
                  {t.backToLogin}
                </Link>
              </div>
            </div>
          ) : (
            // Form State
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-medium text-foreground">
                  {t.title}
                </h1>
                <p className="mt-2 text-sm text-muted">
                  {t.subtitle}
                </p>
              </div>

              {/* Ilustración */}
              <div className="mb-8 flex justify-center">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-10 w-10 text-primary" />
                </div>
              </div>

              {errorMessage && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500 animate-in fade-in slide-in-from-top-2 duration-300">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-foreground mb-2">
                    {t.emailLabel}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    className="w-full rounded-md border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending || !email}
                  className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isPending && <Loader2 size={16} className="animate-spin" />}
                  {isPending ? t.buttonSending : t.buttonSend}
                </button>
              </form>

              <div className="mt-8">
                <Link
                  href={`/login${lang === 'en' ? '?lang=en' : ''}`}
                  className="flex items-center justify-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
                >
                  <ArrowLeft size={16} />
                  {t.backToLogin}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Side - Visual */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-20 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-card-bg to-background"></div>
        <div className="relative max-w-lg text-center">
          <div className="mb-8 flex justify-center">
            <div className="h-32 w-32 rounded-full bg-primary/5 flex items-center justify-center">
              <svg className="h-16 w-16 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
          </div>
          <h2 className="text-xl font-medium text-foreground mb-4">
            {lang === 'es' ? '¿Olvidaste tu contraseña?' : 'Forgot your password?'}
          </h2>
          <p className="text-muted text-sm leading-relaxed">
            {lang === 'es' 
              ? 'No te preocupes, te ayudaremos a recuperar el acceso a tu cuenta de forma segura.'
              : "Don't worry, we'll help you recover access to your account safely."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    }>
      <ForgotPasswordContent />
    </Suspense>
  );
}
