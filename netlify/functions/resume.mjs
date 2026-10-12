// Serves the latest uploaded resume at /assets/Resume.pdf, so the "Download Resume" button never changes.
// Until the first upload, it falls back to the copy committed with the site.
import { resumeStore } from '../lib/shared.mjs';

export default async (req) => {
    const current = await resumeStore().getWithMetadata('current', { type: 'arrayBuffer' });

    if (!current) {
        return Response.redirect(new URL('/assets/Resume-fallback.pdf', req.url), 302);
    }

    return new Response(current.data, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline; filename="Shadman-Shahzahan-Resume.pdf"',
            'Cache-Control': 'no-cache',
        },
    });
};

// A function path takes priority over the static file with the same name.
export const config = { path: '/assets/Resume.pdf' };
