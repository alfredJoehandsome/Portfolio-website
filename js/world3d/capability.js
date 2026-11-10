// Decides, before any three.js is downloaded, whether this visitor gets the 3D world or the
// plain vertical page. Cheap signals first; for everything else the world runs a short
// benchmark (see world.js) and the answer is remembered for a week.
const KEY = 'siteMode';
const LOST_KEY = 'siteGlLost';
const WEEK = 7 * 24 * 3600 * 1000;
const WEAK_GPU = /Mali-4|Mali-T6|Adreno \(TM\) [1-4]\d\d|PowerVR SGX|Apple A9|Apple A10|SwiftShader/i;

// Storage is optional: the getters themselves can throw (private mode, blocked site data).
const local = () => window.localStorage;
const session = () => window.sessionStorage;

function read(storage, key) {
    try {
        return storage().getItem(key);
    } catch (e) {
        return null;
    }
}

function write(storage, key, value) {
    try {
        storage().setItem(key, value);
    } catch (e) {
        // Private mode or blocked storage: the choice just does not persist.
    }
}

function stored() {
    try {
        const v = JSON.parse(read(local, KEY) || 'null');
        return v && typeof v === 'object' ? v : null;
    } catch (e) {
        return null;
    }
}

// The user's explicit choice (the Simple version / Try the 3D world buttons).
export function setUserMode(mode) {
    write(local, KEY, JSON.stringify({ mode: mode, reason: 'user', ua: navigator.userAgent, ts: Date.now() }));
    if (mode === '3d') {
        try {
            session().removeItem(LOST_KEY);
        } catch (e) {
            // Ignore.
        }
    }
    // Drop ?simple and ?force3d so the stored choice is what applies after the reload.
    if (window.location.search) {
        window.location.href = window.location.pathname + window.location.hash;
    } else {
        window.location.reload();
    }
}

export function markContextLost() {
    write(session, LOST_KEY, '1');
}

export function rememberAuto(mode, reason, benchMs) {
    write(local, KEY, JSON.stringify({ mode: mode, reason: reason, benchMs: benchMs, ua: navigator.userAgent, ts: Date.now() }));
}

// Probe WebGL without three.js, then give the context back at once.
function probe() {
    const out = { ok: false, maxTex: 0, gpu: '' };
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) {
            return out;
        }
        out.ok = true;
        out.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        if (info) {
            out.gpu = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '');
        }
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) {
            lose.loseContext();
        }
    } catch (e) {
        // Treated as no WebGL.
    }
    return out;
}

function oldPhone(ua) {
    const ios = /\b(?:iPhone|iPad|iPod)\b[^)]*\bOS (\d+)[_.]/.exec(ua);
    if (ios && +ios[1] < 15) {
        return 'old-ios';
    }
    const and = /\bAndroid (\d+)/.exec(ua);
    if (and && +and[1] < 9) {
        return 'old-android';
    }
    return '';
}

// Returns { mode: '3d' | 'plain', reason, bench: bool, gpu, maxTex }.
export function decide() {
    const ua = navigator.userAgent || '';
    const query = new URLSearchParams(window.location.search);

    // A visitor who asked for the simple version skips the graphics probe entirely.
    if (query.has('simple')) {
        return { mode: 'plain', reason: 'query-simple', bench: false, gpu: '', maxTex: 0 };
    }
    const early = query.has('force3d') ? null : stored();
    if (early && early.reason === 'user' && early.mode !== '3d') {
        return { mode: 'plain', reason: 'user', bench: false, gpu: '', maxTex: 0 };
    }

    const gl = probe();
    const base = { gpu: gl.gpu, maxTex: gl.maxTex };
    const done = (mode, reason, bench) => Object.assign({ mode: mode, reason: reason, bench: !!bench }, base);

    if (!gl.ok) {
        return done('plain', 'no-webgl');
    }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return done('plain', 'reduced-motion');
    }
    if (read(session, LOST_KEY)) {
        return done('plain', 'context-lost');
    }
    if (query.has('simple')) {
        return done('plain', 'query-simple');
    }
    if (query.has('force3d')) {
        return done('3d', 'query-force3d', false);
    }
    const choice = stored();
    if (choice && choice.reason === 'user') {
        return done(choice.mode === '3d' ? '3d' : 'plain', 'user', false);
    }

    // Cheap signals.
    const conn = navigator.connection;
    if (conn && conn.saveData) {
        return done('plain', 'save-data');
    }
    if (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory < 4) {
        return done('plain', 'low-memory:' + navigator.deviceMemory + 'GB');
    }
    if (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 2) {
        return done('plain', 'few-cores:' + navigator.hardwareConcurrency);
    }
    if (gl.maxTex < 4096) {
        return done('plain', 'small-textures:' + gl.maxTex);
    }
    const old = oldPhone(ua);
    if (old) {
        return done('plain', old);
    }
    if (gl.gpu && WEAK_GPU.test(gl.gpu)) {
        return done('plain', 'weak-gpu');
    }

    // A recent benchmark result for this browser.
    if (choice && choice.ua === ua && choice.ts && Date.now() - choice.ts < WEEK && (choice.mode === '3d' || choice.mode === 'plain')) {
        return Object.assign(done(choice.mode, 'cached:' + choice.reason, false), { benchMs: choice.benchMs });
    }
    return done('3d', 'benchmark', true);
}
