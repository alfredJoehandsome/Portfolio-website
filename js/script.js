// Basic interactivity for the portfolio site: menu, year, project dialogs.

// Lets the stylesheet tell a scripted page from a plain one.
document.documentElement.classList.add('js');

// ---------------------------------------------------------
// Clickjacking guard: if this page is loaded inside a frame from another
// origin, break out of it. Frame headers cannot be set on static hosting,
// so this protection runs client side.
// ---------------------------------------------------------
try {
    if (window.top !== window.self) {
        window.top.location = window.self.location;
    }
} catch (e) {
    document.documentElement.style.visibility = 'hidden';
}

// ---------------------------------------------------------
// Mobile navigation toggle (hamburger menu on small screens)
// ---------------------------------------------------------
(function () {
    const toggle = document.getElementById('mobile-menu');
    const nav = document.getElementById('nav-links');
    if (!toggle || !nav) {
        return;
    }

    function setOpen(open) {
        nav.classList.toggle('nav--open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    toggle.addEventListener('click', () => {
        setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    nav.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => setOpen(false));
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
            setOpen(false);
            toggle.focus();
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            setOpen(false);
        }
    });
})();

// ---------------------------------------------------------
// Footer year
// ---------------------------------------------------------
const yearSpan = document.getElementById('year');
if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
}

// ---------------------------------------------------------
// Project dialogs: native <dialog>. Esc closes it natively, focus goes
// back to the button that opened it.
// ---------------------------------------------------------
(function () {
    document.querySelectorAll('[data-dialog]').forEach((trigger) => {
        const dialog = document.getElementById(trigger.getAttribute('data-dialog'));
        if (!dialog || typeof dialog.showModal !== 'function') {
            return;
        }
        trigger.addEventListener('click', () => {
            dialog.showModal();
        });
        dialog.addEventListener('close', () => {
            trigger.focus({ preventScroll: true });
        });
        dialog.addEventListener('click', (event) => {
            // A click on the backdrop lands on the dialog element itself.
            if (event.target === dialog) {
                dialog.close();
            }
        });
        dialog.querySelectorAll('[data-dialog-close]').forEach((button) => {
            button.addEventListener('click', () => dialog.close());
        });
    });
})();
