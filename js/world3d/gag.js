// The gag at the end of the road. Pressing "next" on the last board (Contact) sends the
// walker to the little house's door; it bonks into the door, hops back, turns to the camera,
// scratches its head and says it should introduce itself first, then points up at the email
// address on the Contact board. Everything here is driven by the world's frame loop: update()
// gives the pose overrides, late() aims the arm and places the speech bubble.
import { THREE } from './scene.js';

export const LINE = 'I should probably introduce myself before entering their house.';

const ease = (t) => {
    const c = Math.min(1, Math.max(0, t));
    return c * c * (3 - 2 * c);
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const T_TURN = 0.28;
const T_BUMP = 0.85;            // slam plus the bounce all the way back to the board
const T_ACCEL = 0.08;           // short speed-up, then full walking speed into the door
const BOARD_TIME = 0.42;        // seconds per board spacing, same pace as walking between boards
const T_FACE = 0.4;
const T_SCRATCH = 1.6;
const T_POINT = 2.5;
const PAN_FOLLOW = 0.85;        // how much of the walk the camera follows

export function createGag(o) {
    // o: { ctx, L, house, figure, boardIndex, emailEl() }
    const { L, figure, house } = o;
    const Hc = L.Hc;
    const totalD = house.doorTheta;                // filled per trigger (relative to start)

    // The speech bubble and a polite live region with the same words.
    const bubble = document.createElement('div');
    bubble.className = 'gag-bubble';
    bubble.setAttribute('aria-hidden', 'true');
    bubble.hidden = true;
    const box = document.createElement('div');
    box.className = 'gag-bubble__box';
    box.textContent = LINE;
    const tail = document.createElement('span');
    tail.className = 'gag-bubble__tail';
    box.appendChild(tail);
    bubble.appendChild(box);
    document.body.appendChild(bubble);
    const live = document.createElement('p');
    live.className = 'gag-live';
    live.setAttribute('aria-live', 'polite');
    document.body.appendChild(live);

    // Little stars for the bonk.
    const starGeo = new THREE.OctahedronGeometry(0.05, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffd84d, toneMapped: false });
    const stars = [0, 1, 2].map(() => {
        const m = new THREE.Mesh(starGeo, starMat);
        m.visible = false;
        figure.root.add(m);
        return m;
    });

    const st = {
        phase: null, t: 0, base: 0, dist: 0, dur: 0, back: 0,
        side: 1, bubbleOn: false, shown: false, size: { w: 0, h: 0, maxW: 0 }, pulsing: null
    };
    const out = { dTheta: 0, yawRel: null, walk: 0, rate: 11, looking: false, sx: 1, sy: 1, hop: 0, pan: 0 };

    function startPulse() {
        const el = o.emailEl();
        if (el) {
            el.classList.remove('email-pulse');
            void el.offsetWidth;
            el.classList.add('email-pulse');
            st.pulsing = el;
        }
    }
    function stopPulse() {
        if (st.pulsing) {
            st.pulsing.classList.remove('email-pulse');
            st.pulsing = null;
        }
    }
    function showBubble() {
        if (st.shown) {
            return;
        }
        st.shown = true;
        bubble.hidden = false;
        box.classList.remove('is-in');
        void box.offsetWidth;
        box.classList.add('is-in');
        live.textContent = '';
        window.setTimeout(() => {
            live.textContent = LINE;
        }, 30);
    }
    function hideBubble() {
        st.shown = false;
        bubble.hidden = true;
        box.classList.remove('is-in');
        live.textContent = '';
    }

    function next(phase) {
        st.phase = phase;
        st.t = 0;
        if (phase === 'walk') {
            // Constant speed (no slowing down before the door): one board spacing per BOARD_TIME.
            const spacingTheta = L.spacing / L.Rb;
            st.speed = spacingTheta / BOARD_TIME;
            st.dur = Math.max(0.2, Math.abs(st.dist) / st.speed + T_ACCEL / 2);
        }
        if (phase === 'scratch') {
            showBubble();
        }
        if (phase === 'point') {
            st.side = 0;
        }
    }

    function trigger(baseTheta) {
        if (st.phase) {
            return false;
        }
        st.base = baseTheta;
        st.dist = house.doorTheta - baseTheta;
        st.back = st.dist;
        next('turn');
        return true;
    }

    function cancel() {
        if (!st.phase) {
            return;
        }
        st.phase = null;
        stopPulse();
        hideBubble();
        stars.forEach((s) => {
            s.visible = false;
        });
        figure.setGesture({});
    }

    function update(dt) {
        if (!st.phase) {
            return null;
        }
        st.t += dt;
        const t = st.t;
        out.yawRel = null;
        out.walk = 0;
        out.looking = false;
        out.sx = 1;
        out.sy = 1;
        out.hop = 0;
        out.rate = 11;
        switch (st.phase) {
        case 'turn':
            out.dTheta = 0;
            out.pan = 0;
            out.yawRel = Math.PI / 2;
            if (t >= T_TURN) {
                next('walk');
            }
            break;
        case 'walk': {
            const sign = Math.sign(st.dist) || 1;
            const tt = Math.min(t, st.dur);
            const run = tt < T_ACCEL ? (st.speed * tt * tt) / (2 * T_ACCEL) : st.speed * (tt - T_ACCEL / 2);
            out.dTheta = sign * Math.min(Math.abs(st.dist), run);
            out.rate = 15;
            out.pan = out.dTheta * L.Rb * PAN_FOLLOW;
            out.yawRel = Math.PI / 2 + 0.2;
            out.walk = 1;
            if (t >= st.dur) {
                next('bump');
            }
            break;
        }
        case 'bump': {
            const hit = 0.1;
            let dTheta = st.dist;
            if (t < hit) {
                const k = t / hit;
                out.sy = 1 - 0.3 * k;
                out.sx = 1 + 0.22 * k;
            } else {
                // Knocked backwards: a big hop then a small one, landing back on the board spot.
                const u = clamp((t - hit) / (T_BUMP - hit), 0, 1);
                const k = 1 - (1 - u) * (1 - u);
                dTheta = st.dist * (1 - k);
                const h1 = 0.62;
                if (u < h1) {
                    const v = u / h1;
                    out.hop = 0.55 * Hc * 4 * v * (1 - v);
                } else {
                    const v = (u - h1) / (1 - h1);
                    out.hop = 0.16 * Hc * 4 * v * (1 - v);
                }
                const land = Math.max(Math.exp(-Math.pow((u - h1) * 14, 2)), Math.exp(-Math.pow((u - 1) * 14, 2)));
                const sq = 0.22 * land;
                out.sy = 1 - sq;
                out.sx = 1 + sq * 0.7;
                st.back = dTheta;
            }
            out.dTheta = dTheta;
            out.pan = dTheta * L.Rb * PAN_FOLLOW;
            out.yawRel = Math.PI / 2;
            for (let i = 0; i < stars.length; i++) {
                const s = stars[i];
                const a = (t * 7) + (i * Math.PI * 2) / 3;
                const life = clamp(1 - t / 0.6, 0, 1);
                s.visible = t < 0.6;
                s.position.set(Math.cos(a) * 0.2, 1.12 + 0.05 * Math.sin(t * 20 + i), Math.sin(a) * 0.2);
                s.rotation.y = t * 8;
                s.scale.setScalar(0.5 + life * 1.2);
            }
            if (t >= T_BUMP) {
                stars.forEach((s) => {
                    s.visible = false;
                });
                st.back = 0;
                next('face');
            }
            break;
        }
        case 'back': {
            const f = ease(t / st.dur);
            out.dTheta = st.back * (1 - f);
            out.pan = out.dTheta * L.Rb * PAN_FOLLOW;
            out.yawRel = -Math.PI / 2 - 0.2;
            out.walk = 1;
            if (t >= st.dur) {
                next('face');
            }
            break;
        }
        case 'face':
            out.dTheta = 0;
            out.pan = 0;
            out.yawRel = 0;
            if (t >= T_FACE) {
                next('scratch');
            }
            break;
        case 'scratch':
            out.dTheta = 0;
            out.pan = 0;
            out.yawRel = 0;
            if (t >= T_SCRATCH) {
                next('point');
            }
            break;
        case 'point':
            out.dTheta = 0;
            out.pan = 0;
            out.yawRel = Math.PI;
            out.looking = true;
            if (t >= 0.35 && !st.pulsing) {
                startPulse();
            }
            if (t >= T_POINT) {
                finish();
                return null;
            }
            break;
        default:
            break;
        }
        return out;
    }

    function finish() {
        st.phase = null;
        stopPulse();
        hideBubble();
        figure.setGesture({});
        if (o.onDone) {
            o.onDone();
        }
    }

    // Where the email address is, on the plane of the Contact board.
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane();
    const hit = new THREE.Vector3();
    const ndc = new THREE.Vector2();
    const shoulder = new THREE.Vector3();
    const local = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const headPos = new THREE.Vector3();
    function emailWorld(camera, rect) {
        ndc.set(((rect.left + rect.width / 2) / L.vw) * 2 - 1, -(((rect.top + rect.height / 2) / L.vh) * 2 - 1));
        ray.setFromCamera(ndc, camera);
        const th = (L.count - 1) * ((Math.PI * 2) / L.count);
        plane.normal.set(Math.sin(th), 0, Math.cos(th));
        plane.constant = -L.Rb;
        return ray.ray.intersectPlane(plane, hit) ? hit : null;
    }

    // Aim the arm and place the bubble. Called after the walker's transform is final.
    function late(camera, navBottom) {
        if (!st.phase) {
            return;
        }
        let emailRect = null;
        const el = o.emailEl();
        if (el) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
                emailRect = r;
            }
        }
        if (st.phase === 'scratch') {
            figure.setGesture({ scratch: 1, point: 0, side: 1 });
        } else if (st.phase === 'point') {
            const target = emailRect ? emailWorld(camera, emailRect) : null;
            if (target && st.t > 0.3) {
                local.copy(target);
                figure.root.worldToLocal(local);
                if (!st.side) {
                    st.side = local.x >= 0 ? 1 : -1;
                }
                figure.shoulder(st.side, shoulder);
                dir.copy(local).sub(shoulder).normalize();
                figure.setGesture({ scratch: 0, point: 1, side: st.side, dir });
            } else {
                figure.setGesture({});
            }
        } else {
            figure.setGesture({});
        }
        if (st.shown) {
            placeBubble(camera, emailRect, navBottom);
        }
    }

    function placeBubble(camera, emailRect, navBottom) {
        headPos.set(0, 1.18, 0);
        figure.root.localToWorld(headPos);
        headPos.project(camera);
        const hx = (headPos.x * 0.5 + 0.5) * L.vw;
        const hy = (-headPos.y * 0.5 + 0.5) * L.vh;
        const m = 8;
        const maxW = Math.min(260, L.vw - 2 * m);
        if (st.size.maxW !== maxW) {
            box.style.maxWidth = maxW + 'px';
            st.size.maxW = maxW;
            st.size.w = 0;
        }
        if (!st.size.w) {
            st.size.w = box.offsetWidth;
            st.size.h = box.offsetHeight;
        }
        let w = st.size.w;
        let h = st.size.h;
        const gap = 12;
        const wrapR = (left, top, ww, hh, pad) => ({ l: left - pad, t: top - pad, r: left + ww + pad, b: top + hh + pad });
        const hits = (r) => emailRect && r.l < emailRect.right && r.r > emailRect.left && r.t < emailRect.bottom && r.b > emailRect.top;
        // Above the head.
        let left = clamp(hx - w / 2, m, L.vw - m - w);
        let top = hy - gap - h;
        let mode = 'down';
        const topLimit = Math.max(m, (navBottom || 0) + 6);
        if (top < topLimit || hits(wrapR(left, top, w, h, 6))) {
            // Beside the head instead: on whichever side has more room.
            const half = Math.max(24, L.Hs * 0.32);
            const roomR = L.vw - m - (hx + half + 10);
            const roomL = hx - half - 10 - m;
            const right = roomR >= roomL;
            const room = right ? roomR : roomL;
            const sideMax = Math.min(maxW, Math.max(120, room));
            if (st.size.maxW !== sideMax) {
                box.style.maxWidth = sideMax + 'px';
                st.size.maxW = sideMax;
                w = box.offsetWidth;
                h = box.offsetHeight;
                st.size.w = w;
                st.size.h = h;
            }
            left = right ? hx + half + 10 : hx - half - 10 - w;
            left = clamp(left, m, L.vw - m - w);
            top = clamp(hy - h * 0.7, topLimit, L.vh - m - h);
            mode = right ? 'left' : 'right';
        }
        bubble.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)';
        box.dataset.tail = mode;
        const tailX = clamp(hx - left, 16, w - 16);
        const tailY = clamp(hy - top, 14, h - 14);
        if (mode === 'down') {
            tail.style.left = tailX + 'px';
            tail.style.top = '';
            box.style.transformOrigin = tailX + 'px 100%';
        } else {
            tail.style.left = '';
            tail.style.top = tailY + 'px';
            box.style.transformOrigin = (mode === 'left' ? '0' : '100%') + ' ' + tailY + 'px';
        }
    }

    function dispose() {
        cancel();
        bubble.remove();
        live.remove();
        stars.forEach((s) => figure.root.remove(s));
        starGeo.dispose();
        starMat.dispose();
    }

    return {
        trigger, cancel, update, late, dispose,
        get active() {
            return !!st.phase;
        },
        get phase() {
            return st.phase;
        },
        get time() {
            return st.t;
        },
        // The board is back in the 3D scene while the walker moves about.
        get blocking() {
            return st.phase === 'turn' || st.phase === 'walk' || st.phase === 'bump' || st.phase === 'back';
        }
    };
}
