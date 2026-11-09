// Dialogs as signboards. In the 3D world a <dialog> is a white sign on two short posts that
// rises from below the screen and sinks back when closed. This file only adds the wrapper the
// styling needs, the closing animation, and the Terms sign; the dialogs stay native <dialog>
// (focus trap, Esc, inert page behind). On the plain page nothing visual changes.
(function () {
    'use strict';

    var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    var root = document.documentElement;
    var CLOSE_MS = 280;

    function animated() {
        return root.classList.contains('world-mode') && !reduce.matches;
    }

    function enhance(dialog) {
        if (!dialog || dialog.__sign) {
            return;
        }
        dialog.__sign = true;
        dialog.classList.add('sign');
        // The panel scrolls; the posts and the close buttons stay put around it.
        var panel = document.createElement('div');
        panel.className = 'sign__panel';
        Array.prototype.slice.call(dialog.childNodes).forEach(function (node) {
            if (node.nodeType === 1 && node.matches('.dialog__x, .lightbox__btn')) {
                return;
            }
            panel.appendChild(node);
        });
        dialog.insertBefore(panel, dialog.firstChild);

        var nativeClose = dialog.close;
        var timer = 0;
        function finish(value) {
            window.clearTimeout(timer);
            if (!dialog.__closing) {
                return;
            }
            dialog.__closing = false;
            dialog.classList.remove('is-closing');
            nativeClose.call(dialog, value);
        }
        dialog.close = function (value) {
            if (!dialog.open || dialog.__closing) {
                return;
            }
            if (!animated()) {
                nativeClose.call(dialog, value);
                return;
            }
            dialog.__closing = true;
            dialog.classList.add('is-closing');
            timer = window.setTimeout(function () {
                finish(value);
            }, CLOSE_MS + 40);
        };
        // Esc: run the same sinking animation instead of vanishing.
        dialog.addEventListener('cancel', function (event) {
            if (animated()) {
                event.preventDefault();
                dialog.close();
            }
        });
    }

    window.SignDialogs = { enhance: enhance };

    document.querySelectorAll('dialog.project-dialog').forEach(enhance);

    // Terms & privacy: in the 3D world the footer link opens the same text as a sign.
    var terms = document.getElementById('dialog-terms');
    if (terms) {
        enhance(terms);
        var lastTrigger = null;
        document.addEventListener('click', function (event) {
            var a = event.target && event.target.closest ? event.target.closest('a[href="terms.html"]') : null;
            if (!a || !root.classList.contains('world-mode') || typeof terms.showModal !== 'function') {
                return;
            }
            event.preventDefault();
            lastTrigger = a;
            if (!terms.open) {
                terms.showModal();
            }
        });
        terms.addEventListener('click', function (event) {
            if (event.target === terms) {
                terms.close();
            }
        });
        terms.querySelectorAll('[data-dialog-close]').forEach(function (button) {
            button.addEventListener('click', function () {
                terms.close();
            });
        });
        terms.addEventListener('close', function () {
            if (lastTrigger) {
                lastTrigger.focus({ preventScroll: true });
            }
        });
    }
}());
