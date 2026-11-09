// Boards: a chunky rounded WebGL frame on two posts, a "hole" plane that lets the real DOM
// panel show through, and the DOM itself as a CSS3D object in the same scene.
import { THREE, toon, blobTexture } from './scene.js';
import { RoundedBoxGeometry } from '../vendor/three/addons/geometries/RoundedBoxGeometry.js';
import { CSS3DObject } from '../vendor/three/addons/renderers/CSS3DRenderer.js';
import { RIM, FRAME_DEPTH } from './camera.js';

const PANEL_RADIUS = 6;
const FONT = '"Lexend", system-ui, sans-serif';

function roundedShape(w, h, r) {
    const x = -w / 2;
    const y = -h / 2;
    const shape = new THREE.Shape();
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    shape.lineTo(x + w, y + h - r);
    shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    shape.lineTo(x + r, y + h);
    shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(x, y + r);
    shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return shape;
}

function frameGeometry(w, h) {
    const geo = new RoundedBoxGeometry(w, h, FRAME_DEPTH, 2, 2);
    const n = geo.attributes.normal;
    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const front = new THREE.Color(0xfdfdfd);
    const side = new THREE.Color(0xe3e8ec);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
        c.copy(n.getZ(i) > 0.55 ? front : side);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
}

// The back of a sign: its title in dark ink on white, in the site font.
export function drawBack(canvas, title) {
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fdfdfd';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2f3438';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = String(title).split(' ');
    let size = Math.min(h * 0.42, w * 0.2);
    let lines = [String(title)];
    const fits = (text, px) => {
        ctx.font = '600 ' + px + 'px ' + FONT;
        return ctx.measureText(text).width <= w * 0.86;
    };
    while (size > 24 && !fits(lines[0], size)) {
        size -= 4;
    }
    if (!fits(lines[0], size * 0.8) && words.length > 1) {
        // Two lines for long titles.
        const half = Math.ceil(words.length / 2);
        lines = [words.slice(0, half).join(' '), words.slice(half).join(' ')];
        size = Math.min(h * 0.3, w * 0.2);
        while (size > 24 && !(fits(lines[0], size) && fits(lines[1], size))) {
            size -= 4;
        }
    }
    ctx.font = '600 ' + size + 'px ' + FONT;
    const lineH = size * 1.12;
    const y0 = h / 2 - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line, i) => ctx.fillText(line, w / 2, y0 + i * lineH));
}

export function buildBoards(ctx, L, sections, heights) {
    const boards = [];
    const root = new THREE.Group();
    root.name = 'boards';
    ctx.scene.add(root);
    const delta = (Math.PI * 2) / L.count;
    const postMat = toon(0xe3e8ec);
    const footMat = toon(0xfdfdfd);
    const frameMat = toon(0xffffff, { vertexColors: true });
    const shadowMat = new THREE.MeshBasicMaterial({
        map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    const holeMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        opacity: 0,
        transparent: false,
        blending: THREE.NoBlending,
        side: THREE.FrontSide
    });
    const postGeo = new THREE.CylinderGeometry(13, 13, 1, 14);
    const footGeo = new THREE.SphereGeometry(1, 12, 8);
    const shadowGeo = new THREE.PlaneGeometry(1, 1);
    shadowGeo.rotateX(-Math.PI / 2);
    const disposables = [postMat, footMat, frameMat, shadowMat, holeMat, postGeo, footGeo, shadowGeo];
    // Posts, feet and shadows of every board are three instanced meshes (static).
    const nPosts = sections.length * 2;
    const posts = new THREE.InstancedMesh(postGeo, postMat, nPosts);
    const feet = new THREE.InstancedMesh(footGeo, footMat, nPosts);
    const shadows = new THREE.InstancedMesh(shadowGeo, shadowMat, nPosts);
    shadows.renderOrder = 2;
    [posts, feet, shadows].forEach((m) => {
        m.frustumCulled = false;
        root.add(m);
    });
    let inst = 0;
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _sc = new THREE.Vector3();

    sections.forEach((section, i) => {
        const fit = L.fit(heights[i]);
        const angle = i * delta;
        const group = new THREE.Group();
        group.position.set(Math.sin(angle) * L.Rb, 0, Math.cos(angle) * L.Rb);
        group.rotation.y = angle;
        root.add(group);

        const fw = fit.w + 2 * RIM;
        const fh = fit.h + 2 * RIM;
        const cy = fit.centerY;

        // Frame, its front face exactly behind the DOM plane (local z = 0).
        const frameGeo = frameGeometry(fw, fh);
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.set(0, cy, -FRAME_DEPTH / 2 - 0.5);
        group.add(frame);

        // The hole: a rounded plane, a hair in front of the frame, clearing to transparent.
        const holeGeo = new THREE.ShapeGeometry(roundedShape(fit.w, fit.h, PANEL_RADIUS * fit.scale), 10);
        const hole = new THREE.Mesh(holeGeo, holeMat);
        hole.position.set(0, cy, 0);
        hole.renderOrder = 10;
        group.add(hole);

        // Title on the back of the frame.
        const backW = fw - 34;
        const backH = fh - 34;
        const canvas = document.createElement('canvas');
        const px = Math.min((L.compact ? 640 : 1024) / Math.max(backW, backH), L.compact ? 1 : 1.2);
        canvas.width = Math.max(64, Math.round(backW * px));
        canvas.height = Math.max(64, Math.round(backH * px));
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        const title = section.getAttribute('data-title') || section.id;
        drawBack(canvas, title);
        tex.needsUpdate = true;
        const backGeo = new THREE.PlaneGeometry(backW, backH);
        const back = new THREE.Mesh(backGeo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
        back.rotation.y = Math.PI;
        back.position.set(0, cy, -FRAME_DEPTH - 0.9);
        group.add(back);
        // Same title on the front: shown instead of the hole while the DOM is not mounted.
        const front = new THREE.Mesh(backGeo, back.material);
        front.position.set(0, cy, 0.4);
        front.visible = false;
        group.add(front);
        disposables.push(frameGeo, holeGeo, backGeo, back.material, tex);

        // Posts and feet (instanced, placed in world space).
        group.updateMatrixWorld(true);
        const frameBottom = cy - fh / 2;
        const postTop = frameBottom + 6;
        [-1, 1].forEach((side) => {
            const x = side * fw * 0.32;
            const place = (mesh, local, scale) => {
                _p.copy(local).applyMatrix4(group.matrixWorld);
                _q.setFromRotationMatrix(_m.extractRotation(group.matrixWorld));
                _sc.copy(scale);
                _m.compose(_p, _q, _sc);
                mesh.setMatrixAt(inst, _m);
            };
            const zl = -FRAME_DEPTH / 2 - 0.5;
            place(posts, new THREE.Vector3(x, postTop / 2, zl), new THREE.Vector3(1, postTop, 1));
            place(feet, new THREE.Vector3(x, 2, zl), new THREE.Vector3(26, 15, 26));
            place(shadows, new THREE.Vector3(x, 0.9, zl), new THREE.Vector3(150, 1, 150));
            inst++;
        });

        // The real DOM, 1:1 on the plane (scaled only when the panel had to be fitted).
        const host = document.createElement('div');
        host.className = 'board-host';
        host.style.width = L.boardW + 'px';
        host.style.height = heights[i] + 'px';
        host.appendChild(section);
        const css = new CSS3DObject(host);
        section.style.userSelect = '';
        section.style.width = L.boardW + 'px';
        section.style.height = heights[i] + 'px';
        css.position.set(0, cy, 0);
        css.scale.setScalar(fit.scale);
        group.add(css);

        boards.push({ index: i, section, host, group, css, hole, front, frame, fit, angle, mounted: true });
    });

    function dispose() {
        disposables.forEach((d) => d.dispose && d.dispose());
        ctx.scene.remove(root);
    }

    // Mount (full DOM in the 3D scene) or unmount (white frame with its title) one board.
    function setMounted(board, on) {
        if (board.mounted === on) {
            return;
        }
        board.mounted = on;
        board.css.visible = on;
        board.hole.visible = on;
        board.front.visible = !on;
    }

    function redrawBacks() {
        // After the web font arrives.
        boards.forEach((b) => {
            const mesh = b.group.children.find((c) => c.material && c.material.map && c.material.map.isCanvasTexture);
            if (mesh) {
                const tex = mesh.material.map;
                drawBack(tex.image, b.section.getAttribute('data-title') || b.section.id);
                tex.needsUpdate = true;
            }
        });
    }

    posts.instanceMatrix.needsUpdate = true;
    feet.instanceMatrix.needsUpdate = true;
    shadows.instanceMatrix.needsUpdate = true;
    disposables.push(posts, feet, shadows);
    return { boards, root, dispose, redrawBacks, setMounted };
}
