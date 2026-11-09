// The floating island: grass, soil, the sand path, tufts, pebbles, trees, bushes and blocks.
import { THREE, COLORS, toon, blobTexture } from './scene.js';
import { RoundedBoxGeometry } from '../vendor/three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from '../vendor/three/addons/utils/BufferGeometryUtils.js';

export function rng(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function paint(geo, hex) {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        arr[i * 3] = c.r;
        arr[i * 3 + 1] = c.g;
        arr[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
}

// Keep only the attributes every merged piece shares.
function trim(geo) {
    ['uv', 'uv1'].forEach((name) => {
        if (geo.attributes[name]) {
            geo.deleteAttribute(name);
        }
    });
    return geo;
}

function lathe(points, segments) {
    // points: [radius, y, color]
    const vec = points.map((p) => new THREE.Vector2(p[0], p[1]));
    const geo = new THREE.LatheGeometry(vec, segments);
    const colors = new Float32Array(geo.attributes.position.count * 3);
    const c = new THREE.Color();
    const rows = points.length;
    for (let i = 0; i < geo.attributes.position.count; i++) {
        c.set(points[i % rows][2]);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
}

function grassDisc(L, segments) {
    const rings = 24;
    const verts = [];
    const cols = [];
    const index = [];
    const base = new THREE.Color(COLORS.grass);
    const light = new THREE.Color(0xa6e47e);
    const dark = new THREE.Color(0x66c45e);
    const c = new THREE.Color();
    function colorAt(x, z) {
        const n = Math.sin(x * 0.0021 + 1.3) * Math.cos(z * 0.0017) +
            0.6 * Math.sin((x + z) * 0.0039 + 0.7) + 0.4 * Math.cos((x - z) * 0.0071);
        const v = Math.max(-1, Math.min(1, n / 1.5));
        return v >= 0 ? c.copy(base).lerp(light, v * 0.75) : c.copy(base).lerp(dark, -v * 0.8);
    }
    verts.push(0, 0, 0);
    colorAt(0, 0);
    cols.push(c.r, c.g, c.b);
    for (let r = 1; r <= rings; r++) {
        // Denser near the middle is not needed; even rings keep the colour noise smooth.
        const radius = (L.Ri * r) / rings;
        for (let s = 0; s < segments; s++) {
            const a = (s / segments) * Math.PI * 2;
            const x = Math.sin(a) * radius;
            const z = Math.cos(a) * radius;
            verts.push(x, 0, z);
            colorAt(x, z);
            cols.push(c.r, c.g, c.b);
        }
    }
    for (let s = 0; s < segments; s++) {
        index.push(0, 1 + s, 1 + ((s + 1) % segments));
    }
    for (let r = 1; r < rings; r++) {
        const a0 = 1 + (r - 1) * segments;
        const a1 = 1 + r * segments;
        for (let s = 0; s < segments; s++) {
            const s2 = (s + 1) % segments;
            index.push(a0 + s, a1 + s, a0 + s2);
            index.push(a0 + s2, a1 + s, a1 + s2);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    return geo;
}

function shadowPlane(radius, x, z, y) {
    const g = new THREE.PlaneGeometry(radius * 2, radius * 2);
    g.rotateX(-Math.PI / 2);
    g.translate(x, y, z);
    return g;
}

export function buildIsland(ctx, L, options) {
    const group = new THREE.Group();
    group.name = 'island';
    const phone = L.compact;
    const u = L.Hc;                       // one character height, the unit for props
    const rand = rng(20261109);
    const segs = 128;
    const obstacles = [];                 // {x, z, r} for flowers and tufts to avoid

    // Grass top.
    const grass = new THREE.Mesh(grassDisc(L, segs), toon(0xffffff, { vertexColors: true }));
    grass.name = 'grass';
    group.add(grass);

    // Lip and soil body (a lathe): green lip, soft brown sides, darker underside.
    const Ri = L.Ri;
    const soilPts = [
        [Ri - 2, 0, 0x78cc68],
        [Ri + 0.012 * Ri, -0.006 * Ri, 0x6fc460],
        [Ri + 0.02 * Ri, -0.02 * Ri, 0x66bd5a],
        [Ri + 0.021 * Ri, -0.022 * Ri, COLORS.soil],
        [Ri + 0.012 * Ri, -0.08 * Ri, 0xb08052],
        [Ri * 0.96, -0.15 * Ri, 0xa17249],
        [Ri * 0.86, -0.24 * Ri, 0x8f6540],
        [Ri * 0.68, -0.32 * Ri, 0x7a5636],
        [Ri * 0.44, -0.375 * Ri, 0x66472e],
        [Ri * 0.2, -0.395 * Ri, 0x5c4129],
        [0, -0.4 * Ri, 0x5c4129]
    ];
    const soil = new THREE.Mesh(lathe(soilPts, segs), toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
    soil.name = 'soil';
    group.add(soil);

    // Path: a raised sand ring with darker edges, sunk into the grass so nothing is coplanar.
    const pw = L.pathW;
    const pr = L.Rp;
    const E = COLORS.sandEdge;
    const P = COLORS.sand;
    const path = new THREE.Mesh(lathe([
        [pr - pw / 2 - 20, -2, E],
        [pr - pw / 2 - 14, 2.5, E],
        [pr - pw / 2 - 4, 5, E],
        [pr - pw / 2 - 3.9, 5.2, P],
        [pr - pw / 2 + 6, 7, P],
        [pr + pw / 2 - 6, 7, P],
        [pr + pw / 2 + 3.9, 5.2, P],
        [pr + pw / 2 + 4, 5, E],
        [pr + pw / 2 + 14, 2.5, E],
        [pr + pw / 2 + 20, -2, E]
    ], segs * 2), toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
    path.name = 'path';
    group.add(path);
    L.pathTop = 7;

    // Soft blob of shadow far below the island.
    const below = new THREE.Mesh(
        new THREE.PlaneGeometry(Ri * 2.5, Ri * 2.5),
        new THREE.MeshBasicMaterial({
            map: blobTexture(), transparent: true, opacity: 0.55, depthWrite: false, color: 0x8fa6bd, fog: false
        })
    );
    below.rotation.x = -Math.PI / 2;
    below.position.y = -0.4 * Ri - Ri * 0.55;
    below.renderOrder = -50;
    below.name = 'far-shadow';
    group.add(below);

    // Pebbles on and beside the path.
    const pebbleCount = phone ? 36 : 64;
    const pebbleGeo = new THREE.SphereGeometry(1, 8, 6);
    const pebbles = new THREE.InstancedMesh(pebbleGeo, toon(0xffffff), pebbleCount);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const col = new THREE.Color();
    const pebbleTints = [0xe3c98e, 0xcdb27a, 0xdcd3c2, 0xbfb6a6, 0xf0dcae];
    for (let i = 0; i < pebbleCount; i++) {
        const a = rand() * Math.PI * 2;
        const r = pr + (rand() - 0.5) * (pw + 40);
        const size = (0.05 + rand() * 0.06) * u;
        pos.set(Math.sin(a) * r, 6 + size * 0.1, Math.cos(a) * r);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28);
        sc.set(size * (1 + rand() * 0.5), size * 0.5, size * (0.8 + rand() * 0.5));
        m4.compose(pos, q, sc);
        pebbles.setMatrixAt(i, m4);
        pebbles.setColorAt(i, col.set(pebbleTints[i % pebbleTints.length]));
    }
    pebbles.instanceMatrix.needsUpdate = true;
    pebbles.name = 'pebbles';
    group.add(pebbles);

    // Zones for props: outside the path (towards the rim) and inside the ring of boards.
    const outerLo = pr + pw / 2 + 0.55 * u;
    const outerHi = Ri - 2.2 * u;
    const innerHi = L.Rb - 0.9 * u - 120;
    const delta = (Math.PI * 2) / L.count;
    const pieces = [];
    const shadows = [];

    function tree(x, z, scale, tint, withBlossom) {
        const trunkH = 0.7 * u * scale;
        const trunk = paint(trim(new THREE.CylinderGeometry(0.13 * u * scale, 0.17 * u * scale, trunkH, 8)), 0xa9774b);
        trunk.translate(x, trunkH / 2, z);
        pieces.push(trunk);
        const canopyR = 0.82 * u * scale;
        const canopy = paint(trim(new THREE.SphereGeometry(canopyR, 14, 10)), tint);
        canopy.translate(x, trunkH + canopyR * 0.72, z);
        pieces.push(canopy);
        const side = paint(trim(new THREE.SphereGeometry(canopyR * 0.58, 10, 7)), tint);
        side.translate(x + canopyR * 0.62, trunkH + canopyR * 0.4, z + canopyR * 0.2);
        pieces.push(side);
        shadows.push(shadowPlane(canopyR * 1.05, x, z, 0.8));
        obstacles.push({ x, z, r: canopyR * 1.1 });
    }

    function bush(x, z, scale, tint) {
        const r = 0.34 * u * scale;
        const offsets = [[0, 0, 1], [r * 0.95, r * 0.25, 0.78], [-r * 0.85, r * 0.2, 0.82], [r * 0.1, -r * 0.95, 0.7]];
        offsets.forEach((o) => {
            const g = paint(trim(new THREE.SphereGeometry(r * o[2], 10, 7)), tint);
            g.translate(x + o[0], r * o[2] * 0.82, z + o[1]);
            pieces.push(g);
        });
        shadows.push(shadowPlane(r * 2.0, x, z, 0.8));
        obstacles.push({ x, z, r: r * 2 });
    }

    const pastel = [0xff9ec7, 0xffd84d, 0x9fd8ff, 0xc9a7ff, 0xa6e8c4];
    function block(x, z, size, tint, spin) {
        const g = paint(trim(new RoundedBoxGeometry(size, size * 0.9, size, 3, size * 0.2)), tint);
        g.rotateY(spin);
        g.translate(x, size * 0.45, z);
        pieces.push(g);
        shadows.push(shadowPlane(size * 0.95, x, z, 0.8));
        obstacles.push({ x, z, r: size * 0.9 });
    }

    function stones(x, z, count, spin) {
        for (let i = 0; i < count; i++) {
            const gx = x + Math.cos(spin) * i * 0.9 * u + Math.sin(i * 2.1) * 0.12 * u;
            const gz = z - Math.sin(spin) * i * 0.9 * u + Math.cos(i * 1.7) * 0.12 * u;
            const g = paint(trim(new RoundedBoxGeometry(0.62 * u, 0.12 * u, 0.62 * u, 2, 0.05 * u)), 0xd9e6ee);
            g.rotateY(i * 0.7);
            g.translate(gx, 0.05 * u, gz);
            pieces.push(g);
            obstacles.push({ x: gx, z: gz, r: 0.5 * u });
        }
    }

    const greens = [0x58c26b, 0x6ccd6f, 0x4fb862, 0x7ad57a];
    const rimLo = Ri - 1.5 * u;
    const rimHi = Ri - 0.7 * u;
    for (let i = 0; i < L.count; i++) {
        const mid = (i + 0.5) * delta;
        // Outside the path stays low so it never hides the walker from the travel camera:
        // bushes, small blocks and stepping stones; the tall trees stand near the rim.
        {
            const a = mid + (rand() - 0.5) * 0.3 * delta;
            const r = outerLo + (outerHi - outerLo) * (0.1 + rand() * 0.5);
            const x = Math.sin(a) * r;
            const z = Math.cos(a) * r;
            if (i % 3 === 0) {
                block(x, z, (0.5 + rand() * 0.2) * u, pastel[i % pastel.length], rand() * 3);
            } else if (i % 3 === 1) {
                stones(x, z, 3, rand() * 6);
            }
            const a2 = mid + (rand() - 0.5) * 0.6 * delta;
            const r2 = outerLo + (outerHi - outerLo) * (0.1 + rand() * 0.6);
            bush(Math.sin(a2) * r2, Math.cos(a2) * r2, 0.8 + rand() * 0.4, greens[(i + 2) % greens.length]);
        }
        // Rim trees, seen against the void from the other side of the island.
        {
            const a = mid + (rand() - 0.5) * 0.5 * delta;
            const r = rimLo + (rimHi - rimLo) * rand();
            const x = Math.sin(a) * r;
            const z = Math.cos(a) * r;
            if (i % 2 === 0) {
                tree(x, z, 1.0 + rand() * 0.3, greens[i % greens.length], false);
            } else {
                tree(x, z, 1.0 + rand() * 0.25, 0xffb3d1, true);
            }
        }
        // Inside the ring: trees, bushes, blocks and stepping stones.
        {
            const a = mid + (rand() - 0.5) * 0.3 * delta;
            const r = innerHi * (0.3 + rand() * 0.5);
            const x = Math.sin(a) * r;
            const z = Math.cos(a) * r;
            const kind = i % 4;
            if (kind === 0) {
                tree(x, z, 1.1 + rand() * 0.3, greens[i % greens.length], false);
            } else if (kind === 1) {
                block(x, z, (1 + rand() * 0.5) * u, pastel[(i + 1) % pastel.length], rand() * 3);
            } else if (kind === 2) {
                stones(x, z, 4, rand() * 6);
                bush(x + 1.4 * u, z + 1.4 * u, 1, greens[(i + 1) % greens.length]);
            } else {
                tree(x, z, 0.9 + rand() * 0.3, 0xffc4dc, true);
                bush(x - 1.2 * u, z + 0.6 * u, 1, greens[(i + 3) % greens.length]);
            }
        }
    }

    const props = new THREE.Mesh(mergeGeometries(pieces.map((g) => (g.index ? g.toNonIndexed() : g)), false), toon(0xffffff, { vertexColors: true }));
    props.name = 'props';
    group.add(props);
    const shade = new THREE.Mesh(
        mergeGeometries(shadows.map((g) => g), false),
        new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    );
    shade.renderOrder = 2;
    shade.name = 'prop-shadows';
    group.add(shade);

    // Tufts of grass: little cones, instanced.
    const tuftCount = phone ? 160 : 320;
    const tuftGeo = new THREE.ConeGeometry(0.06 * u, 0.24 * u, 5);
    tuftGeo.translate(0, 0.12 * u, 0);
    const tufts = new THREE.InstancedMesh(tuftGeo, toon(0xffffff), tuftCount * 3);
    const tuftTints = [0x5fbf55, 0x6fcf5e, 0x8ede6f, 0x58b84f];
    let t = 0;
    const axisY = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < tuftCount; i++) {
        let x;
        let z;
        let tries = 0;
        do {
            const a = rand() * Math.PI * 2;
            const r = Math.sqrt(rand()) * (Ri - 0.5 * u);
            x = Math.sin(a) * r;
            z = Math.cos(a) * r;
            tries++;
        } while (tries < 12 && (Math.abs(Math.hypot(x, z) - pr) < pw / 2 + 0.3 * u ||
            obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.r)));
        const s = 0.7 + rand() * 0.7;
        const tint = tuftTints[i % tuftTints.length];
        for (let b = 0; b < 3; b++) {
            const bx = x + (b - 1) * 0.07 * u;
            const bz = z + Math.sin(b * 2.4) * 0.05 * u;
            pos.set(bx, 0, bz);
            q.setFromAxisAngle(axisY, rand() * 6.28);
            const lean = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (b - 1) * 0.22);
            q.multiply(lean);
            sc.set(s, s * (0.8 + b * 0.18), s);
            m4.compose(pos, q, sc);
            tufts.setMatrixAt(t, m4);
            tufts.setColorAt(t, col.set(tint));
            t++;
        }
    }
    tufts.instanceMatrix.needsUpdate = true;
    tufts.name = 'tufts';
    group.add(tufts);

    ctx.scene.add(group);
    return { group, obstacles };
}
