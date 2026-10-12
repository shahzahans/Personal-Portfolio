// Shared helpers for the resume-update functions.
import { getStore } from '@netlify/blobs';
import { timingSafeEqual, randomUUID } from 'node:crypto';

const isDev = process.env.NETLIFY_DEV === 'true';

// Passkeys are bound to this domain. A passkey made on shahzahans.com only works on shahzahans.com.
export const RP_ID = process.env.RP_ID || (isDev ? 'localhost' : 'shahzahans.com');
export const ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : isDev ? ['http://localhost:8888'] : ['https://shahzahans.com'];
export const RP_NAME = "Shadman's Portfolio";

export const MAX_PDF_BYTES = 4 * 1024 * 1024; // Netlify caps request bodies at 6 MB; base64 adds ~33%
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

// Strong consistency so a passkey or challenge written by one request is visible to the next.
export const adminStore = () => getStore({ name: 'admin', consistency: 'strong' });
export const resumeStore = () => getStore({ name: 'resume', consistency: 'strong' });

export function json(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
}

// Setup token gates passkey registration. Remove ADMIN_SETUP_TOKEN in Netlify after setup to lock registration entirely.
export function setupTokenValid(given) {
    const expected = process.env.ADMIN_SETUP_TOKEN;
    if (!expected || typeof given !== 'string') return false;
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

export async function loadCredentials() {
    return (await adminStore().get('credentials', { type: 'json' })) || [];
}

export async function saveCredentials(credentials) {
    await adminStore().setJSON('credentials', credentials);
}

// Challenges are single-use and expire after five minutes.
export async function saveChallenge(challenge, purpose) {
    const id = randomUUID();
    await adminStore().setJSON(`challenge-${id}`, { challenge, purpose, expires: Date.now() + CHALLENGE_TTL_MS });
    return id;
}

export async function consumeChallenge(id, purpose) {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) return null;
    const store = adminStore();
    const record = await store.get(`challenge-${id}`, { type: 'json' });
    if (!record) return null;
    await store.delete(`challenge-${id}`);
    if (record.purpose !== purpose || record.expires < Date.now()) return null;
    return record.challenge;
}
