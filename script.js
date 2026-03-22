/**
 * Re:Try - Core Game Logic
 */

const CONFIG = {
    SCREEN_WIDTH: 800,
    SCREEN_HEIGHT: 600,
    TILE_SIZE: 40,
    GRAVITY: 0.6,
    JUMP_FORCE: -12,
    MOVE_SPEED: 5,
    MAX_GHOSTS: 3,
    COLORS: {
        BACKGROUND: '#050508',
        PLAYER: '#00f2ff',
        PLAYER_GLOW: 'rgba(0, 242, 255, 0.8)',
        GHOST: 'rgba(0, 242, 255, 0.3)',
        GHOST_GLOW: 'rgba(0, 242, 255, 0.2)',
        WALL: '#1a1a2e',
        DOOR: '#ffcc00',
        BUTTON: '#333',
        BUTTON_ACTIVE: '#ffcc00',
        GOAL: '#11ff88',
        ACCENT: '#ff0055',
        SPIKE: '#ff0044'
    }
};

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.03;
        this.size = 2 + Math.random() * 4;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.vy += 0.1; // Slight gravity
    }

    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.SCREEN_WIDTH;
        this.canvas.height = CONFIG.SCREEN_HEIGHT;

        this.screens = {
            title: document.getElementById('title-screen'),
            levelSelect: document.getElementById('level-select'),
            game: document.getElementById('game-screen'),
            clear: document.getElementById('clear-screen')
        };

        this.currentLevel = 0;
        this.unlockedLevels = 10; // Keeping all levels unlocked for review
        this.isPaused = false;
        
        // Game State
        this.player = null;
        this.ghosts = [];
        this.levelData = null;
        this.recording = [];
        this.frameCount = 0;
        this.activeButtons = new Set();
        this.particles = [];
        this.shakeTime = 0;

        this.keys = {};
        
        this.init();
    }

    init() {
        // Event Listeners
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'KeyR') this.retry();
            if (e.code === 'Escape') this.togglePause();
        });
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        document.getElementById('start-btn').onclick = () => this.showScreen('levelSelect');
        document.getElementById('back-to-title').onclick = () => this.showScreen('title');
        document.getElementById('resume-btn').onclick = () => this.togglePause();
        document.getElementById('restart-level-btn').onclick = () => {
            this.togglePause();
            this.resetLevel(true);
        };
        document.getElementById('quit-to-select').onclick = () => {
            this.togglePause();
            this.showScreen('levelSelect');
        };
        document.getElementById('return-to-title-btn').onclick = () => this.showScreen('title');

        this.renderLevelGrid();
        this.showScreen('title');
        
        requestAnimationFrame((t) => this.loop(t));
    }

    showScreen(screenId) {
        Object.keys(this.screens).forEach(key => {
            this.screens[key].classList.add('hidden');
        });
        this.screens[screenId].classList.remove('hidden');
        
        if (screenId === 'levelSelect') this.renderLevelGrid();
    }

    renderLevelGrid() {
        const grid = document.getElementById('level-grid');
        grid.innerHTML = '';
        for (let i = 1; i <= 10; i++) {
            const btn = document.createElement('div');
            btn.className = `level-btn ${i <= this.unlockedLevels ? 'unlocked' : ''}`;
            btn.textContent = i;
            if (i <= this.unlockedLevels) {
                btn.onclick = () => this.startLevel(i);
            }
            grid.appendChild(btn);
        }
    }

    startLevel(levelId) {
        this.currentLevel = levelId;
        this.ghosts = [];
        this.resetLevel(true);
        this.showScreen('game');
        document.getElementById('current-level-id').textContent = levelId;
    }

    resetLevel(resetGhosts = false) {
        if (resetGhosts) this.ghosts = [];
        
        this.frameCount = 0;
        this.recording = [];
        this.activeButtons.clear();
        this.loadMap(this.currentLevel);
        
        // Initialize player
        this.player = {
            x: this.levelData.start.x,
            y: this.levelData.start.y,
            width: 30,
            height: 38,
            vx: 0,
            vy: 0,
            onGround: false
        };

        this.updateUI();
    }

    retry() {
        if (this.recording.length > 0) {
            // Push current run to ghosts (FIFO if max reached)
            this.ghosts.push([...this.recording]);
            if (this.ghosts.length > CONFIG.MAX_GHOSTS) {
                this.ghosts.shift();
            }
        }
        this.resetLevel(false);
    }

    loadMap(id) {
        const levels = {
            1: {
                start: { x: 100, y: 500 },
                goal: { x: 740, y: 500, w: 40, h: 40 },
                walls: [
                    { x: 0, y: 550, w: 800, h: 50 },
                    { x: 400, y: 400, w: 30, h: 150, id: 'door1' }
                ],
                buttons: [
                    { x: 250, y: 540, w: 40, h: 10, target: 'door1' }
                ]
            },
            2: {
                start: { x: 50, y: 500 },
                goal: { x: 740, y: 200, w: 40, h: 40 },
                walls: [
                    { x: 0, y: 550, w: 300, h: 50 },
                    { x: 500, y: 550, w: 300, h: 50 },
                    { x: 300, y: 450, w: 200, h: 20, id: 'plat1', type: 'dynamic' },
                    { x: 600, y: 350, w: 150, h: 20 }
                ],
                buttons: [
                    { x: 150, y: 540, w: 40, h: 10, target: 'plat1' }
                ]
            },
            3: {
                start: { x: 50, y: 500 },
                goal: { x: 720, y: 500, w: 40, h: 40 },
                walls: [
                    { x: 0, y: 550, w: 800, h: 50 },
                    { x: 300, y: 350, w: 30, h: 200, id: 'dA' },
                    { x: 520, y: 350, w: 30, h: 200, id: 'dB' }
                ],
                buttons: [
                    { x: 150, y: 540, w: 40, h: 10, target: 'dA' },
                    { x: 410, y: 540, w: 40, h: 10, target: 'dB' }
                ]
            },
            4: {
                start: { x: 50, y: 500 },
                goal: { x: 50, y: 50, w: 40, h: 40 },
                walls: [
                    { x: 0, y: 550, w: 800, h: 50 },
                    { x: 400, y: 450, w: 200, h: 20 },
                    { x: 100, y: 350, w: 200, h: 20 },
                    { x: 400, y: 250, w: 200, h: 20 },
                    { x: 100, y: 150, w: 200, h: 20 },
                    { x: 0, y: 40, w: 30, h: 60, id: 'gD' }
                ],
                buttons: [
                    { x: 500, y: 240, w: 40, h: 10, target: 'gD' }
                ]
            },
            5: {
                start: { x: 50, y: 500 },
                goal: { x: 700, y: 100, w: 40, h: 40 },
                walls: [
                    { x: 0, y: 550, w: 200, h: 50 },
                    { x: 250, y: 450, w: 100, h: 20, id: 'p1', type: 'dynamic' },
                    { x: 450, y: 350, w: 100, h: 20, id: 'p2', type: 'dynamic' },
                    { x: 250, y: 250, w: 100, h: 20, id: 'p3', type: 'dynamic' },
                    { x: 600, y: 0, w: 200, h: 550 }
                ],
                buttons: [
                    { x: 50, y: 540, w: 40, h: 10, target: 'p1' },
                    { x: 280, y: 440, w: 40, h: 10, target: 'p2' },
                    { x: 480, y: 340, w: 40, h: 10, target: 'p3' }
                ]
            },
            6: {
                // Spikes intro
                start: { x: 50, y: 500 },
                goal: { x: 700, y: 500, w: 40, h: 40 },
                walls: [
                    { x: 0, y: 540, w: 200, h: 60 },
                    { x: 600, y: 540, w: 200, h: 60 }
                ],
                spikes: [
                    { x: 200, y: 570, w: 40, h: 30 },
                    { x: 240, y: 570, w: 40, h: 30 },
                    { x: 280, y: 570, w: 40, h: 30 },
                    { x: 320, y: 570, w: 40, h: 30 },
                    { x: 360, y: 570, w: 40, h: 30 },
                    { x: 400, y: 570, w: 40, h: 30 },
                    { x: 440, y: 570, w: 40, h: 30 },
                    { x: 480, y: 570, w: 40, h: 30 },
                    { x: 520, y: 570, w: 40, h: 30 },
                    { x: 560, y: 570, w: 40, h: 30 }
                ]
            },
            7: {
                // Moving Lift
                start: { x: 50, y: 500 },
                goal: { x: 100, y: 150, w: 40, h: 40 },
                walls: [
                    { x: 0, y: 550, w: 300, h: 50 },
                    { x: 400, y: 500, w: 100, h: 20, id: 'lift', type: 'moving', x1: 400, y1: 500, x2: 400, y2: 200 },
                    { x: 50, y: 200, w: 150, h: 20 }
                ],
                buttons: [
                    { x: 150, y: 540, w: 40, h: 10, target: 'lift' }
                ]
            },
            8: {
                // Coordination
                start: { x: 50, y: 500 },
                goal: { x: 740, y: 100, w: 40, h: 40 },
                walls: [
                    { x: 0, y: 550, w: 200, h: 50 },
                    { x: 300, y: 550, w: 200, h: 50 },
                    { x: 600, y: 550, w: 200, h: 50 },
                    { x: 200, y: 400, w: 100, h: 20, id: 'm1', type: 'moving', x1: 200, y1: 400, x2: 200, y2: 200 },
                    { x: 500, y: 300, w: 100, h: 20, id: 'm2', type: 'moving', x1: 500, y1: 300, x2: 500, y2: 100 }
                ],
                buttons: [
                    { x: 100, y: 540, w: 40, h: 10, target: 'm1' },
                    { x: 400, y: 540, w: 40, h: 10, target: 'm2' }
                ]
            },
            9: {
                // The Gauntlet
                start: { x: 50, y: 500 },
                goal: { x: 740, y: 500, w: 40, h: 40 },
                walls: [
                    { x: 0, y: 550, w: 100, h: 50 },
                    { x: 700, y: 550, w: 100, h: 50 },
                    { x: 150, y: 450, w: 150, h: 20, id: 'b9', x1: 150, y1: 550, x2: 550, y2: 550, type: 'moving' },
                    { x: 300, y: 200, w: 200, h: 20 }
                ],
                buttons: [
                    { x: 400, y: 190, w: 40, h: 10, target: 'b9' }
                ],
                spikes: [
                    { x: 100, y: 580, w: 600, h: 20 }
                ]
            },
            10: {
                // Final
                start: { x: 50, y: 500 },
                goal: { x: 400, y: 50, w: 40, h: 40 },
                walls: [
                    { x: 0, y: 550, w: 800, h: 50 },
                    { x: 100, y: 400, w: 30, h: 150, id: 'f1' },
                    { x: 300, y: 400, w: 30, h: 150, id: 'f2' },
                    { x: 500, y: 400, w: 30, h: 150, id: 'f3' },
                    { x: 350, y: 100, w: 100, h: 20 }
                ],
                buttons: [
                    { x: 50, y: 540, w: 30, h: 10, target: 'f1' },
                    { x: 200, y: 540, w: 30, h: 10, target: 'f2' },
                    { x: 400, y: 540, w: 30, h: 10, target: 'f3' }
                ],
                spikes: [
                    { x: 250, y: 150, w: 300, h: 20 }
                ]
            }
        };
        
        this.levelData = JSON.parse(JSON.stringify(levels[id] || levels[1]));
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        document.getElementById('pause-menu').classList.toggle('hidden', !this.isPaused);
    }

    updateUI() {
        document.getElementById('ghost-count').textContent = this.ghosts.length;
    }

    spawnParticles(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    screenShake(duration = 20) {
        this.shakeTime = duration;
    }

    loop() {
        if (!this.isPaused && this.player) {
            this.update();
        }
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    update() {
        // Update Moving Platforms
        if (this.levelData.walls) {
            this.levelData.walls.forEach(wall => {
                if (wall.type === 'moving') {
                    const targetActive = this.activeButtons.has(wall.id || wall.target);
                    const tx = targetActive ? wall.x2 : wall.x1;
                    const ty = targetActive ? wall.y2 : wall.y1;
                    wall.x += (tx - wall.x) * 0.1;
                    wall.y += (ty - wall.y) * 0.1;
                }
            });
        }

        // Record current run
        this.recording.push({ x: this.player.x, y: this.player.y });
        this.frameCount++;

        // Process Input
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) this.player.vx = -CONFIG.MOVE_SPEED;
        else if (this.keys['ArrowRight'] || this.keys['KeyD']) this.player.vx = CONFIG.MOVE_SPEED;
        else this.player.vx = 0;

        if ((this.keys['ArrowUp'] || this.keys['KeyW'] || this.keys['Space']) && this.player.onGround) {
            this.player.vy = CONFIG.JUMP_FORCE;
            this.player.onGround = false;
            this.spawnParticles(this.player.x + this.player.width/2, this.player.y + this.player.height, CONFIG.COLORS.PLAYER, 5);
        }

        // Apply Gravity
        this.player.vy += CONFIG.GRAVITY;

        // Apply Velocity and Collision (Horizontal)
        this.player.x += this.player.vx;
        this.checkCollisions(true);

        // Apply Velocity and Collision (Vertical)
        const oldOnGround = this.player.onGround;
        this.player.y += this.player.vy;
        this.checkCollisions(false);
        
        if (this.player.onGround && !oldOnGround) {
            this.spawnParticles(this.player.x + this.player.width/2, this.player.y + this.player.height, CONFIG.COLORS.PLAYER, 8);
        }

        // Update active buttons
        this.activeButtons.clear();
        this.checkButtonTriggers(this.player);
        
        // Ghosts also trigger buttons
        this.ghosts.forEach(ghostData => {
            const frameIndex = Math.min(this.frameCount - 1, ghostData.length - 1);
            const ghostPos = ghostData[frameIndex];
            this.checkButtonTriggers({
                x: ghostPos.x,
                y: ghostPos.y,
                width: 30,
                height: 38
            });
        });

        // Check Spikes
        if (this.levelData.spikes) {
            this.levelData.spikes.forEach(spike => {
                if (this.rectIntersect(this.player, spike)) {
                    this.failLevel();
                }
            });
        }

        // Check Goal
        if (this.rectIntersect(this.player, this.levelData.goal)) {
            this.completeLevel();
        }

        // Fall check
        if (this.player.y > CONFIG.SCREEN_HEIGHT + 100) {
            this.failLevel();
        }
    }

    failLevel() {
        this.spawnParticles(this.player.x + this.player.width/2, this.player.y + this.player.height/2, CONFIG.COLORS.ACCENT, 20);
        this.screenShake();
        this.resetLevel(false);
    }

    checkCollisions(horizontal) {
        // Wall collisions
        this.levelData.walls.forEach(wall => {
                if (wall.type === 'moving') {
                    // Moving platforms are always solid
                } else {
                    const isActive = this.activeButtons.has(wall.id);
                    const isSolid = (wall.type === 'dynamic' ? isActive : !isActive);
                    if (!isSolid) return;
                }

            if (this.rectIntersect(this.player, wall)) {
                if (horizontal) {
                    if (this.player.vx > 0) this.player.x = wall.x - this.player.width;
                    if (this.player.vx < 0) this.player.x = wall.x + wall.w;
                    this.player.vx = 0;
                } else {
                    if (this.player.vy > 0) {
                        this.player.y = wall.y - this.player.height;
                        this.player.onGround = true;
                    }
                    if (this.player.vy < 0) {
                        this.player.y = wall.y + wall.h;
                        this.player.vy = 0;
                    }
                }
            }
        });
    }

    checkButtonTriggers(entity) {
        this.levelData.buttons.forEach(btn => {
            if (this.rectIntersect(entity, btn)) {
                this.activeButtons.add(btn.target);
            }
        });
    }

    rectIntersect(r1, r2, tolerance = 0) {
        return r1.x < r2.x + r2.w + tolerance &&
               r1.x + (r1.width || r1.w) > r2.x - tolerance &&
               r1.y < r2.y + r2.h + tolerance &&
               r1.y + (r1.height || r1.h) > r2.y - tolerance;
    }

    completeLevel() {
        if (this.currentLevel === this.unlockedLevels) {
            this.unlockedLevels++;
        }
        if (this.currentLevel < 10) {
            this.startLevel(this.currentLevel + 1);
        } else {
            this.showScreen('clear');
        }
    }

    draw() {
        this.ctx.save();
        
        // Screen Shake
        if (this.shakeTime > 0) {
            const intensity = 5;
            this.ctx.translate(
                (Math.random() - 0.5) * intensity,
                (Math.random() - 0.5) * intensity
            );
            this.shakeTime--;
        }

        // Clear background
        this.ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.player) {
            this.ctx.restore();
            return;
        }

        // Draw Buttons
        this.levelData.buttons.forEach(btn => {
            const isActive = this.activeButtons.has(btn.target);
            this.ctx.fillStyle = isActive ? CONFIG.COLORS.BUTTON_ACTIVE : CONFIG.COLORS.BUTTON;
            
            if (isActive) {
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = CONFIG.COLORS.BUTTON_ACTIVE;
            }
            this.ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
            this.ctx.shadowBlur = 0;
        });

        // Draw Spikes
        if (this.levelData.spikes) {
            this.levelData.spikes.forEach(s => {
                this.ctx.fillStyle = CONFIG.COLORS.SPIKE;
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = CONFIG.COLORS.SPIKE;
                
                this.ctx.beginPath();
                this.ctx.moveTo(s.x, s.y + s.h);
                this.ctx.lineTo(s.x + s.w / 2, s.y);
                this.ctx.lineTo(s.x + s.w, s.y + s.h);
                this.ctx.fill();
                
                this.ctx.shadowBlur = 0;
            });
        }

        // Draw Goal
        const goal = this.levelData.goal;
        if (goal) {
            // Inner glow
            const goalGlow = this.ctx.createRadialGradient(
                goal.x + goal.w/2, goal.y + goal.h/2, 5,
                goal.x + goal.w/2, goal.y + goal.h/2, 40
            );
            goalGlow.addColorStop(0, CONFIG.COLORS.GOAL);
            goalGlow.addColorStop(1, 'transparent');
            
            this.ctx.fillStyle = goalGlow;
            this.ctx.fillRect(goal.x - 20, goal.y - 20, goal.w + 40, goal.h + 40);

            this.ctx.fillStyle = CONFIG.COLORS.GOAL;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = CONFIG.COLORS.GOAL;
            this.ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
            this.ctx.shadowBlur = 0;
        }

        // Draw Walls / Doors / Platforms
        this.levelData.walls.forEach(wall => {
            if (wall.id) {
                const isActive = this.activeButtons.has(wall.id);
                const isSolid = (wall.type === 'moving' ? true : (wall.type === 'dynamic' ? isActive : !isActive));
                
                if (isSolid) {
                    this.ctx.fillStyle = wall.type === 'dynamic' ? CONFIG.COLORS.PLAYER : CONFIG.COLORS.DOOR;
                    this.ctx.shadowBlur = 10;
                    this.ctx.shadowColor = this.ctx.fillStyle;
                    this.ctx.globalAlpha = 1.0;
                    this.ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
                } else {
                    this.ctx.globalAlpha = 0.2;
                    this.ctx.strokeStyle = wall.type === 'dynamic' ? CONFIG.COLORS.PLAYER : CONFIG.COLORS.DOOR;
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
                    this.ctx.globalAlpha = 1.0;
                }
                this.ctx.shadowBlur = 0;
            } else {
                this.ctx.fillStyle = CONFIG.COLORS.WALL;
                this.ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
                
                // Bevel effect
                this.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                this.ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
            }
        });

        // Draw Particles
        this.particles.forEach((p, i) => {
            p.update();
            p.draw(this.ctx);
            if (p.life <= 0) this.particles.splice(i, 1);
        });

        // Draw Ghosts
        this.ghosts.forEach(ghostData => {
            const frameIndex = Math.min(this.frameCount - 1, ghostData.length - 1);
            const pos = ghostData[frameIndex];
            
            // Fade out ghosts at the end of their recording
            const isEnding = this.frameCount > ghostData.length - 30;
            const alpha = isEnding ? Math.max(0, (ghostData.length - this.frameCount) / 30) : 1.0;
            
            this.ctx.globalAlpha = alpha * 0.4;
            this.ctx.fillStyle = CONFIG.COLORS.GHOST;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = CONFIG.COLORS.GHOST_GLOW;
            this.ctx.fillRect(pos.x, pos.y, this.player.width, this.player.height);
            this.ctx.shadowBlur = 0;
            this.ctx.globalAlpha = 1.0;
        });

        // Draw Player
        this.ctx.fillStyle = CONFIG.COLORS.PLAYER;
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = CONFIG.COLORS.PLAYER_GLOW;
        this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
        this.ctx.shadowBlur = 0;

        // Scanline effect
        this.ctx.fillStyle = 'rgba(255,255,255,0.015)';
        for(let i=0; i<CONFIG.SCREEN_HEIGHT; i+=4) {
            this.ctx.fillRect(0, i, CONFIG.SCREEN_WIDTH, 1);
        }

        // Draw Pause overlay
        if (this.isPaused) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.ctx.restore();
    }
}

// Start Game
window.onload = () => {
    new Game();
};
