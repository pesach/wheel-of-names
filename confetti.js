// Confetti particle system for full-screen celebration.

let activeCanvas = null;
let activeCtx = null;
let animationFrameId = null;
let particles = [];
const colors = [
    '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
    '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
    '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800',
    '#ff5722'
];

class Particle {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.reset(true); // Start at random screen position for initial blast, or bottom of screen
    }

    reset(initial = false) {
        // Explode from center or rain from top
        if (initial) {
            this.x = Math.random() * this.width;
            this.y = Math.random() * this.height - this.height;
        } else {
            // Blast from the center bottom or center of screen
            this.x = this.width / 2 + (Math.random() * 200 - 100);
            this.y = this.height * 0.7 + (Math.random() * 100 - 50);
        }

        // Random velocities
        this.speedX = Math.random() * 20 - 10;
        this.speedY = initial ? (Math.random() * 5 + 2) : -(Math.random() * 25 + 10); // initial is falling, blast goes up
        
        // Particle properties
        this.size = Math.random() * 8 + 6;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.shape = Math.random() > 0.5 ? 'rect' : (Math.random() > 0.5 ? 'circle' : 'triangle');
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 10 - 5;
        this.opacity = 1;
        this.decay = Math.random() * 0.005 + 0.002;
    }

    update() {
        // Physics: Gravity and air resistance
        this.speedX *= 0.98;
        this.speedY += 0.45; // Gravity
        
        this.x += this.speedX;
        this.y += this.speedY;

        this.rotation += this.rotationSpeed;
        
        // If falling out or fading out, decay opacity
        if (this.y > this.height) {
            this.opacity -= 0.02;
        }

        return this.opacity > 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;

        ctx.beginPath();
        if (this.shape === 'rect') {
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size * 1.5);
        } else if (this.shape === 'circle') {
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.shape === 'triangle') {
            ctx.moveTo(0, -this.size / 2);
            ctx.lineTo(this.size / 2, this.size / 2);
            ctx.lineTo(-this.size / 2, this.size / 2);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }
}

function resizeCanvas() {
    if (activeCanvas) {
        activeCanvas.width = window.innerWidth;
        activeCanvas.height = window.innerHeight;
    }
}

export function startConfetti(durationMs = 4000) {
    // Clean up any existing canvas
    stopConfetti();

    // Create full screen overlay canvas
    activeCanvas = document.createElement('canvas');
    activeCanvas.style.position = 'fixed';
    activeCanvas.style.top = '0';
    activeCanvas.style.left = '0';
    activeCanvas.style.width = '100vw';
    activeCanvas.style.height = '100vh';
    activeCanvas.style.pointerEvents = 'none';
    activeCanvas.style.zIndex = '99999';
    document.body.appendChild(activeCanvas);

    activeCtx = activeCanvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    particles = [];
    const count = 150;
    
    // Create initial particles
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(activeCanvas.width, activeCanvas.height));
    }

    // Keep adding a few particles to simulate a continuous flow for a bit
    let spawning = true;
    const spawnInterval = setInterval(() => {
        if (spawning && particles.length < 250) {
            for (let i = 0; i < 5; i++) {
                particles.push(new Particle(activeCanvas.width, activeCanvas.height));
            }
        }
    }, 100);

    setTimeout(() => {
        spawning = false;
        clearInterval(spawnInterval);
    }, durationMs * 0.7);

    function tick() {
        if (!activeCanvas) return;

        activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
        
        // Update and draw particles
        particles = particles.filter(p => {
            const alive = p.update();
            if (alive) {
                p.draw(activeCtx);
            }
            return alive;
        });

        if (particles.length > 0 || spawning) {
            animationFrameId = requestAnimationFrame(tick);
        } else {
            stopConfetti();
        }
    }

    tick();

    // Auto cleanup
    setTimeout(() => {
        spawning = false;
    }, durationMs);
}

export function stopConfetti() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (activeCanvas) {
        window.removeEventListener('resize', resizeCanvas);
        activeCanvas.remove();
        activeCanvas = null;
        activeCtx = null;
        particles = [];
    }
}
