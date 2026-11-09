// Stickman, hats, character creator and the walking player.
// Loaded before world.js. Exposes window.Stickman for the world script.
(function () {
    'use strict';

    // -----------------------------------------------------------------
    // Hats are data. Every hat is drawn around the head centre (0, 0) with
    // the head radius being 9, so the top of the head is at y = -9. To add a
    // hat, push one more object to this list.
    // -----------------------------------------------------------------
    const HATS = [
        {
            id: 'none',
            name: 'No hat',
            svg: ''
        },
        {
            id: 'cap',
            name: 'Cap',
            svg: '<path class="h-acc" d="M-9.6 -2.6 A9.6 9.6 0 0 1 9.6 -2.6 Z"/>' +
                 '<path class="h-acc" d="M0 -4.2 H13.5 A1.7 1.7 0 0 1 13.5 -0.8 H0 Z"/>' +
                 '<circle class="h-acc" cx="0" cy="-12.4" r="1.5"/>'
        },
        {
            id: 'top-hat',
            name: 'Top hat',
            svg: '<rect class="h-txt" x="-7" y="-23" width="14" height="16" rx="1"/>' +
                 '<rect class="h-acc" x="-7" y="-13.2" width="14" height="3.6"/>' +
                 '<rect class="h-txt" x="-12" y="-8.4" width="24" height="3.2" rx="1.4"/>'
        },
        {
            id: 'wizard',
            name: 'Wizard hat',
            svg: '<path class="h-acc" d="M-8.4 -6.4 Q-5 -12 -3 -19 Q-1 -26 5 -29 Q4.4 -24.6 7 -19 Q9 -12 8.4 -6.4 Z"/>' +
                 '<ellipse class="h-acc" cx="0" cy="-6" rx="13" ry="2.8"/>' +
                 '<path class="h-txt" d="M0 -17.6 L1.1 -15.1 L3.8 -14.8 L1.8 -13 L2.4 -10.4 L0 -11.7 L-2.4 -10.4 L-1.8 -13 L-3.8 -14.8 L-1.1 -15.1 Z"/>'
        },
        {
            id: 'crown',
            name: 'Crown',
            svg: '<path class="h-gold" d="M-8.6 -6.2 L-9.8 -19 L-4.6 -13 L0 -20.6 L4.6 -13 L9.8 -19 L8.6 -6.2 Z"/>' +
                 '<circle class="h-acc" cx="0" cy="-10.4" r="1.6"/>' +
                 '<circle class="h-gold" cx="-9.8" cy="-19.4" r="1.5"/>' +
                 '<circle class="h-gold" cx="0" cy="-21" r="1.5"/>' +
                 '<circle class="h-gold" cx="9.8" cy="-19.4" r="1.5"/>'
        },
        {
            id: 'party',
            name: 'Party hat',
            svg: '<path class="h-acc" d="M-8 -6.4 L0 -26 L8 -6.4 Z"/>' +
                 '<path class="h-txt" d="M-4.6 -14.8 L4.6 -14.8 L5.8 -11.8 L-5.8 -11.8 Z"/>' +
                 '<circle class="h-txt" cx="0" cy="-27" r="2.6"/>'
        },
        {
            id: 'viking',
            name: 'Viking helmet',
            svg: '<path class="h-txt" d="M-9 -5.6 Q-14.6 -9 -14.2 -18.6 Q-11.2 -13 -7.6 -11.4 Z"/>' +
                 '<path class="h-txt" d="M9 -5.6 Q14.6 -9 14.2 -18.6 Q11.2 -13 7.6 -11.4 Z"/>' +
                 '<path class="h-mut" d="M-9.6 -4.6 A9.6 9.6 0 0 1 9.6 -4.6 Z"/>' +
                 '<rect class="h-txt" x="-9.8" y="-5.4" width="19.6" height="2.4" rx="1"/>'
        },
        {
            id: 'propeller',
            name: 'Propeller beanie',
            svg: '<path class="h-acc" d="M-9.4 -3.6 A9.4 9.4 0 0 1 9.4 -3.6 Z"/>' +
                 '<rect class="h-txt" x="-0.9" y="-16.2" width="1.8" height="5"/>' +
                 '<g class="hat-prop"><ellipse class="h-txt" cx="0" cy="-17" rx="9" ry="1.7"/></g>'
        },
        {
            id: 'pizza',
            name: 'Pizza slice',
            svg: '<path class="h-cheese" d="M-9 -5.4 L0 -24.6 L9 -5.4 Z"/>' +
                 '<path class="h-pep" d="M-9.6 -7.4 Q0 -4.4 9.6 -7.4 L9.2 -4.6 Q0 -1.6 -9.2 -4.6 Z"/>' +
                 '<circle class="h-pep" cx="-0.6" cy="-16" r="2"/>' +
                 '<circle class="h-pep" cx="-2.8" cy="-10.6" r="1.7"/>' +
                 '<circle class="h-pep" cx="3.2" cy="-10.8" r="1.7"/>'
        }
    ];

    const STORAGE_KEY = 'stickmanHat';
    const DEFAULT_HAT = 'cap';

    function hatById(id) {
        return HATS.find((hat) => hat.id === id) || null;
    }

    function readStoredHat() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored && hatById(stored)) {
                return stored;
            }
        } catch (e) {
            // Local storage can be blocked; fall through to the default.
        }
        return DEFAULT_HAT;
    }

    let currentId = readStoredHat();
    const listeners = [];

    // The figure is a 60 x 100 box. Head centre is at (30, 26), shoulders at
    // y = 41, hips at y = 66 and the feet end at about y = 98.
    function buildSvg() {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('class', 'sm');
        svg.setAttribute('viewBox', '0 0 60 100');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        svg.innerHTML =
            '<g class="sm__body">' +
                '<g class="sm__arm sm__arm--l"><line x1="30" y1="41" x2="30" y2="63"/></g>' +
                '<g class="sm__arm sm__arm--r"><line x1="30" y1="41" x2="30" y2="63"/></g>' +
                '<g class="sm__leg sm__leg--l"><line x1="30" y1="66" x2="30" y2="99"/></g>' +
                '<g class="sm__leg sm__leg--r"><line x1="30" y1="66" x2="30" y2="99"/></g>' +
                '<line x1="30" y1="35" x2="30" y2="66"/>' +
                '<circle cx="30" cy="26" r="9"/>' +
                '<g class="sm__hat" transform="translate(30 26)"></g>' +
            '</g>';
        return svg;
    }

    function paintHat(svg) {
        const hat = hatById(currentId);
        const slot = svg.querySelector('.sm__hat');
        if (slot) {
            slot.innerHTML = hat ? hat.svg : '';
        }
    }

    const instances = [];

    function createFigure(container) {
        const svg = buildSvg();
        container.appendChild(svg);
        paintHat(svg);
        instances.push(svg);
        return svg;
    }

    function setHat(id) {
        if (!hatById(id)) {
            return;
        }
        currentId = id;
        try {
            localStorage.setItem(STORAGE_KEY, id);
        } catch (e) {
            // Not persisted, still works for this visit.
        }
        instances.forEach(paintHat);
        listeners.forEach((fn) => fn(hatById(id)));
    }

    window.Stickman = {
        HATS: HATS,
        getHat: () => hatById(currentId),
        setHat: setHat,
        onChange: (fn) => listeners.push(fn)
    };

    // -----------------------------------------------------------------
    // Character creator on the start board
    // -----------------------------------------------------------------
    const preview = document.querySelector('[data-stickman-preview]');
    if (preview) {
        createFigure(preview);
        const nameEl = document.querySelector('[data-hat-name]');
        const prev = document.querySelector('[data-hat-prev]');
        const next = document.querySelector('[data-hat-next]');
        const go = document.querySelector('[data-start-walking]');

        const showName = () => {
            if (nameEl) {
                nameEl.textContent = hatById(currentId).name;
            }
        };
        showName();
        listeners.push(showName);

        const step = (delta) => {
            const index = HATS.findIndex((hat) => hat.id === currentId);
            setHat(HATS[(index + delta + HATS.length) % HATS.length].id);
        };
        if (prev) {
            prev.addEventListener('click', () => step(-1));
        }
        if (next) {
            next.addEventListener('click', () => step(1));
        }
        if (go) {
            go.addEventListener('click', () => {
                // The world script handles this event and cancels it. If it is
                // not running, fall back to a normal scroll.
                const handled = !window.dispatchEvent(
                    new CustomEvent('stickman:go', { detail: { id: 'murmurs' }, cancelable: true })
                );
                if (!handled) {
                    const target = document.getElementById('murmurs');
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            });
        }
    }

    // -----------------------------------------------------------------
    // The player. Fixed on screen, driven by world.js in world mode and by
    // the page scroll in the vertical layout.
    // -----------------------------------------------------------------
    const player = document.createElement('div');
    player.className = 'player';
    player.setAttribute('aria-hidden', 'true');
    const flip = document.createElement('div');
    flip.className = 'player__flip';
    player.appendChild(flip);
    createFigure(flip);
    document.body.appendChild(player);

    // Vertical layout: walk while scrolling, face the scroll direction.
    let lastY = window.scrollY;
    let stopTimer = 0;
    window.addEventListener('scroll', () => {
        if (document.documentElement.classList.contains('world-mode')) {
            return;
        }
        const y = window.scrollY;
        if (y !== lastY) {
            player.classList.toggle('is-flipped', y < lastY);
            player.classList.add('is-walking');
            lastY = y;
            window.clearTimeout(stopTimer);
            stopTimer = window.setTimeout(() => player.classList.remove('is-walking'), 150);
        }
    }, { passive: true });
})();
