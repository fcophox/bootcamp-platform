'use server'

import { fetchQuery, fetchMutation, fetchAction } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'

// Unauthenticated, token/credential-based flows used before a session exists
// (login, invitation acceptance, password reset). None of these take a
// Convex Auth session token -- each is keyed on its own token/credential
// argument instead. Kept separate from app/actions/profile.ts, which is
// for authenticated-session flows.

export async function checkLegacyUser(email: string, password: string) {
    return fetchAction(api.legacyAuth.checkLegacyUser, { email, password })
}

export async function validateInvitationToken(token: string) {
    return fetchQuery(api.invitations.validateToken, { token })
}

export async function acceptInvitation(token: string, userEmail: string, userName?: string) {
    return fetchMutation(api.invitations.acceptInvitation, { token, userEmail, userName })
}

export async function validateResetToken(token: string) {
    return fetchQuery(api.passwordReset.validateResetToken, { token })
}

export async function resetPassword(token: string, newPassword: string) {
    return fetchAction(api.passwordReset.resetPassword, { token, newPassword })
}
