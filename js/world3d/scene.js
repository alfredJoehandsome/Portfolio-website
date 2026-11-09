// Renderer, layers, lights, the white void and the sky cap.
//
// Layering: a CSS3D layer (the real board DOM) sits UNDER a transparent-capable
// WebGL canvas. Each board has a "hole" plane in the WebGL scene that writes depth
// and clears its pixels to transparent, so the DOM shows through exactly there.
import * as THREE from '../vendor/three/three.module.min.js';
import { CSS3DRenderer } from '../vendor/three/addons/renderers/CSS3DRenderer.js';

export { THREE };

export function webglAvailable() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) {
            return false;
        }
        // Do not leave the probe's context alive: phones allow very few.
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) {
            lose.loseContext();
        }
        return true;
    } catch (e) {
        return false;
    }
}

// Palette
export const COLORS = {
    grass: 0x7ed36b,
    soil: 0xb98a5a,
    sand: 0xecd29c,
    sandEdge: 0xd9b97c,
    sky: 0x7cc7f2,
    voidLow: 0xf4f7fa
};

let gradient = null;
function gradientMap() {
    if (!gradient) {
        // Three soft steps: shade, mid, light.
        const data = new Uint8Array([140, 205, 255]);
        gradient = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
        gradient.minFilter = THREE.NearestFilter;
        gradient.magFilter = THREE.NearestFilter;
        gradient.generateMipmaps = false;
        gradient.needsUpdate = true;
    }
    return gradient;
}

// Toy shading: a toon material with a three step gradient.
export function toon(color, options) {
    return new THREE.MeshToonMaterial(Object.assign({ color: color, gradientMap: gradientMap() }, options || {}));
}

let blob = null;
export function blobTexture() {
    if (!blob) {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        g.addColorStop(0, 'rgba(70,90,70,0.5)');
        g.addColorStop(0.55, 'rgba(70,90,70,0.28)');
        g.addColorStop(1, 'rgba(70,90,70,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        blob = new THREE.CanvasTexture(canvas);
        blob.colorSpace = THREE.SRGBColorSpace;
    }
    return blob;
}

export function disposeShared() {
    if (gradient) {
        gradient.dispose();
        gradient = null;
    }
    if (blob) {
        blob.dispose();
        blob = null;
    }
}

function smoothstep(a, b, x) {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
}

// The sky cap: the inside of a big sphere, blue straight above the island,
// fading to white, then the white void (a touch of cool grey toward the nadir).
function buildSkyDome(L) {
    const radius = L.dome.radius;
    const geo = new THREE.SphereGeometry(radius, 48, 32);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const blue = new THREE.Color(COLORS.sky);
    const white = new THREE.Color(0xffffff);
    const low = new THREE.Color(COLORS.voidLow);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const polar = Math.acos(Math.max(-1, Math.min(1, pos.getY(i) / radius)));
        // Blue at the zenith, white at about 40 degrees from it.
        const t = smoothstep(0, L.dome.fade, polar);
        c.copy(blue).lerp(white, t);
        // Below the horizon of the dome: white to cool grey.
        const down = smoothstep(Math.PI * 0.5, Math.PI, polar);
        c.lerp(low, down);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
        toneMapped: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, L.dome.centerY, 0);
    mesh.renderOrder = -100;
    mesh.frustumCulled = false;
    mesh.name = 'sky-dome';
    return mesh;
}

// ONE WebGL context for the whole page, reused across rebuilds (phones kill tabs that
// hold several). The creator preview draws through this same renderer.
let shared = null;
let lostHandler = null;

export function onContextLost(fn) {
    lostHandler = fn;
}

function getRenderer(L) {
    if (!shared) {
        shared = new THREE.WebGLRenderer({
            antialias: !L.compact,
            alpha: true,
            premultipliedAlpha: true,
            powerPreference: L.compact ? 'default' : 'high-performance'
        });
        shared.setClearColor(0xffffff, 1);
        shared.outputColorSpace = THREE.SRGBColorSpace;
        shared.toneMapping = THREE.NoToneMapping;
        shared.shadowMap.enabled = false;
        shared.domElement.className = 'stage__gl';
        shared.domElement.setAttribute('aria-hidden', 'true');
        shared.domElement.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            if (lostHandler) {
                lostHandler();
            }
        });
    }
    return shared;
}

export function destroyRenderer() {
    if (!shared) {
        return;
    }
    const gl = shared;
    shared = null;
    lostHandler = null;     // forcing the loss below must not look like a lost context
    try {
        gl.dispose();
        gl.forceContextLoss();
    } catch (e) {
        // Already lost.
    }
    gl.domElement.remove();
}

export function createStage(host, L) {
    const stage = document.createElement('div');
    stage.className = 'stage';
    const cssLayer = document.createElement('div');
    cssLayer.className = 'stage__css';
    stage.appendChild(cssLayer);

    const css = new CSS3DRenderer({ element: cssLayer });

    const gl = getRenderer(L);
    const canvas = gl.domElement;
    stage.appendChild(canvas);
    host.appendChild(stage);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(L.fovRead, L.vw / L.vh, L.near, L.far);

    // Bright and soft: sky white-blue above, light green bounce below, one warm sun.
    const hemi = new THREE.HemisphereLight(0xf4fbff, 0xcfe9b8, Math.PI * 0.55);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff8ec, Math.PI * 0.6);
    sun.position.set(-0.55, 1, 0.6);
    scene.add(sun);
    scene.add(sun.target);

    const dome = buildSkyDome(L);
    scene.add(dome);

    function resize(width, height, dpr) {
        gl.setPixelRatio(dpr);
        gl.setSize(width, height, false);
        css.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }
    resize(L.vw, L.vh, L.dpr);

    function dispose() {
        scene.traverse((obj) => {
            if (obj.geometry) {
                obj.geometry.dispose();
            }
            if (obj.material) {
                const list = Array.isArray(obj.material) ? obj.material : [obj.material];
                list.forEach((m) => {
                    Object.keys(m).forEach((k) => {
                        const v = m[k];
                        if (v && v.isTexture) {
                            v.dispose();
                        }
                    });
                    m.dispose();
                });
            }
        });
        disposeShared();
        // The renderer (the one WebGL context) is kept for rebuilds; see destroyRenderer.
        gl.renderLists.dispose();
        stage.remove();
    }

    return { stage, cssLayer, canvas, css, gl, scene, camera, hemi, sun, dome, resize, dispose };
}
