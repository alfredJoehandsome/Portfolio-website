// The character creator on the start board: HTML controls and a small live WebGL preview
// (a second renderer) that shows the same character from the front, slowly turning.
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
    const bind = (selector, fn) => {
        const el = root.querySelector(selector);
        if (el) {
            el.addEventListener('click', fn);
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
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.className = 'creator__canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Preview of the character you made. Drag to turn it.');
    canvas.setAttribute('data-no-walk', '');
    previewHost.appendChild(canvas);

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

    let yaw = 0;
    let auto = true;
    let frozen = false;
    let resumeAt = 0;
    let time = 0;
    let dragging = null;
    let width = 0;
    let height = 0;

    function resize() {
        const w = Math.max(1, previewHost.clientWidth);
        const h = Math.max(1, previewHost.clientHeight);
        if (w === width && h === height) {
            return;
        }
        width = w;
        height = h;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(w, h, false);
        canvas.style.width = '100%';
        canvas.style.height = '100%';
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

    canvas.addEventListener('pointerdown', (event) => {
        dragging = { id: event.pointerId, x: event.clientX };
        auto = false;
        try {
            canvas.setPointerCapture(event.pointerId);
        } catch (e) {
            // Optional.
        }
        event.stopPropagation();
    });
    canvas.addEventListener('pointermove', (event) => {
        if (dragging && event.pointerId === dragging.id) {
            yaw += (event.clientX - dragging.x) * 0.012;
            dragging.x = event.clientX;
            event.stopPropagation();
        }
    });
    const endDrag = (event) => {
        if (dragging && event.pointerId === dragging.id) {
            dragging = null;
            resumeAt = performance.now() + 2500;
        }
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    const unsubscribe = characterStore.subscribe((state) => {
        figure.apply(state);
        showState(state);
    });
    showState(characterStore.get());

    function frame(dt, now) {
        if (!dragging && !auto && !frozen && now >= resumeAt) {
            auto = true;
        }
        time += dt;
        if (auto && !frozen) {
            yaw += dt * 0.55;
        }
        resize();
        figure.root.rotation.y = yaw;
        figure.update(dt, { walk: 0, looking: false });
        renderer.render(scene, camera);
    }

    function dispose() {
        unsubscribe();
        figure.dispose();
        shadow.geometry.dispose();
        shadow.material.dispose();
        renderer.dispose();
        try {
            renderer.forceContextLoss();
        } catch (e) {
            // Already gone.
        }
        canvas.remove();
    }

    return {
        frame,
        resize,
        dispose,
        canvas,
        // Test hook: hold still at a given yaw (0 is the front view) and draw once.
        pose(y) {
            frozen = true;
            auto = false;
            yaw = y;
        },
        figure
    };
}
