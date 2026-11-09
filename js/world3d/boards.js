// Boards: a chunky rounded WebGL frame on two posts, a "hole" plane that lets the real DOM
// panel show through, and the DOM itself as a CSS3D object in the same scene.
import { THREE, toon, blobTexture } from './scene.js';
import { RoundedBoxGeometry } from '../vendor/three/addons/geometries/RoundedBoxGeometry.js';
import { CSS3DObject } from '../vendor/three/addons/renderers/CSS3DRenderer.js';
import { RIM, FRAME_DEPTH } from './camera.js';

const PANEL_RADIUS = 24;
const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", system-ui, sans-serif';

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
    const geo = new RoundedBoxGeometry(w, h, FRAME_DEPTH, 2, 12);
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
        ctx.font = '800 ' + px + 'px ' + FONT;
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
    ctx.font = '800 ' + size + 'px ' + FONT;
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
    const postGeo = new THREE.CylinderGeometry(13, 13, 1, 18);
    const footGeo = new THREE.SphereGeometry(1, 16, 12);
    const shadowGeo = new THREE.PlaneGeometry(1, 1);
    shadowGeo.rotateX(-Math.PI / 2);
    const disposables = [postMat, footMat, frameMat, shadowMat, holeMat, postGeo, footGeo, shadowGeo];

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
        const px = Math.min(1024 / Math.max(backW, backH), 1.2);
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
        disposables.push(frameGeo, holeGeo, backGeo, back.material, tex);

        // Posts and feet.
        const frameBottom = cy - fh / 2;
        const postTop = frameBottom + 6;
        [-1, 1].forEach((side) => {
            const x = side * fw * 0.32;
            const post = new THREE.Mesh(postGeo, postMat);
            post.scale.set(1, postTop, 1);
            post.position.set(x, postTop / 2, -FRAME_DEPTH / 2 - 0.5);
            group.add(post);
            const foot = new THREE.Mesh(footGeo, footMat);
            foot.scale.set(26, 15, 26);
            foot.position.set(x, 2, -FRAME_DEPTH / 2 - 0.5);
            group.add(foot);
            const shadow = new THREE.Mesh(shadowGeo, shadowMat);
            shadow.scale.set(150, 1, 150);
            shadow.position.set(x, 0.9, -FRAME_DEPTH / 2 - 0.5);
            shadow.renderOrder = 2;
            group.add(shadow);
        });

        // The real DOM, 1:1 on the plane (scaled only when the panel had to be fitted).
        const css = new CSS3DObject(section);
        section.style.userSelect = '';
        section.style.width = L.boardW + 'px';
        section.style.height = heights[i] + 'px';
        css.position.set(0, cy, 0);
        css.scale.setScalar(fit.scale);
        group.add(css);

        boards.push({ index: i, section, group, css, hole, frame, fit, angle });
    });

    function dispose() {
        disposables.forEach((d) => d.dispose && d.dispose());
        ctx.scene.remove(root);
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

    return { boards, root, dispose, redrawBacks };
}
