// "Walk around the website" in 3D. Every section is a signboard standing on a
// ring path around a big round floor. The camera sits outside the ring and
// looks toward the centre; scrolling orbits the camera together with the
// stickman, so the boards slide past and the next one turns to face the visitor.
//
// All CSS 3D, no WebGL. Coordinates inside .scene: the circle centre is (0,0,0),
// the floor is the plane y = 0, y points down, z points toward the camera.
// Board i stands on the ring at angle a_i = i * spacing / R, rotateY(a_i)
// translateZ(R), facing outward. The player's distance s is measured along the
// ring and psi = s / R spins the world so the board at psi is in front.
(function () {
    'use strict';

    const COMPACT_W = 900;          // narrower or shorter than this uses the compact (phone) layout
    const COMPACT_H = 600;
    const GAP = 400;                // free arc length between two boards on the ring
    const EDGE = 14;                // minimum gap between the board and the sky nav row
    const FEET_BOTTOM = 110;        // stickman feet, px above the window bottom
    // These three are set per variant in build(): desktop 1500 / 10 degrees / 100 px.
    let PERSPECTIVE = 1500;         // px; the front board plane sits at depth 0, so scale 1
    let TILT = 10 * Math.PI / 180;  // camera looks down by this much
    let CLEARANCE = 100;            // board bottom above the ground, in px
    // Compact variant
    const C_PERSPECTIVE = 1100;
    const C_TILT = 10 * Math.PI / 180;
    const C_FEET = 64;              // ground line above the bottom edge
    const C_BOARD_RISE = 70;        // board bottom above the ground line
    const C_BOARD_MAX = 460;
    const C_SIDE = 24;              // free screen margin beside the front board
    const C_NAV_GAP = 12;
    const C_MAP = 56;
    const AXIS_LOCK = 8;            // px of finger travel before a swipe picks its axis
    const INERTIA_TAU = 0.33;       // s, decay of a fling
    const INERTIA_MAX = 1.5;        // spacings a fling may cover
    const INERTIA_STOP = 40;        // px per second below which a fling ends
    const GROUND_SCALE = 8;         // the floor is drawn this many times smaller, then scaled up
    const GROUND_MARGIN = 200;      // floor extends this far beyond the ring
    const WHEEL_PER_PX = 0.0012;    // board spacings walked per wheel pixel (100px = 0.12)
    const MAX_STEP = 0.5;           // one wheel event never walks more than this many spacings
    const SMOOTH_INPUT = 0.18;      // glide while the visitor is scrolling (per 1/60 s)
    const SMOOTH_NAV = 0.12;        // glide for explicit navigation (per 1/60 s)
    const CAPTURE = 0.1;            // magnet radius, as a fraction of the board spacing
    const MAGNET_MS = 480;          // length of the magnet ease
    const MAGNET_IDLE = 100;        // ms without input before the magnet may act
    const MIN_ZOOM = 0.78;          // the camera never dollies back further than this
    const ZOOM_REACH = 0.9;         // dolly blends in within this many spacings of a board
    const WALK_ON = 40;             // px per second above which the stickman walks
    const WALK_OFF = 15;
    const DARKEST = 0.34;           // brightness of the board on the far side
    const POST_X = [0.15, 0.85];
    const MAP_W = 84;
    const MAP_H = 84;

    // Which sky nav link is "current" for each board.
    const NAV_FOR = {
        murmurs: 'murmurs',
        'pizza-to-hell': 'murmurs',
        projects: 'murmurs',
        experience: 'experience',
        about: 'about',
        strengths: 'about',
        testimonials: 'about',
        contact: 'contact'
    };

    const root = document.documentElement;
    const main = document.querySelector('main');
    if (!main) {
        return;
    }
    const sections = Array.from(main.querySelectorAll(':scope > section[data-stop]'));
    if (sections.length === 0) {
        return;
    }
    const ids = sections.map((section) => section.id);
    const count = sections.length;
    const player = document.querySelector('.player');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Older links: the two experience boards were merged into one.
    const ALIASES = { 'experience-2': 'experience' };
    function indexOfId(id) {
        return ids.indexOf(ALIASES[id] || id);
    }

    // -----------------------------------------------------------------
    // State of the active world (null in the vertical layout)
    // -----------------------------------------------------------------
    let w = null;
    let target = 0;
    let current = 0;
    let lastInput = 0;
    let explicit = false;           // walking to a board chosen by key, link or dot
    let magnet = null;              // { from, to, t0 } while easing onto a board
    let rate = 0.12;
    let walking = false;
    let velocity = 0;
    let holding = false;
    let raf = 0;
    let lastFrame = 0;
    let hintGone = false;
    let appliedS = NaN;
    let lastShade = 0;
    let inertia = null;             // { v } arc px per second while a fling coasts
    let direct = false;             // a finger is dragging: follow it 1:1, no smoothing
    let shownIndex = -1;
    // Read by the tests; updated without touching the DOM.
    const debug = { pos: 0, zoom: 1, dolly: 0, spacing: 0, radius: 0, navBottom: 0 };
    window.__world = debug;

    function eligible() {
        return !motionQuery.matches;
    }

    function isCompact() {
        return window.innerWidth < COMPACT_W || window.innerHeight < COMPACT_H;
    }

    // Stage height: the visual viewport, so a mobile address bar does not cut things off.
    function stageHeight() {
        const vv = window.visualViewport;
        return Math.round(vv && vv.height ? vv.height : window.innerHeight);
    }

    function coarse() {
        return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    }

    // Screen position of a point of board i (local x, height above the board bottom)
    // when the camera is parked on board 0, for the compact geometry solver.
    function projectLocal(g, angle, lx, up) {
        const t = g.tilt;
        // rig: rotateX(tilt) then translateY(-clearance)
        let y = -up * Math.cos(t) - g.clearance;
        let z = -up * Math.sin(t);
        let x = lx;
        // slot: translateZ(R) then rotateY(angle)
        z += g.radius;
        const sx = x * Math.cos(angle) + z * Math.sin(angle);
        const sz = -x * Math.sin(angle) + z * Math.cos(angle);
        // camera: translate(0, clearance, -R), rotateX(-tilt), translate(cx, sy, 0)
        let cy2 = y + g.clearance;
        let cz2 = sz - g.radius;
        const ry = cy2 * Math.cos(-t) - cz2 * Math.sin(-t);
        const rz = cy2 * Math.sin(-t) + cz2 * Math.cos(-t);
        const k = g.perspective / (g.perspective - rz);
        return { x: g.vw / 2 + sx * k, y: g.vh / 2 + (g.sceneY + ry - g.vh / 2) * k };
    }

    function wrapIndex(i) {
        return ((i % count) + count) % count;
    }

    function create(tag, className) {
        const node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        return node;
    }

    // Vertical offset of the scene origin so the player's ring point lands on
    // the feet line for a given dolly distance d (see the pipeline below).
    function sceneY(d) {
        const c1 = CLEARANCE * Math.sin(TILT);
        const c2 = CLEARANCE * Math.cos(TILT);
        return w.cy + (w.feetY - w.cy) * (PERSPECTIVE + d + c1) / PERSPECTIVE - c2;
    }

    // Screen y of the top edge of a board of height h (px, already scaled) at dolly d.
    function topAt(d, h) {
        const c1 = CLEARANCE * Math.sin(TILT);
        const c2 = CLEARANCE * Math.cos(TILT);
        const cy = w.cy;
        const feet = w.feetY;
        return cy + (feet - cy) * (PERSPECTIVE + d + c1) / (PERSPECTIVE + d) -
            (c2 + h) * PERSPECTIVE / (PERSPECTIVE + d);
    }

    // -----------------------------------------------------------------
    // Build and tear down
    // -----------------------------------------------------------------
    function setNavMode(on) {
        const header = document.querySelector('.navbar');
        if (!header) {
            return;
        }
        header.querySelectorAll('.nav-links a').forEach((link) => {
            const isResume = link.classList.contains('btn');
            if (on) {
                if (!isResume) {
                    link.classList.add('btn', 'btn--secondary', 'btn--sm', 'is-sky');
                } else {
                    link.classList.remove('btn--secondary');
                    link.classList.add('btn--primary', 'is-sky-resume');
                }
            } else {
                if (link.classList.contains('is-sky')) {
                    link.classList.remove('btn', 'btn--secondary', 'btn--sm', 'is-sky');
                }
                if (link.classList.contains('is-sky-resume')) {
                    link.classList.remove('btn--primary', 'is-sky-resume');
                    link.classList.add('btn--secondary');
                }
                link.removeAttribute('aria-current');
            }
        });
    }

    // Resume leaves the row when the five buttons do not fit the screen width.
    function fitNavRow(vw) {
        const links = document.querySelector('.nav-links');
        if (!links) {
            return;
        }
        const resume = links.querySelector('.is-sky-resume');
        const item = resume && resume.parentElement;
        if (!item) {
            return;
        }
        item.hidden = false;
        links.classList.remove('nav-links--tight', 'nav-links--tighter');
        const room = vw - 24;
        const tiers = ['nav-links--tight', 'nav-links--tighter'];
        for (let i = 0; i < tiers.length && links.getBoundingClientRect().width > room; i++) {
            links.classList.add(tiers[i]);
            if (i > 0) {
                links.classList.remove(tiers[i - 1]);
            }
        }
        if (links.getBoundingClientRect().width > room) {
            item.hidden = true;
        }
    }

    function build(startIndex) {
        const compact = isCompact();
        const vw = window.innerWidth;
        const vh = compact ? stageHeight() : window.innerHeight;
        const boardW = compact
            ? Math.floor(Math.min(vw - 2 * C_SIDE, C_BOARD_MAX) / 2) * 2
            : Math.floor(Math.min(1120, vw * 0.86) / 2) * 2;
        const feetBottom = compact ? C_FEET : FEET_BOTTOM;
        const feetY = vh - feetBottom;

        PERSPECTIVE = compact ? C_PERSPECTIVE : 1500;
        TILT = compact ? C_TILT : 10 * Math.PI / 180;
        CLEARANCE = 100;
        if (compact) {
            // Board bottom sits C_BOARD_RISE px above the ground line on screen.
            CLEARANCE = C_BOARD_RISE / (Math.cos(TILT) - (feetY - vh / 2) * Math.sin(TILT) / PERSPECTIVE);
        }

        root.classList.add('world-mode');
        root.classList.toggle('world-compact', compact);
        if (compact) {
            main.style.setProperty('--stage-h', vh + 'px');
        }
        setNavMode(true);
        if (compact) {
            fitNavRow(vw);
        }
        main.style.setProperty('--board-w', boardW + 'px');
        main.style.setProperty('--board-clear', CLEARANCE + 'px');
        main.style.perspective = PERSPECTIVE + 'px';

        // Reserve the sky nav row: boards must stay below it.
        const navRow = document.querySelector('.nav-links');
        const navBottom = navRow ? navRow.getBoundingClientRect().bottom : 52;
        const minTop = navBottom + (compact ? C_NAV_GAP : EDGE);

        // Compact boards all have one fixed height: from under the nav row down to
        // C_BOARD_RISE above the ground line. They scroll inside.
        const boardH = compact ? Math.floor(feetY - C_BOARD_RISE - minTop) : 0;
        if (compact) {
            main.style.setProperty('--board-h', boardH + 'px');
        }

        let gap = GAP;
        if (compact) {
            gap = solveGap(vw, vh, boardW, boardH, feetY);
        }
        const spacing = boardW + gap;
        const radius = (count * spacing) / (2 * Math.PI);

        // The floor lives in its own 3D context so the compositor does not have to
        // depth-sort it against every board. It is always beneath them.
        const floor = create('div', 'scene');
        main.appendChild(floor);
        const scene = create('div', 'scene');
        main.appendChild(scene);

        w = {
            world: scene,
            floor: floor,
            compact: compact,
            vw: vw,
            vh: vh,
            builtH: vh,
            boardW: boardW,
            cx: vw / 2,
            cy: vh / 2,
            feetY: feetY,
            scrolled: new Set(),
            scrollHandlers: [],
            chips: [],
            spacing: spacing,
            radius: radius,
            perimeter: 2 * Math.PI * radius,
            angles: [],
            dolly: [],
            light: [],
            fronts: [],
            backs: []
        };

        // Lazy images inside 3D-transformed boards are loaded unreliably, so load them now.
        sections.forEach((section) => {
            section.querySelectorAll('img[loading="lazy"]').forEach((img) => {
                img.setAttribute('data-was-lazy', '');
                img.loading = 'eager';
            });
        });

        // Ground: a flat disc on the floor, with a ring path where the visitor walks.
        const groundR = radius + GROUND_MARGIN;
        const ground = create('div', 'ground');
        ground.setAttribute('aria-hidden', 'true');
        // Built small and scaled up: a huge element makes the compositor crawl.
        ground.style.width = ground.style.height = (groundR * 2) / GROUND_SCALE + 'px';
        ground.style.left = ground.style.top = -groundR / GROUND_SCALE + 'px';
        ground.style.transform = 'rotateX(90deg) scale(' + GROUND_SCALE + ')';
        const path = create('div', 'ground__path');
        const pathR = radius + 4;
        path.style.width = path.style.height = (pathR * 2) / GROUND_SCALE + 'px';
        path.style.left = path.style.top = (groundR - pathR) / GROUND_SCALE + 'px';
        ground.appendChild(path);
        floor.appendChild(ground);

        const slots = sections.map((section, i) => {
            const slot = create('div', 'slot');
            const rig = create('div', 'rig');
            slot.appendChild(rig);
            rig.appendChild(section);
            scene.appendChild(slot);
            return { slot: slot, rig: rig, section: section };
        });

        // Measure while the boards are laid out at their natural size.
        const heights = sections.map((section) => (compact ? boardH : section.offsetHeight));

        // Dolly (camera pulls back) per board so it fits under the sky nav row;
        // past the dolly floor the board itself is scaled down.
        const dMax = PERSPECTIVE * (1 / MIN_ZOOM - 1);
        const fit = heights.map((h) => {
            let d = 0;
            let k = 1;
            if (!compact && topAt(0, h) < minTop) {
                let lo = 0;
                let hi = dMax;
                if (topAt(hi, h) >= minTop) {
                    for (let n = 0; n < 40; n++) {
                        const mid = (lo + hi) / 2;
                        if (topAt(mid, h) >= minTop) {
                            hi = mid;
                        } else {
                            lo = mid;
                        }
                    }
                    d = hi;
                } else {
                    d = dMax;
                    // Scale the board so its top lands on minTop at the floor of the dolly.
                    const s = PERSPECTIVE / (PERSPECTIVE + d);
                    const base = w.cy + (w.feetY - w.cy) * (PERSPECTIVE + d + CLEARANCE * Math.sin(TILT)) /
                        (PERSPECTIVE + d);
                    const room = (base - minTop) / s - CLEARANCE * Math.cos(TILT);
                    k = Math.max(0.5, room / h);
                }
            }
            return { d: d, k: k };
        });

        slots.forEach((entry, i) => {
            const angle = (i * spacing) / radius;
            w.angles.push(angle);
            w.dolly.push(fit[i].d);
            const k = fit[i].k;
            const h = heights[i];
            entry.slot.style.transform = 'rotateY(' + angle + 'rad) translateZ(' + radius + 'px)';
            entry.rig.style.transform = 'translateY(' + -CLEARANCE + 'px) rotateX(' + TILT +
                'rad)' + (k < 1 ? ' scale(' + k + ')' : '');

            // Back face: plain board back with the title and the posts.
            const back = create('div', 'board-back');
            back.setAttribute('aria-hidden', 'true');
            back.style.height = h + 'px';
            const title = create('div', 'board-back__title');
            title.textContent = entry.section.getAttribute('data-title') || entry.section.id;
            back.appendChild(title);
            entry.rig.appendChild(back);

            POST_X.forEach((fraction) => {
                // Post length: from the board bottom down to the floor, a little into it.
                const reach = (CLEARANCE * Math.cos(TILT) + 3) / k;
                if (compact) {
                    // The board scrolls, so its posts stand on the rig beside it.
                    const post = create('span', 'board__post');
                    post.style.left = (fraction - 0.5) * boardW + 'px';
                    post.style.height = reach + 'px';
                    entry.rig.appendChild(post);
                    return;
                }
                [entry.section, back].forEach((face) => {
                    const post = create('span', 'board__post');
                    post.style.left = fraction * 100 + '%';
                    post.style.height = reach + 'px';
                    face.appendChild(post);
                });
            });
            if (compact) {
                const chip = create('button', 'board-more');
                chip.type = 'button';
                chip.tabIndex = -1;
                chip.hidden = true;
                chip.setAttribute('aria-label', 'Scroll down');
                chip.appendChild(document.createTextNode('More '));
                const ns = 'http://www.w3.org/2000/svg';
                const chev = document.createElementNS(ns, 'svg');
                chev.setAttribute('viewBox', '0 0 12 12');
                chev.setAttribute('aria-hidden', 'true');
                const chevPath = document.createElementNS(ns, 'path');
                chevPath.setAttribute('d', 'M2 4l4 4 4-4');
                chev.appendChild(chevPath);
                chip.appendChild(chev);
                chip.addEventListener('click', () => {
                    entry.section.scrollBy({ top: entry.section.clientHeight * 0.8, behavior: 'smooth' });
                });
                entry.rig.appendChild(chip);
                w.chips.push(chip);
                const onScroll = () => {
                    w.scrolled.add(i);
                    updateChip(i);
                };
                entry.section.addEventListener('scroll', onScroll, { passive: true });
                w.scrollHandlers.push(onScroll);
            }
            w.fronts.push(entry.section);
            w.backs.push(back);
            w.light.push(1);
        });

        // HUD: position text and mini map.
        const hud = create('div', 'hud');
        const hudCount = create('p', 'hud__count');
        const hudHint = create('p', 'hud__hint');
        hudHint.textContent = coarse() ? 'Swipe to walk' : 'Scroll or use the arrow keys to walk';
        if (hintGone) {
            hudHint.classList.add('is-gone');
        }
        hud.appendChild(hudCount);
        hud.appendChild(hudHint);
        main.appendChild(hud);

        const map = create('div', 'minimap');
        map.setAttribute('role', 'group');
        map.setAttribute('aria-label', 'Site map');
        const ns = 'http://www.w3.org/2000/svg';
        const mapSvg = document.createElementNS(ns, 'svg');
        const mapSize = compact ? C_MAP : MAP_W;
        mapSvg.setAttribute('viewBox', '0 0 ' + mapSize + ' ' + mapSize);
        mapSvg.setAttribute('aria-hidden', 'true');
        const mapR = mapSize / 2 - 10;
        const ring = document.createElementNS(ns, 'circle');
        ring.setAttribute('cx', String(mapSize / 2));
        ring.setAttribute('cy', String(mapSize / 2));
        ring.setAttribute('r', String(mapR));
        mapSvg.appendChild(ring);
        map.appendChild(mapSvg);

        // Seen from above with the camera at the bottom: angle 0 is the bottom of the ring.
        const mapPoint = (a) => ({
            x: mapSize / 2 + mapR * Math.sin(a),
            y: mapSize / 2 + mapR * Math.cos(a)
        });
        const dots = sections.map((section, i) => {
            const dot = create('button', 'minimap__dot');
            dot.type = 'button';
            dot.setAttribute('aria-label', section.getAttribute('data-title') || section.id);
            const pos = mapPoint(w.angles[i]);
            dot.style.left = pos.x + 'px';
            dot.style.top = pos.y + 'px';
            dot.addEventListener('click', () => walkToIndex(i));
            map.appendChild(dot);
            return dot;
        });
        const me = create('span', 'minimap__me');
        map.appendChild(me);
        main.appendChild(map);

        w.hud = hud;
        w.hudCount = hudCount;
        w.hudHint = hudHint;
        w.map = map;
        w.dots = dots;
        w.me = me;
        w.mapPoint = mapPoint;
        w.navLinks = Array.from(document.querySelectorAll('.nav-links a.is-sky'));

        debug.spacing = spacing;
        debug.radius = radius;
        debug.navBottom = navBottom;
        debug.compact = compact;
        debug.boardH = boardH;
        debug.feetY = feetY;
        debug.boardW = boardW;
        placePlayer();

        target = current = startIndex * spacing;
        explicit = false;
        magnet = null;
        walking = false;
        velocity = 0;
        appliedS = NaN;
        shownIndex = -1;
        render(true);
        if (compact) {
            sections.forEach((section, i) => updateChip(i));
            sections.forEach((section) => {
                section.querySelectorAll('img').forEach((img) => {
                    if (!img.complete) {
                        img.addEventListener('load', updateChips, { once: true });
                    }
                });
            });
        }
    }

    // Compact: the stickman is placed from the stage height so it stays on the ground
    // line even when the layout viewport and the visual viewport differ.
    function placePlayer() {
        if (!player || !w) {
            return;
        }
        if (w.compact) {
            player.style.bottom = 'auto';
            player.style.top = w.feetY - player.offsetHeight + 'px';
        } else {
            player.style.top = '';
            player.style.bottom = '';
        }
    }

    function updateChip(i) {
        if (!w || !w.compact || !w.chips[i]) {
            return;
        }
        const section = sections[i];
        w.chips[i].hidden = section.scrollHeight - section.clientHeight - section.scrollTop <= 6;
    }

    function updateChips() {
        sections.forEach((section, i) => updateChip(i));
    }

    // Choose the free arc between boards so the neighbours just peek in beside the
    // front board: their near edge lands a few px behind the front board's edge.
    function solveGap(vw, vh, boardW, boardH, feetY) {
        const target = vw / 2 + boardW / 2 - 6;
        const sceneYAt = (cl) => {
            const c1 = cl * Math.sin(TILT);
            const c2 = cl * Math.cos(TILT);
            return vh / 2 + (feetY - vh / 2) * (PERSPECTIVE + c1) / PERSPECTIVE - c2;
        };
        let best = 160;
        let bestErr = Infinity;
        for (let g = 60; g <= 900; g += 10) {
            const spacing = boardW + g;
            const radius = (count * spacing) / (2 * Math.PI);
            const geo = { tilt: TILT, clearance: CLEARANCE, radius: radius, perspective: PERSPECTIVE,
                vw: vw, vh: vh, sceneY: sceneYAt(CLEARANCE) };
            const near = projectLocal(geo, spacing / radius, -boardW / 2, boardH / 2);
            const err = Math.abs(near.x - target);
            if (err < bestErr) {
                bestErr = err;
                best = g;
            }
        }
        return best;
    }

    function teardown() {
        if (!w) {
            return;
        }
        window.cancelAnimationFrame(raf);
        raf = 0;
        w.hud.remove();
        w.map.remove();
        sections.forEach((section) => {
            section.style.transform = '';
            section.style.filter = '';
            section.querySelectorAll('.board__post').forEach((post) => post.remove());
            main.appendChild(section);
        });
        document.querySelectorAll('img[data-was-lazy]').forEach((img) => {
            img.loading = 'lazy';
            img.removeAttribute('data-was-lazy');
        });
        sections.forEach((section, i) => {
            if (w.scrollHandlers[i]) {
                section.removeEventListener('scroll', w.scrollHandlers[i]);
            }
            section.scrollTop = 0;
        });
        w.world.remove();
        w.floor.remove();
        main.style.removeProperty('--board-w');
        main.style.removeProperty('--board-clear');
        main.style.removeProperty('--board-h');
        main.style.removeProperty('--stage-h');
        main.style.perspective = '';
        const tightRow = document.querySelector('.nav-links');
        if (tightRow) {
            tightRow.classList.remove('nav-links--tight', 'nav-links--tighter');
        }
        const resumeItem = document.querySelector('.nav-links .is-sky-resume');
        if (resumeItem && resumeItem.parentElement) {
            resumeItem.parentElement.hidden = false;
        }
        setNavMode(false);
        root.classList.remove('world-mode', 'world-compact');
        if (player) {
            player.style.top = '';
            player.style.bottom = '';
        }
        if (player) {
            player.classList.remove('is-walking', 'is-flipped');
        }
        w = null;
    }

    // -----------------------------------------------------------------
    // Camera and HUD
    // -----------------------------------------------------------------
    // Dolly: each tall board pulls the camera back, blended by how close the
    // visitor is to it (arc distance), so it eases out and back in.
    function dollyAt(s) {
        let dolly = 0;
        for (let i = 0; i < count; i++) {
            const need = w.dolly[i];
            if (need <= 0) {
                continue;
            }
            let d = Math.abs(s - i * w.spacing) % w.perimeter;
            d = Math.min(d, w.perimeter - d);
            const x = Math.min(1, Math.max(0, 1 - d / (ZOOM_REACH * w.spacing)));
            const blend = x * x * (3 - 2 * x);
            dolly = Math.max(dolly, need * blend);
        }
        return dolly;
    }

    function render(force) {
        if (!w) {
            return;
        }
        if (force || current !== appliedS) {
            const psi = current / w.radius;
            const dolly = dollyAt(current);
            // Pipeline (right to left): spin the ring, bring the front board
            // bottom to the origin, tilt the camera, place it on screen.
            const camera =
                'translate3d(' + w.cx + 'px, ' + sceneY(dolly) + 'px, ' + -dolly + 'px) ' +
                'rotateX(' + -TILT + 'rad) ' +
                'translate3d(0, ' + CLEARANCE + 'px, ' + -w.radius + 'px) ' +
                'rotateY(' + -psi + 'rad)';
            w.world.style.transform = camera;
            w.floor.style.transform = camera;
            const pos = w.mapPoint(psi);
            w.me.style.left = pos.x + 'px';
            w.me.style.top = pos.y + 'px';
            debug.pos = current;
            debug.dolly = dolly;
            debug.zoom = PERSPECTIVE / (PERSPECTIVE + dolly);

            // Darken boards by depth. Only touch the style when it changed noticeably,
            // and not more than about ten times a second while moving.
            const stamp = performance.now();
            const shadeDue = force || current === target || stamp - lastShade >= 100;
            if (shadeDue) lastShade = stamp;
            const turn = 2 * Math.PI;
            for (let i = 0; shadeDue && i < count; i++) {
                let delta = Math.abs(psi - w.angles[i]) % turn;
                delta = Math.min(delta, turn - delta);
                let b = delta < 0.01 ? 1 : Math.max(DARKEST, 1 - (1 - DARKEST) * Math.pow(delta / Math.PI, 0.85));
                b = Math.round(b * 12) / 12;
                // Only the face the camera can see gets the filter, and only when
                // the step changes: filtered layers are repainted when they change.
                const showBack = delta > Math.PI / 2 ? 1 : 0;
                const key = b + (showBack ? 'b' : 'f');
                if (key !== w.light[i]) {
                    w.light[i] = key;
                    // Shade with plain solid colours instead of a CSS filter: a filter
                    // forces a repaint of the whole board layer, a colour change does not.
                    // Fronts the camera can see are near boards and stay unshaded.
                    const back = w.backs[i];
                    const shade = (v) => Math.round(v * b);
                    back.style.backgroundColor = 'rgb(' + shade(31) + ',' + shade(31) + ',' + shade(31) + ')';
                    back.style.borderColor = 'rgb(' + shade(51) + ',' + shade(51) + ',' + shade(51) + ')';
                    back.firstChild.style.color = 'rgb(' + shade(238) + ',' + shade(238) + ',' + shade(238) + ')';
                }
            }
            appliedS = current;
        }
        const index = wrapIndex(Math.round(current / w.spacing));
        if (index !== shownIndex) {
            shownIndex = index;
            const title = sections[index].getAttribute('data-title') || sections[index].id;
            w.hudCount.textContent = index + 1 + ' / ' + count + ' · ' + title;
            w.dots.forEach((dot, i) => dot.classList.toggle('is-current', i === index));
            if (w.compact) {
                // Boards left behind go back to the top.
                w.scrolled.forEach((i) => {
                    if (i !== index) {
                        sections[i].scrollTop = 0;
                        w.scrolled.delete(i);
                        updateChip(i);
                    }
                });
            }
            const navTarget = NAV_FOR[ids[index]];
            w.navLinks.forEach((link) => {
                if (link.getAttribute('href') === '#' + navTarget) {
                    link.setAttribute('aria-current', 'true');
                } else {
                    link.removeAttribute('aria-current');
                }
            });
        }
    }

    // -----------------------------------------------------------------
    // Motion
    // -----------------------------------------------------------------
    function wake() {
        if (w) {
            // Let the compositor own the transform while the world is moving.
            w.world.style.willChange = 'transform';
            w.floor.style.willChange = 'transform';
        }
        if (!raf && w) {
            lastFrame = performance.now();
            raf = window.requestAnimationFrame(frame);
        }
    }

    function frame(now) {
        raf = 0;
        if (!w) {
            return;
        }
        const dt = Math.max(0, Math.min(0.1, (now - lastFrame) / 1000));
        lastFrame = now;
        const before = current;
        let arrived = false;

        if (inertia) {
            // A released swipe coasts, then the soft magnet takes over.
            current += inertia.v * dt;
            target = current;
            inertia.v *= Math.exp(-dt / INERTIA_TAU);
            lastInput = now;
            if (Math.abs(inertia.v) < INERTIA_STOP) {
                inertia = null;
            }
        } else if (direct) {
            current = target;
        } else if (magnet) {
            const t = Math.min(1, (now - magnet.t0) / MAGNET_MS);
            const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            current = magnet.from + (magnet.to - magnet.from) * eased;
            if (t >= 1) {
                current = target = magnet.to;
                magnet = null;
                arrived = true;
            }
        } else {
            const gap = target - current;
            if (Math.abs(gap) < 0.5) {
                current = target;
            } else {
                current += gap * (1 - Math.pow(1 - rate, dt * 60));
            }
            if (explicit && current === target) {
                explicit = false;
                arrived = true;
            } else if (!explicit && !holding && now - lastInput >= MAGNET_IDLE &&
                       Math.abs(target - current) < 30) {
                // Soft magnet: only when the stop is close to a board.
                const k = Math.round(current / w.spacing);
                const board = k * w.spacing;
                if (Math.abs(current - board) <= CAPTURE * w.spacing) {
                    if (Math.abs(current - board) < 0.5) {
                        current = target = board;
                        arrived = true;
                    } else {
                        magnet = { from: current, to: board, t0: now };
                        target = board;
                    }
                }
            }
        }
        render(false);

        // Walk cycle follows the real speed.
        const speed = dt > 0 ? (current - before) / dt : 0;
        velocity += (speed - velocity) * 0.35;
        const abs = Math.abs(velocity);
        if (!walking && abs > WALK_ON) {
            walking = true;
        } else if (walking && abs < WALK_OFF) {
            walking = false;
        }
        if (player) {
            player.classList.toggle('is-walking', walking);
            if (walking) {
                player.classList.toggle('is-flipped', velocity < 0);
            }
        }

        if (arrived) {
            settle();
        }
        const idle = !magnet && !inertia && current === target && !explicit && !holding &&
            now - lastInput >= MAGNET_IDLE && !walking;
        if (idle) {
            w.world.style.willChange = 'auto';
            w.floor.style.willChange = 'auto';
            if (player) {
                player.classList.remove('is-walking');
            }
            return;
        }
        raf = window.requestAnimationFrame(frame);
    }

    function settle() {
        const id = ids[wrapIndex(Math.round(current / w.spacing))];
        if (window.location.hash !== '#' + id) {
            try {
                history.replaceState(null, '', '#' + id);
            } catch (e) {
                // Some contexts (file URLs, sandboxes) refuse this; ignore.
            }
        }
    }

    function noteInput() {
        lastInput = performance.now();
        if (!hintGone) {
            hintGone = true;
            if (w) {
                w.hudHint.classList.add('is-gone');
            }
        }
        wake();
    }

    // Continuous walking from wheel or touch. Cancels any magnet or walk to a board.
    function nudge(distance) {
        if (!w) {
            return;
        }
        inertia = null;
        if (magnet) {
            target = current;
            magnet = null;
        }
        if (explicit) {
            target = current;
            explicit = false;
        }
        rate = SMOOTH_INPUT;
        target += distance;
        noteInput();
    }

    // Explicit navigation to a given distance.
    function goTo(newTarget) {
        if (!w) {
            return;
        }
        inertia = null;
        magnet = null;
        rate = SMOOTH_NAV;
        explicit = true;
        target = newTarget;
        noteInput();
    }

    // Walk to board i the shortest way around the loop.
    function walkToIndex(i) {
        if (!w) {
            return;
        }
        const here = Math.round(target / w.spacing);
        let delta = wrapIndex(i - here);
        if (delta > count / 2) {
            delta -= count;
        }
        goTo((here + delta) * w.spacing);
    }

    function walkNext() {
        goTo((Math.floor(target / w.spacing + 1e-6) + 1) * w.spacing);
    }

    function walkPrev() {
        goTo((Math.ceil(target / w.spacing - 1e-6) - 1) * w.spacing);
    }

    // -----------------------------------------------------------------
    // Input
    // -----------------------------------------------------------------
    function dialogOpen() {
        return !!document.querySelector('dialog[open]');
    }

    window.addEventListener('wheel', (event) => {
        if (!w || event.ctrlKey || dialogOpen()) {
            return;
        }
        event.preventDefault();
        let dx = event.deltaX;
        let dy = event.deltaY;
        if (event.deltaMode === 1) {
            dx *= 16;
            dy *= 16;
        } else if (event.deltaMode === 2) {
            dx *= window.innerHeight;
            dy *= window.innerHeight;
        }
        const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        const limit = MAX_STEP * w.spacing;
        nudge(Math.max(-limit, Math.min(limit, d * WHEEL_PER_PX * w.spacing)));
    }, { passive: false });

    window.addEventListener('keydown', (event) => {
        if (!w || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }
        if (dialogOpen()) {
            return;
        }
        const el = event.target;
        if (el && el.closest && el.closest('input, textarea, select, [contenteditable], dialog')) {
            return;
        }
        const interactive = !!(el && el.closest && el.closest('a, button, summary'));
        switch (event.key) {
            case 'ArrowRight':
            case 'ArrowDown':
            case 'PageDown':
                walkNext();
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
            case 'PageUp':
                walkPrev();
                break;
            case ' ':
                // Space presses a focused button or link; only walk from the page itself.
                if (interactive) {
                    return;
                }
                if (event.shiftKey) {
                    walkPrev();
                } else {
                    walkNext();
                }
                break;
            case 'Home':
                walkToIndex(0);
                break;
            case 'End':
                walkToIndex(count - 1);
                break;
            default:
                return;
        }
        event.preventDefault();
    });

    // Touch and pen: a horizontal swipe walks, 1:1 with the finger, and coasts after
    // release. A vertical swipe is left to the browser, which scrolls the board under
    // the finger (boards allow touch-action: pan-y). Taps are not swipes.
    let drag = null;
    let suppressClick = false;
    main.addEventListener('pointerdown', (event) => {
        if (!w || event.pointerType === 'mouse' || dialogOpen()) {
            return;
        }
        if (inertia) {
            inertia = null;
            target = current;
        }
        drag = {
            id: event.pointerId,
            x0: event.clientX,
            y0: event.clientY,
            last: event.clientX,
            active: false,
            samples: [{ t: event.timeStamp, x: event.clientX }]
        };
        noteInput();
    });
    main.addEventListener('pointermove', (event) => {
        if (!w || !drag || event.pointerId !== drag.id) {
            return;
        }
        const dx = event.clientX - drag.x0;
        const dy = event.clientY - drag.y0;
        if (!drag.active) {
            if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) {
                return;
            }
            if (Math.abs(dy) > Math.abs(dx)) {
                drag = null;            // vertical: native scrolling
                return;
            }
            drag.active = true;
            holding = true;
            direct = true;
            suppressClick = true;
            try {
                main.setPointerCapture(event.pointerId);
            } catch (e) {
                // Capture is optional.
            }
        }
        // Screen px to arc: dragging one board width walks one spacing.
        const gain = w.spacing / w.boardW;
        nudge(-(event.clientX - drag.last) * gain);
        drag.last = event.clientX;
        drag.samples.push({ t: event.timeStamp, x: event.clientX });
        while (drag.samples.length > 2 && event.timeStamp - drag.samples[0].t > 100) {
            drag.samples.shift();
        }
    });
    function endDrag(event) {
        if (!drag || event.pointerId !== drag.id) {
            return;
        }
        const finished = drag;
        drag = null;
        holding = false;
        direct = false;
        lastInput = performance.now();
        if (finished.active && w && event.type === 'pointerup') {
            const first = finished.samples[0];
            const lastSample = finished.samples[finished.samples.length - 1];
            const span = lastSample.t - first.t;
            const fresh = event.timeStamp - lastSample.t < 80;
            if (span > 8 && fresh) {
                const gain = w.spacing / w.boardW;
                let v = -((lastSample.x - first.x) / span) * 1000 * gain;
                const limit = (INERTIA_MAX * w.spacing) / INERTIA_TAU;
                v = Math.max(-limit, Math.min(limit, v));
                if (Math.abs(v) > INERTIA_STOP * 4) {
                    inertia = { v: v };
                }
            }
        }
        wake();
    }
    main.addEventListener('pointerup', endDrag);
    main.addEventListener('pointercancel', endDrag);
    main.addEventListener('click', (event) => {
        if (suppressClick) {
            suppressClick = false;
            event.preventDefault();
            event.stopPropagation();
        }
    }, true);

    // Keyboard focus anywhere inside a board brings that board into view.
    main.addEventListener('focusin', (event) => {
        if (!w || !event.target.closest) {
            return;
        }
        const board = event.target.closest('[data-stop]');
        if (!board) {
            return;
        }
        const i = sections.indexOf(board);
        if (i >= 0 && wrapIndex(Math.round(target / w.spacing)) !== i) {
            walkToIndex(i);
        }
    });

    // The browser may try to scroll the clipped stage to reveal a focused element.
    main.addEventListener('scroll', () => {
        main.scrollTop = 0;
        main.scrollLeft = 0;
    });

    // Links to a board (nav, logo) walk instead of jumping.
    document.addEventListener('click', (event) => {
        if (!w || event.defaultPrevented || !event.target.closest) {
            return;
        }
        const link = event.target.closest('a[href^="#"]');
        if (!link) {
            return;
        }
        const i = indexOfId(link.getAttribute('href').slice(1));
        if (i < 0) {
            return;
        }
        event.preventDefault();
        walkToIndex(i);
    });

    // "Start walking" on the start board.
    window.addEventListener('stickman:go', (event) => {
        const i = indexOfId(event.detail && event.detail.id);
        if (w && i >= 0) {
            event.preventDefault();
            walkToIndex(i);
        }
    });

    window.addEventListener('hashchange', () => {
        const i = indexOfId(window.location.hash.slice(1));
        if (w && i >= 0 && wrapIndex(Math.round(target / w.spacing)) !== i) {
            walkToIndex(i);
        }
    });

    // -----------------------------------------------------------------
    // Mode switching
    // -----------------------------------------------------------------
    function currentIndex() {
        if (w) {
            return wrapIndex(Math.round(target / w.spacing));
        }
        const fromHash = indexOfId(window.location.hash.slice(1));
        return fromHash >= 0 ? fromHash : 0;
    }

    function refresh() {
        const index = currentIndex();
        if (eligible()) {
            teardown();
            build(index);
        } else if (w) {
            teardown();
            sections[index].scrollIntoView({ behavior: 'instant', block: 'start' });
        }
    }

    // Resize: a small height-only change (mobile address bar) just moves the anchor;
    // anything else rebuilds.
    function reanchor(height) {
        w.vh = height;
        w.cy = height / 2;
        w.feetY = height - C_FEET;
        debug.feetY = w.feetY;
        main.style.setProperty('--stage-h', height + 'px');
        placePlayer();
        render(true);
    }

    let resizeTimer = 0;
    function onViewportChange() {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
            if (w && w.compact && isCompact() && eligible()) {
                const height = stageHeight();
                if (window.innerWidth === w.vw && Math.abs(height - w.builtH) < 80) {
                    reanchor(height);
                    return;
                }
            }
            refresh();
        }, 120);
    }
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', onViewportChange);
    }
    if (motionQuery.addEventListener) {
        motionQuery.addEventListener('change', refresh);
    }

    if (window.location.hash === '#experience-2') {
        try {
            history.replaceState(null, '', '#experience');
        } catch (e) {
            // Ignore; the board lookup below still understands the alias.
        }
        window.addEventListener('DOMContentLoaded', () => {
            if (!w) {
                document.getElementById('experience').scrollIntoView({ block: 'start' });
            }
        });
    }

    refresh();

    // Web fonts change the board heights; lay out again once they are in.
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            if (w) {
                refresh();
            }
        });
    }
})();
