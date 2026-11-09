// Boot and mode switching for the Wii world: a real 3D island with the board DOM rendered by
// CSS3DRenderer underneath a WebGL canvas (see scene.js for the layering).
import { THREE, createStage, blobTexture, onContextLost, destroyRenderer } from './scene.js';
import { setUserMode, markContextLost } from './capability.js';
import { makeLayout, applyPose, project, travelAmount } from './camera.js';
import { buildIsland } from './island.js';
import { buildBoards } from './boards.js';
import { buildFlowers } from './flowers.js';
import { buildClouds } from './clouds.js';
import { buildCharacter, characterStore, DEFAULT_CHARACTER } from './character.js';
import { createCreator } from './creator.js';
import { createOverlay } from './overlay.js';
import { createInput } from './input.js';
import { createHud, setNavMode, fitNavRow } from './hud.js';
import { CSS3DObject } from '../vendor/three/addons/renderers/CSS3DRenderer.js';

const COMPACT_W = 900;          // narrower or shorter than this uses the compact (phone) layout
const COMPACT_H = 600;
const FONT_WEIGHTS = [400, 500, 600, 700];

const root = document.documentElement;
const main = document.querySelector('main');
const sections = main ? Array.from(main.querySelectorAll(':scope > section[data-stop]')) : [];
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let glOk = true;
let started = false;
let onDecision = () => {};
let benchWanted = false;
const ids = sections.map((s) => s.id);
const count = sections.length;

let world = null;
let hintGone = false;
let lastIndex = 0;
let resizeTimer = 0;

const debug = { ready: false, frames: 0, frameTimes: [] };
window.__world = debug;

function eligible() {
    return glOk && !motionQuery.matches && count > 0;
}

// ------------------------------------------------------------------------------------
// Benchmark: the first frames of the real world, drawn while the loader shows. A device that
// cannot hold about 30 fps (phone) or 40 fps (desktop) gets the plain page instead.
// ------------------------------------------------------------------------------------
const BENCH_FRAMES = 45;
const BENCH_MAX_MS = 9000;

function finishReady(w) {
    w.bench = false;
    debug.ready = true;
    root.classList.add('world-ready');
    window.setTimeout(() => root.classList.remove('world-loading'), 600);
    onDecision({ ready: true });
}

function runBench(w, now) {
    if (document.hidden) {
        return;
    }
    if (w.benchSkip > 0) {
        w.benchSkip--;
        w.benchLast = now;
        w.benchStart = w.benchStart || now;
        return;
    }
    w.benchDt.push(now - w.benchLast);
    w.benchLast = now;
    const spent = now - w.benchStart;
    if (w.benchDt.length < BENCH_FRAMES && spent < BENCH_MAX_MS) {
        return;
    }
    const sorted = w.benchDt.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    // ?benchlimit=N overrides the threshold (a test knob).
    const knob = +new URLSearchParams(window.location.search).get('benchlimit');
    const limit = knob > 0 ? knob : (w.compact || coarse() ? 34 : 25);
    const slow = median > limit || w.benchDt.length < 12;
    benchWanted = false;
    onDecision({ benchMs: Math.round(median * 10) / 10, slow, limit, frames: w.benchDt.length });
    if (slow) {
        w.bench = false;
    } else {
        finishReady(w);
    }
}

function isCompact() {
    return window.innerWidth < COMPACT_W || window.innerHeight < COMPACT_H;
}

function stageHeight() {
    const vv = window.visualViewport;
    return Math.round(vv && vv.height ? vv.height : window.innerHeight);
}

function phoneSized() {
    return isCompact() || coarse();
}

function coarse() {
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}

function currentIndex() {
    if (world) {
        return world.input.targetIndex();
    }
    const i = ids.indexOf(window.location.hash.slice(1) === 'experience-2' ? 'experience' : window.location.hash.slice(1));
    return i >= 0 ? i : lastIndex;
}

// ------------------------------------------------------------------------------------
// Build and tear down
// ------------------------------------------------------------------------------------
function build(startIndex) {
    const compact = isCompact();
    const vw = window.innerWidth;
    const vh = compact ? stageHeight() : window.innerHeight;
    const rawDpr = window.devicePixelRatio || 1;
    // Phones render the world at a lower pixel ratio: 1.25 when the screen is 3x, else 1.5.
    const dpr = compact ? (rawDpr >= 3 ? 1.25 : Math.min(rawDpr, 1.5)) : Math.min(rawDpr, 2);

    root.classList.add('world-mode');
    root.classList.toggle('world-compact', compact);
    if (compact) {
        main.style.setProperty('--stage-h', vh + 'px');
    }
    setNavMode(true);
    if (compact) {
        fitNavRow(vw);
    }
    const navRow = document.querySelector('.nav-links');
    const navBottom = navRow ? navRow.getBoundingClientRect().bottom : 52;

    const L = makeLayout({ vw, vh, compact, count, navBottom, dpr });
    main.style.setProperty('--board-w', L.boardW + 'px');
    if (compact) {
        main.style.setProperty('--board-h', L.region + 'px');
    }

    // Lazy images inside 3D-transformed boards are loaded unreliably, so desktop loads them
    // now. Phones load them per board, when that board is mounted (see mountAround).
    if (!compact) {
        sections.forEach((section) => {
            section.querySelectorAll('img[loading="lazy"]').forEach((img) => {
                img.setAttribute('data-was-lazy', '');
                img.loading = 'eager';
            });
        });
    }

    // Built first, so its swatches count in the Start panel's height.
    const creator = createCreator(sections[0]);

    // Measure the panels at their real width (phone panels have one fixed height).
    const measure = document.createElement('div');
    measure.className = 'measure';
    if (!compact) {
        main.appendChild(measure);
    }
    sections.forEach((section) => {
        section.style.width = L.boardW + 'px';
        section.style.height = compact ? L.region + 'px' : '';
        if (!compact) {
            measure.appendChild(section);
        }
    });
    const heights = sections.map((section) => (compact ? L.region : Math.min(Math.ceil(section.offsetHeight), L.region)));

    const ctx = createStage(main, L);
    const island = buildIsland(ctx, L);
    const boards = buildBoards(ctx, L, sections, heights);
    measure.remove();
    const flowers = buildFlowers(ctx, L, island.obstacles);
    const topMax = Math.max.apply(null, boards.boards.map((b) => b.fit.centerY + b.fit.h / 2 + 18));
    const clouds = buildClouds(ctx, L, topMax);

    // The walker.
    const figure = buildCharacter(characterStore.get());
    figure.root.scale.setScalar(L.Hc);
    ctx.scene.add(figure.root);
    const shadowGeo = new THREE.PlaneGeometry(1, 1);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const walkShadow = new THREE.Mesh(shadowGeo, shadowMat);
    walkShadow.scale.setScalar(L.Hc * 0.95);
    walkShadow.renderOrder = 3;
    ctx.scene.add(walkShadow);
    const unsubscribe = characterStore.subscribe((state) => figure.apply(state));

    // The settled board lives in a native-scrolling 2D overlay (overlay.js).
    const overlay = createOverlay(main, boards.boards, L);

    // Phones keep full DOM only for the current board and its neighbours; the rest are plain
    // white frames with their title. Desktop keeps everything mounted.
    const mountedWanted = (center) => boards.boards.map((b) => {
        if (!compact) {
            return true;
        }
        const d = Math.abs(b.index - center);
        return Math.min(d, count - d) <= 1;
    });
    function mountAround(center) {
        const want = mountedWanted(center);
        boards.boards.forEach((b, i) => {
            if (compact && want[i] && !b.imagesLoaded) {
                b.imagesLoaded = true;
                b.section.querySelectorAll('img[loading="lazy"]').forEach((img) => {
                    img.setAttribute('data-was-lazy', '');
                    img.loading = 'eager';
                });
            }
            if (overlay && !want[i] && overlay.index() === i) {
                overlay.hide();
            }
            boards.setMounted(b, want[i]);
        });
    }
    mountAround(startIndex);

    // Input and HUD.
    const input = createInput({
        root: main,
        ids,
        count,
        scroller: () => overlay.scroller(),
        isEmpty: (el) => !!el && el.nodeType === 1 && !el.closest('.board-overlay, .board-host, .board, button, a, input, select, textarea, dialog, .hud, .arrow-wrap, .minimap, .navbar, .nav, .submenu, .loader'),
        onHover(side) {
            main.classList.toggle('is-hover-prev', side < 0);
            main.classList.toggle('is-hover-next', side > 0);
            document.querySelectorAll('.arrow-wrap--prev .arrow').forEach((b) => b.classList.toggle('is-hot', side < 0));
            document.querySelectorAll('.arrow-wrap--next .arrow').forEach((b) => b.classList.toggle('is-hot', side > 0));
        },
        onInput() {
            if (!hintGone) {
                hintGone = true;
                if (world) {
                    world.hud.hideHint();
                }
            }
        },
        onArrive(index) {
            const id = ids[index];
            window.dispatchEvent(new CustomEvent('world:arrived', { detail: { id } }));
            if (window.location.hash !== '#' + id) {
                try {
                    history.replaceState(null, '', '#' + id);
                } catch (e) {
                    // Some contexts (file URLs, sandboxes) refuse this; ignore.
                }
            }
        }
    });
    input.configure({ spacing: L.spacing, boardW: L.boardW });
    input.place(startIndex);
    const hud = createHud(main, {
        sections,
        ids,
        compact,
        count,
        angles: sections.map((s, i) => (i * L.spacing) / L.Rb),
        hintGone,
        coarse: coarse(),
        onGo: (i) => input.walkToIndex(i),
        onStep: (dir) => input.walkToIndex(input.targetIndex() + dir),
        onHoldStart: (dir) => input.holdStart('arrow', dir),
        onHoldEnd: () => input.holdEnd('arrow')
    });


    world = {
        L, ctx, island, boards, flowers, clouds, figure, walkShadow, shadowGeo, shadowMat, unsubscribe,
        overlay, mountAround, calm: 0, mountedCenter: startIndex, input, hud, creator, compact,
        yaw: startIndex * ((Math.PI * 2) / count) + Math.PI,
        time: 0,
        pose: {},
        raf: 0,
        last: performance.now(),
        first: true,
        bench: !!benchWanted,
        shownIndex: -1
    };
    input.attach();
    world.switchBtn = createSwitch(compact);
    window.__world = Object.assign(debug, {
        L, ctx, boards: boards.boards, input: input.state, figure, creator,
        project: (x, y, z) => project(ctx.camera, L, x, y, z),
        // Test hooks.
        setPos: (spacings) => input.place(0) || (input.state.current = input.state.target = spacings * L.spacing),
        walkTo: (i) => input.walkToIndex(i),
        setCharacter: (p) => characterStore.set(p)
    });
    frame(performance.now());
}

// "Simple version": a text button in the sky nav row (desktop), and the line under the intro
// on the start board (every size). Both store the choice and reload.
function createSwitch(compact) {
    const made = [];
    if (!compact) {
        const row = document.querySelector('.nav-links');
        if (row) {
            const li = document.createElement('li');
            li.className = 'mode-li';
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mode-switch';
            b.textContent = 'Simple version';
            b.setAttribute('aria-label', 'Switch to the simple version of this site');
            b.addEventListener('click', () => setUserMode('plain'));
            li.appendChild(b);
            const resumeLi = row.querySelector('.is-sky-resume');
            row.insertBefore(li, resumeLi ? resumeLi.parentElement : null);
            made.push(li);
        }
    }
    return {
        remove() {
            made.forEach((n) => n.remove());
        }
    };
}

function teardown() {
    if (!world) {
        return;
    }
    const w = world;
    window.cancelAnimationFrame(w.raf);
    w.input.detach();
    w.hud.dispose();
    if (w.creator) {
        w.creator.dispose();
    }
    w.unsubscribe();
    w.figure.dispose();
    w.shadowGeo.dispose();
    w.shadowMat.dispose();
    if (w.overlay) {
        w.overlay.dispose();
    }
    if (w.switchBtn) {
        w.switchBtn.remove();
    }
    sections.forEach((section) => {
        main.insertBefore(section, w.ctx.stage);
        section.removeAttribute('style');
        section.removeAttribute('draggable');
        section.scrollTop = 0;
    });
    document.querySelectorAll('img[data-was-lazy]').forEach((img) => {
        img.loading = 'lazy';
        img.removeAttribute('data-was-lazy');
    });
    w.flowers.dispose();
    w.clouds.dispose();
    w.boards.dispose();
    w.ctx.dispose();
    main.style.removeProperty('--board-w');
    main.style.removeProperty('--board-h');
    main.style.removeProperty('--stage-h');
    setNavMode(false);
    root.classList.remove('world-mode', 'world-compact');
    world = null;
    debug.ready = false;
}

// ------------------------------------------------------------------------------------
// Frame loop
// ------------------------------------------------------------------------------------
const Y = new THREE.Vector3(0, 1, 0);
const sunDir = new THREE.Vector3();
const TAU = Math.PI * 2;

function angleDiff(a, b) {
    let d = (b - a) % TAU;
    if (d > Math.PI) {
        d -= TAU;
    } else if (d < -Math.PI) {
        d += TAU;
    }
    return d;
}

function frame(now) {
    const w = world;
    if (!w) {
        return;
    }
    w.raf = window.requestAnimationFrame(frame);
    const t0 = performance.now();
    const dt = Math.max(0, Math.min(0.1, (now - w.last) / 1000));
    w.last = now;
    w.time += dt;
    const { L, ctx, input, figure } = w;
    const s = input.state;
    input.update(now, dt);

    applyPose(L, ctx.camera, s.current, w.pose);
    const theta = w.pose.theta;

    // The sun rides with the camera so every board is lit the same way.
    sunDir.set(-0.55, 1, 0.6).applyAxisAngle(Y, theta);
    ctx.sun.position.copy(sunDir);

    // The walker stands on the path at the visitor's angle.
    const px = Math.sin(theta) * L.Rp;
    const pz = Math.cos(theta) * L.Rp;
    const o = debug.charOverride;
    figure.root.position.set(o ? o.x : px, o ? o.y : L.pathTop, o ? o.z : pz);
    w.walkShadow.position.set(px, L.pathTop + 0.6, pz);
    const settled = !s.walking;
    let want;
    if (settled) {
        want = theta + Math.PI;                         // facing the board, back to the camera
    } else {
        want = s.velocity >= 0 ? theta + Math.PI / 2 + 0.34 : theta - Math.PI / 2 - 0.34;
    }
    w.yaw += angleDiff(w.yaw, want) * (1 - Math.exp(-dt * 7));
    figure.root.rotation.y = w.yaw;
    const worldSpeed = Math.abs(s.velocity) * (L.Rp / L.Rb);
    figure.update(dt, {
        walk: s.walking ? 1 : 0,
        rate: Math.max(6, Math.min(14, (10.8 * worldSpeed) / L.Hc)),
        looking: settled && w.pose.t < 0.5
    });

    w.flowers.update(w.time, theta);
    w.clouds.update(w.time);

    const index = input.currentIndex();
    if (index !== w.shownIndex) {
        w.shownIndex = index;
        lastIndex = index;
        if (w.compact) {
            w.mountAround(index);
        }
    }
    w.hud.update(theta, index);

    // Let the compositor own the DOM layer while the world moves, crisp text when it rests.
    const moving = s.walking || w.pose.t > 0.001 || s.explicit || Math.abs(s.target - s.current) > 0.5;
    const camEl = ctx.cssLayer.firstChild && ctx.cssLayer.firstChild.firstChild;
    if (camEl && camEl.style) {
        const wc = moving ? 'transform' : 'auto';
        if (w.willChange !== wc) {
            camEl.style.willChange = wc;
            w.willChange = wc;
        }
    }

    // Settled on a board means that board lives in the native-scrolling overlay.
    if (w.overlay && !debug.noOverlay) {
        if (moving) {
            w.calm = 0;
            if (w.overlay.index() >= 0) {
                w.overlay.hide();
            }
        } else if (w.overlay.index() !== index) {
            w.calm++;
            if (w.calm >= 3) {
                w.overlay.show(index);
            }
        }
    }

    // The creator preview rides on the main renderer (one WebGL context for the page).
    if (w.creator) {
        const near = Math.min(index, count - index) <= 1;
        w.creator.draw(ctx.gl, dt, now, near);
    }

    ctx.css.render(ctx.scene, ctx.camera);
    ctx.gl.render(ctx.scene, ctx.camera);

    if (w.first) {
        w.first = false;
        w.firstAt = now;
        w.benchDt = [];
        w.benchSkip = 8;
    }
    if (w.bench) {
        runBench(w, now, dt);
    } else if (!debug.ready && !w.slowOut) {
        finishReady(w);
    }
    debug.frames++;
    debug.frameTimes.push(now);
    if (debug.frameTimes.length > 600) {
        debug.frameTimes.shift();
    }
    debug.index = index;
    debug.t = w.pose.t;
    debug.theta = theta;
    debug.cost = performance.now() - t0;
}

// ------------------------------------------------------------------------------------
// Mode switching
// ------------------------------------------------------------------------------------
function refresh() {
    const index = currentIndex();
    if (eligible()) {
        teardown();
        build(index);
    } else if (world) {
        teardown();
        root.classList.remove('world-loading', 'world-ready');
        sections[index].scrollIntoView({ behavior: 'instant', block: 'start' });
    }
}

function onViewportChange() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
        if (world && window.innerWidth === world.L.vw && stageHeightFor(world) === world.L.vh) {
            return;
        }
        refresh();
    }, 150);
}

function stageHeightFor(w) {
    return w.compact ? stageHeight() : window.innerHeight;
}

document.addEventListener('visibilitychange', () => {
    if (!world) {
        return;
    }
    if (document.hidden) {
        window.cancelAnimationFrame(world.raf);
        world.raf = 0;
    } else if (!world.raf) {
        world.last = performance.now();
        world.raf = window.requestAnimationFrame(frame);
    }
});

window.addEventListener('resize', onViewportChange);
window.addEventListener('orientationchange', onViewportChange);
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportChange);
}
if (motionQuery.addEventListener) {
    motionQuery.addEventListener('change', refresh);
}

if (window.location.hash === '#experience-2') {
    try {
        history.replaceState(null, '', '#experience');
    } catch (e) {
        // The board lookup still understands the alias.
    }
    window.addEventListener('DOMContentLoaded', () => {
        if (!world) {
            const el = document.getElementById('experience');
            if (el) {
                el.scrollIntoView({ block: 'start' });
            }
        }
    });
}

// Called by main.js once the capability check chose the 3D world.
// opts: { bench: bool, onDecision(info) }
export async function start(opts) {
    if (started) {
        return;
    }
    started = true;
    benchWanted = !!opts.bench;
    onDecision = opts.onDecision || (() => {});
    onContextLost(() => {
        // A lost context (memory pressure) would leave a dead screen: go plain, for good.
        markContextLost();
        glOk = false;
        try {
            teardown();
        } catch (e) {
            // Ignore.
        }
        destroyRenderer();
        root.classList.remove('world-loading', 'world-ready', 'world-mode', 'world-compact');
        onDecision({ lost: true });
    });
    root.classList.add('world-loading');
    // The web font changes the panel sizes, so lay out once it is in (never wait long).
    if (document.fonts && document.fonts.load) {
        const loads = FONT_WEIGHTS.map((wt) => document.fonts.load(wt + ' 16px "Lexend"').catch(() => null));
        await Promise.race([Promise.all(loads), new Promise((r) => window.setTimeout(r, 2500))]);
    }
    if (document.readyState === 'loading') {
        await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
    }
    try {
        refresh();
    } catch (e) {
        // Anything unexpected: fall back to the plain vertical page.
        console.error(e);
        try {
            teardown();
        } catch (e2) {
            // Ignore.
        }
        destroyRenderer();
        root.classList.remove('world-loading', 'world-mode', 'world-compact');
        onDecision({ error: true });
    }
}

// Leave the world for the plain page without a reload (benchmark failed).
export function abandon() {
    glOk = false;
    window.cancelAnimationFrame(world ? world.raf : 0);
    try {
        teardown();
    } catch (e) {
        // Ignore.
    }
    destroyRenderer();
    root.classList.remove('world-loading', 'world-ready', 'world-mode', 'world-compact');
    const index = lastIndex;
    if (sections[index]) {
        sections[index].scrollIntoView({ behavior: 'instant', block: 'start' });
    }
}
