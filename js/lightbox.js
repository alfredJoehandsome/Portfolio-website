// Lightbox for project images: every screenshot becomes a button that opens a full screen
// <dialog> with the large copy, previous/next buttons, a caption ("Project · 2 of 3"), Esc,
// left/right keys and swipe. The large copies (assets/images/web/large/) load only when the
// lightbox opens. Works in the 3D world and on the plain page alike.
(function () {
    if (typeof HTMLDialogElement === 'undefined') {
        return;
    }

    var groups = [];

    function add(name, imgs) {
        var list = [];
        imgs.forEach(function (img) {
            if (list.indexOf(img) < 0 && !img.closest('.zoom')) {
                list.push(img);
            }
        });
        if (list.length) {
            groups.push({ name: name, imgs: list });
        }
    }

    function collect() {
        var murmurs = document.querySelector('#murmurs .feature__media');
        if (murmurs) {
            add('Murmurs of the Mist', Array.prototype.slice.call(murmurs.querySelectorAll('img')));
        }
        var pizza = document.querySelector('#pizza-to-hell .feature__media');
        if (pizza) {
            add('Pizza to Hell', Array.prototype.slice.call(pizza.querySelectorAll('img')));
        }
        document.querySelectorAll('.project-card').forEach(function (card) {
            var h = card.querySelector('h3');
            var name = h ? h.textContent.trim() : 'Project';
            var imgs = Array.prototype.slice.call(card.querySelectorAll('img'));
            var btn = card.querySelector('[data-dialog]');
            var dialog = btn ? document.getElementById(btn.getAttribute('data-dialog')) : null;
            if (dialog) {
                imgs = imgs.concat(Array.prototype.slice.call(dialog.querySelectorAll('.shots img, .dialog__single img')));
            }
            add(name, imgs);
        });
    }

    // Large copies exist for the .jpg files (WebP first, JPEG as the fallback). The gif and the
    // svg are shown as they are (the gif has its own animated WebP).
    function largeSrc(src) {
        return /\/web\/[^/]+\.jpg$/.test(src) ? src.replace('/web/', '/web/large/') : src;
    }

    function webpOf(src) {
        return /\.(jpg|gif)$/.test(src) ? src.replace(/\.(jpg|gif)$/, '.webp') : '';
    }

    var dialog = null;
    var bigImg = null;
    var bigPic = null;
    var bigSource = null;
    var caption = null;
    var prevBtn = null;
    var nextBtn = null;
    var current = null;     // { group, index, trigger }

    function el(tag, className, attrs) {
        var node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        Object.keys(attrs || {}).forEach(function (k) {
            node.setAttribute(k, attrs[k]);
        });
        return node;
    }

    function build() {
        dialog = el('dialog', 'lightbox', { 'aria-label': 'Image viewer' });
        var stage = el('div', 'lightbox__stage');
        bigPic = el('picture');
        bigSource = el('source', '', { type: 'image/webp' });
        bigImg = el('img', 'lightbox__img', { alt: '' });
        bigPic.appendChild(bigSource);
        bigPic.appendChild(bigImg);
        stage.appendChild(bigPic);
        caption = el('p', 'lightbox__caption', { 'aria-live': 'polite' });
        var close = el('button', 'lightbox__btn lightbox__close', { type: 'button', 'aria-label': 'Close image viewer' });
        close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>';
        prevBtn = el('button', 'lightbox__btn lightbox__prev', { type: 'button', 'aria-label': 'Previous image' });
        prevBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg>';
        nextBtn = el('button', 'lightbox__btn lightbox__next', { type: 'button', 'aria-label': 'Next image' });
        nextBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"></path></svg>';
        dialog.appendChild(stage);
        dialog.appendChild(caption);
        dialog.appendChild(close);
        dialog.appendChild(prevBtn);
        dialog.appendChild(nextBtn);
        document.body.appendChild(dialog);
        if (window.SignDialogs) {
            window.SignDialogs.enhance(dialog);
        }

        close.addEventListener('click', function () {
            dialog.close();
        });
        prevBtn.addEventListener('click', function () {
            step(-1);
        });
        nextBtn.addEventListener('click', function () {
            step(1);
        });
        dialog.addEventListener('click', function (event) {
            if (event.target === dialog || event.target === stage) {
                dialog.close();
            }
        });
        dialog.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                event.stopPropagation();
                step(-1);
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                event.stopPropagation();
                step(1);
            }
        });
        dialog.addEventListener('close', function () {
            var trigger = current && current.trigger;
            bigSource.removeAttribute('srcset');
            bigImg.removeAttribute('src');
            current = null;
            if (trigger) {
                trigger.focus({ preventScroll: true });
            }
        });
        // Swipe on phones: a horizontal drag steps to the previous or next image.
        var start = null;
        stage.addEventListener('pointerdown', function (event) {
            start = { id: event.pointerId, x: event.clientX, y: event.clientY };
        });
        stage.addEventListener('pointerup', function (event) {
            if (!start || start.id !== event.pointerId) {
                return;
            }
            var dx = event.clientX - start.x;
            var dy = event.clientY - start.y;
            start = null;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
                step(dx < 0 ? 1 : -1);
            }
        });
        stage.addEventListener('pointercancel', function () {
            start = null;
        });
    }

    function show() {
        var g = current.group;
        var img = g.imgs[current.index];
        var src = largeSrc(img.getAttribute('src'));
        var webp = webpOf(src);
        if (webp) {
            bigSource.setAttribute('srcset', webp);
        } else {
            bigSource.removeAttribute('srcset');
        }
        bigImg.src = src;
        bigImg.alt = img.getAttribute('alt') || g.name;
        bigImg.className = 'lightbox__img' + (img.classList.contains('pixel') ? ' pixel' : '');
        caption.textContent = g.name + ' · ' + (current.index + 1) + ' of ' + g.imgs.length;
        var many = g.imgs.length > 1;
        prevBtn.hidden = !many;
        nextBtn.hidden = !many;
    }

    function step(delta) {
        if (!current) {
            return;
        }
        var n = current.group.imgs.length;
        current.index = (current.index + delta + n) % n;
        show();
    }

    function open(group, index, trigger) {
        if (!dialog) {
            build();
        }
        current = { group: group, index: index, trigger: trigger };
        show();
        if (!dialog.open) {
            dialog.showModal();
        }
        dialog.querySelector('.lightbox__close').focus({ preventScroll: true });
    }

    function wrap() {
        groups.forEach(function (group) {
            group.imgs.forEach(function (img, i) {
                var button = el('button', 'zoom', {
                    type: 'button',
                    'aria-haspopup': 'dialog',
                    'aria-label': 'Open ' + group.name + ' screenshot ' + (i + 1) + ' of ' + group.imgs.length
                });
                var node = img.closest('picture') || img;
                node.parentNode.insertBefore(button, node);
                button.appendChild(node);
                button.addEventListener('click', function () {
                    open(group, i, button);
                });
            });
        });
    }

    collect();
    wrap();
}());
