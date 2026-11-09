// Entry point. Decides between the 3D world and the plain vertical page BEFORE any three.js
// is downloaded (the world module is imported dynamically, only for devices that pass).
import { decide, rememberAuto, setUserMode } from './capability.js';

const root = document.documentElement;
// The stylesheet keys the dialog, creator and plain-page layout on this class.
root.classList.add('js');

const decision = decide();
const info = { mode: decision.mode, reason: decision.reason, benchMs: null, gpu: decision.gpu, maxTex: decision.maxTex, done: false };
window.__siteMode = info;

let abandonWorld = null;

// The "Simple version" line on the start board (the real node moves around, so delegate).
document.addEventListener('click', (event) => {
    if (event.target && event.target.closest && event.target.closest('[data-simple-version]')) {
        setUserMode('plain');
    }
});

function addTryButton() {
    if (info.reason === 'no-webgl' || info.reason === 'reduced-motion') {
        return;
    }
    const list = document.querySelector('.nav-links');
    if (!list || list.querySelector('.try-3d')) {
        return;
    }
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'try-3d';
    b.textContent = 'Try the 3D world';
    b.addEventListener('click', () => setUserMode('3d'));
    li.appendChild(b);
    const resume = list.querySelector('a[href$="Resume.pdf"]');
    list.insertBefore(li, resume ? resume.parentElement : null);
}

function goPlain(reason) {
    info.mode = 'plain';
    info.reason = reason;
    info.done = true;
    root.classList.remove('world-loading', 'world-ready', 'world-mode', 'world-compact');
    root.classList.add('mode-plain');
    addTryButton();
}

function onDecision(d) {
    if (d.lost) {
        goPlain('context-lost');
    } else if (d.error) {
        goPlain('error');
    } else if (d.ready) {
        info.done = true;
    } else if (typeof d.benchMs === 'number') {
        info.benchMs = d.benchMs;
        info.limit = d.limit;
        if (d.slow) {
            rememberAuto('plain', 'bench-slow', d.benchMs);
            if (abandonWorld) {
                abandonWorld();
            }
            goPlain('bench-slow');
        } else {
            rememberAuto('3d', 'bench-pass', d.benchMs);
        }
    }
}

if (decision.mode === 'plain') {
    goPlain(decision.reason);
} else {
    root.classList.add('world-loading');
    import('./world.js').then((m) => {
        abandonWorld = m.abandon;
        return m.start({ bench: decision.bench, onDecision: onDecision });
    }).catch((e) => {
        console.error(e);
        goPlain('load-error');
    });
}
