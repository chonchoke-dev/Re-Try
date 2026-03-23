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
    ECHO_PALETTE: ['#ff00ff', '#00ff88', '#0099ff', '#ffaa00', '#ff0055'],
    TURRET_COOLDOWN: 120, // Frames
    PROJECTILE_SPEED: 6
};

const CHARACTERS = {
    cube: {
        name: 'CUBE',
        speed: 4.8,
        jump: -11,
        maxEchoes: 6,
        width: 32,
        height: 42,
        shape: 'square'
    },
    triangle: {
        name: 'TRIANGLE',
        speed: 6.5,
        jump: -13.5,
        maxEchoes: 4,
        width: 32,
        height: 32,
        shape: 'triangle'
    },
    circle: {
        name: 'CIRCLE',
        speed: 3.8,
        jump: -10,
        maxEchoes: 10,
        width: 40,
        height: 40,
        shape: 'circle'
    }
};

class Projectile {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.width = 12;
        this.height = 12;
        this.color = '#ff0044';
        this.life = 300; // Max frames
    }

    update(ts = 1.0) {
        this.x += this.vx * ts;
        this.y += this.vy * ts;
        this.life -= 1 * ts;
    }

    draw(ctx, camera) {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x - camera.x + 6, this.y - camera.y + 6, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Turret {
    constructor(x, y, dirX, dirY, type = 'fixed') {
        this.x = x;
        this.y = y;
        this.dirX = dirX;
        this.dirY = dirY;
        this.type = type; // 'fixed' or 'tracking'
        this.width = 40;
        this.height = 40;
        this.cooldown = Math.random() * CONFIG.TURRET_COOLDOWN;
        this.laserActive = false;
    }

    update(game) {
        if (this.type === 'tracking') {
            const dx = game.player.x + 16 - (this.x + 20);
            const dy = game.player.y + 21 - (this.y + 20);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 600) { // Tracking range
                this.dirX = dx / dist;
                this.dirY = dy / dist;
            }
        }

        this.cooldown--;
        this.laserActive = this.cooldown < 45;

        if (this.cooldown <= 0) {
            game.projectiles.push(new Projectile(
                this.x + 14, 
                this.y + 14, 
                this.dirX * CONFIG.PROJECTILE_SPEED, 
                this.dirY * CONFIG.PROJECTILE_SPEED
            ));
            this.cooldown = this.type === 'tracking' ? CONFIG.TURRET_COOLDOWN * 0.8 : CONFIG.TURRET_COOLDOWN;
        }
    }

    draw(ctx, camera) {
        ctx.fillStyle = this.type === 'tracking' ? '#554433' : '#444';
        ctx.fillRect(this.x - camera.x, this.y - camera.y, 40, 40);
        
        // Laser Sight
        if (this.laserActive) {
            ctx.beginPath();
            ctx.strokeStyle = this.type === 'tracking' ? 'rgba(255, 100, 0, 0.3)' : 'rgba(255, 0, 68, 0.2)';
            ctx.lineWidth = 1;
            ctx.moveTo(this.x + 20 - camera.x, this.y + 20 - camera.y);
            ctx.lineTo(this.x + 20 + this.dirX * 600 - camera.x, this.y + 20 + this.dirY * 600 - camera.y);
            ctx.stroke();
        }

        ctx.fillStyle = this.type === 'tracking' ? '#ff8800' : '#ff0044';
        // Eye/Barrel
        const bx = this.x + 15 + this.dirX * 12;
        const by = this.y + 15 + this.dirY * 12;
        ctx.fillRect(bx - camera.x, by - camera.y, 10, 10);
        
        // Glow if about to fire
        if (this.cooldown < 30) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.type === 'tracking' ? '#ff8800' : '#ff0044';
            ctx.strokeStyle = this.type === 'tracking' ? '#ff8800' : '#ff0044';
            ctx.strokeRect(this.x - camera.x, this.y - camera.y, 40, 40);
            ctx.shadowBlur = 0;
        }
    }
}

class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.deadzone = 200;
    }

    update(playerX, playerY, levelWidth, levelHeight) {
        // Horizontal scroll with smoothing
        const targetX = playerX - CONFIG.SCREEN_WIDTH / 2;
        this.x += (targetX - this.x) * 0.1;

        // Vertical scroll (limited)
        const targetY = (playerY - CONFIG.SCREEN_HEIGHT / 2) * 0.3;
        this.y += (targetY - this.y) * 0.1;

        // Clamp
        this.x = Math.max(0, Math.min(this.x, levelWidth - CONFIG.SCREEN_WIDTH));
        this.y = Math.max(-100, Math.min(this.y, levelHeight - CONFIG.SCREEN_HEIGHT));
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
        this.width = recording[0].width || 32;
        this.height = recording[0].height || 42;
        this.shape = recording[0].shape || 'square';
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
        
        if (this.shape === 'triangle') {
            this.drawTriangle(ctx, camera);
        } else if (this.shape === 'circle') {
            this.drawCircle(ctx, camera);
        } else {
            ctx.fillRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
        }
        
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

    drawTriangle(ctx, camera) {
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2 - camera.x, this.y - camera.y);
        ctx.lineTo(this.x + this.width - camera.x, this.y + this.height - camera.y);
        ctx.lineTo(this.x - camera.x, this.y + this.height - camera.y);
        ctx.closePath();
        ctx.fill();
    }

    drawCircle(ctx, camera) {
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2 - camera.x, this.y + this.height / 2 - camera.y, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    getRect() {
        return { x: this.x, y: this.y, w: this.width, h: this.height };
    }
}

class Game {
    constructor() {
        try {
            this.canvas = document.getElementById('game-canvas');
            this.ctx = this.canvas.getContext('2d');
            
            // Fixed internal resolution
            this.baseWidth = 1200;
            this.baseHeight = 600;
            this.canvas.width = this.baseWidth;
            this.canvas.height = this.baseHeight;
            
            this.screens = {
                title: document.getElementById('title-screen'),
                levelSelect: document.getElementById('level-select'),
                game: document.getElementById('game-screen'),
                levelClear: document.getElementById('level-clear-screen'),
                clear: document.getElementById('clear-screen'),
                characterSelect: document.getElementById('character-select'),
                howToPlay: document.getElementById('how-to-play')
            };

            this.deaths = 0;
            this.levelTimer = 0;
            this.gameData = this.loadData();
            
            // Transitions
            this.fadeAlpha = 0;
            this.fadeTarget = null;
            this.isFading = false;
            this.currentScreen = 'title'; // Keep track of current screen for fade logic
            this.unlockedLevels = 1;
            this.isPaused = false;
            this.selectedCharId = 'cube';
            
            this.player = {
                x: 0, y: 0, vx: 0, vy: 0, width: 32, height: 42,
                renderW: 32, renderH: 42, // Squash and Stretch
                shape: 'square',
                maxEchoes: 6,
                moveSpeed: 4.8,
                jumpForce: -11,
                onGround: false,
                wasOnGround: false,
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
            this.turrets = [];
            this.projectiles = [];
            this.camera = new Camera();

            this.init();
        } catch (e) {
            console.error("Game Initialization Failed", e);
        }
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

        this.safeClick('start-btn', () => this.showScreen('characterSelect'));
        this.safeClick('how-to-play-btn', () => this.showScreen('howToPlay'));
        this.safeClick('back-from-how-to', () => this.showScreen('title'));
        this.safeClick('back-to-title', () => this.showScreen('title'));
        this.safeClick('back-to-title-2', () => this.showScreen('title'));
        
        // Character Selection
        const charCards = document.querySelectorAll('.char-card');
        charCards.forEach(card => {
            card.onclick = () => {
                charCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.selectedCharId = card.dataset.char;
            };
        });

        this.safeClick('confirm-char-btn', () => {
            this.applyCharacterStats();
            this.showScreen('levelSelect');
        });

        this.safeClick('resume-btn', () => this.togglePause());
        this.safeClick('restart-level-btn', () => {
            if (this.isPaused) this.togglePause();
            this.resetLevel();
        });
        this.safeClick('quit-to-select', () => {
             if (this.isPaused) this.togglePause();
            this.showScreen('levelSelect');
        });
        this.safeClick('return-to-title-btn', () => this.showScreen('title'));
        this.safeClick('return-to-hub-btn', () => this.showScreen('title'));
        
        this.safeClick('next-level-btn', () => {
            if (this.currentLevel < 7) {
                this.startLevel(this.currentLevel + 1);
            } else {
                this.showScreen('clear');
            }
        });

        this.initTouchControls();
        this.handleResize();
        window.addEventListener('resize', () => this.handleResize());
        this.renderLevelGrid();
        this.currentScreen = 'title';
        
        requestAnimationFrame(() => this.loop());
    }

    safeClick(id, callback) {
        const el = document.getElementById(id);
        if (el) el.onclick = callback;
    }

    handleResize() {
        const ww = window.innerWidth;
        const wh = window.innerHeight;
        const ratio = this.baseWidth / this.baseHeight;
        
        let newWidth, newHeight;
        if (ww / wh > ratio) {
            newHeight = wh;
            newWidth = wh * ratio;
        } else {
            newWidth = ww;
            newHeight = ww / ratio;
        }
        
        this.canvas.style.width = `${newWidth}px`;
        this.canvas.style.height = `${newHeight}px`;
    }

    initTouchControls() {
        const moveBtns = {
            'btn-left': 'KeyA',
            'btn-right': 'KeyD',
            'btn-jump': 'Space'
        };

        Object.entries(moveBtns).forEach(([id, key]) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.keys[key] = true;
            });
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.keys[key] = false;
            });
        });

        const phaseBtn = document.getElementById('btn-phase');
        if (phaseBtn) {
            phaseBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.handlePhase();
            });
        }

        const pauseBtn = document.getElementById('btn-pause');
        if (pauseBtn) {
            pauseBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.togglePause();
            });
        }
    }

    saveData() {
        localStorage.setItem('echoRun_v1', JSON.stringify(this.gameData));
    }

    loadData() {
        try {
            const saved = localStorage.getItem('echoRun_v1');
            return saved ? JSON.parse(saved) : { unlocked: [0], grades: {} };
        } catch (e) {
            console.error("Save Data Corrupted", e);
            return { unlocked: [0], grades: {} };
        }
    }

    showScreen(screenId) {
        if (this.isFading) return;
        this.isFading = true;
        this.fadeTarget = screenId;
        this.fadeAlpha = 0;
    }

    executeScreenSwitch(screenId) {
        for (const s of Object.values(this.screens)) {
            if (s) s.classList.add('hidden');
        }
        if (this.screens[screenId]) {
            this.screens[screenId].classList.remove('hidden');
        }
        this.currentScreen = screenId;
        
        if (screenId === 'levelSelect') this.updateLevelSelectUI();
        
        const helpOverlay = document.getElementById('help-overlay');
        if (screenId === 'game') {
            if (helpOverlay) {
                helpOverlay.classList.remove('hidden');
                helpOverlay.style.opacity = '1';
                setTimeout(() => {
                    if (this.screens.game && this.screens.game.classList.contains('hidden')) return;
                    if (helpOverlay) helpOverlay.style.opacity = '0';
                }, 5000);
            }
        } else if (helpOverlay) {
            helpOverlay.classList.add('hidden');
            helpOverlay.style.opacity = '1';
        }

        // Hide mobile controls on UI screens
        if (this.isMobile) {
            const mobileControls = document.getElementById('mobile-controls');
            if (mobileControls) {
                if (screenId === 'game') {
                    mobileControls.classList.remove('hidden');
                } else {
                    mobileControls.classList.add('hidden');
                }
            }
        }
    }

    updateLevelSelectUI() {
        const btns = document.querySelectorAll('.level-btn');
        btns.forEach(btn => {
            const id = parseInt(btn.dataset.level);
            btn.classList.toggle('locked', !this.gameData.unlocked.includes(id));
            const grade = this.gameData.grades[id];
            if (grade) {
                let gradeSpan = btn.querySelector('.grade-badge');
                if (!gradeSpan) {
                    gradeSpan = document.createElement('span');
                    gradeSpan.className = 'grade-badge';
                    btn.appendChild(gradeSpan);
                }
                gradeSpan.textContent = grade;
                gradeSpan.className = `grade-badge grade-${grade}`;
            }
        });
    }

    renderLevelGrid() {
        const grid = document.getElementById('level-grid');
        grid.innerHTML = '';
        for (let i = 0; i <= 7; i++) {
            const btn = document.createElement('div');
            btn.className = `level-btn`;
            btn.dataset.level = i; // Store level ID
            btn.textContent = i === 0 ? 'T' : i;
            btn.onclick = () => {
                if (this.gameData.unlocked.includes(i)) {
                    this.startLevel(i);
                }
            };
            grid.appendChild(btn);
        }
        this.updateLevelSelectUI(); // Update grades and locked status
    }

    startLevel(id) {
        this.currentLevel = id;
        this.deaths = 0;
        this.levelTimer = 0;
        this.echoes = [];
        this.isGoalReached = false;
        this.goalTimer = 0;
        this.resetLevel();
        this.showScreen('game');
    }

    resetLevel() {
        this.deaths++; // Increment death count on reset
        this.loadMap(this.currentLevel);
        this.player.x = this.levelData.start.x;
        this.player.y = this.levelData.start.y;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.isRecording = false;
        this.player.recording = [];
        this.echoes = [];
        this.projectiles = [];
        this.activeButtons.clear();
        this.camera.x = 0;
        this.applyCharacterStats();
    }

    applyCharacterStats() {
        const char = CHARACTERS[this.selectedCharId];
        this.player.width = char.width;
        this.player.height = char.height;
        this.player.moveSpeed = char.speed;
        this.player.jumpForce = char.jump;
        this.player.maxEchoes = char.maxEchoes;
        this.player.shape = char.shape;
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
                // Add shape data to recording for Echo
                const recordingData = this.player.recording.map(p => ({...p, shape: this.player.shape, width: this.player.width, height: this.player.height}));
                this.echoes.push(new Echo(recordingData, color));
                if (this.echoes.length > this.player.maxEchoes) this.echoes.shift();
                
                // Teleport back
                this.player.x = this.player.recordStartX;
                this.player.y = this.player.recordStartY;
                
                if (this.player.shape !== 'square') { // Cube (square) keeps momentum
                    this.player.vx = 0;
                    this.player.vy = 0;
                } else {
                    // Slingshot: boost momentum slightly for Cube
                    this.player.vx *= 1.2;
                    this.player.vy *= 1.2;
                    this.shakeTime = 15; // Extra shake for slingshot
                }

                this.player.trail = [];
                this.spawnParticles(this.player.x + this.player.width/2, this.player.y + this.player.height/2, color, 15);
                this.shakeTime = Math.max(this.shakeTime, 10);
            }
            this.player.isRecording = false;
        }
        
        // Visual feedback for mobile button
        const phaseBtn = document.getElementById('btn-phase');
        if (phaseBtn) {
            phaseBtn.classList.toggle('recording', this.player.isRecording);
            phaseBtn.textContent = this.player.isRecording ? 'STOP' : 'RECORD';
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
                    { x: 100, y: 300, text: "A / D で移動" },
                    { x: 100, y: 330, text: "SPACE / W でジャンプ" },
                    { x: 750, y: 450, text: "大きな溝があるぞ！" },
                    { x: 1100, y: 250, text: "SHIFTキーを長押しして移動を記録" },
                    { x: 1100, y: 280, text: "（ネオンの軌跡を確認！）" },
                    { x: 1100, y: 310, text: "離すとテレポート＆足場(ECHO)を生成" }
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
                    { x: 300, y: 250, text: "壁が高すぎる？" },
                    { x: 300, y: 280, text: "ジャンプの頂点を記録しよう。" },
                    { x: 300, y: 310, text: "それを階段のように使ってみて。" }
                ]
            },
            2: { // Sequential Gates
                width: 2800,
                start: { x: 100, y: 450 },
                goal: { x: 2600, y: 490, w: 60, h: 60 },
                walls: [
                    { x: 0, y: 550, w: 2800, h: 50 },
                    // Path 1
                    { x: 800, y: 100, w: 40, h: 450, id: 'door1' },
                    { x: 400, y: 350, w: 200, h: 20 },
                    // Path 2
                    { x: 1600, y: 100, w: 40, h: 450, id: 'door2' },
                    { x: 1200, y: 250, w: 200, h: 20 },
                    // Path 3 (New)
                    { x: 2200, y: 100, w: 40, h: 450, id: 'door3' },
                    { x: 1900, y: 400, w: 150, h: 20 }
                ],
                buttons: [
                    { x: 500, y: 340, w: 40, h: 10, target: 'door1' },
                    { x: 1300, y: 240, w: 40, h: 10, target: 'door2' },
                    { x: 2000, y: 390, w: 40, h: 10, target: 'door3' }
                ],
                hints: [
                    { x: 300, y: 250, text: "複数フェーズの連携が必要だ。" },
                    { x: 1000, y: 200, text: "エコーを使ってドアを開け続けよう。" }
                ]
            },
            3: { // Leap of Faith (Fixed)
                width: 4000,
                start: { x: 100, y: 400 },
                goal: { x: 3850, y: 450, w: 60, h: 60 },
                walls: [
                    { x: 0, y: 550, w: 500, h: 50 },
                    { x: 1200, y: 500, w: 100, h: 20 }, // Small platform mid-way
                    { x: 2400, y: 450, w: 100, h: 20 }, // Small platform mid-way
                    { x: 3600, y: 550, w: 400, h: 50 }
                ],
                spikes: [
                    { x: 500, y: 580, w: 3100, h: 20 }
                ],
                hints: [
                    { x: 200, y: 300, text: "巨大な落とし穴だ。" },
                    { x: 200, y: 330, text: "記録を繋いで、空中に橋を架けろ。" }
                ]
            },
            4: { // The Ascent (New)
                width: 1200,
                start: { x: 100, y: 500 },
                goal: { x: 1000, y: 50, w: 60, h: 60 },
                walls: [
                    { x: 0, y: 580, w: 1200, h: 20 },
                    { x: 300, y: 450, w: 600, h: 20 },
                    { x: 0, y: 320, w: 400, h: 20 },
                    { x: 500, y: 200, w: 700, h: 20 },
                    { x: 100, y: 100, w: 300, h: 20 }
                ],
                hints: [
                    { x: 100, y: 400, text: "重力はただの提案に過ぎない。" },
                    { x: 100, y: 430, text: "自分の「履歴」を登れ。" }
                ]
            },
            5: { // Synchronized Chaos (New)
                width: 3200,
                start: { x: 100, y: 450 },
                goal: { x: 3000, y: 450, w: 80, h: 80 },
                walls: [
                    { x: 0, y: 550, w: 3200, h: 50 },
                    { x: 600, y: 100, w: 40, h: 450, id: 'gateA' },
                    { x: 1200, y: 0, w: 40, h: 450, id: 'gateB' },
                    { x: 1800, y: 100, w: 40, h: 450, id: 'gateC' },
                    { x: 2400, y: 0, w: 40, h: 450, id: 'gateD' }
                ],
                buttons: [
                    { x: 400, y: 540, w: 40, h: 10, target: 'gateA' },
                    { x: 1000, y: 540, w: 40, h: 10, target: 'gateB' },
                    { x: 1600, y: 540, w: 40, h: 10, target: 'gateC' },
                    { x: 2200, y: 540, w: 40, h: 10, target: 'gateD' }
                ],
                spikes: [
                    { x: 800, y: 530, w: 100, h: 20 },
                    { x: 1400, y: 530, w: 100, h: 20 },
                    { x: 2000, y: 530, w: 100, h: 20 }
                ],
                hints: [
                    { x: 200, y: 300, text: "最終データ抽出が進行中。" },
                    { x: 200, y: 330, text: "守護者の動きに注意せよ。" }
                ],
                turrets: [
                    { x: 1000, y: 400, dirX: -1, dirY: 0 },
                    { x: 1600, y: 400, dirX: 1, dirY: 0 }
                ]
            },
            6: { // The Gauntlet (New)
                width: 3500,
                start: { x: 100, y: 450 },
                goal: { x: 3300, y: 450, w: 80, h: 80 },
                walls: [
                    { x: 0, y: 550, w: 3500, h: 50 },
                    { x: 800, y: 300, w: 40, h: 250 }, // Wall to jump over
                    { x: 1800, y: 300, w: 40, h: 250 }
                ],
                turrets: [
                    { x: 1200, y: 510, dirX: -1, dirY: 0 }, // Shoots left at player
                    { x: 1400, y: 510, dirX: -1, dirY: 0 },
                    { x: 2200, y: 510, dirX: -1, dirY: 0 },
                    { x: 2400, y: 510, dirX: -1, dirY: 0 },
                    { x: 3000, y: 510, dirX: -1, dirY: 0 }
                ],
                hints: [
                    { x: 200, y: 300, text: "ヴォイド弾を検知。" },
                    { x: 200, y: 330, text: "「過去」を盾として使え。" },
                    { x: 200, y: 360, text: "静止状態のエコーで弾を遮断できる。" }
                ]
            },
            7: { // The Eye
                width: 2000,
                start: { x: 100, y: 500 },
                goal: { x: 1800, y: 100, w: 80, h: 80 },
                walls: [
                    { x: 0, y: 580, w: 2000, h: 20 },
                    { x: 400, y: 450, w: 200, h: 20 },
                    { x: 800, y: 350, w: 200, h: 20 },
                    { x: 1200, y: 250, w: 200, h: 20 }
                ],
                turrets: [
                    { x: 600, y: 100, dirX: 0, dirY: 0, type: 'tracking' },
                    { x: 1400, y: 400, dirX: 0, dirY: 0, type: 'tracking' },
                    { x: 1000, y: 500, dirX: 0, dirY: 0, type: 'fixed' }
                ],
                hints: [
                    { x: 200, y: 300, text: "追跡信号を検知。" },
                    { x: 200, y: 330, text: "彼らは常に君を見ている。" },
                    { x: 200, y: 360, text: "エコーだけが、彼らの視線を逸らせる。" }
                ]
            }
        };
        this.levelData = levels[id] || levels[0];

        // Initialize Turrets
        this.turrets = [];
        if (this.levelData.turrets) {
            this.levelData.turrets.forEach(t => {
                this.turrets.push(new Turret(t.x, t.y, t.dirX, t.dirY, t.type || 'fixed'));
            });
        }
    }

    loop() {
        requestAnimationFrame(() => this.loop());
        
        try {
            this.updateFade();
            if (!this.isPaused && this.currentScreen === 'game') {
                this.update();
            }
            this.draw();
        } catch (e) {
            console.error("Game Loop Error:", e);
        }
    }

    updateFade() {
        if (this.isFading) {
            this.fadeAlpha += 0.05;
            if (this.fadeAlpha >= 1) {
                this.executeScreenSwitch(this.fadeTarget);
                this.isFading = false;
                this.fadeAlpha = 1; 
            }
        } else if (this.fadeAlpha > 0) {
            this.fadeAlpha -= 0.05;
        }
    }

    update() {
        if (this.currentScreen !== 'game') return;

        if (this.isGoalReached) {
            this.goalTimer--;
            if (this.goalTimer <= 0) {
                this.showLevelClearScreen(); // Changed to showLevelClearScreen
            }
            return;
        }

        this.levelTimer++;
        let timeScale = 1.0;
        if (this.player.isRecording && this.player.shape === 'circle') {
            timeScale = 0.4; // 40% speed
        }

        this.updatePlayer(timeScale);
        
        // Everything else scaled by timeScale
        this.echoes.forEach(e => {
            for (let i = 0; i < (timeScale < 1 ? 0 : 1); i++) e.update(); 
            // Better: update echoes precisely
            if (timeScale >= 1 || Math.random() < timeScale) e.update();
        });
        
        // Turrets and Projectiles
        this.turrets.forEach(t => {
             // For turrets, we still use the randomized fire rate skip, but maybe smoother
            if (timeScale >= 1 || Math.random() < timeScale) t.update(this);
        });
        
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(timeScale);
            
            // Remove if life is out
            if (p.life <= 0) {
                this.projectiles.splice(i, 1);
                continue;
            }

            // Collision with Walls
            let hitWall = false;
            for (const w of this.levelData.walls) {
                if (w.id && this.activeButtons.has(w.id)) continue;
                if (this.rectIntersect({ x: p.x, y: p.y, width: p.width, height: p.height }, { x: w.x, y: w.y, width: w.w, height: w.h })) {
                    hitWall = true;
                    break;
                }
            }
            if (hitWall) {
                this.spawnParticles(p.x + 6, p.y + 6, p.color, 3);
                this.projectiles.splice(i, 1);
                continue;
            }

            // Collision with Echoes (SHIELD)
            let hitEcho = false;
            for (const e of this.echoes) {
                if (this.rectIntersect({ x: p.x, y: p.y, width: p.width, height: p.height }, { x: e.x, y: e.y, width: e.width, height: e.height })) {
                    hitEcho = true;
                    break;
                }
            }
            if (hitEcho) {
                this.spawnParticles(p.x + 6, p.y + 6, '#00f2ff', 5);
                this.projectiles.splice(i, 1);
                continue;
            }

            // Collision with Player (DEATH)
            if (this.rectIntersect({ x: p.x, y: p.y, width: p.width, height: p.height }, this.player)) {
                this.resetLevel();
                return;
            }
        }

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

    updatePlayer(ts = 1.0) {
        // Horizontal
        let speed = this.player.moveSpeed * ts;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.player.vx = -speed;
        else if (this.keys['KeyD'] || this.keys['ArrowRight']) this.player.vx = speed;
        else this.player.vx *= 0.8;

        // Gravity
        this.player.vy += CONFIG.GRAVITY * ts;

        // Jump Handling (Coyote + Buffer)
        if (this.player.onGround) this.player.coyoteTimer = CONFIG.COYOTE_TIME;
        else this.player.coyoteTimer--;

        if (this.keys['Space'] || this.keys['ArrowUp'] || this.keys['KeyW']) this.player.jumpBuffer = CONFIG.JUMP_BUFFER;
        else this.player.jumpBuffer--;

        // Jump Exec
        if (this.player.jumpBuffer > 0) {
            if (this.player.coyoteTimer > 0) {
                // Normal Jump
                this.player.vy = this.player.jumpForce;
                this.player.jumpBuffer = 0;
                this.player.coyoteTimer = 0;
                this.spawnParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height, CONFIG.COLORS.PLAYER, 5);
                
                // Squash and Stretch: Stretch on jump
                this.player.renderW = this.player.width * 0.8;
                this.player.renderH = this.player.height * 1.3;
            } else if (this.player.shape === 'triangle' && !this.player.onGround) {
                // Wall Jump (Triangle Only)
                const wallSide = this.getWallSide();
                if (wallSide !== 0) {
                    this.player.vy = this.player.jumpForce * 0.9;
                    this.player.vx = -wallSide * this.player.moveSpeed * 1.5;
                    this.player.jumpBuffer = 0;
                    this.spawnParticles(this.player.x + (wallSide > 0 ? this.player.width : 0), this.player.y + this.player.height/2, '#fff', 8);
                    this.shakeTime = 5;
                    this.player.renderW = this.player.width * 0.7;
                    this.player.renderH = this.player.height * 1.4;
                }
            }
        }

        // Movement Execution
        this.player.wasOnGround = this.player.onGround;
        this.player.x += this.player.vx;
        this.resolveCollisions(true);
        this.player.y += this.player.vy;
        this.resolveCollisions(false);

        // Landing Impact
        if (this.player.onGround && !this.player.wasOnGround) {
            this.spawnParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height, '#fff', 5);
            this.player.renderW = this.player.width * 1.4;
            this.player.renderH = this.player.height * 0.6;
            if (Math.abs(this.player.vy) > 10) this.shakeTime = 10;
        }

        // Lerp Squash and Stretch back to normal
        this.player.renderW += (this.player.width - this.player.renderW) * 0.2;
        this.player.renderH += (this.player.height - this.player.renderH) * 0.2;

        // Recording
        if (this.player.isRecording) {
            this.player.recording.push({ x: this.player.x, y: this.player.y });
            // Add to trail every few frames for performance
            if (this.player.recording.length % 2 === 0) {
                 this.player.trail.push({ x: this.player.x + this.player.width / 2, y: this.player.y + this.player.height / 2 });
            }
        }
    }

    getWallSide() {
        // Check small offset left/right for wall collision
        let side = 0;
        const checkDist = 4;
        
        const leftRect = { x: this.player.x - checkDist, y: this.player.y + 4, width: checkDist, height: this.player.height - 8 };
        const rightRect = { x: this.player.x + this.player.width, y: this.player.y + 4, width: checkDist, height: this.player.height - 8 };

        for (const w of this.levelData.walls) {
            if (w.id && this.activeButtons.has(w.id)) continue;
            const wr = { x: w.x, y: w.y, width: w.w, height: w.h };
            if (this.rectIntersect(leftRect, wr)) side = -1;
            if (this.rectIntersect(rightRect, wr)) side = 1;
        }
        return side;
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
        this.spawnParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, CONFIG.COLORS.GOAL, 30);
    }

    showLevelClearScreen() {
        const grade = this.calcGrade();
        this.gameData.grades[this.currentLevel] = grade;
        if (!this.gameData.unlocked.includes(this.currentLevel + 1)) {
            this.gameData.unlocked.push(this.currentLevel + 1);
        }
        this.saveData();

        document.getElementById('clear-grade').textContent = grade;
        document.getElementById('clear-time').textContent = (this.levelTimer / 60).toFixed(2) + "s";
        document.getElementById('clear-deaths').textContent = this.deaths;

        if (this.currentLevel >= 0 && this.currentLevel <= 6) {
             const idText = this.currentLevel === 0 ? 'Tutorial' : this.currentLevel;
             document.getElementById('cleared-sector-id').textContent = idText;
             
             const nextBtn = document.getElementById('next-level-btn');
             nextBtn.textContent = 'PROCEED TO NEXT SECTOR';
             nextBtn.onclick = () => this.startLevel(this.currentLevel + 1);
             
             this.showScreen('levelClear');
        } else {
            // Final Sector cleared
            this.showScreen('clear');
        }
    }

    calcGrade() {
        const t = this.levelTimer / 60;
        const d = this.deaths;
        // Simple heuristic
        if (t < 15 && d === 0) return 'S';
        if (t < 25 && d < 2) return 'A';
        if (t < 40 && d < 5) return 'B';
        return 'C';
    }

    spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y, color));
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        document.getElementById('pause-menu').classList.toggle('hidden', !this.isPaused);
    }

    draw() {
        // Transitions (Top Layer)
        if (this.fadeAlpha > 0) {
            this.ctx.save();
            this.ctx.fillStyle = `rgba(0,0,0,${this.fadeAlpha})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();
        }

        if (this.shakeTime > 0) {
            this.ctx.save();
            this.ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
            this.shakeTime--;
        }

        // Background
        this.drawParallax();

        this.ctx.fillStyle = 'rgba(10, 10, 20, 0.4)'; // Slight trail for motion
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

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

        // Turrets
        this.turrets.forEach(t => t.draw(this.ctx, this.camera));

        // Projectiles
        this.projectiles.forEach(p => p.draw(this.ctx, this.camera));

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
            this.ctx.strokeRect(this.player.x - this.camera.x - 4, this.player.y - this.camera.y - 4, this.player.width + 8, this.player.height + 8);
        } else {
             this.ctx.shadowBlur = 15;
             this.ctx.shadowColor = CONFIG.COLORS.PLAYER;
        }

        if (this.player.shape === 'triangle') {
            this.ctx.beginPath();
            const rw = this.player.renderW;
            const rh = this.player.renderH;
            const ox = this.player.x + this.player.width / 2 - this.camera.x;
            const oy = this.player.y + this.player.height - this.camera.y;
            this.ctx.moveTo(ox, oy - rh);
            this.ctx.lineTo(ox + rw / 2, oy);
            this.ctx.lineTo(ox - rw / 2, oy);
            this.ctx.closePath();
            this.ctx.fill();
        } else if (this.player.shape === 'circle') {
            this.ctx.beginPath();
            const rw = this.player.renderW;
            const rh = this.player.renderH;
            this.ctx.ellipse(this.player.x + this.player.width / 2 - this.camera.x, this.player.y + this.player.height / 2 - this.camera.y, rw / 2, rh / 2, 0, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            // Cube: Draw with squash and stretch
            const rw = this.player.renderW;
            const rh = this.player.renderH;
            const dx = this.player.x + this.player.width / 2 - rw / 2 - this.camera.x;
            const dy = this.player.y + this.player.height - rh - this.camera.y;
            this.ctx.fillRect(dx, dy, rw, rh);
            
            // After-images for Cube (Momentum)
            if (Math.abs(this.player.vx) > 8 || Math.abs(this.player.vy) > 12) {
                this.ctx.globalAlpha = 0.3;
                this.ctx.fillRect(dx - this.player.vx * 2, dy - this.player.vy * 2, rw, rh);
                this.ctx.globalAlpha = 0.15;
                this.ctx.fillRect(dx - this.player.vx * 4, dy - this.player.vy * 4, rw, rh);
                this.ctx.globalAlpha = 1.0;
            }

            // Speed Lines for high velocity (Commercial Juice)
            if (Math.abs(this.player.vx) > 10) {
                this.ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                for(let i=0; i<3; i++) {
                    const ly = dy + Math.random() * rh;
                    this.ctx.moveTo(dx, ly);
                    this.ctx.lineTo(dx - this.player.vx * 5, ly);
                }
                this.ctx.stroke();
            }
        }
        this.ctx.shadowBlur = 0;

        // Particles
        this.particles = this.particles.filter(p => p.life > 0);
        this.particles.forEach(p => {
            p.update();
            p.draw(this.ctx, this.camera);
        });

        // Hints
        this.ctx.fillStyle = 'rgba(255,255,255,0.7)';
        this.ctx.font = '18px sans-serif'; // Use sans-serif for Japanese support
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

        // Post-Processing
        this.drawPostProcessing();

        // UI Overlay
        this.drawUI();
        
        if (this.player.isRecording && Math.random() > 0.9) this.ctx.restore(); // Restore glitch
        if (this.shakeTime > 0) this.ctx.restore();
    }

    drawParallax() {
        const cx = this.camera.x;
        const cy = this.camera.y;

        // Layer 1: Far Stars (Slowest)
        this.ctx.fillStyle = '#114';
        for (let i = 0; i < 50; i++) {
            let x = (i * 12345 % 4000) - cx * 0.1;
            let y = (i * 9876 % 600) - cy * 0.05;
            this.ctx.fillRect(x, y, 2, 2);
        }

        // Layer 2: Mid structures
        this.ctx.fillStyle = 'rgba(30, 30, 50, 0.5)';
        for (let i = 0; i < 20; i++) {
            let x = (i * 3333 % 5000) - cx * 0.3;
            let y = 300 - cy * 0.1;
            this.ctx.fillRect(x, y, 100, 300);
        }
    }

    drawPostProcessing() {
        // Vignette
        const grad = this.ctx.createRadialGradient(
            this.canvas.width/2, this.canvas.height/2, 100,
            this.canvas.width/2, this.canvas.height/2, 600
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.4)');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Scanlines
        this.ctx.fillStyle = 'rgba(0,0,0,0.05)';
        for (let i = 0; i < this.canvas.height; i += 4) {
            this.ctx.fillRect(0, i, this.canvas.width, 1);
        }
    }

    drawUI() {
        // Echo Count
        this.ctx.fillStyle = 'white';
        this.ctx.font = '700 14px Outfit';
        this.ctx.fillText(`SECTOR: ${this.currentLevel === 0 ? 'T' : this.currentLevel}`, 20, 30);
        this.ctx.fillText(`ECHOES: ${this.echoes.length}/${this.player.maxEchoes}`, 20, 50);
        this.ctx.fillText(`AVATAR: ${CHARACTERS[this.selectedCharId].name}`, 20, 70);
        
        if (this.player.isRecording) {
            const blink = Math.floor(Date.now() / 400) % 2 === 0;
            if (blink) {
                this.ctx.fillStyle = '#ff00ff';
                this.ctx.fillText('PHASE RECORDING...', 20, 90);
            }
        }
    }
}

function startGame() {
    console.log("ECHO RUN: Initializing System...");
    if (!window.gameInstance) {
        window.gameInstance = new Game();
        console.log("ECHO RUN: Core Initialized.");
    }
}

// More robust initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGame);
} else {
    startGame();
}

