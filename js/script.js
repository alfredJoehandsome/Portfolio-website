// Basic interactivity for the portfolio site

// ---------------------------------------------------------
// Mobile navigation toggle (hamburger menu on small screens)
// ---------------------------------------------------------

// Get the hamburger button and the nav list
const menuToggle = document.getElementById('mobile-menu');
const navLinks = document.querySelector('.nav-links');

if (menuToggle && navLinks) {
    // When the hamburger is clicked, show/hide the nav links
    menuToggle.addEventListener('click', () => {
        // Toggling "active" adds/removes a CSS class which slides the menu in/out
        navLinks.classList.toggle('active');
    });

    // Close the mobile menu when a navigation link is clicked
    // This avoids the menu staying open after the user chooses a section
    navLinks.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
        });
    });
}


const yearSpan = document.getElementById('year');
if (yearSpan) {
    const now = new Date();
    yearSpan.textContent = now.getFullYear();
}


const revealElements = document.querySelectorAll('.reveal');

if (revealElements.length > 0) {
    // Check that the browser supports IntersectionObserver (modern feature)
    if ('IntersectionObserver' in window) {
        // Create a new observer that watches visibility of target elements
        const observer = new IntersectionObserver(
            (entries, obs) => {
                entries.forEach((entry) => {
                    // isIntersecting is true when the element is at least partly visible
                    if (entry.isIntersecting) {
                        // Add the class that triggers the CSS transition
                        entry.target.classList.add('in-view');

                        // Stop observing this element so we only animate it once
                        obs.unobserve(entry.target);
                    }
                });
            },
            {
                // 0.1 means: trigger when 10% of the element is visible
                threshold: 0.1,
            }
        );

        // Attach the observer to each reveal element
        revealElements.forEach((el) => observer.observe(el));
    } else {
        // Fallback for old browsers:
        // If IntersectionObserver is not available, just show all sections immediately.
        revealElements.forEach((el) => el.classList.add('in-view'));
    }
}


(function () {
    // Grab the canvas element defined in index.html
    const canvas = document.getElementById('star-canvas');
    const heroSection = document.getElementById('hero');
    if (!canvas || !heroSection) {
        return;
    }
    // Grab the star counter span. If the counter element is absent the script
    // continues silently. The number will be updated whenever the user
    // collects a star by clicking on it.
    const starCountValueEl = document.getElementById('star-count-value');
    // Track how many stars have been collected. We increment this when the
    // user successfully clicks on a star (i.e. before spawning the firework).
    let starsCollected = 0;
    const ctx = canvas.getContext('2d');
    let width;
    let height;

    // Resize the canvas to match the hero section
    function resizeCanvas() {
        const rect = heroSection.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        canvas.width = width;
        canvas.height = height;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Star particles fall from the top of the screen
    const stars = [];
    // Fireworks bursts hold arrays of particles
    const fireworks = [];

    // Maximum number of shooting stars allowed on screen at once. If the number
    // of stars in the stars array reaches this value, new stars will not be
    // spawned until existing ones are removed (either by clicking or moving off
    // screen). This prevents the canvas from becoming overcrowded if the user
    // does not click on any stars.
    const MAX_STARS = 10;

    // A palette of colours for stars and fireworks (inspired by the accent colours)
    // Colours for stars and fireworks. Choose bright, high-contrast colours so
    // shooting stars stand out clearly against the dark background. These
    // values are pale hues and pure white/yellow to evoke starlight.
    const STAR_COLOURS = [
        '#ffffff', // pure white
        '#ffe58a', // soft yellow
        '#a8d4ff', // pale blue
        '#ffb3e6', // pale pink
    ];

    // Spawn a single star with a random diagonal trajectory. Stars start from
    // the top of the screen and travel downward at a diagonal angle with a
    // stronger horizontal component. Each star also stores its colour in
    // r/g/b form and a short trail of previous positions to draw a fading
    // shooting-star effect.
    function spawnStar() {
        // Before creating a new star, check the current count. If there are
        // already too many stars on screen, skip spawning. This keeps the
        // number of stars manageable even if none are clicked.
        if (stars.length >= MAX_STARS) {
            return;
        }

        // Star size between 5 and 8 pixels (larger so they resemble stars rather than specks)
        const size = Math.random() * 3 + 5;
        // Choose a direction: left-to-right (1) or right-to-left (-1)
        const direction = Math.random() < 0.5 ? 1 : -1;
        // Spawn off-screen horizontally on the chosen side and at a random vertical position
        const x = direction === 1 ? -size : width + size;
        const y = Math.random() * height * 0.7;
        // Select a colour and break it down into RGB channels for the trail.
        const colour = STAR_COLOURS[Math.floor(Math.random() * STAR_COLOURS.length)];
        const r = parseInt(colour.substr(1, 2), 16);
        const g = parseInt(colour.substr(3, 2), 16);
        const b = parseInt(colour.substr(5, 2), 16);
        // Horizontal speed dominates to emphasise sideways motion; vertical drift is gentle
        const horizontalSpeed = Math.random() * 1.2 + 1.0; // 1.0–2.2
        const verticalDrift = Math.random() * 0.4 + 0.1;   // 0.1–0.5
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
    // Spawn stars at a lower frequency (every 700ms) to reduce clutter on screen.
    setInterval(spawnStar, 700);

    // Create a firework burst at (x, y)
    function spawnFirework(x, y) {
        // Increase the number of particles per firework for a more impressive burst
        const numParticles = 30;
        const particles = [];
        for (let i = 0; i < numParticles; i++) {
            const angle = Math.random() * Math.PI * 2;
            // Slightly broaden the speed range so fireworks spread further
            const speed = Math.random() * 3 + 2;
            const colour = STAR_COLOURS[Math.floor(Math.random() * STAR_COLOURS.length)];
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                alpha: 1,
                life: Math.random() * 30 + 30, // lifespan frames
                colour: colour,
            });
        }
        fireworks.push(particles);
    }

    // On document click, determine if a star was clicked and trigger firework
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
        // Check from end to start to allow safe removal
        for (let i = stars.length - 1; i >= 0; i--) {
            const s = stars[i];
            const dx = s.x - cx;
            const dy = s.y - cy;
            const distSquared = dx * dx + dy * dy;
            // Clicked within a generous radius around the star. Multiply the star
            // size by 8 to make clicking easier even on small stars.
            // Expand the detection radius to make it easier to click on stars.
            const detectionRadius = s.size * 10;
            if (distSquared < detectionRadius * detectionRadius) {
                // Remove star from the array so it no longer animates
                stars.splice(i, 1);
                // Increment collected count and update the UI. Guard against
                // missing element in case the counter is not present.
                starsCollected++;
                if (starCountValueEl) {
                    starCountValueEl.textContent = starsCollected;
                }
                // Trigger firework at the click location
                spawnFirework(cx, cy);
                break;
            }
        }
    });

    // Draw a 5-point star shape for the star head. A separate helper
    // function makes the trail code cleaner. The star is drawn using
    // alternating outer and inner radii to create spikes. Colour channels
    // (r, g, b) are passed separately to avoid constructing new colours on every call.
    function drawStarHead(ctx, x, y, size, r, g, b) {
        const spikes = 5;
        // Increase outer radius relative to the base size to emphasise the star shape.
        const outerRadius = size * 1.2;
        const innerRadius = size * 0.6;
        let rot = Math.PI / 2 * 3;
        const cx = x;
        const cy = y;
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            // Outer point
            let xCoord = cx + Math.cos(rot) * outerRadius;
            let yCoord = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(xCoord, yCoord);
            rot += Math.PI / spikes;
            // Inner point
            xCoord = cx + Math.cos(rot) * innerRadius;
            yCoord = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(xCoord, yCoord);
            rot += Math.PI / spikes;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        // Apply a slight glow so the star head looks like it’s shining. The shadow
        // blur is scaled to the star size and the colour matches the star.
        ctx.shadowBlur = outerRadius;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fill();
        // Reset shadow settings so they don’t affect subsequent drawing
        ctx.shadowBlur = 0;
    }

    // Main animation loop
    function animate() {
        ctx.clearRect(0, 0, width, height);
        // Draw and update stars
        for (let i = stars.length - 1; i >= 0; i--) {
            const s = stars[i];
            // Update position based on velocity
            s.x += s.vx;
            s.y += s.vy;
            // Update the trail: add the current position to the front
            s.trail.unshift({ x: s.x, y: s.y });
            // Limit the trail length; a longer trail produces a longer streak
            const maxTrail = 15;
            if (s.trail.length > maxTrail) {
                s.trail.pop();
            }
            // Draw the trail as tapered line segments. Iterate through the trail
            // positions and connect them with gradually decreasing width and
            // opacity. Older segments are drawn thinner and more transparent.
            if (s.trail.length >= 2) {
                ctx.lineCap = 'round';
                // Add a gentle glow to the trail so it appears softer. The glow
                // intensity scales with star size.
                ctx.shadowBlur = s.size * 1.5;
                ctx.shadowColor = `rgba(${s.r}, ${s.g}, ${s.b}, 0.6)`;
                for (let j = s.trail.length - 1; j > 0; j--) {
                    const p0 = s.trail[j];
                    const p1 = s.trail[j - 1];
                    // Normalized parameter: 0 at the oldest, 1 near the head
                    const t = (s.trail.length - j) / s.trail.length;
                    // Width tapers from nearly zero to full size
                    const widthTrail = s.size * t;
                    // Alpha fades toward the tail
                    const alpha = t * 0.8;
                    ctx.strokeStyle = `rgba(${s.r}, ${s.g}, ${s.b}, ${alpha})`;
                    ctx.lineWidth = widthTrail;
                    ctx.beginPath();
                    ctx.moveTo(p0.x, p0.y);
                    ctx.lineTo(p1.x, p1.y);
                    ctx.stroke();
                }
                // Reset shadow settings after drawing the trail
                ctx.shadowBlur = 0;
            }
            // Draw the star head as a five-point star to resemble a twinkling star
            drawStarHead(ctx, s.x, s.y, s.size, s.r, s.g, s.b);
            // Remove stars that move outside the viewport boundaries
            if (
                s.x < -s.size ||
                s.x > width + s.size ||
                s.y > height + s.size
            ) {
                stars.splice(i, 1);
            }
        }
        // Draw and update firework particles
        for (let fi = fireworks.length - 1; fi >= 0; fi--) {
            const burst = fireworks[fi];
            for (let pi = burst.length - 1; pi >= 0; pi--) {
                const p = burst[pi];
                p.x += p.vx;
                p.y += p.vy;
                // Apply simple gravity
                p.vy += 0.05;
                p.life--;
                // Fade out gradually
                p.alpha -= 1 / p.life;
                // Draw particle
                ctx.fillStyle = p.colour;
                ctx.globalAlpha = Math.max(p.alpha, 0);
                // Draw each firework particle slightly larger to make the explosion visible
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

        // (Debug removed) Optionally, you could display the number of active
        // stars here for troubleshooting. This block has been removed in
        // production to avoid cluttering the interface.

        requestAnimationFrame(animate);
    }
    animate();
})();
