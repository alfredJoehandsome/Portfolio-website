// The little house at the end of the road: it stands on the path in the gap between the last
// board (Contact) and the first (Start), so the ring is a road with two ends. Cream walls, a
// coral roof, a door that faces along the path toward Contact, two framed windows, a chimney
// that lets out a puff now and then, a doormat and a mailbox. Toy proportions, small bevels.
//
// Frame: the group is rotated so local +z points along the path toward Contact (the door
// side) and local +x points away from the island centre, towards the camera.
import { THREE, toon, blobTexture } from './scene.js';
import { RoundedBoxGeometry } from '../vendor/three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from '../vendor/three/addons/utils/BufferGeometryUtils.js';

const CREAM = 0xfff3da;
const PLINTH = 0xe6d8b8;
const ROOF = 0xe8735a;
const ROOF_DARK = 0xc9553f;
const WOOD = 0x9a6038;
const BRICK = 0xd98b6b;
const BRICK_CAP = 0xb86a50;
const GLASS = 0xa7dcff;
const WHITE = 0xffffff;
const BLUE = 0x4aa8e0;
const RED = 0xff6a5a;
const POST = 0xa9774b;

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
    ['uv', 'uv1'].forEach((name) => {
        if (geo.attributes[name]) {
            geo.deleteAttribute(name);
        }
    });
    return geo;
}

export function buildHouse(ctx, L) {
    const u = L.Hc;
    const delta = (Math.PI * 2) / L.count;
    const theta = (L.count - 0.5) * delta;          // the middle of the gap after the last board
    const Wx = Math.max(3 * u, L.pathW * 1.2);      // across the path: wider than the path itself
    const Wz = Math.max(1.9 * u, Math.min(2.5 * u, L.gap * 0.9));
    const Hw = 1.8 * u;                             // wall height
    const bev = 0.04 * u;
    const rx = Wx / 2 + 0.2 * u;                    // roof half width with eaves
    const rh = 1.15 * u;                            // roof rise
    const roofLen = Wz + 0.36 * u;

    const pieces = [];
    function box(w, h, d, x, y, z, hex, r) {
        const g = paint(new RoundedBoxGeometry(w, h, d, 2, Math.min(r === undefined ? bev : r, Math.min(w, h, d) * 0.45)), hex);
        g.translate(x, y, z);
        pieces.push(g.index ? g.toNonIndexed() : g);
    }

    // Walls on a low plinth.
    box(Wx * 1.03, 0.14 * u, Wz * 1.03, 0, 0.07 * u, 0, PLINTH, 0.03 * u);
    box(Wx, Hw, Wz, 0, Hw / 2 + 0.07 * u, 0, CREAM);
    const base = Hw + 0.07 * u;

    // Roof: a triangular prism along z with small bevels, and a cream gable on the door side.
    const tri = new THREE.Shape();
    tri.moveTo(-rx, 0);
    tri.lineTo(rx, 0);
    tri.lineTo(0, rh);
    tri.lineTo(-rx, 0);
    const roofGeo = paint(new THREE.ExtrudeGeometry(tri, {
        depth: roofLen - 0.06 * u, bevelEnabled: true, bevelThickness: 0.03 * u, bevelSize: 0.03 * u, bevelSegments: 1
    }), ROOF);
    roofGeo.translate(0, base - 0.02 * u, -(roofLen - 0.06 * u) / 2);
    pieces.push(roofGeo.index ? roofGeo.toNonIndexed() : roofGeo);
    // Ridge cap.
    box(0.12 * u, 0.1 * u, roofLen + 0.02 * u, 0, base + rh - 0.02 * u, 0, ROOF_DARK, 0.03 * u);
    // Eave trim along both long edges.
    box(0.07 * u, 0.07 * u, roofLen, rx - 0.01 * u, base - 0.02 * u, 0, ROOF_DARK, 0.025 * u);
    box(0.07 * u, 0.07 * u, roofLen, -(rx - 0.01 * u), base - 0.02 * u, 0, ROOF_DARK, 0.025 * u);
    // Cream gable fill on the door side.
    const gt = new THREE.Shape();
    const gx = rx - 0.34 * u;
    const gh = rh * (gx / rx);
    gt.moveTo(-gx, 0);
    gt.lineTo(gx, 0);
    gt.lineTo(0, gh);
    gt.lineTo(-gx, 0);
    const gable = paint(new THREE.ExtrudeGeometry(gt, { depth: 0.05 * u, bevelEnabled: false }), CREAM);
    gable.translate(0, base + 0.02 * u, roofLen / 2 - 0.02 * u);
    pieces.push(gable.index ? gable.toNonIndexed() : gable);

    // Door: frame, door, knob, and a doormat in front of it.
    const dz = Wz / 2;
    box(0.8 * u, 1.3 * u, 0.05 * u, 0, 0.07 * u + 0.65 * u, dz + 0.012 * u, WHITE, 0.03 * u);
    box(0.62 * u, 1.16 * u, 0.06 * u, 0, 0.07 * u + 0.58 * u, dz + 0.04 * u, WOOD, 0.03 * u);
    box(0.4 * u, 0.4 * u, 0.02 * u, 0, 0.07 * u + 0.84 * u, dz + 0.075 * u, 0x86512f, 0.02 * u);
    const knob = paint(new THREE.SphereGeometry(0.04 * u, 10, 8), 0xffd84d);
    knob.translate(0.2 * u, 0.07 * u + 0.55 * u, dz + 0.09 * u);
    pieces.push(knob.index ? knob.toNonIndexed() : knob);
    box(0.78 * u, 0.03 * u, 0.46 * u, 0, 0.015 * u, dz + 0.3 * u, WHITE, 0.012 * u);
    box(0.7 * u, 0.04 * u, 0.38 * u, 0, 0.02 * u, dz + 0.3 * u, BLUE, 0.012 * u);

    // Two windows on the wall that faces the camera.
    const wx = Wx / 2;
    [-1, 1].forEach((side) => {
        const z = side * Wz * 0.24;
        const y = 0.07 * u + Hw * 0.58;
        box(0.06 * u, 0.76 * u, 0.76 * u, wx + 0.012 * u, y, z, WHITE, 0.03 * u);
        box(0.05 * u, 0.6 * u, 0.6 * u, wx + 0.04 * u, y, z, GLASS, 0.015 * u);
        box(0.06 * u, 0.045 * u, 0.62 * u, wx + 0.06 * u, y, z, WHITE, 0.01 * u);
        box(0.06 * u, 0.62 * u, 0.045 * u, wx + 0.06 * u, y, z, WHITE, 0.01 * u);
        box(0.1 * u, 0.05 * u, 0.88 * u, wx + 0.04 * u, y - 0.4 * u, z, ROOF_DARK, 0.02 * u);
    });

    // Chimney on the camera side of the roof, with a cap.
    const cx = Wx * 0.28;
    const cz = -Wz * 0.18;
    const surface = base + rh * (1 - cx / rx);
    const chH = 0.8 * u;
    box(0.36 * u, chH, 0.36 * u, cx, surface - 0.12 * u + chH / 2, cz, BRICK);
    box(0.46 * u, 0.07 * u, 0.46 * u, cx, surface - 0.12 * u + chH, cz, BRICK_CAP, 0.025 * u);
    const chTop = surface - 0.12 * u + chH + 0.04 * u;

    // Mailbox on a post, beside the door.
    const mx = 0.98 * u;
    const mz = dz + 0.5 * u;
    const post = paint(new THREE.CylinderGeometry(0.035 * u, 0.045 * u, 0.7 * u, 8), POST);
    post.translate(mx, 0.35 * u, mz);
    pieces.push(post.index ? post.toNonIndexed() : post);
    box(0.24 * u, 0.22 * u, 0.36 * u, mx, 0.8 * u, mz, BLUE, 0.05 * u);
    box(0.03 * u, 0.2 * u, 0.045 * u, mx + 0.14 * u, 0.9 * u, mz - 0.05 * u, RED, 0.01 * u);
    box(0.06 * u, 0.06 * u, 0.07 * u, mx + 0.14 * u, 1.0 * u, mz - 0.05 * u, RED, 0.02 * u);

    const group = new THREE.Group();
    group.name = 'house';
    const merged = new THREE.Mesh(mergeGeometries(pieces, false), toon(0xffffff, { vertexColors: true }));
    group.add(merged);
    pieces.forEach((g) => g.dispose());

    // Blob shadow under the whole house.
    const shadowGeo = new THREE.PlaneGeometry(1, 1);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.scale.set(Wx * 1.5, 1, Wz * 1.6);
    shadow.position.y = 0.6;
    shadow.renderOrder = 2;
    group.add(shadow);

    // Smoke: three soft spheres drift up from the chimney every few seconds.
    const puffGeo = new THREE.SphereGeometry(1, 14, 10);
    const puffs = [0, 1, 2].map(() => {
        const mat = toon(0xffffff, { transparent: true, opacity: 0, depthWrite: false });
        const mesh = new THREE.Mesh(puffGeo, mat);
        mesh.visible = false;
        group.add(mesh);
        return mesh;
    });
    const CYCLE = 7;
    const LIFE = 2.6;
    function update(time) {
        const phase = time % CYCLE;
        puffs.forEach((p, k) => {
            const t = phase - k * 0.5;
            if (t < 0 || t > LIFE) {
                p.visible = false;
                return;
            }
            const f = t / LIFE;
            p.visible = true;
            p.position.set(cx + f * 0.55 * u + Math.sin(f * 4 + k) * 0.05 * u, chTop + f * 1.5 * u, cz + Math.sin(k * 2.1) * 0.06 * u);
            p.scale.setScalar((0.12 + f * 0.17) * u * (1 + k * 0.1));
            p.material.opacity = 0.92 * Math.min(1, f * 6) * (1 - f * f);
        });
    }
    update(1e6);

    // Placed on the path, door towards Contact.
    group.position.set(Math.sin(theta) * L.Rp, L.pathTop, Math.cos(theta) * L.Rp);
    group.rotation.y = theta - Math.PI / 2;
    group.updateMatrixWorld(true);
    ctx.scene.add(group);

    // Flowers and tufts keep clear of the footprint.
    const obstacles = [];
    const local = new THREE.Vector3();
    const reach = Math.hypot(Wx, Wz) / 2 * 0.62;
    for (let ix = -2; ix <= 2; ix++) {
        for (let iz = -1; iz <= 1; iz++) {
            local.set((ix / 2) * (Wx / 2), 0, iz * (Wz / 2));
            group.localToWorld(local);
            obstacles.push({ x: local.x, z: local.z, r: Math.max(reach * 0.55, 0.7 * u) });
        }
    }
    local.set(mx, 0, mz);
    group.localToWorld(local);
    obstacles.push({ x: local.x, z: local.z, r: 0.5 * u });

    // Where the walker stops at the door: on the mat, in front of the door, on the path line.
    const stopDist = Wz / 2 + 0.3 * u;               // from the house centre, along the path
    const doorTheta = theta - stopDist / L.Rp;

    function dispose() {
        group.traverse((o) => {
            if (o.geometry) {
                o.geometry.dispose();
            }
            if (o.material) {
                o.material.dispose();
            }
        });
        ctx.scene.remove(group);
    }

    return { group, obstacles, update, dispose, theta, doorTheta, width: Wx, depth: Wz };
}
