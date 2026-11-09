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
    hint.textContent = o.coarse ? 'Swipe to walk' : 'Scroll or use the arrow keys to walk';
    if (o.hintGone) {
        hint.classList.add('is-gone');
    }
    const counter = create('p', 'hud__count');
    hud.appendChild(hint);
    hud.appendChild(counter);
    host.appendChild(hud);

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
    const me = create('span', 'minimap__me');
    map.appendChild(me);
    host.appendChild(map);

    const navLinks = Array.from(document.querySelectorAll('.nav-links a.is-sky'));
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
        counter.textContent = index + 1 + ' / ' + o.count + ' · ' + title;
        dots.forEach((dot, i) => dot.classList.toggle('is-current', i === index));
        const navTarget = NAV_FOR[o.ids[index]];
        navLinks.forEach((link) => {
            if (link.getAttribute('href') === '#' + navTarget) {
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
        }
    };
}
