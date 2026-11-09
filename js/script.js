// Basic interactivity for the portfolio site: cookie notice, menu, year.

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
// Cookie notice: show until the visitor accepts or declines,
// then remember the choice in local storage.
// ---------------------------------------------------------
(function () {
    const banner = document.getElementById('cookie-banner');
    if (!banner) {
        return;
    }
    let stored = null;
    try {
        stored = localStorage.getItem('cookieConsent');
    } catch (e) {
        stored = null;
    }
    if (!stored) {
        banner.hidden = false;
    }
    function setConsent(value) {
        try {
            localStorage.setItem('cookieConsent', value);
        } catch (e) {
            // Local storage may be unavailable; hide the banner regardless.
        }
        banner.hidden = true;
    }
    const accept = document.getElementById('cookie-accept');
    const decline = document.getElementById('cookie-decline');
    if (accept) {
        accept.addEventListener('click', () => setConsent('accepted'));
    }
    if (decline) {
        decline.addEventListener('click', () => setConsent('declined'));
    }
})();

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
