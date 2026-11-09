// Walking input and motion. The visitor only ever rests ON a board: every input moves exactly
// one board (or jumps to a chosen one) with a glide in between. Wheel gestures, swipes, keys,
// arrow buttons, nav links, the minimap and focus all end in goTo().
// All distances are arc length in px along the ring of boards; board i sits at i * spacing.
export const TUNING = {
    SWIPE_LOCK: 8,           // px of finger travel before a swipe picks its axis
    SWIPE_STEP: 44,          // px of horizontal travel that walks one board
    WHEEL_STEP: 60,          // accumulated wheel px that walks one board
    HOLD_DWELL: 700,         // ms spent on a board before a held key/button/click walks on
    WHEEL_IDLE: 200,         // ms of wheel silence that ends a gesture (and unlocks the next)
    SMOOTH_NAV: 0.12,        // glide per 1/60 s
    WALK_ON: 40,             // px per second above which the character walks
    WALK_OFF: 15
};

// Older links: the two experience boards were merged into one.
const ALIASES = { 'experience-2': 'experience' };

export function createInput(host) {
    // host: { root, ids, count, onInput(), onArrive(index), scroller() -> the settled board's
    //         scrolling element or null, isEmpty(el) -> is this the empty world, onHover(side) }
    const T = TUNING;
    const ids = host.ids;
    const count = host.count;
    const root = host.root;
    let spacing = 1;
    let active = false;

    const s = {
        current: 0,
        target: 0,
        explicit: false,
        rate: T.SMOOTH_NAV,
        velocity: 0,
        walking: false,
        holding: false
    };
    let drag = null;
    let suppressClick = false;
    const wheel = { last: 0, acc: 0, locked: false, scrolled: false };

    const indexOfId = (id) => ids.indexOf(ALIASES[id] || id);
    const dialogOpen = () => !!document.querySelector('dialog[open]');

    // The road has two ends (Start and Contact, with the house between them): positions are
    // clamped, never wrapped, so no walk can pass through the house.
    const lastIndex = () => count - 1;
    function goTo(rawTarget) {
        if (!active) {
            return;
        }
        const newTarget = Math.max(0, Math.min(lastIndex() * spacing, rawTarget));
        if (host.onNavigate) {
            host.onNavigate();
        }
        s.rate = T.SMOOTH_NAV;
        s.explicit = true;
        s.target = newTarget;
        host.onInput();
    }

    function walkToIndex(i) {
        if (!active) {
            return;
        }
        goTo(Math.max(0, Math.min(lastIndex(), i)) * spacing);
    }
    const hereIndex = () => Math.max(0, Math.min(lastIndex(), Math.round(s.target / spacing)));
    function stepBy(n) {
        if (!active) {
            return;
        }
        const to = hereIndex() + n;
        if (to > lastIndex()) {
            if (host.onBeyond) {
                host.onBeyond();
            }
            return;
        }
        if (to < 0) {
            if (host.onBlocked) {
                host.onBlocked();
            }
            return;
        }
        goTo(to * spacing);
    }

    // Holding a key, an arrow button or the mouse on the empty world: walk one board, arrive,
    // dwell HOLD_DWELL ms, and walk on only if it is still held. Releasing stops at the board
    // being walked to. Key auto-repeat is ignored entirely.
    const hold = { src: null, dir: 0, timer: 0 };
    function holdStart(src, dir) {
        hold.src = src;
        hold.dir = dir;
        window.clearTimeout(hold.timer);
        hold.timer = 0;
    }
    function holdEnd(src) {
        if (src && hold.src !== src) {
            return;
        }
        hold.src = null;
        hold.dir = 0;
        window.clearTimeout(hold.timer);
        hold.timer = 0;
    }
    function holdArrived() {
        if (!hold.src) {
            return;
        }
        window.clearTimeout(hold.timer);
        hold.timer = window.setTimeout(() => {
            hold.timer = 0;
            if (hold.src && !s.explicit) {
                stepBy(hold.dir);
            }
        }, T.HOLD_DWELL);
    }
    const walkNext = () => stepBy(1);
    const walkPrev = () => stepBy(-1);
    const targetIndex = () => hereIndex();
    const currentIndex = () => Math.max(0, Math.min(lastIndex(), Math.round(s.current / spacing)));

    // Can the settled board's content still scroll in this direction (1 down, -1 up)?
    function canScroll(dir) {
        const sec = host.scroller();
        if (!sec) {
            return false;
        }
        return dir > 0 ? sec.scrollTop + sec.clientHeight < sec.scrollHeight - 1 : sec.scrollTop > 1;
    }

    // One animation step. Returns true when the visitor just arrived on a board.
    function update(now, dt) {
        const before = s.current;
        let arrived = false;
        const gap = s.target - s.current;
        if (Math.abs(gap) < 0.5) {
            s.current = s.target;
            if (s.explicit) {
                s.explicit = false;
                arrived = true;
            }
        } else {
            s.current += gap * (1 - Math.pow(1 - s.rate, dt * 60));
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
            host.onArrive(currentIndex());
            holdArrived();
        }
        return arrived;
    }

    // ---- listeners ------------------------------------------------------------------
    // Wheel: read first, walk second. Content that can still scroll scrolls (natively when the
    // pointer is over it). A new gesture at the edge walks exactly one board; trackpad momentum
    // can never skip several because input is ignored until the walk ends and the wheel has
    // been silent for WHEEL_IDLE ms.
    function onWheel(event) {
        if (!active || event.ctrlKey || dialogOpen()) {
            return;
        }
        // The time the wheel actually turned, not when a busy frame got round to it.
        const now = event.timeStamp > 0 && event.timeStamp <= performance.now() + 1 ? event.timeStamp : performance.now();
        let dx = event.deltaX;
        let dy = event.deltaY;
        if (event.deltaMode === 1) {
            dx *= 16;
            dy *= 16;
        } else if (event.deltaMode === 2) {
            dx *= window.innerHeight;
            dy *= window.innerHeight;
        }
        const idle = now - wheel.last >= T.WHEEL_IDLE;
        wheel.last = now;
        if (idle) {
            wheel.acc = 0;
            wheel.scrolled = false;
            if (wheel.locked && !s.explicit) {
                wheel.locked = false;
            }
        }
        if (wheel.locked) {
            if (!s.explicit && idle) {
                wheel.locked = false;
            } else {
                event.preventDefault();
                return;
            }
        }
        const horizontal = Math.abs(dx) > Math.abs(dy);
        const d = horizontal ? dx : dy;
        if (d === 0) {
            return;
        }
        const dir = d > 0 ? 1 : -1;
        if (!horizontal) {
            const sec = host.scroller();
            if (canScroll(dir)) {
                wheel.scrolled = true;
                if (!(sec && sec.contains(event.target))) {
                    event.preventDefault();
                    sec.scrollTop += d;
                }
                host.onInput();
                return;
            }
            if (wheel.scrolled) {
                // The same gesture just ran into the edge: that was reading, not a request to walk.
                event.preventDefault();
                return;
            }
        }
        event.preventDefault();
        if (wheel.acc !== 0 && Math.sign(wheel.acc) !== dir) {
            wheel.acc = 0;
        }
        wheel.acc += d;
        if (Math.abs(wheel.acc) >= T.WHEEL_STEP) {
            wheel.acc = 0;
            wheel.locked = true;
            stepBy(dir);
        }
    }

    function onKey(event) {
        if (!active || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }
        if (dialogOpen()) {
            return;
        }
        const el = event.target;
        if (el && el.closest && el.closest('input, textarea, select, [contenteditable], dialog, .submenu')) {
            return;
        }
        const letter = event.key.length === 1 && event.key !== ' ';
        if (letter && event.shiftKey) {
            return;
        }
        const key = letter ? event.key.toLowerCase() : event.key;
        const holdId = 'key:' + key;
        const interactive = !!(el && el.closest && el.closest('a, button, summary'));
        // Up, down, page keys and space read the board first, then walk.
        const vertical = (dir, amount) => {
            if (canScroll(dir)) {
                host.scroller().scrollBy({ top: dir * amount(host.scroller()), behavior: 'smooth' });
            } else if (event.repeat) {
                return;
            } else {
                holdStart(holdId, dir);
                stepBy(dir);
            }
        };
        const page = (sec) => sec.clientHeight * 0.85;
        const line = () => 64;
        switch (key) {
            case 'ArrowRight':
            case 'd':
            case 's':
                if (!event.repeat) {
                    holdStart(holdId, 1);
                    walkNext();
                }
                break;
            case 'ArrowLeft':
            case 'a':
            case 'w':
                if (!event.repeat) {
                    holdStart(holdId, -1);
                    walkPrev();
                }
                break;
            case 'ArrowDown':
                vertical(1, line);
                break;
            case 'ArrowUp':
                vertical(-1, line);
                break;
            case 'PageDown':
                vertical(1, page);
                break;
            case 'PageUp':
                vertical(-1, page);
                break;
            case ' ':
                // Space presses a focused button or link; only walk from the page itself.
                if (interactive) {
                    return;
                }
                vertical(event.shiftKey ? -1 : 1, page);
                break;
            case 'Home':
                if (event.repeat) {
                    break;
                }
                walkToIndex(0);
                break;
            case 'End':
                if (event.repeat) {
                    break;
                }
                walkToIndex(count - 1);
                break;
            default:
                return;
        }
        event.preventDefault();
    }

    function onKeyUp(event) {
        const letter = event.key.length === 1 && event.key !== ' ';
        holdEnd('key:' + (letter ? event.key.toLowerCase() : event.key));
    }

    // Touch and pen: a horizontal swipe walks one board (previous or next). A vertical swipe is
    // left to the browser, which scrolls the board under the finger. Taps are not swipes.
    function onPointerDown(event) {
        if (!active || event.pointerType === 'mouse' || dialogOpen()) {
            return;
        }
        if (event.target.closest && event.target.closest('[data-no-walk]')) {
            return;
        }
        suppressClick = false;
        drag = { id: event.pointerId, x0: event.clientX, y0: event.clientY, fired: false };
        host.onInput();
    }

    function onPointerMove(event) {
        if (!active || !drag || event.pointerId !== drag.id || drag.fired) {
            return;
        }
        const dx = event.clientX - drag.x0;
        const dy = event.clientY - drag.y0;
        if (Math.abs(dx) < T.SWIPE_LOCK && Math.abs(dy) < T.SWIPE_LOCK) {
            return;
        }
        if (Math.abs(dy) > Math.abs(dx)) {
            drag = null;            // vertical: native scrolling
            return;
        }
        suppressClick = true;
        if (Math.abs(dx) >= T.SWIPE_STEP) {
            drag.fired = true;
            if (dx < 0) {
                walkNext();
            } else {
                walkPrev();
            }
            try {
                root.setPointerCapture(event.pointerId);
            } catch (e) {
                // Capture is optional.
            }
        }
    }

    function endDrag(event) {
        if (!drag || event.pointerId !== drag.id) {
            return;
        }
        const was = drag;
        drag = null;
        if (was.fired || suppressClick) {
            // A swipe produces no click on touch; do not let a stale flag eat the next tap.
            window.setTimeout(() => {
                suppressClick = false;
            }, 60);
        }
    }

    // Clicking (mouse) or tapping (touch: under 8px of movement and 300ms) the empty world walks
    // to that side: left of the screen centre is the previous board, right is the next.
    let tap = null;
    let tapAt = -1000;
    const sideOf = (x) => (x < window.innerWidth / 2 ? -1 : 1);

    let mouseHeld = false;
    function onTapDown(event) {
        if (event.pointerType === 'mouse') {
            // The mouse acts on press so it can be held: one board, a dwell, the next if still down.
            if (event.button === 0 && active && !dialogOpen() && host.isEmpty(event.target)) {
                mouseHeld = true;
                const dir = sideOf(event.clientX);
                holdStart('ptr', dir);
                stepBy(dir);
            }
            return;
        }
        tap = { id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp };
    }

    function onTapMove(event) {
        if (tap && tap.id === event.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) >= 8) {
            tap = null;
        }
    }

    function onTapUp(event) {
        if (!tap || tap.id !== event.pointerId) {
            return;
        }
        const t = tap;
        tap = null;
        if (!active || dialogOpen() || event.timeStamp - t.t >= 300) {
            return;
        }
        if (Math.hypot(event.clientX - t.x, event.clientY - t.y) >= 8 || !host.isEmpty(event.target)) {
            return;
        }
        tapAt = performance.now();
        stepBy(sideOf(event.clientX));
    }

    function onMouseUp() {
        holdEnd('ptr');
    }

    function onWorldClick(event) {
        if (!active || dialogOpen() || event.defaultPrevented) {
            return;
        }
        if (mouseHeld) {
            mouseHeld = false;           // the press already walked
            return;
        }
        if (event.pointerType === 'touch' || event.pointerType === 'pen' || performance.now() - tapAt < 700) {
            return;
        }
        if (!host.isEmpty(event.target)) {
            return;
        }
        stepBy(sideOf(event.clientX));
    }

    function onHover(event) {
        if (event.pointerType && event.pointerType !== 'mouse') {
            return;
        }
        const empty = active && !dialogOpen() && host.isEmpty(event.target);
        host.onHover(empty ? sideOf(event.clientX) : 0);
    }

    function onLeave() {
        host.onHover(0);
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
        [window, 'keyup', onKeyUp],
        [window, 'blur', () => holdEnd()],
        [window, 'pointerup', onMouseUp],
        [window, 'pointercancel', onMouseUp],
        [root, 'pointerdown', onPointerDown],
        [root, 'pointermove', onPointerMove],
        [root, 'pointerup', endDrag],
        [root, 'pointercancel', endDrag],
        [root, 'click', onClickCapture, true],
        [root, 'click', onWorldClick],
        [root, 'pointerdown', onTapDown],
        [root, 'pointermove', onTapMove],
        [root, 'pointerup', onTapUp],
        [root, 'pointermove', onHover],
        [root, 'pointerleave', onLeave],
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
        step: stepBy,
        currentIndex,
        targetIndex,
        configure(p) {
            spacing = p.spacing;
        },
        holdStart,
        holdEnd,
        place(index) {
            s.current = s.target = index * spacing;
            s.explicit = false;
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
