// The toy figure: builder, faces, clothes, hats, procedural animation and persistence.
// Original design built from primitives (capsules and spheres). Total height is 1 unit
// (without a hat) and the head is 40 percent of it; scale the root to size it.
import { THREE, toon } from './scene.js';

// ----------------------------------------------------------------------------------
// Data. To add an option, push one more object to a list.
// ----------------------------------------------------------------------------------
export const SHIRTS = [
    { id: 'crimson', name: 'Crimson', color: '#c0392b' },
    { id: 'sky', name: 'Sky', color: '#34bfef' },
    { id: 'grass', name: 'Grass', color: '#5cc15a' },
    { id: 'sun', name: 'Sun', color: '#ffc93c' },
    { id: 'pink', name: 'Pink', color: '#ff8fb8' },
    { id: 'purple', name: 'Purple', color: '#9b7bea' },
    { id: 'white', name: 'White', color: '#f5f5f5' },
    { id: 'charcoal', name: 'Charcoal', color: '#3a3f44' }
];

export const PANTS = [
    { id: 'denim', name: 'Denim', color: '#3d5a99' },
    { id: 'charcoal', name: 'Charcoal', color: '#3a3f44' },
    { id: 'khaki', name: 'Khaki', color: '#c8b28a' },
    { id: 'white', name: 'White', color: '#f5f5f5' },
    { id: 'black', name: 'Black', color: '#222222' },
    { id: 'red', name: 'Red', color: '#b5322a' }
];

const INK = '#3b2f35';
const MOUTH = '#7a2e3a';
const BROW = '#6b4a3a';
const BLUSH = 'rgba(255,125,150,0.38)';

function ellipse(c, x, y, rx, ry, fill) {
    c.fillStyle = fill;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
}

function stroke(c, width, color) {
    c.lineWidth = width;
    c.strokeStyle = color;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.stroke();
}

function brow(c, x, y, tilt, curve) {
    c.beginPath();
    c.moveTo(x - 17, y + tilt);
    c.quadraticCurveTo(x, y - curve, x + 17, y - tilt);
    stroke(c, 7, BROW);
}

function shine(c, x, y, rx, ry) {
    ellipse(c, x, y, rx, ry, INK);
    ellipse(c, x + rx * 0.32, y - ry * 0.34, rx * 0.36, rx * 0.36, '#ffffff');
    ellipse(c, x - rx * 0.28, y + ry * 0.36, rx * 0.17, rx * 0.17, '#ffffff');
}

function blush(c) {
    ellipse(c, 52, 150, 22, 13, BLUSH);
    ellipse(c, 204, 150, 22, 13, BLUSH);
}

function closedEye(c, x, y) {
    c.beginPath();
    c.arc(x, y - 4, 15, Math.PI * 0.12, Math.PI * 0.88, false);
    stroke(c, 7, INK);
}

function openMouth(c, x, y, w, depth) {
    c.beginPath();
    c.moveTo(x - w, y);
    c.quadraticCurveTo(x, y + depth * 2, x + w, y);
    c.closePath();
    c.fillStyle = MOUTH;
    c.fill();
    c.save();
    c.clip();
    ellipse(c, x, y + depth * 0.92, w * 0.5, depth * 0.38, '#ff8fa3');
    c.restore();
    c.beginPath();
    c.moveTo(x - w, y);
    c.quadraticCurveTo(x, y + depth * 2, x + w, y);
    c.closePath();
    stroke(c, 5, MOUTH);
}

// Eyes are at x = 82 and 174, y = 118 on a 256 x 232 canvas.
export const FACES = [
    {
        id: 'happy',
        name: 'Happy',
        eyes: [82, 174],
        draw(c, blink) {
            blush(c);
            [82, 174].forEach((x) => {
                brow(c, x, 84, 0, 8);
                if (blink) {
                    closedEye(c, x, 120);
                } else {
                    ellipse(c, x, 120, 12, 17, INK);
                }
            });
            c.beginPath();
            c.arc(128, 150, 27, Math.PI * 0.14, Math.PI * 0.86, false);
            stroke(c, 8, INK);
        }
    },
    {
        id: 'cheerful',
        name: 'Cheerful',
        eyes: [82, 174],
        draw(c, blink) {
            blush(c);
            [82, 174].forEach((x) => {
                brow(c, x, 78, 0, 12);
                if (blink) {
                    closedEye(c, x, 118);
                } else {
                    shine(c, x, 118, 17, 22);
                }
            });
            openMouth(c, 128, 150, 30, 24);
        }
    },
    {
        id: 'cool',
        name: 'Cool',
        eyes: [82, 174],
        draw(c, blink) {
            blush(c);
            [82, 174].forEach((x, i) => {
                brow(c, x, 88, i === 0 ? 5 : -5, 3);
                if (blink) {
                    closedEye(c, x, 122);
                } else {
                    c.save();
                    c.beginPath();
                    c.rect(x - 24, 112, 48, 40);
                    c.clip();
                    ellipse(c, x, 116, 14, 16, INK);
                    c.restore();
                    c.beginPath();
                    c.moveTo(x - 17, 112);
                    c.lineTo(x + 17, 112);
                    stroke(c, 7, INK);
                }
            });
            c.beginPath();
            c.moveTo(104, 156);
            c.quadraticCurveTo(136, 172, 162, 146);
            stroke(c, 8, INK);
        }
    },
    {
        id: 'surprised',
        name: 'Surprised',
        eyes: [82, 174],
        draw(c, blink) {
            blush(c);
            [82, 174].forEach((x) => {
                brow(c, x, 66, 0, 16);
                if (blink) {
                    closedEye(c, x, 118);
                } else {
                    shine(c, x, 118, 15, 19);
                }
            });
            ellipse(c, 128, 166, 13, 17, MOUTH);
            ellipse(c, 128, 172, 7, 8, '#ff8fa3');
        }
    },
    {
        id: 'wink',
        name: 'Wink',
        eyes: [82],
        draw(c, blink) {
            blush(c);
            brow(c, 82, 80, -3, 12);
            brow(c, 174, 86, 2, 6);
            if (blink) {
                closedEye(c, 82, 120);
            } else {
                ellipse(c, 82, 120, 12, 17, INK);
            }
            c.beginPath();
            c.arc(174, 126, 15, Math.PI * 1.1, Math.PI * 1.9, false);
            stroke(c, 7, INK);
            openMouth(c, 128, 148, 28, 22);
        }
    },
    {
        id: 'sleepy',
        name: 'Sleepy',
        eyes: [],
        draw(c) {
            blush(c);
            [82, 174].forEach((x) => {
                brow(c, x, 92, 0, 3);
                closedEye(c, x, 122);
            });
            ellipse(c, 128, 160, 8, 7, MOUTH);
        }
    }
];

// ----------------------------------------------------------------------------------
// Hats. Built around the head centre with the head radius being 1; sized by the caller.
// Each returns { group, tick(time) } where tick is optional.
// ----------------------------------------------------------------------------------
const mats = {};
function hatMat(color) {
    if (!mats[color]) {
        mats[color] = toon(color, { side: THREE.DoubleSide });
    }
    return mats[color];
}
function mesh(geo, color) {
    return new THREE.Mesh(geo, hatMat(color));
}

function star(points, outer, inner, depth) {
    const shape = new THREE.Shape();
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) {
            shape.moveTo(x, y);
        } else {
            shape.lineTo(x, y);
        }
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
}

export const HATS = [
    { id: 'none', name: 'No hat', build: null },
    {
        id: 'cap',
        name: 'Cap',
        build() {
            // A dome that hugs the head: a sphere segment a hair larger than the head, tipped back so
            // the front edge rides just above the eyes and the back hangs lower. The brim is a thin
            // curved shape that starts exactly on the front edge of the crown and angles down.
            const R = 1.045;
            const EDGE = Math.PI * 0.42;                 // polar angle where the crown ends
            const g = new THREE.Group();
            const tilt = new THREE.Group();
            tilt.rotation.x = -0.2;
            g.add(tilt);
            tilt.add(mesh(new THREE.SphereGeometry(R, 40, 22, 0, Math.PI * 2, 0, EDGE), 0xe5484d));
            // The rim is a thin darker band so the cut edge reads as a hem.
            const rimR = R * Math.sin(EDGE);
            const rim = mesh(new THREE.TorusGeometry(rimR, 0.022, 6, 48), 0xcf3a42);
            rim.rotation.x = Math.PI / 2;
            rim.position.y = R * Math.cos(EDGE);
            tilt.add(rim);
            // Button on the apex.
            const button = mesh(new THREE.SphereGeometry(0.085, 14, 10), 0xcf3a42);
            button.scale.y = 0.8;
            button.position.y = R - 0.01;
            tilt.add(button);
            // Brim: a strip leaving the front half of the rim, longest at the middle, sloping down.
            const steps = 24;
            const half = 1.2;                             // radians either side of straight ahead
            const pos = [];
            const idx = [];
            const y0 = R * Math.cos(EDGE);
            for (let i = 0; i <= steps; i++) {
                const a = -half + (2 * half * i) / steps;
                const len = 0.56 * Math.pow(Math.cos((a / half) * Math.PI * 0.5), 0.6);
                const sx = Math.sin(a);
                const cz = Math.cos(a);
                const ix = rimR * sx;
                const iz = rimR * cz;
                // Outward and down: 22 degrees below the rim plane.
                const ox = ix + sx * len * 0.93;
                const oz = iz + cz * len * 0.93;
                const oy = y0 - len * 0.37;
                pos.push(ix, y0 + 0.004, iz, ox, oy, oz);
                if (i > 0) {
                    const k = (i - 1) * 2;
                    idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
                }
            }
            const brimGeo = new THREE.BufferGeometry();
            brimGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            brimGeo.setIndex(idx);
            brimGeo.computeVertexNormals();
            tilt.add(mesh(brimGeo, 0xcf3a42));
            return { group: g };
        }
    },
    {
        id: 'top-hat',
        name: 'Top hat',
        build() {
            const g = new THREE.Group();
            const brim = mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.1, 32), 0x3a3f44);
            brim.position.y = 0.7;
            g.add(brim);
            const crown = mesh(new THREE.CylinderGeometry(0.68, 0.7, 0.95, 28), 0x3a3f44);
            crown.position.y = 1.17;
            g.add(crown);
            const band = mesh(new THREE.CylinderGeometry(0.715, 0.725, 0.2, 28), 0xe5484d);
            band.position.y = 0.88;
            g.add(band);
            return { group: g };
        }
    },
    {
        id: 'wizard',
        name: 'Wizard hat',
        build() {
            const g = new THREE.Group();
            const tilt = new THREE.Group();
            tilt.position.y = 0.55;
            tilt.rotation.x = -0.1;
            g.add(tilt);
            const cone = mesh(new THREE.ConeGeometry(0.86, 1.45, 28), 0x7e5bd6);
            cone.position.y = 0.72;
            tilt.add(cone);
            const brim = mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.07, 32), 0x6a49c2);
            brim.position.y = 0.03;
            tilt.add(brim);
            const tip = mesh(new THREE.SphereGeometry(0.12, 10, 8), 0xffd84d);
            tip.position.y = 1.46;
            tilt.add(tip);
            const s = mesh(star(5, 0.24, 0.1, 0.04), 0xffd84d);
            s.position.set(0, 0.55, 0.5);
            s.rotation.x = -0.52;
            tilt.add(s);
            return { group: g };
        }
    },
    {
        id: 'crown',
        name: 'Crown',
        build() {
            const g = new THREE.Group();
            // A slightly conical band that follows the curve of the head.
            const band = mesh(new THREE.CylinderGeometry(0.8, 0.89, 0.42, 28, 1, true), 0xffc93c);
            band.position.y = 0.7;
            g.add(band);
            for (let i = 0; i < 5; i++) {
                const a = (i / 5) * Math.PI * 2;
                const spike = mesh(new THREE.ConeGeometry(0.17, 0.4, 10), 0xffc93c);
                spike.position.set(Math.sin(a) * 0.79, 1.12, Math.cos(a) * 0.79);
                g.add(spike);
                const ball = mesh(new THREE.SphereGeometry(0.08, 8, 6), 0xffe08a);
                ball.position.set(Math.sin(a) * 0.79, 1.34, Math.cos(a) * 0.79);
                g.add(ball);
            }
            const gem = mesh(new THREE.SphereGeometry(0.11, 10, 8), 0xe5484d);
            gem.position.set(0, 0.7, 0.86);
            g.add(gem);
            return { group: g };
        }
    },
    {
        id: 'party',
        name: 'Party hat',
        build() {
            const g = new THREE.Group();
            const tilt = new THREE.Group();
            tilt.position.y = 0.7;
            tilt.rotation.z = -0.2;
            g.add(tilt);
            const cone = mesh(new THREE.ConeGeometry(0.58, 1.25, 26), 0x34bfef);
            cone.position.y = 0.62;
            tilt.add(cone);
            [0.3, 0.7].forEach((h) => {
                const r = 0.58 * (1 - h / 1.25) + 0.015;
                const ring = mesh(new THREE.TorusGeometry(r, 0.045, 8, 28), 0xffd84d);
                ring.rotation.x = Math.PI / 2;
                ring.position.y = h;
                tilt.add(ring);
            });
            const pom = mesh(new THREE.SphereGeometry(0.15, 12, 8), 0xffffff);
            pom.position.y = 1.27;
            tilt.add(pom);
            return { group: g };
        }
    },
    {
        id: 'viking',
        name: 'Viking helmet',
        build() {
            const g = new THREE.Group();
            g.add(mesh(new THREE.SphereGeometry(1.06, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), 0xb7c1cb));
            const rim = mesh(new THREE.TorusGeometry(1.0, 0.08, 8, 32), 0x8f9aa6);
            rim.rotation.x = Math.PI / 2;
            rim.position.y = 0.17;
            g.add(rim);
            [-1, 1].forEach((side) => {
                const curve = new THREE.CatmullRomCurve3([
                    new THREE.Vector3(0, 0, 0),
                    new THREE.Vector3(0.26, -0.05, 0),
                    new THREE.Vector3(0.48, 0.2, 0),
                    new THREE.Vector3(0.52, 0.62, 0)
                ]);
                const horn = mesh(new THREE.TubeGeometry(curve, 12, 0.14, 10, false), 0xf4ecd8);
                horn.position.set(side * 0.98, 0.35, 0);
                horn.scale.x = side;
                g.add(horn);
                const tipBall = mesh(new THREE.SphereGeometry(0.14, 10, 8), 0xf4ecd8);
                tipBall.position.set(side * (0.98 + 0.52), 0.35 + 0.62, 0);
                g.add(tipBall);
                const root = mesh(new THREE.SphereGeometry(0.19, 10, 8), 0xe3d8bd);
                root.position.set(side * 0.98, 0.35, 0);
                g.add(root);
            });
            return { group: g };
        }
    },
    {
        id: 'propeller',
        name: 'Propeller beanie',
        build() {
            const g = new THREE.Group();
            g.add(mesh(new THREE.SphereGeometry(1.05, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.46), 0xff8fb8));
            const fold = mesh(new THREE.TorusGeometry(1.0, 0.1, 8, 32), 0xffffff);
            fold.rotation.x = Math.PI / 2;
            fold.position.y = 0.16;
            g.add(fold);
            const stem = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.28, 8), 0xffffff);
            stem.position.y = 1.15;
            g.add(stem);
            const spin = new THREE.Group();
            spin.position.y = 1.31;
            [0xffd84d, 0x34bfef].forEach((color, i) => {
                const blade = mesh(new THREE.CapsuleGeometry(0.085, 0.62, 4, 8), color);
                blade.rotation.z = Math.PI / 2;
                blade.rotation.x = 0.3 * (i ? -1 : 1);
                blade.position.x = i ? -0.4 : 0.4;
                spin.add(blade);
            });
            const hub = mesh(new THREE.SphereGeometry(0.1, 8, 6), 0xffffff);
            spin.add(hub);
            g.add(spin);
            return { group: g, tick(time) { spin.rotation.y = time * 16; } };
        }
    },
    {
        id: 'pizza',
        name: 'Pizza slice',
        build() {
            const g = new THREE.Group();
            const tilt = new THREE.Group();
            tilt.position.y = 0.68;
            tilt.rotation.x = -0.18;
            g.add(tilt);
            const shape = new THREE.Shape();
            shape.moveTo(-0.62, 0);
            shape.lineTo(0.62, 0);
            shape.lineTo(0.05, 1.5);
            shape.quadraticCurveTo(0, 1.58, -0.05, 1.5);
            shape.closePath();
            const slice = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.05, bevelSegments: 2 }), 0xffd44d);
            slice.position.z = -0.05;
            tilt.add(slice);
            const crust = mesh(new THREE.CapsuleGeometry(0.15, 1.12, 4, 10), 0xe0a050);
            crust.rotation.z = Math.PI / 2;
            crust.position.y = 0.0;
            tilt.add(crust);
            [[-0.1, 0.55, 0.17], [0.2, 0.95, 0.13], [-0.18, 0.28, 0.12]].forEach((p) => {
                const pep = mesh(new THREE.CylinderGeometry(p[2], p[2], 0.05, 14), 0xe5484d);
                pep.rotation.x = Math.PI / 2;
                pep.position.set(p[0], p[1], 0.14);
                tilt.add(pep);
            });
            return { group: g };
        }
    }
];

export const hatById = (id) => HATS.find((h) => h.id === id) || null;
export const faceById = (id) => FACES.find((f) => f.id === id) || null;
export const shirtById = (id) => SHIRTS.find((s) => s.id === id) || null;
export const pantsById = (id) => PANTS.find((p) => p.id === id) || null;

// ----------------------------------------------------------------------------------
// Persistence (localStorage key "character"; the old "stickmanHat" is migrated).
// ----------------------------------------------------------------------------------
const STORAGE_KEY = 'character';
const OLD_KEY = 'stickmanHat';
export const DEFAULT_CHARACTER = { face: 'happy', shirt: 'sky', pants: 'khaki', hat: 'propeller' };

function sanitize(raw) {
    const out = Object.assign({}, DEFAULT_CHARACTER);
    if (raw && typeof raw === 'object') {
        if (faceById(raw.face)) {
            out.face = raw.face;
        }
        if (shirtById(raw.shirt)) {
            out.shirt = raw.shirt;
        }
        if (pantsById(raw.pants)) {
            out.pants = raw.pants;
        }
        if (hatById(raw.hat)) {
            out.hat = raw.hat;
        }
    }
    return out;
}

function readStored() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return sanitize(JSON.parse(stored));
        }
        const oldHat = localStorage.getItem(OLD_KEY);
        if (oldHat && hatById(oldHat)) {
            const migrated = sanitize({ hat: oldHat });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            localStorage.removeItem(OLD_KEY);
            return migrated;
        }
    } catch (e) {
        // Storage can be blocked or hold junk; use the defaults.
    }
    return Object.assign({}, DEFAULT_CHARACTER);
}

const listeners = [];
let current = readStored();

export const characterStore = {
    get: () => Object.assign({}, current),
    set(patch) {
        const next = sanitize(Object.assign({}, current, patch));
        current = next;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
            // Not persisted, still works for this visit.
        }
        listeners.slice().forEach((fn) => fn(Object.assign({}, next)));
    },
    subscribe(fn) {
        listeners.push(fn);
        return () => {
            const i = listeners.indexOf(fn);
            if (i >= 0) {
                listeners.splice(i, 1);
            }
        };
    }
};

// ----------------------------------------------------------------------------------
// Builder
// ----------------------------------------------------------------------------------
const HEAD_R = 0.2;
const HEAD_Y = 0.8;
const NECK_Y = 0.6;

export function buildCharacter(initial) {
    const disposables = [];
    const own = (x) => {
        disposables.push(x);
        return x;
    };
    const skin = own(toon(0xffd9b8));
    const shirt = own(toon(0xc0392b));
    const pants = own(toon(0x3d5a99));
    const shoe = own(toon(0x4a5057));

    const root = new THREE.Group();
    root.name = 'character';
    const body = new THREE.Group();            // bob and lean pivot
    root.add(body);

    function limb(radius, length, material) {
        return own(new THREE.CapsuleGeometry(radius, length, 5, 12));
    }

    // Legs, pivoting at the hip.
    const legs = [-1, 1].map((side) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.07, 0.26, 0);
        const leg = new THREE.Mesh(limb(0.056, 0.07), pants);
        leg.position.y = -0.1;
        pivot.add(leg);
        const foot = new THREE.Mesh(own(new THREE.SphereGeometry(1, 16, 12)), shoe);
        foot.scale.set(0.076, 0.052, 0.105);
        foot.position.set(0, -0.2, 0.028);
        pivot.add(foot);
        body.add(pivot);
        return pivot;
    });

    // Torso.
    const torso = new THREE.Mesh(limb(0.13, 0.13), shirt);
    torso.position.y = 0.43;
    body.add(torso);

    // Arms with hands, pivoting at the shoulder.
    const arms = [-1, 1].map((side) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.165, 0.54, 0);
        pivot.rotation.z = side * 0.1;
        const arm = new THREE.Mesh(limb(0.046, 0.06), shirt);
        arm.position.y = -0.075;
        pivot.add(arm);
        const hand = new THREE.Mesh(own(new THREE.SphereGeometry(0.056, 14, 10)), skin);
        hand.position.y = -0.178;
        pivot.add(hand);
        body.add(pivot);
        return pivot;
    });

    // Head: sphere, face patch and a slot for the hat. Pivots at the neck.
    const head = new THREE.Group();
    head.position.set(0, NECK_Y, 0);
    body.add(head);
    const skull = new THREE.Mesh(own(new THREE.SphereGeometry(HEAD_R, 40, 28)), skin);
    skull.position.y = HEAD_Y - NECK_Y;
    head.add(skull);

    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = 256;
    faceCanvas.height = 232;
    const faceTex = own(new THREE.CanvasTexture(faceCanvas));
    faceTex.colorSpace = THREE.SRGBColorSpace;
    faceTex.anisotropy = 4;
    const faceMat = own(new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false, toneMapped: false }));
    const phiLen = 1.8;
    const facePatch = new THREE.Mesh(
        own(new THREE.SphereGeometry(HEAD_R * 1.012, 32, 20, Math.PI / 2 - phiLen / 2, phiLen, Math.PI * 0.27, Math.PI * 0.5)),
        faceMat
    );
    facePatch.position.y = HEAD_Y - NECK_Y;
    facePatch.renderOrder = 3;
    head.add(facePatch);

    const hatSlot = new THREE.Group();
    hatSlot.position.y = HEAD_Y - NECK_Y;
    hatSlot.scale.setScalar(HEAD_R);
    head.add(hatSlot);

    // ---- state ---------------------------------------------------------------------
    const state = Object.assign({}, DEFAULT_CHARACTER);
    let hatObj = null;
    let blinkClosed = false;
    let nextBlink = 2 + Math.random() * 3;
    let blinkUntil = 0;
    let time = 0;
    let phase = 0;
    let walkAmt = 0;
    let lookAmt = 0;

    function paintFace() {
        const face = faceById(state.face);
        const c = faceCanvas.getContext('2d');
        c.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
        face.draw(c, blinkClosed && face.eyes.length > 0);
        faceTex.needsUpdate = true;
    }

    function setFace(id) {
        if (faceById(id)) {
            state.face = id;
            blinkClosed = false;
            paintFace();
        }
    }
    function setShirt(id) {
        const s = shirtById(id);
        if (s) {
            state.shirt = id;
            shirt.color.set(s.color);
        }
    }
    function setPants(id) {
        const p = pantsById(id);
        if (p) {
            state.pants = id;
            pants.color.set(p.color);
        }
    }
    function clearHat() {
        if (hatObj) {
            hatSlot.remove(hatObj.group);
            hatObj.group.traverse((o) => {
                if (o.geometry) {
                    o.geometry.dispose();
                }
            });
            hatObj = null;
        }
    }
    function setHat(id) {
        const hat = hatById(id);
        if (!hat) {
            return;
        }
        state.hat = id;
        clearHat();
        if (hat.build) {
            hatObj = hat.build();
            hatSlot.add(hatObj.group);
        }
    }
    function apply(next) {
        setFace(next.face);
        setShirt(next.shirt);
        setPants(next.pants);
        setHat(next.hat);
    }
    apply(Object.assign({}, DEFAULT_CHARACTER, initial || {}));

    // ---- animation -----------------------------------------------------------------
    // input: { walk: 0..1 how hard he is walking, rate: strides in rad/s, looking: bool }
    function update(dt, input) {
        time += dt;
        const target = input.walk || 0;
        walkAmt += (target - walkAmt) * (1 - Math.exp(-dt * 10));
        lookAmt += ((input.looking ? 1 : 0) - lookAmt) * (1 - Math.exp(-dt * 6));
        phase += dt * (input.rate || 9) * (0.35 + 0.65 * walkAmt);

        const swing = Math.sin(phase) * 0.62 * walkAmt;
        legs[0].rotation.x = swing;
        legs[1].rotation.x = -swing;
        arms[0].rotation.x = -swing * 1.05;
        arms[1].rotation.x = swing * 1.05;

        const idle = Math.sin(time * 2.2);
        const bob = Math.abs(Math.cos(phase)) * 0.028 * walkAmt;
        body.position.y = bob + (1 - walkAmt) * idle * 0.002;
        body.rotation.x = 0.1 * walkAmt;
        torso.scale.set(1 + idle * 0.012 * (1 - walkAmt), 1 + idle * 0.02 * (1 - walkAmt), 1);
        // Idle arms sway a little; the head looks up at the billboard when settled.
        if (walkAmt < 0.2) {
            arms[0].rotation.x += Math.sin(time * 1.1) * 0.03;
            arms[1].rotation.x -= Math.sin(time * 1.1) * 0.03;
        }
        head.rotation.x = -0.38 * lookAmt + Math.sin(phase * 2) * 0.03 * walkAmt;
        head.rotation.z = Math.sin(phase) * 0.04 * walkAmt;

        // Blink every 3 to 6 seconds for 120 ms.
        const face = faceById(state.face);
        if (face.eyes.length) {
            if (!blinkClosed && time >= nextBlink) {
                blinkClosed = true;
                blinkUntil = time + 0.12;
                paintFace();
            } else if (blinkClosed && time >= blinkUntil) {
                blinkClosed = false;
                nextBlink = time + 3 + Math.random() * 3;
                paintFace();
            }
        }
        if (hatObj && hatObj.tick) {
            hatObj.tick(time);
        }
    }

    function dispose() {
        clearHat();
        disposables.forEach((d) => d.dispose && d.dispose());
        root.traverse((o) => {
            if (o.geometry) {
                o.geometry.dispose();
            }
        });
    }

    return {
        root, body, head, state,
        apply, setFace, setShirt, setPants, setHat, update, dispose,
        blinkNow() {
            nextBlink = 0;
        }
    };
}
