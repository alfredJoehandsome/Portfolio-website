// Basic interactivity for the portfolio site

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

const menuToggle = document.getElementById('mobile-menu');
const navLinks = document.querySelector('.nav-links');

if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });

    navLinks.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
        });
    });
}

const projectCards = document.querySelectorAll('.project-card');

function updatePopoverPosition(card) {
    if (window.innerWidth <= 960) {
        return;
    }

    const popover = card.querySelector('.project-popover');
    if (!popover) {
        return;
    }

    popover.classList.remove('project-popover--left');
    const defaultRect = popover.getBoundingClientRect();
    if (defaultRect.right > window.innerWidth - 16) {
        popover.classList.add('project-popover--left');
        const leftRect = popover.getBoundingClientRect();
        if (leftRect.left < 16) {
            popover.classList.remove('project-popover--left');
        }
    }
}

if (projectCards.length > 0) {
    projectCards.forEach((card) => {
        const handler = () => updatePopoverPosition(card);
        card.addEventListener('mouseenter', handler);
        card.addEventListener('focusin', handler);
    });

    window.addEventListener('resize', () => {
        projectCards.forEach((card) => updatePopoverPosition(card));
    });
}

const yearSpan = document.getElementById('year');
if (yearSpan) {
    const now = new Date();
    yearSpan.textContent = now.getFullYear();
}

// ---------------------------------------------------------
// Staggered scroll reveals: siblings inside the same grid get
// a small incremental delay so cards cascade in.
// ---------------------------------------------------------
(function () {
    const groups = document.querySelectorAll(
        '.strength-grid, .project-grid, .stats-grid, .testimonial-grid, .exp-list'
    );
    groups.forEach((group) => {
        const items = group.querySelectorAll('.reveal');
        items.forEach((el, i) => {
            el.style.setProperty('--reveal-delay', `${Math.min(i * 0.09, 0.45)}s`);
        });
    });
})();

const revealElements = document.querySelectorAll('.reveal');

if (revealElements.length > 0) {
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
            (entries, obs) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const el = entry.target;
                        el.classList.add('in-view');
                        obs.unobserve(el);
                        // Once the reveal transition has finished, drop the
                        // reveal classes so they no longer override hover and
                        // tilt transitions on the same element.
                        window.setTimeout(() => {
                            el.classList.remove('reveal', 'in-view');
                            el.style.removeProperty('--reveal-delay');
                        }, 1300);
                    }
                });
            },
            {
                threshold: 0.1,
            }
        );

        revealElements.forEach((el) => observer.observe(el));
    } else {
        revealElements.forEach((el) => el.classList.add('in-view'));
    }
}

// ---------------------------------------------------------
// Hero shooting stars.
// Performance notes: canvas shadowBlur was removed (it is very expensive
// per draw call and caused the lag), the trail is short, and the number of
// active stars and firework bursts are both hard capped.
// ---------------------------------------------------------
(function () {
    const canvas = document.getElementById('star-canvas');
    const heroSection = document.getElementById('hero');
    if (!canvas || !heroSection) {
        return;
    }

    const starCountValueEl = document.getElementById('star-count-value');
    let starsCollected = 0;
    const ctx = canvas.getContext('2d');
    let width;
    let height;

    function resizeCanvas() {
        const rect = heroSection.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        canvas.width = width;
        canvas.height = height;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const stars = [];
    const fireworks = [];
    let heroVisible = true;

    function setHeroVisibility(isVisible) {
        heroVisible = isVisible;
        heroSection.classList.toggle('hero--stars-hidden', !isVisible);
        if (!isVisible) {
            stars.length = 0;
            fireworks.length = 0;
            ctx.clearRect(0, 0, width, height);
        }
    }

    if ('IntersectionObserver' in window) {
        const heroObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    setHeroVisibility(entry.isIntersecting);
                });
            },
            {
                threshold: 0.1,
            }
        );

        heroObserver.observe(heroSection);
    } else {
        const updateVisibility = () => {
            const rect = heroSection.getBoundingClientRect();
            const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;
            setHeroVisibility(isVisible);
        };

        window.addEventListener('scroll', updateVisibility, { passive: true });
        window.addEventListener('resize', updateVisibility);
        updateVisibility();
    }

    // Hard cap on how many shooting stars can be active at once.
    const MAX_STARS = 6;
    // Hard cap on how many firework bursts can be active at once.
    const MAX_FIREWORKS = 3;

    // A restrained palette that matches the charcoal and crimson theme so the
    // stars read as a subtle, professional accent rather than a game overlay.
    const STAR_COLOURS = [
        '#ffffff', // pure white
        '#f0eeea', // warm paper white
        '#d8d5d0', // soft grey
        '#c0392b', // crimson accent
    ];

    function spawnStar() {
        if (!heroVisible) {
            return;
        }
        // Enforce the active star cap.
        if (stars.length >= MAX_STARS) {
            return;
        }

        // Smaller stars (3 to 5 pixels) so the effect stays subtle.
        const size = Math.random() * 2 + 3;
        const direction = Math.random() < 0.5 ? 1 : -1;
        const x = direction === 1 ? -size : width + size;
        const y = Math.random() * height * 0.7;
        const colour = STAR_COLOURS[Math.floor(Math.random() * STAR_COLOURS.length)];
        const r = parseInt(colour.substr(1, 2), 16);
        const g = parseInt(colour.substr(3, 2), 16);
        const b = parseInt(colour.substr(5, 2), 16);
        const horizontalSpeed = Math.random() * 1.2 + 1.0; // 1.0 to 2.2
        const verticalDrift = Math.random() * 0.4 + 0.1;   // 0.1 to 0.5
        const vx = direction * horizontalSpeed;
        const vy = verticalDrift;
        stars.push({
            x: x,
            y: y,
            size: size,
            vx: vx,
            vy: vy,
            colour: colour,
            r: r,
            g: g,
            b: b,
            trail: []
        });
    }

    // Respect users who ask for reduced motion: skip the animation entirely.
    const prefersReducedMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        heroSection.classList.add('hero--stars-hidden');
    }
    // Spawn stars at a gentle cadence so the effect stays quiet and tasteful.
    if (!prefersReducedMotion) {
        setInterval(spawnStar, 1300);
    }

    function spawnFirework(x, y, force, big) {
        // Normally cap concurrent bursts. The celebration finale passes force
        // to bypass that cap, with a higher hard limit purely for safety.
        if (force) {
            if (fireworks.length >= 40) {
                fireworks.shift();
            }
        } else if (fireworks.length >= MAX_FIREWORKS) {
            fireworks.shift();
        }
        // Bigger, punchier bursts for the finale pops.
        const numParticles = big ? 26 : 16;
        const particles = [];
        for (let i = 0; i < numParticles; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * (big ? 4.5 : 3) + 4;
            const colour = STAR_COLOURS[Math.floor(Math.random() * STAR_COLOURS.length)];
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                alpha: 1,
                life: Math.random() * 30 + 30,
                colour: colour,
            });
        }
        fireworks.push(particles);
    }

    let celebrating = false;

    // Reward: each time the collected count reaches a multiple of 10, a wave of
    // stars rains across the screen and then pops in a staggered cascade.
    function celebrate() {
        if (celebrating) {
            return;
        }
        celebrating = true;
        const count = 22;
        const created = [];
        for (let i = 0; i < count; i++) {
            const size = Math.random() * 3 + 4;
            const x = (width / (count + 1)) * (i + 1) + (Math.random() * 26 - 13);
            const y = -20 - Math.random() * 120;
            const colour = STAR_COLOURS[Math.floor(Math.random() * STAR_COLOURS.length)];
            const r = parseInt(colour.substr(1, 2), 16);
            const g = parseInt(colour.substr(3, 2), 16);
            const b = parseInt(colour.substr(5, 2), 16);
            const star = {
                x: x,
                y: y,
                size: size,
                vx: Math.random() * 0.8 - 0.4,
                vy: Math.random() * 2 + 3.5,
                colour: colour,
                r: r,
                g: g,
                b: b,
                trail: []
            };
            stars.push(star);
            created.push(star);
        }
        // Stagger each pop so the wave bursts as a satisfying cascade.
        created.forEach((star, i) => {
            window.setTimeout(() => {
                const idx = stars.indexOf(star);
                if (idx !== -1) {
                    stars.splice(idx, 1);
                    spawnFirework(star.x, star.y, true, true);
                }
            }, 450 + i * 60 + Math.random() * 140);
        });
        // Allow the next celebration once this one has finished.
        window.setTimeout(() => {
            celebrating = false;
        }, 450 + count * 60 + 1400);
    }

    document.addEventListener('click', (event) => {
        const rect = canvas.getBoundingClientRect();
        if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
        ) {
            return;
        }
        const cx = event.clientX - rect.left;
        const cy = event.clientY - rect.top;
        for (let i = stars.length - 1; i >= 0; i--) {
            const s = stars[i];
            const dx = s.x - cx;
            const dy = s.y - cy;
            const distSquared = dx * dx + dy * dy;
            const detectionRadius = s.size * 10;
            if (distSquared < detectionRadius * detectionRadius) {
                stars.splice(i, 1);
                starsCollected++;
                if (starCountValueEl) {
                    starCountValueEl.textContent = starsCollected;
                }
                spawnFirework(cx, cy);
                // Every tenth star triggers the falling star reward.
                if (starsCollected % 10 === 0) {
                    celebrate();
                }
                break;
            }
        }
    });

    // Draw a five-point star shape. Flat fill, no shadowBlur.
    function drawStarHead(ctx, x, y, size, r, g, b) {
        const spikes = 5;
        const outerRadius = size * 1.2;
        const innerRadius = size * 0.6;
        let rot = Math.PI / 2 * 3;
        const cx = x;
        const cy = y;
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            let xCoord = cx + Math.cos(rot) * outerRadius;
            let yCoord = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(xCoord, yCoord);
            rot += Math.PI / spikes;
            xCoord = cx + Math.cos(rot) * innerRadius;
            yCoord = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(xCoord, yCoord);
            rot += Math.PI / spikes;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        // Flat fill, no shadowBlur. Canvas shadow blur is extremely expensive
        // per draw call and was the main cause of lag, so it is removed here.
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fill();
    }

    function animate() {
        if (!heroVisible) {
            requestAnimationFrame(animate);
            return;
        }
        ctx.clearRect(0, 0, width, height);

        for (let i = stars.length - 1; i >= 0; i--) {
            const s = stars[i];
            s.x += s.vx;
            s.y += s.vy;
            s.trail.unshift({ x: s.x, y: s.y });
            // Shorter trail means fewer draw calls per frame.
            const maxTrail = 8;
            if (s.trail.length > maxTrail) {
                s.trail.pop();
            }
            // Draw the trail as tapered line segments with no shadow blur.
            if (s.trail.length >= 2) {
                ctx.lineCap = 'round';
                for (let j = s.trail.length - 1; j > 0; j--) {
                    const p0 = s.trail[j];
                    const p1 = s.trail[j - 1];
                    const t = (s.trail.length - j) / s.trail.length;
                    const widthTrail = s.size * t;
                    const alpha = t * 0.8;
                    ctx.strokeStyle = `rgba(${s.r}, ${s.g}, ${s.b}, ${alpha})`;
                    ctx.lineWidth = widthTrail;
                    ctx.beginPath();
                    ctx.moveTo(p0.x, p0.y);
                    ctx.lineTo(p1.x, p1.y);
                    ctx.stroke();
                }
            }
            drawStarHead(ctx, s.x, s.y, s.size, s.r, s.g, s.b);
            if (
                s.x < -s.size ||
                s.x > width + s.size ||
                s.y > height + s.size
            ) {
                stars.splice(i, 1);
            }
        }

        for (let fi = fireworks.length - 1; fi >= 0; fi--) {
            const burst = fireworks[fi];
            for (let pi = burst.length - 1; pi >= 0; pi--) {
                const p = burst[pi];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.05;
                p.life--;
                p.alpha -= 1 / p.life;
                ctx.fillStyle = p.colour;
                ctx.globalAlpha = Math.max(p.alpha, 0);
                ctx.fillRect(p.x, p.y, 3, 3);
                ctx.globalAlpha = 1;
                if (p.alpha <= 0 || p.life <= 0) {
                    burst.splice(pi, 1);
                }
            }
            if (burst.length === 0) {
                fireworks.splice(fi, 1);
            }
        }

        requestAnimationFrame(animate);
    }

    if (!prefersReducedMotion) {
        animate();
    }
})();

// ---------------------------------------------------------
// Small glow that follows the cursor inside the hero.
// Uses transform (GPU friendly) and stays subtle so it never takes over.
// ---------------------------------------------------------
(function () {
    const hero = document.getElementById('hero');
    const glow = document.getElementById('hero-glow');
    if (!hero || !glow) {
        return;
    }
    const HALF = 170; // half the glow size, so it centres on the cursor
    let queued = false;
    let lastX = 0;
    let lastY = 0;

    hero.addEventListener('pointermove', (event) => {
        const rect = hero.getBoundingClientRect();
        lastX = event.clientX - rect.left;
        lastY = event.clientY - rect.top;
        glow.style.opacity = '1';
        if (!queued) {
            queued = true;
            requestAnimationFrame(() => {
                glow.style.transform = `translate(${lastX - HALF}px, ${lastY - HALF}px)`;
                queued = false;
            });
        }
    });

    hero.addEventListener('pointerleave', () => {
        glow.style.opacity = '0';
    });
})();

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
// Navbar hides on scroll down, returns on scroll up.
// ---------------------------------------------------------
(function () {
    const navbar = document.querySelector('.navbar');
    let lastScrollY = window.scrollY;
    let ticking = false;

    function onScroll() {
        if (navbar) {
            const goingDown = window.scrollY > lastScrollY;
            // Only hide once we are past the hero top area, and never
            // while the mobile menu is open.
            const menuOpen = document.querySelector('.nav-links.active');
            if (goingDown && window.scrollY > 320 && !menuOpen) {
                navbar.classList.add('navbar--hidden');
            } else if (!goingDown) {
                navbar.classList.remove('navbar--hidden');
            }
        }
        lastScrollY = window.scrollY;
        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(onScroll);
        }
    }, { passive: true });

    onScroll();
})();

// ---------------------------------------------------------
// Animated stat counters. Count up with ease-out when the
// stats band scrolls into view. Skipped for reduced motion.
// ---------------------------------------------------------
(function () {
    const counters = document.querySelectorAll('.stat-number');
    if (counters.length === 0) {
        return;
    }

    const reduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function formatNumber(value) {
        // Matches the "25,000+" style already used in the copy.
        return value.toLocaleString('en-US');
    }

    function setFinal(el) {
        const target = parseInt(el.dataset.count, 10) || 0;
        el.textContent = formatNumber(target) + (el.dataset.suffix || '');
    }

    function animateCounter(el) {
        const target = parseInt(el.dataset.count, 10) || 0;
        const suffix = el.dataset.suffix || '';
        const duration = 1600;
        const start = performance.now();

        function tick(now) {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
            el.textContent = formatNumber(Math.round(target * eased)) + suffix;
            if (t < 1) {
                requestAnimationFrame(tick);
            }
        }
        requestAnimationFrame(tick);
    }

    if (reduced || !('IntersectionObserver' in window)) {
        counters.forEach(setFinal);
        return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.4 });

    counters.forEach((el) => observer.observe(el));
})();

