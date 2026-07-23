'use client';

import React, { useState, useTransition, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemeLogo } from '@/components/theme-logo';
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';

const translations = {
  es: {
    title: "Nueva contraseña",
    subtitle: "Crea una contraseña segura para tu cuenta.",
    passwordLabel: "Nueva contraseña",
    passwordPlaceholder: "Mínimo 6 caracteres",
    confirmLabel: "Confirmar contraseña",
    confirmPlaceholder: "Repite tu contraseña",
    buttonReset: "Cambiar contraseña",
    buttonResetting: "Cambiando...",
    successTitle: "¡Contraseña actualizada!",
    successMessage: "Tu contraseña ha sido cambiada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.",
    goToLogin: "Ir al inicio de sesión",
    invalidToken: "Enlace inválido",
    invalidTokenDesc: "Este enlace no es válido o ya expiró.",
    requestNew: "Solicitar nuevo enlace",
    errorMismatch: "Las contraseñas no coinciden.",
    errorMinLength: "La contraseña debe tener al menos 6 caracteres.",
    errorGeneric: "Ocurrió un error. Por favor, inténtalo de nuevo.",
    requirements: "Requisitos de contraseña:",
    reqLength: "Al menos 6 caracteres",
    reqMatch: "Ambas contraseñas coinciden",
  },
  en: {
    title: "New password",
    subtitle: "Create a secure password for your account.",
    passwordLabel: "New password",
    passwordPlaceholder: "Minimum 6 characters",
    confirmLabel: "Confirm password",
    confirmPlaceholder: "Repeat your password",
    buttonReset: "Change password",
    buttonResetting: "Changing...",
    successTitle: "Password updated!",
    successMessage: "Your password has been changed successfully. You can now sign in with your new password.",
    goToLogin: "Go to sign in",
    invalidToken: "Invalid link",
    invalidTokenDesc: "This link is invalid or has expired.",
    requestNew: "Request new link",
    errorMismatch: "Passwords do not match.",
    errorMinLength: "Password must be at least 6 characters.",
    errorGeneric: "An error occurred. Please try again.",
    requirements: "Password requirements:",
    reqLength: "At least 6 characters",
    reqMatch: "Both passwords match",
  }
};

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const lang = (searchParams.get('lang') === 'en') ? 'en' : 'es';
  const t = translations[lang];

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState<'loading' | 'form' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Validar token - solo una vez al inicio
  const tokenValidation = useQuery(
    api.passwordReset.validateResetToken,
    token && status === 'loading' ? { token } : "skip"
  );
  
  // Efecto para establecer el estado inicial basado en la validación del token
  React.useEffect(() => {
    if (status !== 'loading') return;
    
    if (!token) {
      setTokenError("El enlace no es válido.");
      setStatus('error');
      return;
    }
    
    if (tokenValidation === undefined) return; // Aún cargando
    
    if (tokenValidation.valid) {
      setStatus('form');
    } else {
      setTokenError(tokenValidation.error || "El enlace no es válido.");
      setStatus('error');
    }
  }, [token, tokenValidation, status]);
  
  // Debug logging
  console.log("[ResetPassword] token from URL:", token);
  console.log("[ResetPassword] tokenValidation:", tokenValidation);
  console.log("[ResetPassword] status:", status);
  
  // Action para resetear la contraseña
  const resetPassword = useAction(api.passwordReset.resetPassword);

  // Requisitos de contraseña
  const hasMinLength = password.length >= 6;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const createQueryString = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(name, value);
    return '?' + params.toString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Validaciones
    if (!hasMinLength) {
      setErrorMessage(t.errorMinLength);
      return;
    }
    if (!passwordsMatch) {
      setErrorMessage(t.errorMismatch);
      return;
    }

    startTransition(async () => {
      try {
        if (!token) {
          setStatus('error');
          return;
        }

        // Usar la action para resetear la contraseña
        await resetPassword({
          token,
          newPassword: password,
        });

        setStatus('success');
      } catch (err) {
        console.error("Password reset error:", err);
        setErrorMessage(t.errorGeneric);
      }
    });
  };

  // Estado de carga inicial
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // Token inválido
  if (status === 'error' && !errorMessage) {
    return (
      <InvalidTokenView 
        lang={lang} 
        t={t} 
        createQueryString={createQueryString}
        error={tokenError || undefined}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Theme & Language Toggle */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-4">
        <Link
          href={createQueryString('lang', lang === 'es' ? 'en' : 'es')}
          className="text-xs font-semibold text-muted hover:text-foreground px-2 py-1 border border-border/50 rounded-md transition-colors"
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
            <div className="relative h-10 w-64 overflow-hidden">
              <ThemeLogo />
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
              
              <p className="text-sm text-muted text-center mb-8">
                {t.successMessage}
              </p>

              <Link
                href={`/login${lang === 'en' ? '?lang=en' : ''}`}
                className="flex items-center justify-center w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                {t.goToLogin}
              </Link>
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
                {tokenValidation?.email && (
                  <p className="mt-2 text-xs text-primary font-medium">
                    {tokenValidation.email}
                  </p>
                )}
              </div>

              {errorMessage && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500 animate-in fade-in slide-in-from-top-2 duration-300">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Nueva contraseña */}
                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-foreground mb-2">
                    {t.passwordLabel}
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.passwordPlaceholder}
                      className="w-full rounded-md border border-border bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirmar contraseña */}
                <div>
                  <label htmlFor="confirm" className="block text-xs font-medium text-foreground mb-2">
                    {t.confirmLabel}
                  </label>
                  <div className="relative">
                    <input
                      id="confirm"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t.confirmPlaceholder}
                      className="w-full rounded-md border border-border bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Indicadores de requisitos */}
                <div className="p-4 rounded-xl bg-card-bg/50 border border-border/50">
                  <p className="text-xs font-medium text-muted mb-3">{t.requirements}</p>
                  <div className="space-y-2">
                    <RequirementItem 
                      met={hasMinLength} 
                      text={t.reqLength}
                    />
                    <RequirementItem 
                      met={passwordsMatch} 
                      text={t.reqMatch}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPending || !hasMinLength || !passwordsMatch}
                  className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isPending && <Loader2 size={16} className="animate-spin" />}
                  {isPending ? t.buttonResetting : t.buttonReset}
                </button>
              </form>
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
              <KeyRound className="h-16 w-16 text-primary/40" />
            </div>
          </div>
          <h2 className="text-xl font-medium text-foreground mb-4">
            {lang === 'es' ? 'Crea una contraseña segura' : 'Create a secure password'}
          </h2>
          <p className="text-muted text-sm leading-relaxed">
            {lang === 'es' 
              ? 'Elige una contraseña que sea fácil de recordar pero difícil de adivinar.'
              : 'Choose a password that is easy to remember but hard to guess.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function RequirementItem({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-4 w-4 rounded-full flex items-center justify-center transition-colors ${
        met ? 'bg-emerald-500/20 text-emerald-500' : 'bg-muted/10 text-muted/50'
      }`}>
        {met ? (
          <CheckCircle2 size={12} />
        ) : (
          <div className="h-1.5 w-1.5 rounded-full bg-current" />
        )}
      </div>
      <span className={`text-xs transition-colors ${met ? 'text-emerald-500' : 'text-muted'}`}>
        {text}
      </span>
    </div>
  );
}

function InvalidTokenView({ 
  lang, 
  t, 
  createQueryString,
  error 
}: { 
  lang: string; 
  t: typeof translations.es;
  createQueryString: (name: string, value: string) => string;
  error?: string;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="absolute top-6 right-6 z-10 flex items-center gap-4">
        <Link
          href={createQueryString('lang', lang === 'es' ? 'en' : 'es')}
          className="text-xs font-semibold text-muted hover:text-foreground px-2 py-1 border border-border/50 rounded-md transition-colors"
        >
          {lang === 'es' ? 'EN' : 'ES'}
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex w-full flex-col items-center justify-center px-8 py-12">
        <div className="mx-auto w-full max-w-sm text-center">
          <div className="mb-8">
            <div className="relative h-10 w-64 overflow-hidden mx-auto">
              <ThemeLogo />
            </div>
          </div>

          <div className="mb-6 flex justify-center">
            <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </div>
          
          <h1 className="text-2xl font-medium text-foreground mb-3">
            {t.invalidToken}
          </h1>
          
          <p className="text-sm text-muted mb-8">
            {error || t.invalidTokenDesc}
          </p>

          <Link
            href={`/forgot-password${lang === 'en' ? '?lang=en' : ''}`}
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90"
          >
            {t.requestNew}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
