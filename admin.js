// Resume update page. The server only accepts changes signed by a registered passkey,
// so this page is safe to find: without the owner's device, nothing here works.

const $ = (id) => document.getElementById(id);
const messageEl = $('admin-message');

// Remember this device as the owner's so the portfolio shows its "Update resume" link.
function rememberOwnerDevice() {
    try { localStorage.setItem('portfolioOwner', '1'); } catch (e) {}
}

function isOwnerDevice() {
    try { return localStorage.getItem('portfolioOwner') === '1'; } catch (e) { return false; }
}

function showMessage(text, kind) {
    messageEl.textContent = text;
    messageEl.className = 'admin-message' + (kind ? ' admin-message-' + kind : '');
    messageEl.hidden = false;
}

// WebAuthn uses binary buffers; the server speaks base64url strings.
function b64urlToBuffer(value) {
    let s = value.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer;
}

function bufferToB64url(buffer) {
    let binary = '';
    new Uint8Array(buffer).forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function api(path, body) {
    const res = await fetch('/api/admin/' + path, body === undefined ? {} : {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
    return data;
}

function formatSize(bytes) {
    return bytes < 1024 * 1024 ? Math.round(bytes / 1024) + ' KB' : (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

async function loadStatus() {
    try {
        const status = await api('status');
        $('status-text').textContent = status.resume
            ? `${status.resume.filename}, updated ${new Date(status.resume.uploadedAt).toLocaleString()}`
            : 'Using the resume that shipped with the site (no uploads yet).';
        $('upload-card').hidden = !status.registered;
        $('remember-device').hidden = !status.registered || isOwnerDevice();
        $('setup-card').open = !status.registered;
    } catch (err) {
        $('status-text').textContent = 'Could not reach the update service. It only works on the live site.';
    }
}

// One-time per device: create a passkey bound to this site.
$('register-device').addEventListener('click', async () => {
    const setupToken = $('setup-token').value.trim();
    if (!setupToken) return showMessage('Enter the setup token first.', 'error');

    try {
        const { options, challengeId } = await api('register/options', { setupToken });
        const credential = await navigator.credentials.create({
            publicKey: {
                ...options,
                challenge: b64urlToBuffer(options.challenge),
                user: { ...options.user, id: b64urlToBuffer(options.user.id) },
                excludeCredentials: (options.excludeCredentials || []).map((c) => ({ ...c, id: b64urlToBuffer(c.id) })),
            },
        });
        const response = {
            id: credential.id,
            rawId: bufferToB64url(credential.rawId),
            type: credential.type,
            authenticatorAttachment: credential.authenticatorAttachment || undefined,
            clientExtensionResults: credential.getClientExtensionResults(),
            response: {
                clientDataJSON: bufferToB64url(credential.response.clientDataJSON),
                attestationObject: bufferToB64url(credential.response.attestationObject),
                transports: credential.response.getTransports ? credential.response.getTransports() : [],
            },
        };
        await api('register/verify', { setupToken, challengeId, response, label: $('device-label').value.trim() });
        rememberOwnerDevice();
        $('setup-token').value = '';
        showMessage('Passkey set up. This device can now update your resume.', 'success');
        loadStatus();
    } catch (err) {
        showMessage(err.name === 'NotAllowedError' ? 'Passkey setup was cancelled.' : err.message, 'error');
    }
});

// Upload: review the file, then sign the change with the passkey.
let selectedFile = null;

$('resume-file').addEventListener('change', (e) => {
    selectedFile = e.target.files[0] || null;
    messageEl.hidden = true;
    if (!selectedFile) return ($('upload-review').hidden = true);
    if (selectedFile.type !== 'application/pdf') {
        $('upload-review').hidden = true;
        return showMessage('Please choose a PDF file.', 'error');
    }
    if (selectedFile.size > 4 * 1024 * 1024) {
        $('upload-review').hidden = true;
        return showMessage('PDF must be under 4 MB.', 'error');
    }
    $('review-name').textContent = selectedFile.name;
    $('review-size').textContent = formatSize(selectedFile.size);
    $('upload-review').hidden = false;
});

$('cancel-upload').addEventListener('click', () => {
    selectedFile = null;
    $('resume-file').value = '';
    $('upload-review').hidden = true;
});

function readAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

// Asks this device's passkey (fingerprint / face / PIN) to sign a fresh server challenge.
async function signWithPasskey() {
    const { options, challengeId } = await api('auth/options', {});
    const assertion = await navigator.credentials.get({
        publicKey: {
            ...options,
            challenge: b64urlToBuffer(options.challenge),
            allowCredentials: (options.allowCredentials || []).map((c) => ({ ...c, id: b64urlToBuffer(c.id) })),
        },
    });
    const response = {
        id: assertion.id,
        rawId: bufferToB64url(assertion.rawId),
        type: assertion.type,
        authenticatorAttachment: assertion.authenticatorAttachment || undefined,
        clientExtensionResults: assertion.getClientExtensionResults(),
        response: {
            clientDataJSON: bufferToB64url(assertion.response.clientDataJSON),
            authenticatorData: bufferToB64url(assertion.response.authenticatorData),
            signature: bufferToB64url(assertion.response.signature),
            userHandle: assertion.response.userHandle ? bufferToB64url(assertion.response.userHandle) : undefined,
        },
    };
    return { challengeId, response };
}

$('confirm-upload').addEventListener('click', async () => {
    if (!selectedFile) return;
    const button = $('confirm-upload');
    button.disabled = true;

    try {
        const data = await readAsBase64(selectedFile);
        const { challengeId, response } = await signWithPasskey();
        await api('resume', { challengeId, response, file: { name: selectedFile.name, data } });
        rememberOwnerDevice();
        showMessage('Resume updated. The Download Resume button now serves the new file.', 'success');
        $('cancel-upload').click();
        loadStatus();
    } catch (err) {
        showMessage(err.name === 'NotAllowedError' ? 'Confirmation was cancelled. Nothing changed.' : err.message, 'error');
    } finally {
        button.disabled = false;
    }
});

$('remember-device').addEventListener('click', async () => {
    try {
        const { challengeId, response } = await signWithPasskey();
        await api('auth/verify', { challengeId, response });
        rememberOwnerDevice();
        $('remember-device').hidden = true;
        showMessage('Done. The Update Resume icon now shows in your portfolio on this device.', 'success');
    } catch (err) {
        showMessage(err.name === 'NotAllowedError' ? 'Confirmation was cancelled.' : err.message, 'error');
    }
});

if (!window.PublicKeyCredential) {
    showMessage('This browser does not support passkeys. Try a recent Chrome, Edge, Safari, or Firefox.', 'error');
}

loadStatus();
