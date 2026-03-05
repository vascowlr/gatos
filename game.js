/**
 * Stray Love: O Fugitivo - Core Game Engine
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Constants
const GRAVITY = 0.5;
const GROUND_Y_RATIO = 0.85;
const PLAYER_SPEED = 6;
const JUMP_FORCE = -14;
const ENEMY_SPEED = 2.5;
const HAIRBALL_SPEED = 12;
const MAX_HEALTH = 100;
const LEVEL_WIDTH = 3500; // Será definido dinamicamente por fase
let currentLevel = 1;
const MAX_LEVELS = 3;

// Game State
let gameState = 'START';
let health = MAX_HEALTH;
let hairballs = 15;
let cameraX = 0;
let animationId;

// Asset Loading
const assets = {
    hero: new Image(),
    enemy: new Image(),
    background: new Image()
};

assets.hero.src = 'assets/hero_cat.png';
assets.enemy.src = 'assets/mafia_cat.png';
assets.background.src = 'assets/background.png';
assets.boss = new Image();
assets.boss.src = 'assets/mafia_cat.png'; // No boss icon yet, using mafia for now

// UI Elements
const uiOverlay = document.getElementById('ui-overlay');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const victoryScreen = document.getElementById('victory-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const replayBtn = document.getElementById('replay-btn');
const healthBar = document.getElementById('health-bar');
const hairballCount = document.getElementById('hairball-count');

// Input Handling
const keys = {
    w: false, a: false, s: false, d: false,
    space: false, e: false
};

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === ' ' || key === 'w' || key === 'arrowup') keys.space = true;
    else if (key === 'a' || key === 'arrowleft') keys.a = true;
    else if (key === 'd' || key === 'arrowright') keys.d = true;
    else if (key === 's' || key === 'arrowdown') keys.s = true;
    else if (key === 'e') keys.e = true;

    if ((key === 'e') && gameState === 'PLAYING') {
        player.attack();
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === ' ' || key === 'w' || key === 'arrowup') keys.space = false;
    else if (key === 'a' || key === 'arrowleft') keys.a = false;
    else if (key === 'd' || key === 'arrowright') keys.d = false;
    else if (key === 's' || key === 'arrowdown') keys.s = false;
    else if (key === 'e') keys.e = false;
});

// Classes
class Player {
    constructor() {
        this.width = 120;
        this.height = 120;
        this.reset();
        this.lastAttackTime = 0;
    }

    reset() {
        this.x = 100;
        this.y = canvas.height * GROUND_Y_RATIO - this.height;
        this.vx = 0;
        this.vy = 0;
        this.facing = 1;
        this.onGround = false;
        health = MAX_HEALTH;
        hairballs = 15;
        updateHUD();
    }

    update() {
        // Movement
        if (keys.a) {
            this.vx = -PLAYER_SPEED;
            this.facing = -1;
        } else if (keys.d) {
            this.vx = PLAYER_SPEED;
            this.facing = 1;
        } else {
            this.vx *= 0.85; // Friction
        }

        this.x += this.vx;

        // Jump
        if (keys.space && this.onGround) {
            this.vy = JUMP_FORCE;
            this.onGround = false;
        }

        // Gravity
        this.vy += GRAVITY;
        this.y += this.vy;

        // Platform & Ground Collision
        const groundY = canvas.height * GROUND_Y_RATIO - this.height;
        this.onGround = false;

        // Check Platforms first (landing from top)
        for (let p of platforms) {
            if (this.vy >= 0 &&
                this.x + this.width * 0.3 < p.x + p.w &&
                this.x + this.width * 0.7 > p.x &&
                this.y + this.height >= p.y &&
                this.y + this.height <= p.y + p.h + this.vy) {
                this.y = p.y - this.height;
                this.vy = 0;
                this.onGround = true;
                break;
            }
        }

        // Ground Collision
        if (this.y > groundY) {
            this.y = groundY;
            this.vy = 0;
            this.onGround = true;
        }

        // Boundaries
        if (this.x < 0) this.x = 0;
        if (this.x > levelConfig.width - this.width) {
            this.x = levelConfig.width - this.width;
            if (enemies.length === 0 && (!boss || boss.isDead)) {
                nextLevel();
            }
        }

        // Camera Follow
        const targetCamX = this.x - canvas.width / 3;
        cameraX += (targetCamX - cameraX) * 0.1; // Smooth camera
        if (cameraX < 0) cameraX = 0;
        if (cameraX > levelConfig.width - canvas.width) cameraX = levelConfig.width - canvas.width;
    }

    attack() {
        const now = Date.now();
        if (hairballs > 0 && now - this.lastAttackTime > 350) {
            projectiles.push(new Projectile(this.x + this.width / 2, this.y + this.height / 2, this.facing));
            hairballs--;
            this.lastAttackTime = now;
            updateHUD();
        }
    }

    render() {
        ctx.save();
        ctx.translate(-cameraX, 0);

        // Glow to hide "fake png" edges
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(0, 255, 255, 0.5)';

        if (this.facing === 1) {
            ctx.translate(this.x + this.width, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(assets.hero, 0, 0, this.width, this.height);
        } else {
            ctx.drawImage(assets.hero, this.x, this.y, this.width, this.height);
        }
        ctx.restore();
    }
}

class Enemy {
    constructor(x) {
        this.width = 110;
        this.height = 110;
        this.x = x;
        this.y = canvas.height * GROUND_Y_RATIO - this.height;
        this.speed = ENEMY_SPEED + Math.random() * 1.5;
        this.health = 2;
        this.vx = -this.speed;
        this.spawnX = x;
    }

    update() {
        this.x += this.vx;

        // Grounded Y
        const groundY = canvas.height * GROUND_Y_RATIO - this.height;
        this.y = groundY;

        // Patrol logic
        if (this.x < this.spawnX - 300) {
            this.vx = Math.abs(this.vx);
            this.x = this.spawnX - 300;
        }
        if (this.x > this.spawnX + 300) {
            this.vx = -Math.abs(this.vx);
            this.x = this.spawnX + 300;
        }

        // Stay within level boundaries and handle walls better
        if (this.x < 0) {
            this.x = 0;
            this.vx = Math.abs(this.vx);
        }
        if (this.x > levelConfig.width - this.width) {
            this.x = levelConfig.width - this.width;
            this.vx = -Math.abs(this.vx);
        }

        // Player collision
        if (checkCollision(this, player)) {
            takeDamage(0.5);
        }
    }

    render() {
        ctx.save();
        ctx.translate(-cameraX, 0);
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(255, 0, 85, 0.4)';
        if (this.vx > 0) {
            ctx.translate(this.x + this.width, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(assets.enemy, 0, 0, this.width, this.height);
        } else {
            ctx.drawImage(assets.enemy, this.x, this.y, this.width, this.height);
        }
        ctx.restore();
    }
}

class Projectile {
    constructor(x, y, dir) {
        this.x = x;
        this.y = y;
        this.radius = 12;
        this.vx = dir * HAIRBALL_SPEED;
    }

    update() {
        this.x += this.vx;
    }

    render() {
        ctx.save();
        ctx.translate(-cameraX, 0);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#fff';
        ctx.fill();
        ctx.restore();
    }
}

class Platform {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    render() {
        ctx.save();
        ctx.translate(-cameraX, 0);

        // Stylish platform
        const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.h);
        grad.addColorStop(0, '#333');
        grad.addColorStop(1, '#000');
        ctx.fillStyle = grad;
        ctx.fillRect(this.x, this.y, this.w, this.h);

        // Neon edge
        ctx.strokeStyle = 'var(--secondary-color)';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.w, this.h);

        ctx.restore();
    }
}

class Boss {
    constructor() {
        this.width = 250;
        this.height = 250;
        this.x = 2800;
        this.y = canvas.height * GROUND_Y_RATIO - this.height;
        this.health = 20;
        this.maxHealth = 20;
        this.vx = -4;
        this.state = 'PATROL';
        this.lastAttack = 0;
        this.isDead = false;
    }

    update() {
        if (this.isDead) return;

        this.x += this.vx;

        // Boss AI
        if (this.x < 2000) this.vx = 4;
        if (this.x > levelConfig.width - this.width) this.vx = -4;

        // Boss Attack (fires mafia cats or something?)
        const now = Date.now();
        if (now - this.lastAttack > 2000) {
            // Spawn an enemy
            enemies.push(new Enemy(this.x));
            this.lastAttack = now;
        }

        if (checkCollision(this, player)) {
            takeDamage(2);
        }
    }

    render() {
        if (this.isDead) return;
        ctx.save();
        ctx.translate(-cameraX, 0);

        // Red glow for boss
        ctx.shadowBlur = 40;
        ctx.shadowColor = 'red';

        if (this.vx > 0) {
            ctx.translate(this.x + this.width, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(assets.enemy, 0, 0, this.width, this.height);
        } else {
            ctx.drawImage(assets.enemy, this.x, this.y, this.width, this.height);
        }

        // Boss Health Bar
        const barW = 200;
        ctx.fillStyle = '#444';
        ctx.fillRect(this.x + (this.width - barW) / 2, this.y - 40, barW, 10);
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x + (this.width - barW) / 2, this.y - 40, barW * (this.health / this.maxHealth), 10);

        ctx.restore();
    }
}

// Level Configs
const levelConfigs = [
    {
        width: 3000,
        enemyCount: 6,
        platforms: [
            new Platform(800, 450, 200, 20),
            new Platform(1200, 350, 250, 20),
            new Platform(1600, 450, 200, 20),
            new Platform(2200, 300, 300, 20)
        ],
        hasBoss: false
    },
    {
        width: 4000,
        enemyCount: 10,
        platforms: [
            new Platform(600, 500, 150, 20),
            new Platform(900, 400, 150, 20),
            new Platform(1200, 300, 150, 20),
            new Platform(1600, 450, 200, 20),
            new Platform(2000, 350, 200, 20),
            new Platform(2400, 250, 200, 20),
            new Platform(2800, 400, 200, 20)
        ],
        hasBoss: false
    },
    {
        width: 3500,
        enemyCount: 4,
        platforms: [
            new Platform(500, 450, 300, 20),
            new Platform(1000, 350, 300, 20),
            new Platform(1500, 450, 300, 20),
            new Platform(2000, 300, 400, 20)
        ],
        hasBoss: true
    }
];

// Collections
let player = new Player();
let enemies = [];
let projectiles = [];
let platforms = [];
let boss = null;
let levelConfig = levelConfigs[0];

function init() {
    currentLevel = 1;
    startLevel(1);
}

function startLevel(lvl) {
    resize();
    hideScreens();
    currentLevel = lvl;
    levelConfig = levelConfigs[lvl - 1];

    player.reset();
    createEnemies();
    platforms = levelConfig.platforms;
    projectiles = [];
    cameraX = 0;

    if (levelConfig.hasBoss) {
        boss = new Boss();
    } else {
        boss = null;
    }

    gameState = 'PLAYING';
    if (!animationId) gameLoop();
}

function nextLevel() {
    if (currentLevel < MAX_LEVELS) {
        startLevel(currentLevel + 1);
    } else {
        showVictory();
    }
}

function hideScreens() {
    uiOverlay.classList.remove('active');
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    victoryScreen.classList.remove('active');
}

function createEnemies() {
    enemies = [];
    const count = levelConfig.enemyCount;
    for (let i = 0; i < count; i++) {
        enemies.push(new Enemy(800 + i * (levelConfig.width / (count + 1)) + Math.random() * 200));
    }
}

function resize() {
    const container = document.getElementById('game-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

function checkCollision(obj1, obj2) {
    const m = 30; // Collision margin
    return obj1.x + m < obj2.x + obj2.width - m &&
        obj1.x + obj1.width - m > obj2.x + m &&
        obj1.y + m < obj2.y + obj2.height - m &&
        obj1.y + obj1.height - m > obj2.y + m;
}

function takeDamage(amt) {
    health -= amt;
    if (health <= 0) {
        health = 0;
        gameOver();
    }
    updateHUD();
}

function updateHUD() {
    healthBar.style.width = `${health}%`;
    hairballCount.innerText = hairballs;
    const levelDisplay = document.getElementById('level-display');
    if (levelDisplay) {
        levelDisplay.innerText = `Level ${currentLevel}${levelConfig.hasBoss ? ' (BOSS)' : ''}`;
    }
}

function gameOver() {
    gameState = 'GAMEOVER';
    hideScreens();
    uiOverlay.classList.add('active');
    gameOverScreen.classList.add('active');
}

function showVictory() {
    gameState = 'VICTORY';
    hideScreens();
    uiOverlay.classList.add('active');
    victoryScreen.classList.add('active');
}

function gameLoop() {
    if (gameState !== 'PLAYING') {
        animationId = null;
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Parallax Background
    const bgWidth = canvas.height * (assets.background.width / assets.background.height || 1.77);
    for (let i = 0; i < Math.ceil(LEVEL_WIDTH / bgWidth) + 1; i++) {
        ctx.drawImage(assets.background, i * bgWidth - cameraX * 0.5, 0, bgWidth, canvas.height);
    }

    // Platforms
    for (let p of platforms) {
        p.render();
    }

    // Entities
    player.update();
    player.render();

    if (boss) {
        boss.update();
        boss.render();
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.update();
        p.render();

        // Check enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (p.x > e.x && p.x < e.x + e.width && p.y > e.y && p.y < e.y + e.height) {
                e.health--;
                projectiles.splice(i, 1);
                if (e.health <= 0) {
                    enemies.splice(j, 1);
                    hairballs += 2;
                    updateHUD();
                }
                break;
            }
        }

        // Check boss
        if (boss && !boss.isDead && projectiles[i]) {
            if (p.x > boss.x && p.x < boss.x + boss.width && p.y > boss.y && p.y < boss.y + boss.height) {
                boss.health--;
                projectiles.splice(i, 1);
                if (boss.health <= 0) {
                    boss.isDead = true;
                    hairballs += 10;
                    updateHUD();
                }
            }
        }

        if (p.x < cameraX - 100 || p.x > cameraX + canvas.width + 100) {
            if (projectiles[i]) projectiles.splice(i, 1);
        }
    }

    for (let e of enemies) {
        e.update();
        e.render();
    }

    animationId = requestAnimationFrame(gameLoop);
}

// Listeners
window.addEventListener('resize', resize);
startBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);
replayBtn.addEventListener('click', init);

// Initial State
resize();
uiOverlay.classList.add('active');
startScreen.classList.add('active');
