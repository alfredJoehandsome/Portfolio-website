// HUD: position counter and hint, round minimap, and the sky nav row state.
const NS = 'http://www.w3.org/2000/svg';
const MAP_W = 84;
const C_MAP = 56;

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

function create(tag, className) {
    const node = document.createElement(tag);
    if (className) {
        node.className = className;
    }
    return node;
}

export function setNavMode(on) {
    const header = document.querySelector('.navbar');
    if (!header) {
        return;
    }
    header.querySelectorAll('.nav-links > li > a, .nav-links > li > .menu-btn').forEach((link) => {
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
    if (!on) {
        const row = document.querySelector('.nav-links');
        if (row) {
            row.classList.remove('nav-links--tight', 'nav-links--tighter');
        }
        const resume = document.querySelector('.nav-links .is-sky-resume');
        if (resume && resume.parentElement) {
            resume.parentElement.hidden = false;
        }
    }
}

// Resume leaves the row when the five buttons do not fit the screen width.
export function fitNavRow(vw) {
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

export function createHud(host, o) {
    // o: { sections, ids, compact, angles, count, hintGone, onGo(index), coarse }
    const hud = create('div', 'hud');
    const hint = create('p', 'hud__hint');
    hint.textContent = o.coarse ? 'Swipe sideways or use the arrows' : 'Scroll, use the arrows or press the arrow keys';
    if (o.hintGone) {
        hint.classList.add('is-gone');
    }
    const counter = create('p', 'hud__count');
    hud.appendChild(hint);
    hud.appendChild(counter);
    host.appendChild(hud);

    // Big previous / next buttons (one board per press), labelled with the neighbour's title.
    const titleOf = (i) => {
        const sec = o.sections[Math.max(0, Math.min(o.count - 1, i))];
        return sec.getAttribute('data-title') || sec.id;
    };
    function arrow(dir) {
        const wrap = create('div', 'arrow-wrap arrow-wrap--' + (dir < 0 ? 'prev' : 'next'));
        const btn = create('button', 'arrow');
        btn.type = 'button';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', dir < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7');
        svg.appendChild(path);
        btn.appendChild(svg);
        const label = create('span', 'arrow__label');
        label.setAttribute('aria-hidden', 'true');
        wrap.appendChild(btn);
        wrap.appendChild(label);
        // Pressing walks one board; holding walks on after a dwell on each board (see input.js).
        btn.addEventListener('pointerdown', (event) => {
            if (event.button === 0 || event.pointerType !== 'mouse') {
                o.onStep(dir);
                if (o.onHoldStart) {
                    o.onHoldStart(dir);
                }
            }
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => {
            btn.addEventListener(type, () => {
                if (o.onHoldEnd) {
                    o.onHoldEnd();
                }
            });
        });
        // A click with no pointer (Enter or Space on the focused button) still steps once.
        btn.addEventListener('click', (event) => {
            if (event.detail === 0) {
                o.onStep(dir);
            }
        });
        host.appendChild(wrap);
        return { wrap, btn, label };
    }
    const prevArrow = arrow(-1);
    const nextArrow = arrow(1);

    const map = create('div', 'minimap');
    map.setAttribute('role', 'group');
    map.setAttribute('aria-label', 'Site map');
    const size = o.compact ? C_MAP : MAP_W;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('aria-hidden', 'true');
    const ringR = size / 2 - 10;
    const island = document.createElementNS(NS, 'circle');
    island.setAttribute('class', 'minimap__island');
    island.setAttribute('cx', String(size / 2));
    island.setAttribute('cy', String(size / 2));
    island.setAttribute('r', String(size / 2 - 3));
    const sand = document.createElementNS(NS, 'circle');
    sand.setAttribute('class', 'minimap__sand');
    sand.setAttribute('cx', String(size / 2));
    sand.setAttribute('cy', String(size / 2));
    sand.setAttribute('r', String(ringR));
    svg.appendChild(island);
    svg.appendChild(sand);
    map.appendChild(svg);

    // Seen from above with the camera at the bottom: angle 0 is the bottom of the ring.
    const point = (a) => ({ x: size / 2 + ringR * Math.sin(a), y: size / 2 + ringR * Math.cos(a) });
    const dots = o.sections.map((section, i) => {
        const dot = create('button', 'minimap__dot');
        dot.type = 'button';
        dot.setAttribute('aria-label', section.getAttribute('data-title') || section.id);
        const p = point(o.angles[i]);
        dot.style.left = p.x + 'px';
        dot.style.top = p.y + 'px';
        dot.addEventListener('click', () => o.onGo(i));
        map.appendChild(dot);
        return dot;
    });
    // The little house in the gap between Contact and Start.
    const houseMark = document.createElementNS(NS, 'svg');
    houseMark.setAttribute('class', 'minimap__house');
    houseMark.setAttribute('viewBox', '0 0 12 12');
    houseMark.setAttribute('aria-hidden', 'true');
    const hp = document.createElementNS(NS, 'path');
    hp.setAttribute('d', 'M1.5 6 L6 1.8 L10.5 6 L9.4 6 L9.4 10.2 L2.6 10.2 L2.6 6 Z');
    houseMark.appendChild(hp);
    const hpos = point(o.houseAngle);
    houseMark.style.left = hpos.x + 'px';
    houseMark.style.top = hpos.y + 'px';
    map.appendChild(houseMark);
    const me = create('span', 'minimap__me');
    map.appendChild(me);
    host.appendChild(map);

    const navLinks = Array.from(document.querySelectorAll('.nav-links [data-nav].is-sky'));
    let shown = -1;

    function update(psi, index) {
        const p = point(psi);
        me.style.left = p.x + 'px';
        me.style.top = p.y + 'px';
        if (index === shown) {
            return;
        }
        shown = index;
        const section = o.sections[index];
        const title = section.getAttribute('data-title') || section.id;
        counter.textContent = o.compact ? index + 1 + ' / ' + o.count : index + 1 + ' / ' + o.count + ' · ' + title;
        const first = index <= 0;
        const last = index >= o.count - 1;
        const prevTitle = titleOf(index - 1);
        const nextTitle = last ? 'House' : titleOf(index + 1);
        prevArrow.wrap.hidden = first;
        prevArrow.btn.disabled = first;
        prevArrow.btn.setAttribute('aria-label', 'Previous: ' + prevTitle);
        nextArrow.btn.setAttribute('aria-label', 'Next: ' + nextTitle);
        prevArrow.label.textContent = prevTitle;
        nextArrow.label.textContent = nextTitle;
        dots.forEach((dot, i) => dot.classList.toggle('is-current', i === index));
        const navTarget = NAV_FOR[o.ids[index]];
        navLinks.forEach((link) => {
            if (link.getAttribute('data-nav') === navTarget) {
                link.setAttribute('aria-current', 'true');
            } else {
                link.removeAttribute('aria-current');
            }
        });
        return true;
    }

    return {
        update,
        hideHint() {
            hint.classList.add('is-gone');
        },
        dispose() {
            hud.remove();
            map.remove();
            prevArrow.wrap.remove();
            nextArrow.wrap.remove();
        }
    };
}
