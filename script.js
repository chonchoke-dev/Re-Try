/**
 * Echo Run - Core Game Engine 2.0
 * Mario-inspired horizontal platformer with Phasing mechanics.
 */

const CONFIG = {
    SCREEN_WIDTH: 800,
    SCREEN_HEIGHT: 600,
    TILE_SIZE: 40,
    GRAVITY: 0.5,
    JUMP_FORCE: -11,
    MOVE_SPEED: 4.8,
    COYOTE_TIME: 6, // Frames
    JUMP_BUFFER: 8, // Frames
    MAX_ECHOES: 6,
    COLORS: {
        BACKGROUND: '#050508',
        PLAYER: '#00f2ff',
        PLAYER_GLOW: 'rgba(0, 242, 255, 0.8)',
        ECHO: 'rgba(0, 242, 255, 0.4)',
        ECHO_GLOW: 'rgba(0, 242, 255, 0.2)',
        WALL: '#1a1a2e',
        DOOR: '#ffcc00',
        BUTTON: '#333',
        BUTTON_ACTIVE: '#ffcc00',
        GOAL: '#11ff88',
        ACCENT: '#ff0055',
        SPIKE: '#ff0044',
        PARTICLE_PLAYER: '#00f2ff',
        PARTICLE_ECHO: '#ff00ff'
    },
    ECHO_PALETTE: ['#ff00ff', '#00ff88', '#0099ff', '#ffaa00', '#ff0055']
};

class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.deadzone = 200;
    }

    update(playerX, playerY, levelWidth, levelHeight) {
        // Horizontal scroll
        if (playerX - this.x > CONFIG.SCREEN_WIDTH - this.deadzone) {
            this.x = playerX - (CONFIG.SCREEN_WIDTH - this.deadzone);
        } else if (playerX - this.x < this.deadzone) {
            this.x = playerX - this.deadzone;
        }

        // Vertical scroll (optional, but keep it centered-ish)
        this.y = 0; // Stick to bottom for now

        // Clamp
        this.x = Math.max(0, Math.min(this.x, levelWidth - CONFIG.SCREEN_WIDTH));
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 6;
        this.vy = (Math.random() - 0.5) * 6;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.05;
        this.size = 2 + Math.random() * 3;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.vy += 0.1;
    }

    draw(ctx, camera) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class Echo {
    constructor(recording, color) {
        this.recording = [...recording];
        this.color = color;
        this.frame = 0;
        this.width = 32;
        this.height = 42;
        this.x = this.recording[0].x;
        this.y = this.recording[0].y;
        this.isDone = false;
    }

    update() {
        if (this.frame < this.recording.length) {
            const pos = this.recording[this.frame];
            this.x = pos.x;
            this.y = pos.y;
            this.frame++;
        } else {
            this.isDone = true;
        }
    }

    draw(ctx, camera) {
        const alpha = this.isDone ? 0.2 : 0.5;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
        
        // Outline if done
        if (this.isDone) {
            ctx.strokeStyle = this.color;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
            ctx.setLineDash([]);
        }
        
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
    }

    getRect() {
        return { x: this.x, y: this.y, w: this.width, h: this.height };
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
            levelClear: document.getElementById('level-clear-screen'),
            clear: document.getElementById('clear-screen')
        };

        this.camera = new Camera();
        this.currentLevel = 0;
        this.unlockedLevels = 1;
        this.isPaused = false;
        
        this.player = {
            x: 0, y: 0, vx: 0, vy: 0, width: 32, height: 42,
            onGround: false,
            coyoteTimer: 0,
            jumpBuffer: 0,
            isRecording: false,
            recording: [],
            recordStartX: 0,
            recordStartY: 0,
            trail: []
        };

        this.echoes = [];
        this.levelData = null;
        this.particles = [];
        this.keys = {};
        this.activeButtons = new Set();
        this.shakeTime = 0;
        this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.isGoalReached = false;
        this.goalTimer = 0;

        this.init();
    }

    init() {
        window.addEventListener('keydown', (e) => {
            if (this.screens.levelClear.classList.contains('hidden') === false) return; // Disable keys on clear screen
            this.keys[e.code] = true;
            if (e.code === 'KeyR') this.resetLevel();
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.handlePhase();
            if (e.code === 'Escape') this.togglePause();
        });
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        document.getElementById('start-btn').onclick = () => this.showScreen('levelSelect');
        document.getElementById('back-to-title').onclick = () => this.showScreen('title');
        document.getElementById('resume-btn').onclick = () => this.togglePause();
        document.getElementById('restart-level-btn').onclick = () => {
            if (this.isPaused) this.togglePause();
            this.resetLevel();
        };
        document.getElementById('quit-to-select').onclick = () => {
             if (this.isPaused) this.togglePause();
            this.showScreen('levelSelect');
        };
        document.getElementById('return-to-title-btn').onclick = () => this.showScreen('title');
        
        document.getElementById('next-level-btn').onclick = () => {
            if (this.currentLevel < 3) {
                this.startLevel(this.currentLevel + 1);
            } else {
                this.showScreen('clear');
            }
        };
        document.getElementById('level-clear-to-select').onclick = () => this.showScreen('levelSelect');

        this.initTouchControls();
        this.renderLevelGrid();
        this.showScreen('title');
        
        requestAnimationFrame(() => this.loop());
    }

    initTouchControls() {
        if (!this.isMobile) return;
        document.getElementById('mobile-controls').classList.remove('hidden');

        const addTouchBtn = (id, key) => {
            const btn = document.getElementById(id);
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.keys[key] = true;
            });
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.keys[key] = false;
                if (key === 'ShiftLeft') this.handlePhase();
                if (key === 'Escape') this.togglePause();
            });
        };

        addTouchBtn('btn-left', 'KeyA');
        addTouchBtn('btn-right', 'KeyD');
        addTouchBtn('btn-jump', 'Space');
        addTouchBtn('btn-phase', 'ShiftLeft');
        addTouchBtn('btn-pause', 'Escape');
    }

    showScreen(screenId) {
        Object.keys(this.screens).forEach(key => this.screens[key].classList.add('hidden'));
        this.screens[screenId].classList.remove('hidden');
        if (screenId === 'levelSelect') this.renderLevelGrid();
        
        // Hide mobile controls on UI screens
        if (this.isMobile) {
            const mobileControls = document.getElementById('mobile-controls');
            if (screenId === 'game') {
                mobileControls.classList.remove('hidden');
            } else {
                mobileControls.classList.add('hidden');
            }
        }
    }

    renderLevelGrid() {
        const grid = document.getElementById('level-grid');
        grid.innerHTML = '';
        for (let i = 0; i <= 3; i++) {
            const btn = document.createElement('div');
            btn.className = `level-btn unlocked`;
            btn.textContent = i === 0 ? 'T' : i;
            btn.onclick = () => this.startLevel(i);
            grid.appendChild(btn);
        }
    }

    startLevel(id) {
        this.currentLevel = id;
        this.echoes = [];
        this.isGoalReached = false;
        this.goalTimer = 0;
        this.resetLevel();
        this.showScreen('game');
    }

    resetLevel() {
        this.loadMap(this.currentLevel);
        this.player.x = this.levelData.start.x;
        this.player.y = this.levelData.start.y;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.isRecording = false;
        this.player.recording = [];
        this.echoes = [];
        this.activeButtons.clear();
        this.camera.x = 0;
    }

    handlePhase() {
        if (!this.player.isRecording) {
            this.player.isRecording = true;
            this.player.recording = [];
            this.player.recordStartX = this.player.x;
            this.player.recordStartY = this.player.y;
            this.player.trail = [];
        } else {
            // Spawn Echo
            if (this.player.recording.length > 5) {
                const color = CONFIG.ECHO_PALETTE[this.echoes.length % CONFIG.ECHO_PALETTE.length];
                this.echoes.push(new Echo(this.player.recording, color));
                if (this.echoes.length > CONFIG.MAX_ECHOES) this.echoes.shift();
                
                // Teleport back
                this.player.x = this.player.recordStartX;
                this.player.y = this.player.recordStartY;
                this.player.vx = 0;
                this.player.vy = 0;
                this.player.trail = [];
                this.spawnParticles(this.player.x + 16, this.player.y + 21, color, 15);
            }
            this.player.isRecording = false;
        }
    }

    loadMap(id) {
        const levels = {
            0: { // Tutorial
                width: 2000,
                start: { x: 100, y: 400 },
                goal: { x: 1800, y: 450, w: 60, h: 60 },
                walls: [
                    { x: 0, y: 550, w: 800, h: 50 },
                    { x: 900, y: 550, w: 1100, h: 50 }, // Gap at 800-900
                    { x: 400, y: 450, w: 100, h: 20 },  // Small jump
                    { x: 1200, y: 350, w: 200, h: 200 } // High wall! Need Echo.
                ],
                spikes: [{ x: 800, y: 580, w: 100, h: 20 }],
                hints: [
                    { x: 100, y: 300, text: "A / D to Move" },
                    { x: 100, y: 330, text: "W / SPACE to Jump" },
                    { x: 750, y: 450, text: "Wait, a gap!" },
                    { x: 1100, y: 250, text: "HOLD SHIFT to record your path" },
                    { x: 1100, y: 280, text: "(Watch the neon trail!)" },
                    { x: 1100, y: 310, text: "RELEASE to teleport & create a platform" }
                ]
            },
            1: { // Sky Climb
                width: 2500,
                start: { x: 100, y: 400 },
                goal: { x: 2300, y: 450, w: 60, h: 60 },
                walls: [
                    { x: 0, y: 550, w: 600, h: 50 },
                    { x: 600, y: 0, w: 40, h: 450 }, // Wall too high to jump over (450px high)
                    { x: 750, y: 550, w: 600, h: 50 },
                    { x: 1350, y: 0, w: 40, h: 450 }, // Another high wall
                    { x: 1500, y: 550, w: 1000, h: 50 }
                ],
                spikes: [
                    { x: 600, y: 580, w: 150, h: 20 }
                ],
                hints: [
                    { x: 300, y: 250, text: "WALL TOO HIGH?" },
                    { x: 300, y: 280, text: "RECORD A JUMP AT THE PEAK" },
                    { x: 300, y: 310, text: "AND USE IT AS A LADDER." }
                ]
            },
            2: { // Sequential Gates
                width: 2000,
                start: { x: 100, y: 400 },
                goal: { x: 1800, y: 490, w: 60, h: 60 },
                walls: [
                    { x: 0, y: 550, w: 2000, h: 50 },
                    { x: 800, y: 100, w: 40, h: 450, id: 'door1' }, // Door 1
                    { x: 1400, y: 100, w: 40, h: 450, id: 'door2' } // Door 2
                ],
                buttons: [
                    { x: 500, y: 540, w: 40, h: 10, target: 'door1' },
                    { x: 1100, y: 540, w: 40, h: 10, target: 'door2' }
                ],
                hints: [
                    { x: 300, y: 300, text: "YOU CAN'T BE IN TWO PLACES AT ONCE." },
                    { x: 1000, y: 300, text: "UNLESS YOU HAVE AN ECHO." }
                ]
            },
            3: { // Leap of Faith
                width: 4000,
                start: { x: 100, y: 400 },
                goal: { x: 3800, y: 450, w: 60, h: 60 },
                walls: [
                    { x: 0, y: 550, w: 400, h: 50 },
                    { x: 3600, y: 550, w: 400, h: 50 }
                ],
                spikes: [
                    { x: 400, y: 580, w: 3200, h: 20 }
                ],
                hints: [
                    { x: 200, y: 300, text: "A MASSIVE GAP." },
                    { x: 200, y: 330, text: "CHAIN MULTIPLE ECHOES IN MID-AIR." }
                ]
            }
        };
        this.levelData = levels[id] || levels[0];
    }

    loop() {
        if (!this.isPaused && this.levelData) {
            this.update();
        }
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    update() {
        if (this.isGoalReached) {
            this.goalTimer--;
            if (this.goalTimer <= 0) {
                this.showLevelClearScreen();
            }
            return;
        }

        this.updatePlayer();
        this.echoes.forEach(e => e.update());
        
        // Buttons
        this.activeButtons.clear();
        this.checkButton(this.player);
        this.echoes.forEach(e => this.checkButton(e));

        // Camera
        this.camera.update(this.player.x, this.player.y, this.levelData.width, 600);

        // Fail conditions
        if (this.player.y > 700) this.resetLevel();
        if (this.levelData.spikes) {
            this.levelData.spikes.forEach(s => {
                if (this.rectIntersect(this.player, { x: s.x, y: s.y, width: s.w, height: s.h })) this.resetLevel();
            });
        }

        // Goal
        if (this.rectIntersect(this.player, { ...this.levelData.goal, width: this.levelData.goal.w, height: this.levelData.goal.h })) {
            this.completeLevel();
        }
    }

    updatePlayer() {
        // Horizontal
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.player.vx = -CONFIG.MOVE_SPEED;
        else if (this.keys['KeyD'] || this.keys['ArrowRight']) this.player.vx = CONFIG.MOVE_SPEED;
        else this.player.vx *= 0.8;

        // Gravity
        this.player.vy += CONFIG.GRAVITY;

        // Jump Handling (Coyote + Buffer)
        if (this.player.onGround) this.player.coyoteTimer = CONFIG.COYOTE_TIME;
        else this.player.coyoteTimer--;

        if (this.keys['Space'] || this.keys['ArrowUp'] || this.keys['KeyW']) this.player.jumpBuffer = CONFIG.JUMP_BUFFER;
        else this.player.jumpBuffer--;

        if (this.player.jumpBuffer > 0 && this.player.coyoteTimer > 0) {
            this.player.vy = CONFIG.JUMP_FORCE;
            this.player.jumpBuffer = 0;
            this.player.coyoteTimer = 0;
            this.spawnParticles(this.player.x + 16, this.player.y + 40, CONFIG.COLORS.PLAYER, 5);
        }

        // Movement Execution
        this.player.x += this.player.vx;
        this.resolveCollisions(true);
        this.player.y += this.player.vy;
        this.resolveCollisions(false);

        // Recording
        if (this.player.isRecording) {
            this.player.recording.push({ x: this.player.x, y: this.player.y });
            // Add to trail every few frames for performance
            if (this.player.recording.length % 2 === 0) {
                 this.player.trail.push({ x: this.player.x + 16, y: this.player.y + 21 });
            }
        }
    }

    resolveCollisions(horizontal) {
        this.player.onGround = false;

        // Walls
        this.levelData.walls.forEach(w => {
            if (w.id && this.activeButtons.has(w.id)) return; // Door open
            
            const wallRect = { x: w.x, y: w.y, width: w.w, height: w.h };
            if (this.rectIntersect(this.player, wallRect)) {
                this.collideWith(wallRect, horizontal);
            }
        });

        // Echoes (Solid)
        this.echoes.forEach(e => {
            const echoRect = { x: e.x, y: e.y, width: e.width, height: e.height };
            if (this.rectIntersect(this.player, echoRect)) {
                this.collideWith(echoRect, horizontal);
            }
        });
    }

    collideWith(rect, horizontal) {
        if (horizontal) {
            if (this.player.vx > 0) this.player.x = rect.x - this.player.width;
            else if (this.player.vx < 0) this.player.x = rect.x + rect.width;
            this.player.vx = 0;
        } else {
            if (this.player.vy > 0) {
                this.player.y = rect.y - this.player.height;
                this.player.vy = 0;
                this.player.onGround = true;
            } else if (this.player.vy < 0) {
                this.player.y = rect.y + rect.height;
                this.player.vy = 0;
            }
        }
    }

    checkButton(entity) {
        if (!this.levelData.buttons) return;
        this.levelData.buttons.forEach(btn => {
            const entRect = { x: entity.x, y: entity.y, width: entity.width || entity.w, height: entity.height || entity.h };
            if (this.rectIntersect(entRect, { x: btn.x, y: btn.y, width: btn.w, height: btn.h })) {
                this.activeButtons.add(btn.target);
            }
        });
    }

    rectIntersect(r1, r2) {
        return r1.x < r2.x + r2.width && r1.x + r1.width > r2.x &&
               r1.y < r2.y + r2.height && r1.y + r1.height > r2.y;
    }

    completeLevel() {
        if (this.isGoalReached) return;
        this.isGoalReached = true;
        this.goalTimer = 90; // 1.5 seconds at 60fps
        this.spawnParticles(this.player.x + 16, this.player.y + 21, CONFIG.COLORS.GOAL, 30);
    }

    showLevelClearScreen() {
        if (this.currentLevel >= 0 && this.currentLevel <= 3) {
             const idText = this.currentLevel === 0 ? 'Tutorial' : this.currentLevel;
             document.getElementById('cleared-sector-id').textContent = idText;
             
             const nextBtn = document.getElementById('next-level-btn');
             if (this.currentLevel === 3) {
                 nextBtn.textContent = 'COMPLETE ALL DATA CORES';
                 nextBtn.onclick = () => this.showScreen('clear');
             } else {
                 nextBtn.textContent = 'PROCEED TO NEXT SECTOR';
                 nextBtn.onclick = () => this.startLevel(this.currentLevel + 1);
             }
             
             this.showScreen('levelClear');
        } else {
            this.showScreen('clear');
        }
    }

    spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y, color));
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        document.getElementById('pause-menu').classList.toggle('hidden', !this.isPaused);
    }

    draw() {
        this.ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Subtle Grid
        this.ctx.strokeStyle = 'rgba(0, 242, 255, 0.03)';
        this.ctx.lineWidth = 1;
        const offset = -(this.camera.x % 40);
        for (let x = offset; x < CONFIG.SCREEN_WIDTH; x += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, CONFIG.SCREEN_HEIGHT);
            this.ctx.stroke();
        }
        for (let y = 0; y < CONFIG.SCREEN_HEIGHT; y += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(CONFIG.SCREEN_WIDTH, y);
            this.ctx.stroke();
        }

        if (!this.levelData) return;

        this.ctx.save();
        
        // Walls
        this.levelData.walls.forEach(w => {
            const isOpen = w.id && this.activeButtons.has(w.id);
            if (isOpen) {
                this.ctx.strokeStyle = CONFIG.COLORS.DOOR;
                this.ctx.globalAlpha = 0.3;
                this.ctx.strokeRect(w.x - this.camera.x, w.y - this.camera.y, w.w, w.h);
                this.ctx.globalAlpha = 1.0;
            } else {
                this.ctx.fillStyle = w.id ? CONFIG.COLORS.DOOR : CONFIG.COLORS.WALL;
                this.ctx.fillRect(w.x - this.camera.x, w.y - this.camera.y, w.w, w.h);
            }
        });

        // Spikes
        if (this.levelData.spikes) {
            this.levelData.spikes.forEach(s => {
                this.ctx.fillStyle = CONFIG.COLORS.SPIKE;
                this.ctx.beginPath();
                this.ctx.moveTo(s.x-this.camera.x, s.y+s.h-this.camera.y);
                this.ctx.lineTo(s.x+s.w/2-this.camera.x, s.y-this.camera.y);
                this.ctx.lineTo(s.x+s.w-this.camera.x, s.y+s.h-this.camera.y);
                this.ctx.fill();
            });
        }

        // Buttons
        if (this.levelData.buttons) {
            this.levelData.buttons.forEach(b => {
                this.ctx.fillStyle = this.activeButtons.has(b.target) ? CONFIG.COLORS.BUTTON_ACTIVE : CONFIG.COLORS.BUTTON;
                this.ctx.fillRect(b.x - this.camera.x, b.y - this.camera.y, b.w, b.h);
            });
        }

        // Goal
        const g = this.levelData.goal;
        this.ctx.fillStyle = CONFIG.COLORS.GOAL;
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = CONFIG.COLORS.GOAL;
        this.ctx.fillRect(g.x - this.camera.x, g.y - this.camera.y, g.w, g.h);
        
        // Pulse effect for goal
        this.ctx.strokeStyle = CONFIG.COLORS.GOAL;
        this.ctx.lineWidth = 2;
        const pulse = (Math.sin(Date.now() / 200) + 1) * 5;
        this.ctx.strokeRect(g.x - this.camera.x - pulse, g.y - this.camera.y - pulse, g.w + pulse * 2, g.h + pulse * 2);
        this.ctx.shadowBlur = 0;

        // Echoes
        this.echoes.forEach(e => e.draw(this.ctx, this.camera));

        // Recording Trail
        if (this.player.isRecording && this.player.trail.length > 1) {
            this.ctx.beginPath();
            this.ctx.strokeStyle = '#ff00ff';
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([5, 5]);
            this.ctx.moveTo(this.player.trail[0].x - this.camera.x, this.player.trail[0].y - this.camera.y);
            for (let i = 1; i < this.player.trail.length; i++) {
                this.ctx.lineTo(this.player.trail[i].x - this.camera.x, this.player.trail[i].y - this.camera.y);
            }
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        // Player
        this.ctx.fillStyle = CONFIG.COLORS.PLAYER;
        if (this.player.isRecording) {
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = '#ff00ff';
            this.ctx.strokeStyle = '#ff00ff';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(this.player.x - this.camera.x - 2, this.player.y - this.camera.y - 2, 36, 46);
        } else {
             this.ctx.shadowBlur = 15;
             this.ctx.shadowColor = CONFIG.COLORS.PLAYER;
        }
        this.ctx.fillRect(this.player.x - this.camera.x, this.player.y - this.camera.y, this.player.width, this.player.height);
        this.ctx.shadowBlur = 0;

        // Particles
        this.particles = this.particles.filter(p => p.life > 0);
        this.particles.forEach(p => {
            p.update();
            p.draw(this.ctx, this.camera);
        });

        // Hints
        this.ctx.fillStyle = 'rgba(255,255,255,0.6)';
        this.ctx.font = '16px Outfit';
        this.levelData.hints.forEach(h => {
            this.ctx.fillText(h.text, h.x - this.camera.x, h.y - this.camera.y);
        });

        this.ctx.restore();

        // Goal Text
        if (this.isGoalReached) {
            this.ctx.fillStyle = 'rgba(0, 255, 136, ' + (Math.min(1, this.goalTimer / 30)) + ')';
            this.ctx.font = '700 80px Outfit';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GOAL!', CONFIG.SCREEN_WIDTH / 2, CONFIG.SCREEN_HEIGHT / 2);
            this.ctx.textAlign = 'left';
        }

        // UI Overlay
        this.drawUI();
    }

    drawUI() {
        // Echo Count
        this.ctx.fillStyle = 'white';
        this.ctx.font = '700 14px Outfit';
        this.ctx.fillText(`SECTOR: ${this.currentLevel === 0 ? 'T' : this.currentLevel}`, 20, 30);
        this.ctx.fillText(`ECHOES: ${this.echoes.length}/${CONFIG.MAX_ECHOES}`, 20, 50);
        
        if (this.player.isRecording) {
            const blink = Math.floor(Date.now() / 400) % 2 === 0;
            if (blink) {
                this.ctx.fillStyle = '#ff00ff';
                this.ctx.fillText('PHASE RECORDING...', 20, 70);
            }
        }
    }
}

window.onload = () => new Game();

