// The character creator on the start board: HTML controls and a small live preview that
// shows the character from the front (drawn by the one shared renderer, see below).
import { THREE, blobTexture } from './scene.js';
import { FACES, HATS, SHIRTS, PANTS, buildCharacter, characterStore, faceById, hatById } from './character.js';

export function createCreator(root) {
    const previewHost = root.querySelector('[data-character-preview]');
    if (!previewHost) {
        return null;
    }

    // ---- controls ------------------------------------------------------------------
    const faceName = root.querySelector('[data-face-name]');
    const hatName = root.querySelector('[data-hat-name]');
    const shirtBox = root.querySelector('[data-shirts]');
    const pantsBox = root.querySelector('[data-pants]');

    function swatches(box, list, key) {
        box.textContent = '';
        list.forEach((item) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'swatch';
            b.style.setProperty('--swatch', item.color);
            b.setAttribute('aria-label', item.name);
            b.setAttribute('aria-pressed', 'false');
            b.dataset.id = item.id;
            b.addEventListener('click', () => characterStore.set({ [key]: item.id }));
            box.appendChild(b);
        });
    }
    swatches(shirtBox, SHIRTS, 'shirt');
    swatches(pantsBox, PANTS, 'pants');

    function step(list, key, delta) {
        const state = characterStore.get();
        const i = list.findIndex((x) => x.id === state[key]);
        characterStore.set({ [key]: list[(i + delta + list.length) % list.length].id });
    }
    const bound = [];
    const bind = (selector, fn) => {
        const el = root.querySelector(selector);
        if (el) {
            el.addEventListener('click', fn);
            bound.push([el, fn]);
        }
    };
    bind('[data-face-prev]', () => step(FACES, 'face', -1));
    bind('[data-face-next]', () => step(FACES, 'face', 1));
    bind('[data-hat-prev]', () => step(HATS, 'hat', -1));
    bind('[data-hat-next]', () => step(HATS, 'hat', 1));
    bind('[data-start-walking]', () => {
        // The world handles this event and cancels it. If it is not running, scroll.
        const handled = !window.dispatchEvent(new CustomEvent('character:go', { detail: { id: 'murmurs' }, cancelable: true }));
        if (!handled) {
            const target = document.getElementById('murmurs');
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });

    function showState(state) {
        if (faceName) {
            faceName.textContent = faceById(state.face).name;
        }
        if (hatName) {
            hatName.textContent = hatById(state.hat).name;
        }
        [[shirtBox, state.shirt], [pantsBox, state.pants]].forEach((pair) => {
            pair[0].querySelectorAll('.swatch').forEach((b) => {
                b.setAttribute('aria-pressed', String(b.dataset.id === pair[1]));
            });
        });
    }

    // ---- preview -------------------------------------------------------------------
    // No renderer of its own: phones allow very few WebGL contexts. The preview scene is drawn
    // by the main renderer into a corner of its canvas (scissored, transparent), copied onto
    // this 2D canvas, and then the main frame overwrites the corner. Nothing here spins: the
    // character faces forward, breathes and blinks.
    const canvas = document.createElement('canvas');
    canvas.className = 'creator__canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Preview of the character you made');
    previewHost.appendChild(canvas);
    const ctx2d = canvas.getContext('2d');

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xf4fbff, 0xcfe9b8, Math.PI * 0.55));
    const sun = new THREE.DirectionalLight(0xfff0d2, Math.PI * 0.62);
    sun.position.set(-0.5, 1, 0.9);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
    const figure = buildCharacter(characterStore.get());
    figure.root.scale.setScalar(1);
    scene.add(figure.root);
    const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.9),
        new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.002;
    scene.add(shadow);

    let dirty = true;
    let lastDraw = 0;
    let width = 0;
    let height = 0;
    const FRAME_MS = 100;
    const _vp = new THREE.Vector4();
    const _col = new THREE.Color();
    const _size = new THREE.Vector2();

    function resize() {
        dirty = true;
    }

    function frameCamera(w, h) {
        camera.aspect = w / h;
        // Frame a 1.4 unit tall figure (room for tall hats) whatever the aspect.
        const need = 1.38;
        const fov = (camera.fov * Math.PI) / 180;
        const distH = need / 2 / Math.tan(fov / 2);
        const distW = 0.9 / 2 / (Math.tan(fov / 2) * camera.aspect);
        const dist = Math.max(distH, distW);
        camera.position.set(0, 0.62, dist);
        camera.lookAt(0, 0.62, 0);
        camera.updateProjectionMatrix();
    }

    const unsubscribe = characterStore.subscribe((state) => {
        figure.apply(state);
        showState(state);
        dirty = true;
    });
    showState(characterStore.get());

    // Called every world frame, before the main render. Cheap unless it is time to draw.
    function draw(gl, dt, now, visible) {
        if (!visible) {
            return;
        }
        const cw = previewHost.clientWidth;
        const ch = previewHost.clientHeight;
        if (!cw || !ch) {
            return;
        }
        figure.update(dt, { walk: 0, looking: false });
        if (!dirty && now - lastDraw < FRAME_MS) {
            return;
        }
        const pr = gl.getPixelRatio();
        const w = Math.max(1, Math.round(cw * pr));
        const h = Math.max(1, Math.round(ch * pr));
        gl.getDrawingBufferSize(_size);
        if (w > _size.x || h > _size.y) {
            return;
        }
        if (w !== width || h !== height) {
            width = w;
            height = h;
            canvas.width = w;
            canvas.height = h;
            frameCamera(w, h);
        }
        gl.getViewport(_vp);
        gl.getClearColor(_col);
        const alpha = gl.getClearAlpha();
        gl.setViewport(0, 0, cw, ch);
        gl.setScissor(0, 0, cw, ch);
        gl.setScissorTest(true);
        gl.setClearColor(0xffffff, 0);
        gl.render(scene, camera);
        gl.setScissorTest(false);
        gl.setClearColor(_col, alpha);
        gl.setViewport(_vp);
        ctx2d.clearRect(0, 0, w, h);
        ctx2d.drawImage(gl.domElement, 0, _size.y - h, w, h, 0, 0, w, h);
        lastDraw = now;
        dirty = false;
    }

    function dispose() {
        bound.forEach((b) => b[0].removeEventListener('click', b[1]));
        unsubscribe();
        figure.dispose();
        shadow.geometry.dispose();
        shadow.material.dispose();
        canvas.remove();
    }

    return {
        draw,
        resize,
        dispose,
        canvas,
        invalidate() {
            dirty = true;
        },
        // Test hook: turn the figure to a given yaw (0 is the front view) and redraw.
        pose(y) {
            figure.root.rotation.y = y;
            dirty = true;
        },
        figure
    };
}
