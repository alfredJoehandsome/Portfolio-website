// Layout (everything in px, 1 world unit = 1 css px at the board plane) and the two
// camera poses: a head-on, exactly 1:1 "read" pose behind the character, and a
// pulled back "travel" pose, blended by how close the visitor is to the nearest board.
import { THREE } from './scene.js';

export const RIM = 18;                  // frame rim around the panel
export const FRAME_DEPTH = 26;
const NAV_GAP = 14;
const COMPACT_NAV_GAP = 12;
const HAT_MAX = 1.22;                   // tallest hat adds this much to the figure height

const rad = (deg) => (deg * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function smoothstep(a, b, x) {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
}

export function makeLayout(o) {
    const vw = o.vw;
    const vh = o.vh;
    const compact = o.compact;
    const count = o.count;
    const fovRead = compact ? 44 : 34;
    const D = vh / 2 / Math.tan(rad(fovRead) / 2);       // distance where the panel plane is 1:1
    const S = (compact ? 0.2 : 0.24) * D;                // panel plane to the character
    const Hs = compact ? clamp(0.15 * vh, 92, 140) : clamp(0.165 * vh, 104, 170);   // figure height on screen
    const feetBottom = compact ? 30 : 38;
    const Yf = vh - feetBottom;                          // feet line on screen
    const k = (D - S) / D;
    const Hc = Hs * k;                                   // figure height in world px
    const yc = (Yf - vh / 2) * k;                        // camera height in the read pose
    const top = o.navBottom + (compact ? COMPACT_NAV_GAP : NAV_GAP);
    const bottom = Yf - HAT_MAX * Hs - (compact ? 10 : 16);

    // Panel width: parity follows the viewport so panel edges land on whole pixels.
    let boardW = compact
        ? Math.min(vw - 2 * 24, 460)
        : Math.min(1120, vw - 2 * 96);
    boardW = Math.floor(boardW / 2) * 2 + (vw % 2);
    const region = Math.floor(bottom - top);

    // Spacing and ring radius.
    // The free arc between boards is chosen so the next board peeks in beside the front one.
    const gap = solveGap({ vw, boardW, count, D, target: vw - (compact ? 14 : 56) });
    const spacing = boardW + gap;
    const Rb = (count * spacing) / (2 * Math.PI);        // board plane radius
    const Rp = Rb + S;                                   // path radius (the character walks here)
    const pathW = Math.max(150, 2.3 * Hc);
    const Ri = Rp + Math.max(0.85 * D, pathW);           // island radius
    const rho0 = Rb + D;

    const L = {
        vw, vh, compact, count, dpr: o.dpr,
        fovRead, D, S, Hs, Hc, Yf, yc, k,
        top, bottom, region, boardW, gap, spacing, Rb, Rp, Ri, pathW,
        perimeter: count * spacing,
        near: 60,
        far: Math.max(60000, rho0 * 12),
        dome: {
            radius: rho0 * 1.84,
            centerY: -rho0 * 1.33,
            fade: rad(40)
        }
    };
    L.dome.radius = Math.min(L.dome.radius, L.far * 0.45);

    // Fit one panel of natural height h (px): scale k so it sits in the free region,
    // and the screen y of its top edge so it is centred there (whole pixels at k = 1).
    L.fit = function (h) {
        // Panels are never scaled down: a tall one is cut to the free region and scrolls.
        const shown = Math.min(h, region);
        const topPx = Math.round(top + (region - shown) / 2);
        const centerScreen = topPx + shown / 2;
        // World height of the panel centre: it is at distance D, so screen offsets are 1:1.
        const centerY = yc + (vh / 2 - centerScreen);
        return { scale: 1, w: boardW, h: shown, topPx, centerScreen, centerY, natural: h, overflow: h > region };
    };

    L.read = { rho: Rb + D, h: yc, pitch: 0, fov: fovRead };
    L.travel = {
        rho: Rb + D * (compact ? 1.25 : 1.4),
        h: yc + D * (compact ? 0.3 : 0.34),
        pitch: -rad(compact ? 12 : 11),
        fov: fovRead * (compact ? 1.05 : 1.14)
    };
    return L;
}

// Gap between boards so the next board just peeks in beside the front one.
function solveGap(p) {
    const delta = (2 * Math.PI) / p.count;
    let best = 160;
    let bestErr = Infinity;
    for (let g = 60; g <= 900; g += 5) {
        const spacing = p.boardW + g;
        const Rb = (p.count * spacing) / (2 * Math.PI);
        const x = Rb * Math.sin(delta) - (p.boardW / 2) * Math.cos(delta);
        const depth = Rb + p.D - Rb * Math.cos(delta) - (p.boardW / 2) * Math.sin(delta);
        const screenX = p.vw / 2 + (p.D * x) / depth;
        const err = Math.abs(screenX - p.target);
        if (err < bestErr) {
            bestErr = err;
            best = g;
        }
    }
    return best;
}

// Blend factor between read pose (0) and travel pose (1) for arc position s.
export function travelAmount(L, s) {
    const m = ((s % L.spacing) + L.spacing) % L.spacing;
    const dist = Math.min(m, L.spacing - m);
    return smoothstep(0, 0.35, dist / L.spacing);
}

const _e = new THREE.Euler();

// Put the camera where the visitor is. Returns the pose for the others.
export function applyPose(L, camera, s, out) {
    const theta = s / L.Rb;
    const t = travelAmount(L, s);
    const rho = L.read.rho + (L.travel.rho - L.read.rho) * t;
    const h = L.read.h + (L.travel.h - L.read.h) * t;
    const pitch = L.read.pitch + (L.travel.pitch - L.read.pitch) * t;
    const fov = L.read.fov + (L.travel.fov - L.read.fov) * t;
    camera.position.set(rho * Math.sin(theta), h, rho * Math.cos(theta));
    _e.set(pitch, theta, 0, 'YXZ');
    camera.quaternion.setFromEuler(_e);
    if (Math.abs(camera.fov - fov) > 1e-6) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld(true);
    const pose = out || {};
    pose.theta = theta;
    pose.t = t;
    pose.rho = rho;
    pose.h = h;
    pose.pitch = pitch;
    pose.fov = fov;
    return pose;
}

const _v = new THREE.Vector3();
// Screen position (css px) of a world point.
export function project(camera, L, x, y, z, out) {
    _v.set(x, y, z).project(camera);
    const r = out || {};
    r.x = (_v.x * 0.5 + 0.5) * L.vw;
    r.y = (-_v.y * 0.5 + 0.5) * L.vh;
    r.z = _v.z;
    return r;
}
