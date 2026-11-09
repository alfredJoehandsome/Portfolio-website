// Dropdown menus in the nav (Work, About): the disclosure pattern. A button with aria-expanded
// and aria-controls opens a list of links. Esc closes and returns focus, a click outside closes,
// the arrow keys move between items. Items that carry data-open-dialog also open that project's
// Details dialog, in the 3D world (after the walk arrives) and on the plain page alike.
(function () {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.menu-btn'));
    if (!buttons.length) {
        return;
    }

    function listOf(btn) {
        return document.getElementById(btn.getAttribute('aria-controls'));
    }

    function items(btn) {
        return Array.prototype.slice.call(listOf(btn).querySelectorAll('a'));
    }

    function place(btn) {
        // Keep the list inside the screen (phones: the About pill sits near the right edge).
        var list = listOf(btn);
        list.style.left = '';
        list.style.right = '';
        var r = list.getBoundingClientRect();
        var over = r.right - (window.innerWidth - 8);
        if (over > 0) {
            list.style.left = Math.min(0, -over) + 'px';
        }
        var neg = r.left < 8 ? 8 - r.left : 0;
        if (neg > 0) {
            list.style.left = neg + 'px';
        }
    }

    function open(btn, focusFirst) {
        close(null);
        btn.setAttribute('aria-expanded', 'true');
        listOf(btn).hidden = false;
        place(btn);
        if (focusFirst) {
            items(btn)[0].focus();
        }
    }

    function close(except, restoreFocus) {
        buttons.forEach(function (btn) {
            if (btn === except || btn.getAttribute('aria-expanded') !== 'true') {
                return;
            }
            btn.setAttribute('aria-expanded', 'false');
            listOf(btn).hidden = true;
            if (restoreFocus) {
                btn.focus();
            }
        });
    }

    // Walk to a board and open a project's Details dialog.
    function openDialogWhenThere(boardId, dialog) {
        function show() {
            if (!dialog.open) {
                dialog.showModal();
            }
        }
        var inWorld = document.documentElement.classList.contains('world-mode');
        if (!inWorld) {
            window.setTimeout(show, 0);
            return;
        }
        var w = window.__world;
        var here = w && w.boards && w.boards[w.index] && w.boards[w.index].section.id === boardId;
        if (here && !(w.input && w.input.explicit)) {
            show();
            return;
        }
        var done = false;
        function onArrived(event) {
            if (event.detail && event.detail.id === boardId && !done) {
                done = true;
                window.removeEventListener('world:arrived', onArrived);
                show();
            }
        }
        window.addEventListener('world:arrived', onArrived);
        window.setTimeout(function () {
            window.removeEventListener('world:arrived', onArrived);
        }, 8000);
    }

    buttons.forEach(function (btn) {
        var list = listOf(btn);
        btn.addEventListener('click', function () {
            if (btn.getAttribute('aria-expanded') === 'true') {
                close(null);
            } else {
                open(btn, false);
            }
        });
        btn.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                open(btn, true);
            } else if (event.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
                event.preventDefault();
                event.stopPropagation();
                close(null, true);
            }
        });
        list.addEventListener('keydown', function (event) {
            var links = items(btn);
            var i = links.indexOf(document.activeElement);
            var handled = true;
            if (event.key === 'ArrowDown') {
                links[(i + 1) % links.length].focus();
            } else if (event.key === 'ArrowUp') {
                links[(i - 1 + links.length) % links.length].focus();
            } else if (event.key === 'Home') {
                links[0].focus();
            } else if (event.key === 'End') {
                links[links.length - 1].focus();
            } else if (event.key === 'Escape') {
                event.stopPropagation();
                close(null, true);
            } else if (event.key === 'Tab') {
                handled = false;
                close(null);
            } else {
                handled = false;
            }
            if (handled) {
                event.preventDefault();
            }
        });
        list.addEventListener('click', function (event) {
            var link = event.target.closest('a');
            if (!link) {
                return;
            }
            var id = link.getAttribute('data-open-dialog');
            close(null);
            if (id) {
                var dialog = document.getElementById(id);
                if (dialog && typeof dialog.showModal === 'function') {
                    openDialogWhenThere(link.getAttribute('href').slice(1), dialog);
                }
            }
        });
    });

    document.addEventListener('click', function (event) {
        if (!event.target.closest('.has-menu')) {
            close(null);
        }
    });
    window.addEventListener('resize', function () {
        close(null);
    });
}());
