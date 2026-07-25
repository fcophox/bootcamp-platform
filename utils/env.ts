// NEXT_PUBLIC_APP_ENV is baked in at Docker build time (see Dockerfile /
// .github/workflows/ci.yml), not read at container runtime — Next.js inlines
// NEXT_PUBLIC_* vars into the client bundle at build time. CI sets it to
// "production" for :prod builds (main) and "development" for :develop builds.
// Defaults to "development" for local dev, where the var is never set.
export function getAppEnv(): 'development' | 'production' {
    return process.env.NEXT_PUBLIC_APP_ENV === 'production' ? 'production' : 'development';
}

export function isProdEnv(): boolean {
    return getAppEnv() === 'production';
}
