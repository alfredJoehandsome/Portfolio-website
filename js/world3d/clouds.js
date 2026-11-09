// A ring of puffy 3D clouds above the boards, under the blue patch. The ring turns slowly on
// its own (about one turn per 3 minutes) and every cloud bobs a little.
import { THREE, toon } from './scene.js';
import { rng } from './island.js';
import { mergeGeometries } from '../vendor/three/addons/utils/BufferGeometryUtils.js';

function cloudGeometry(rand, size) {
    const parts = [];
    const n = 4 + Math.floor(rand() * 4);           // 4 to 7 spheres
    const top = new THREE.Color(0xffffff);
    const bottom = new THREE.Color(0xdbe7f4);
    const c = new THREE.Color();
    const floor = -size * 0.42;
    for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        const r = size * (i === Math.floor(n / 2) ? 0.62 : 0.34 + rand() * 0.22);
        const g = new THREE.SphereGeometry(r, 12, 8);
        g.scale(1, 0.82, 1);
        g.translate(t * size * 2.1, (rand() - 0.3) * size * 0.22 + (i % 2 ? size * 0.1 : 0), (rand() - 0.5) * size * 0.55);
        parts.push(g);
    }
    const merged = mergeGeometries(parts.map((g) => {
        g.deleteAttribute('uv');
        return g;
    }), false);
    const pos = merged.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i);
        if (y < floor) {
            // Slightly flattened bottom.
            y = floor + (y - floor) * 0.22;
            pos.setY(i, y);
        }
        const k = Math.min(1, Math.max(0, (y - floor) / (size * 0.9)));
        c.copy(bottom).lerp(top, Math.pow(k, 0.7));
        cols[i * 3] = c.r;
        cols[i * 3 + 1] = c.g;
        cols[i * 3 + 2] = c.b;
    }
    merged.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    merged.computeVertexNormals();
    return merged;
}

export function buildClouds(ctx, L, minY) {
    const rand = rng(424242);
    const u = L.Hc;
    const count = L.compact ? 6 : 8;
    const ring = new THREE.Group();
    ring.name = 'clouds';
    const mat = toon(0xffffff, { vertexColors: true, emissive: 0x7c8fa8, emissiveIntensity: 0.5 });
    const items = [];
    for (let i = 0; i < count; i++) {
        const size = (1.5 + rand() * 1.1) * u * (L.compact ? 1.15 : 1);
        const geo = cloudGeometry(rand, size);
        const cloud = new THREE.Mesh(geo, mat);
        const a = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.4;
        const r = L.Rb * (0.55 + rand() * 0.5);
        const y = Math.max(minY, 6.5 * u) + (rand() * 3.2) * u;
        cloud.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
        cloud.rotation.y = rand() * Math.PI;
        ring.add(cloud);
        items.push({ cloud, y, phase: rand() * 6.28, speed: 0.35 + rand() * 0.4, amp: (0.12 + rand() * 0.14) * u });
    }
    ctx.scene.add(ring);

    function update(time) {
        ring.rotation.y = (time * Math.PI * 2) / 180;
        items.forEach((it) => {
            it.cloud.position.y = it.y + Math.sin(time * it.speed + it.phase) * it.amp;
        });
    }
    update(0);

    function dispose() {
        ring.traverse((o) => {
            if (o.geometry) {
                o.geometry.dispose();
            }
        });
        mat.dispose();
        ctx.scene.remove(ring);
    }
    return { update, dispose, ring };
}
