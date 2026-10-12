// Passkey-protected resume updates. No usernames or passwords: the owner's device signs each request
// with a passkey (fingerprint / face / PIN), and only signatures from registered passkeys are accepted.
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { createHash } from 'node:crypto';
import {
    RP_ID, RP_NAME, ORIGINS, MAX_PDF_BYTES,
    json, setupTokenValid, loadCredentials, saveCredentials,
    saveChallenge, consumeChallenge, resumeStore,
} from '../lib/shared.mjs';

const OWNER_USER_ID = new TextEncoder().encode('portfolio-owner');

export default async (req) => {
    const route = new URL(req.url).pathname.replace(/^\/api\/admin\/?/, '');

    try {
        if (req.method === 'GET' && route === 'status') return await status();
        if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

        const body = await req.json().catch(() => null);
        if (!body) return json(400, { error: 'Invalid request body' });

        switch (route) {
            case 'register/options': return await registerOptions(body);
            case 'register/verify': return await registerVerify(body);
            case 'auth/options': return await authOptions();
            case 'resume': return await uploadResume(body);
            default: return json(404, { error: 'Not found' });
        }
    } catch (err) {
        console.error(err);
        return json(500, { error: 'Something went wrong on the server' });
    }
};

export const config = { path: '/api/admin/*' };

async function status() {
    const credentials = await loadCredentials();
    const meta = await resumeStore().getMetadata('current');
    return json(200, {
        registered: credentials.length > 0,
        devices: credentials.length,
        resume: meta ? meta.metadata : null,
    });
}

// Step 1 of setup: requires the one-time ADMIN_SETUP_TOKEN set in the Netlify dashboard.
async function registerOptions({ setupToken }) {
    if (!setupTokenValid(setupToken)) return json(403, { error: 'Setup token is wrong, or setup is turned off' });

    const credentials = await loadCredentials();
    const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userName: 'owner',
        userDisplayName: 'Portfolio owner',
        userID: OWNER_USER_ID,
        attestationType: 'none',
        excludeCredentials: credentials.map((c) => ({ id: c.id, transports: c.transports })),
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
    });
    const challengeId = await saveChallenge(options.challenge, 'register');
    return json(200, { options, challengeId });
}

async function registerVerify({ setupToken, challengeId, response, label }) {
    if (!setupTokenValid(setupToken)) return json(403, { error: 'Setup token is wrong, or setup is turned off' });

    const expectedChallenge = await consumeChallenge(challengeId, 'register');
    if (!expectedChallenge) return json(400, { error: 'Setup request expired. Try again.' });

    // The library throws on malformed responses; treat any failure as "not verified".
    const { verified, registrationInfo } = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: ORIGINS,
        expectedRPID: RP_ID,
        requireUserVerification: true,
    }).catch(() => ({ verified: false }));
    if (!verified) return json(400, { error: 'Passkey could not be verified' });

    const { credential } = registrationInfo;
    const credentials = await loadCredentials();
    credentials.push({
        id: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        transports: credential.transports || [],
        label: String(label || 'Unnamed device').slice(0, 60),
        createdAt: new Date().toISOString(),
    });
    await saveCredentials(credentials);
    return json(200, { ok: true, devices: credentials.length });
}

async function authOptions() {
    const credentials = await loadCredentials();
    if (credentials.length === 0) return json(409, { error: 'No passkey is set up yet' });

    const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: credentials.map((c) => ({ id: c.id, transports: c.transports })),
        userVerification: 'required',
    });
    const challengeId = await saveChallenge(options.challenge, 'auth');
    return json(200, { options, challengeId });
}

// Every upload carries a fresh passkey signature, so each change is confirmed on the owner's device.
async function uploadResume({ challengeId, response, file }) {
    const expectedChallenge = await consumeChallenge(challengeId, 'auth');
    if (!expectedChallenge) return json(400, { error: 'Confirmation expired. Try again.' });

    const credentials = await loadCredentials();
    const stored = credentials.find((c) => c.id === response?.id);
    if (!stored) return json(403, { error: 'This passkey is not allowed to make changes' });

    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: ORIGINS,
        expectedRPID: RP_ID,
        credential: {
            id: stored.id,
            publicKey: Buffer.from(stored.publicKey, 'base64url'),
            counter: stored.counter,
            transports: stored.transports,
        },
        requireUserVerification: true,
    }).catch(() => ({ verified: false }));
    if (!verified) return json(403, { error: 'Passkey check failed' });

    stored.counter = authenticationInfo.newCounter;
    stored.lastUsedAt = new Date().toISOString();
    await saveCredentials(credentials);

    // Only accept real PDFs under the size limit.
    if (typeof file?.data !== 'string') return json(400, { error: 'No file was sent' });
    const pdf = Buffer.from(file.data, 'base64');
    if (pdf.length === 0 || pdf.length > MAX_PDF_BYTES) return json(400, { error: 'PDF must be under 4 MB' });
    if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') return json(400, { error: 'That file is not a PDF' });

    const store = resumeStore();
    const previous = await store.getWithMetadata('current', { type: 'arrayBuffer' });
    if (previous) await store.set('previous', previous.data, { metadata: previous.metadata });

    const metadata = {
        filename: String(file.name || 'Resume.pdf').replace(/[^\w.\- ]/g, '').slice(0, 100) || 'Resume.pdf',
        size: pdf.length,
        sha256: createHash('sha256').update(pdf).digest('hex'),
        uploadedAt: new Date().toISOString(),
        device: stored.label,
    };
    await store.set('current', pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.length), { metadata });
    return json(200, { ok: true, resume: metadata });
}
