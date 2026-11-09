// Cute 2.5D flowers: a thin stem and a flat five petal head that slowly spins about its own
// axis. One InstancedMesh for the stems and one for the heads (head matrices update per frame).
import { THREE, toon } from './scene.js';
import { rng } from './island.js';
import { mergeGeometries } from '../vendor/three/addons/utils/BufferGeometryUtils.js';

const PALETTE = [0xff9ec7, 0xffd84d, 0xffffff, 0x9fd8ff, 0xc9a7ff];

function headGeometry() {
    const parts = [];
    const white = new THREE.Color(0xffffff);
    const centre = new THREE.Color(0xffb52e);
    function tag(geo, color, tint) {
        const n = geo.attributes.position.count;
        const cols = new Float32Array(n * 3);
        const t = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            cols[i * 3] = color.r;
            cols[i * 3 + 1] = color.g;
            cols[i * 3 + 2] = color.b;
            t[i] = tint;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        geo.setAttribute('aTint', new THREE.BufferAttribute(t, 1));
        geo.deleteAttribute('uv');
        return geo;
    }
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const petal = new THREE.SphereGeometry(1, 6, 4);
        petal.scale(0.36, 0.52, 0.11);
        petal.translate(0, 0.52, 0);
        petal.rotateZ(-a);
        parts.push(tag(petal, white, 1));
    }
    const disc = new THREE.SphereGeometry(1, 6, 4);
    disc.scale(0.3, 0.3, 0.16);
    disc.translate(0, 0, 0.07);
    parts.push(tag(disc, centre, 0));
    return mergeGeometries(parts, false);
}

function headMaterial() {
    const mat = toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
        shader.vertexShader = 'attribute float aTint;\n' + shader.vertexShader.replace(
            '#include <color_vertex>',
            `#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
    vColor = vec3( 1.0 );
    #ifdef USE_COLOR
        vColor *= color;
    #endif
    #ifdef USE_INSTANCING_COLOR
        vColor.xyz *= mix( vec3( 1.0 ), instanceColor.xyz, aTint );
    #endif
#endif`
        );
    };
    mat.customProgramCacheKey = () => 'flower-head-tint';
    return mat;
}

export function buildFlowers(ctx, L, obstacles) {
    const phone = L.compact;
    const total = phone ? 70 : 120;
    const u = L.Hc;
    const rand = rng(7771);
    const group = new THREE.Group();
    group.name = 'flowers';

    const stemGeo = new THREE.CylinderGeometry(0.014 * u, 0.02 * u, 1, 6);
    stemGeo.translate(0, 0.5, 0);
    const stems = new THREE.InstancedMesh(stemGeo, toon(0x59b857), total);
    const heads = new THREE.InstancedMesh(headGeometry(), headMaterial(), total);
    group.add(stems);
    group.add(heads);

    const pw = L.pathW;
    // Zones on the grass, never on the path: between the boards and the path, outside the
    // path, and inside the ring of boards.
    const zones = [
        { weight: 0.4, lo: L.Rb + 50, hi: L.Rp - pw / 2 - 0.25 * u },
        { weight: 0.35, lo: L.Rp + pw / 2 + 0.3 * u, hi: L.Ri - 1.0 * u },
        { weight: 0.25, lo: 0.25 * L.Rb, hi: L.Rb - 70 }
    ];

    const m4 = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const col = new THREE.Color();
    const zAxis = new THREE.Vector3(0, 0, 1);
    const N = new THREE.Vector3();
    const flowers = [];
    let tries = 0;
    while (flowers.length < total && tries < total * 40) {
        tries++;
        const roll = rand();
        const zone = roll < zones[0].weight ? zones[0] : roll < zones[0].weight + zones[1].weight ? zones[1] : zones[2];
        const a = rand() * Math.PI * 2;
        const r = zone.lo + (zone.hi - zone.lo) * Math.sqrt(rand());
        const x = Math.sin(a) * r;
        const z = Math.cos(a) * r;
        if (obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 0.1 * u)) {
            continue;
        }
        const h = (0.34 + rand() * 0.26) * u;
        const size = (0.15 + rand() * 0.09) * u;
        const outward = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        N.copy(outward).multiplyScalar(0.82).add(new THREE.Vector3(0, 0.58, 0)).normalize();
        const align = new THREE.Quaternion().setFromUnitVectors(zAxis, N);
        const top = new THREE.Vector3(x, h, z).addScaledVector(N, size * 0.15);
        flowers.push({
            x, z, h, size, align, top,
            speed: (0.35 + rand() * 0.7) * (rand() < 0.5 ? -1 : 1),
            phase: rand() * 6.28
        });
        const i = flowers.length - 1;
        pos.set(x, h, z);
        q.identity();
        sc.set(1, h, 1);
        m4.compose(new THREE.Vector3(x, 0, z), q, sc);
        stems.setMatrixAt(i, m4);
        heads.setColorAt(i, col.set(PALETTE[i % PALETTE.length]));
    }
    stems.count = flowers.length;
    heads.count = flowers.length;
    stems.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    ctx.scene.add(group);

    const spin = new THREE.Quaternion();
    sc.set(1, 1, 1);
    function update(time) {
        for (let i = 0; i < flowers.length; i++) {
            const f = flowers[i];
            spin.setFromAxisAngle(zAxis, f.phase + time * f.speed);
            q.copy(f.align).multiply(spin);
            sc.setScalar(f.size);
            m4.compose(f.top, q, sc);
            heads.setMatrixAt(i, m4);
        }
        heads.instanceMatrix.needsUpdate = true;
    }
    update(0);

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
    return { update, dispose, count: flowers.length, heads };
}
