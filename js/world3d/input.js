// Walking input and motion, ported from the v4 world: wheel steps, keys, swipe with inertia,
// soft magnet onto the nearest board, explicit walks (nav, minimap, focus, hash).
// All distances are arc length in px along the ring of boards; board i sits at i * spacing.
export const TUNING = {
    AXIS_LOCK: 8,            // px of finger travel before a swipe picks its axis
    INERTIA_TAU: 0.33,       // s, decay of a fling
    INERTIA_MAX: 1.5,        // spacings a fling may cover
    INERTIA_STOP: 40,        // px per second below which a fling ends
    WHEEL_PER_PX: 0.0012,    // board spacings walked per wheel pixel (100px = 0.12)
    MAX_STEP: 0.5,           // one wheel event never walks more than this many spacings
    SMOOTH_INPUT: 0.18,      // glide while the visitor is scrolling (per 1/60 s)
    SMOOTH_NAV: 0.12,        // glide for explicit navigation (per 1/60 s)
    CAPTURE: 0.1,            // magnet radius, as a fraction of the board spacing
    MAGNET_MS: 480,          // length of the magnet ease
    MAGNET_IDLE: 100,        // ms without input before the magnet may act
    WALK_ON: 40,             // px per second above which the character walks
    WALK_OFF: 15
};

// Older links: the two experience boards were merged into one.
const ALIASES = { 'experience-2': 'experience' };

export function createInput(host) {
    // host: { root, ids, count, onInput(), onArrive(index) }
    const T = TUNING;
    const ids = host.ids;
    const count = host.count;
    const root = host.root;
    let spacing = 1;
    let boardW = 1;
    let active = false;

    const s = {
        current: 0,
        target: 0,
        lastInput: 0,
        explicit: false,
        magnet: null,
        rate: 0.12,
        velocity: 0,
        walking: false,
        holding: false,
        inertia: null,
        direct: false
    };
    let drag = null;
    let suppressClick = false;

    const wrap = (i) => ((i % count) + count) % count;
    const indexOfId = (id) => ids.indexOf(ALIASES[id] || id);
    const dialogOpen = () => !!document.querySelector('dialog[open]');

    function noteInput() {
        s.lastInput = performance.now();
        host.onInput();
    }

    function nudge(distance) {
        if (!active) {
            return;
        }
        s.inertia = null;
        if (s.magnet) {
            s.target = s.current;
            s.magnet = null;
        }
        if (s.explicit) {
            s.target = s.current;
            s.explicit = false;
        }
        s.rate = T.SMOOTH_INPUT;
        s.target += distance;
        noteInput();
    }

    function goTo(newTarget) {
        if (!active) {
            return;
        }
        s.inertia = null;
        s.magnet = null;
        s.rate = T.SMOOTH_NAV;
        s.explicit = true;
        s.target = newTarget;
        noteInput();
    }

    function walkToIndex(i) {
        if (!active) {
            return;
        }
        const here = Math.round(s.target / spacing);
        let delta = wrap(i - here);
        if (delta > count / 2) {
            delta -= count;
        }
        goTo((here + delta) * spacing);
    }
    const walkNext = () => goTo((Math.floor(s.target / spacing + 1e-6) + 1) * spacing);
    const walkPrev = () => goTo((Math.ceil(s.target / spacing - 1e-6) - 1) * spacing);
    const targetIndex = () => wrap(Math.round(s.target / spacing));
    const currentIndex = () => wrap(Math.round(s.current / spacing));

    // One animation step. Returns true when the visitor just arrived on a board.
    function update(now, dt) {
        const before = s.current;
        let arrived = false;
        if (s.inertia) {
            s.current += s.inertia.v * dt;
            s.target = s.current;
            s.inertia.v *= Math.exp(-dt / T.INERTIA_TAU);
            s.lastInput = now;
            if (Math.abs(s.inertia.v) < T.INERTIA_STOP) {
                s.inertia = null;
            }
        } else if (s.direct) {
            s.current = s.target;
        } else if (s.magnet) {
            const t = Math.min(1, (now - s.magnet.t0) / T.MAGNET_MS);
            const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            s.current = s.magnet.from + (s.magnet.to - s.magnet.from) * eased;
            if (t >= 1) {
                s.current = s.target = s.magnet.to;
                s.magnet = null;
                arrived = true;
            }
        } else {
            const gap = s.target - s.current;
            if (Math.abs(gap) < 0.5) {
                s.current = s.target;
            } else {
                s.current += gap * (1 - Math.pow(1 - s.rate, dt * 60));
            }
            if (s.explicit && s.current === s.target) {
                s.explicit = false;
                arrived = true;
            } else if (!s.explicit && !s.holding && now - s.lastInput >= T.MAGNET_IDLE &&
                       Math.abs(s.target - s.current) < 30) {
                // Soft magnet: only when the stop is close to a board.
                const k = Math.round(s.current / spacing);
                const board = k * spacing;
                if (Math.abs(s.current - board) <= T.CAPTURE * spacing) {
                    if (Math.abs(s.current - board) < 0.5) {
                        s.current = s.target = board;
                        arrived = true;
                    } else {
                        s.magnet = { from: s.current, to: board, t0: now };
                        s.target = board;
                    }
                }
            }
        }
        // Walk cycle follows the real speed.
        const speed = dt > 0 ? (s.current - before) / dt : 0;
        s.velocity += (speed - s.velocity) * 0.35;
        const abs = Math.abs(s.velocity);
        if (!s.walking && abs > T.WALK_ON) {
            s.walking = true;
        } else if (s.walking && abs < T.WALK_OFF) {
            s.walking = false;
        }
        if (arrived) {
            host.onArrive(wrap(Math.round(s.current / spacing)));
        }
        return arrived;
    }

    // ---- listeners ------------------------------------------------------------------
    function onWheel(event) {
        if (!active || event.ctrlKey || dialogOpen()) {
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
        const limit = T.MAX_STEP * spacing;
        nudge(Math.max(-limit, Math.min(limit, d * T.WHEEL_PER_PX * spacing)));
    }

    function onKey(event) {
        if (!active || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
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
    }

    // Touch and pen: a horizontal swipe walks, 1:1 with the finger, and coasts after
    // release. A vertical swipe is left to the browser, which scrolls the board under
    // the finger (boards allow touch-action: pan-y). Taps are not swipes.
    function onPointerDown(event) {
        if (!active || event.pointerType === 'mouse' || dialogOpen()) {
            return;
        }
        if (event.target.closest && event.target.closest('[data-no-walk]')) {
            return;
        }
        suppressClick = false;
        if (s.inertia) {
            s.inertia = null;
            s.target = s.current;
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
    }

    function onPointerMove(event) {
        if (!active || !drag || event.pointerId !== drag.id) {
            return;
        }
        const dx = event.clientX - drag.x0;
        const dy = event.clientY - drag.y0;
        if (!drag.active) {
            if (Math.abs(dx) < T.AXIS_LOCK && Math.abs(dy) < T.AXIS_LOCK) {
                return;
            }
            if (Math.abs(dy) > Math.abs(dx)) {
                drag = null;            // vertical: native scrolling
                return;
            }
            drag.active = true;
            s.holding = true;
            s.direct = true;
            suppressClick = true;
            try {
                root.setPointerCapture(event.pointerId);
            } catch (e) {
                // Capture is optional.
            }
        }
        // Screen px to arc: dragging one board width walks one spacing.
        const gain = spacing / boardW;
        nudge(-(event.clientX - drag.last) * gain);
        drag.last = event.clientX;
        drag.samples.push({ t: event.timeStamp, x: event.clientX });
        while (drag.samples.length > 2 && event.timeStamp - drag.samples[0].t > 100) {
            drag.samples.shift();
        }
    }

    function endDrag(event) {
        if (!drag || event.pointerId !== drag.id) {
            return;
        }
        const finished = drag;
        drag = null;
        s.holding = false;
        s.direct = false;
        s.lastInput = performance.now();
        if (finished.active) {
            // A drag produces no click on touch; do not let a stale flag eat the next tap.
            window.setTimeout(() => {
                suppressClick = false;
            }, 60);
        }
        if (finished.active && active && event.type === 'pointerup') {
            const first = finished.samples[0];
            const last = finished.samples[finished.samples.length - 1];
            const span = last.t - first.t;
            const fresh = event.timeStamp - last.t < 80;
            if (span > 8 && fresh) {
                const gain = spacing / boardW;
                let v = -((last.x - first.x) / span) * 1000 * gain;
                const limit = (T.INERTIA_MAX * spacing) / T.INERTIA_TAU;
                v = Math.max(-limit, Math.min(limit, v));
                if (Math.abs(v) > T.INERTIA_STOP * 4) {
                    s.inertia = { v: v };
                }
            }
        }
    }

    function onClickCapture(event) {
        if (suppressClick) {
            suppressClick = false;
            event.preventDefault();
            event.stopPropagation();
        }
    }

    // Keyboard focus anywhere inside a board brings that board into view.
    function onFocusIn(event) {
        if (!active || !event.target.closest) {
            return;
        }
        const board = event.target.closest('[data-stop]');
        if (!board) {
            return;
        }
        const i = ids.indexOf(board.id);
        if (i >= 0 && targetIndex() !== i) {
            walkToIndex(i);
        }
    }

    // The browser may try to scroll the clipped stage to reveal a focused element.
    function onScrollReset(event) {
        const el = event.target;
        if (el === root || (el && el.classList && (el.classList.contains('stage') || el.classList.contains('stage__css')))) {
            el.scrollTop = 0;
            el.scrollLeft = 0;
        }
    }

    // Links to a board (nav, logo) walk instead of jumping.
    function onDocClick(event) {
        if (!active || event.defaultPrevented || !event.target.closest) {
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
    }

    function onGo(event) {
        const i = indexOfId(event.detail && event.detail.id);
        if (active && i >= 0) {
            event.preventDefault();
            walkToIndex(i);
        }
    }

    function onHash() {
        const i = indexOfId(window.location.hash.slice(1));
        if (active && i >= 0 && targetIndex() !== i) {
            walkToIndex(i);
        }
    }

    const listeners = [
        [window, 'wheel', onWheel, { passive: false }],
        [window, 'keydown', onKey],
        [root, 'pointerdown', onPointerDown],
        [root, 'pointermove', onPointerMove],
        [root, 'pointerup', endDrag],
        [root, 'pointercancel', endDrag],
        [root, 'click', onClickCapture, true],
        [root, 'focusin', onFocusIn],
        [root, 'scroll', onScrollReset, true],
        [document, 'click', onDocClick],
        [window, 'character:go', onGo],
        [window, 'hashchange', onHash]
    ];

    return {
        state: s,
        indexOfId,
        update,
        walkToIndex,
        currentIndex,
        targetIndex,
        configure(p) {
            spacing = p.spacing;
            boardW = p.boardW;
        },
        place(index) {
            s.current = s.target = index * spacing;
            s.explicit = false;
            s.magnet = null;
            s.inertia = null;
            s.velocity = 0;
            s.walking = false;
        },
        attach() {
            active = true;
            listeners.forEach((l) => l[0].addEventListener(l[1], l[2], l[3]));
        },
        detach() {
            active = false;
            listeners.forEach((l) => l[0].removeEventListener(l[1], l[2], l[3]));
            drag = null;
        }
    };
}
