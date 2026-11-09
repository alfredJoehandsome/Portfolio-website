// Phones: the settled board is shown in a plain 2D overlay (no 3D transform) exactly over its
// panel, so scrolling inside it is native (momentum, overscroll containment). The real DOM
// node is moved in and out, so links, Details buttons and the creator keep working. While the
// world moves the node goes back into the CSS3D board.
export function createOverlay(main, boards, L) {
    const el = document.createElement('div');
    el.className = 'board-overlay';
    el.hidden = true;
    const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    // "More": shown until the visitor has scrolled that board at all.
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'board-more';
    chip.tabIndex = -1;
    chip.hidden = true;
    chip.setAttribute('aria-label', 'Scroll down');
    chip.appendChild(document.createTextNode('More '));
    const ns = 'http://www.w3.org/2000/svg';
    const chev = document.createElementNS(ns, 'svg');
    chev.setAttribute('viewBox', '0 0 12 12');
    chev.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M2 4l4 4 4-4');
    chev.appendChild(p);
    chip.appendChild(chev);
    el.appendChild(chip);

    // At the end of a board that overflows: say how to get to the next one.
    const end = document.createElement('p');
    end.className = 'board-end';
    end.hidden = true;
    end.textContent = coarse ? 'Swipe sideways for the next board' : 'Scroll again for the next board';
    el.appendChild(end);
    main.appendChild(el);

    let open = -1;
    let memo = { index: -1, top: 0 };
    const scrolled = new Set();

    function section() {
        return open >= 0 ? boards[open].section : null;
    }

    function updateChip() {
        const sec = section();
        if (!sec) {
            chip.hidden = true;
            end.hidden = true;
            el.classList.remove('has-more');
            return;
        }
        const left = sec.scrollHeight - sec.clientHeight - sec.scrollTop;
        const overflow = sec.scrollHeight - sec.clientHeight > 6;
        const room = left > 6;
        const show = room && !scrolled.has(open);
        chip.hidden = !show;
        end.hidden = !(overflow && !room);
        el.classList.toggle('has-more', show || (overflow && !room));
    }

    function onScroll() {
        const sec = section();
        if (sec && sec.scrollTop > 2) {
            scrolled.add(open);
        }
        updateChip();
    }

    function onImg() {
        updateChip();
    }

    // A finger that starts on the chip still scrolls the board (the chip is not inside the
    // scroller); the chip goes away with the first scroll, so this only covers that one drag.
    let chipDrag = null;
    chip.addEventListener('pointerdown', (event) => {
        chipDrag = { id: event.pointerId, y: event.clientY, moved: false };
        try {
            chip.setPointerCapture(event.pointerId);
        } catch (e) {
            // Optional.
        }
    });
    chip.addEventListener('pointermove', (event) => {
        const sec = section();
        if (!chipDrag || chipDrag.id !== event.pointerId || !sec) {
            return;
        }
        const dy = event.clientY - chipDrag.y;
        if (Math.abs(dy) > 4) {
            chipDrag.moved = true;
        }
        if (chipDrag.moved) {
            sec.scrollTop -= event.clientY - chipDrag.y;
            chipDrag.y = event.clientY;
            event.stopPropagation();
        }
    });
    const chipEnd = (event) => {
        if (chipDrag && chipDrag.id === event.pointerId) {
            const moved = chipDrag.moved;
            chipDrag = null;
            if (moved) {
                chip.dataset.dragged = '1';
                window.setTimeout(() => delete chip.dataset.dragged, 80);
            }
        }
    };
    chip.addEventListener('pointerup', chipEnd);
    chip.addEventListener('pointercancel', chipEnd);

    chip.addEventListener('click', () => {
        if (chip.dataset.dragged) {
            return;
        }
        const sec = section();
        if (sec) {
            sec.scrollBy({ top: sec.clientHeight * 0.8, behavior: 'smooth' });
        }
    });

    function show(i) {
        if (open === i) {
            return;
        }
        hide();
        // Boards that were left behind start from the top again.
        if (memo.index !== i) {
            memo = { index: -1, top: 0 };
            scrolled.clear();
            boards.forEach((b) => {
                if (b.index !== i && b.section.scrollTop) {
                    b.section.scrollTop = 0;
                }
            });
        }
        const sec = boards[i].section;
        const fit = boards[i].fit;
        el.style.left = Math.round((L.vw - fit.w) / 2) + 'px';
        el.style.top = fit.topPx + 'px';
        el.style.width = Math.round(fit.w) + 'px';
        el.style.height = Math.round(fit.h) + 'px';
        const focused = sec.contains(document.activeElement) ? document.activeElement : null;
        el.insertBefore(sec, chip);
        el.hidden = false;
        boards[i].css.visible = false;      // the empty 3D host needs no layer meanwhile
        open = i;
        sec.scrollTop = memo.index === i ? memo.top : 0;
        if (focused) {
            focused.focus({ preventScroll: true });
        }
        sec.addEventListener('scroll', onScroll, { passive: true });
        sec.querySelectorAll('img').forEach((img) => {
            if (!img.complete) {
                img.addEventListener('load', onImg, { once: true });
            }
        });
        updateChip();
    }

    function hide() {
        const sec = section();
        if (!sec) {
            return;
        }
        memo = { index: open, top: sec.scrollTop };
        sec.removeEventListener('scroll', onScroll);
        const focused = sec.contains(document.activeElement) ? document.activeElement : null;
        boards[open].host.appendChild(sec);
        if (focused) {
            focused.focus({ preventScroll: true });
        }
        boards[open].css.visible = boards[open].mounted;
        sec.scrollTop = memo.top;
        el.hidden = true;
        open = -1;
        updateChip();
    }

    function dispose() {
        hide();
        el.remove();
    }

    return { show, hide, dispose, index: () => open, el, scroller: () => section() };
}
