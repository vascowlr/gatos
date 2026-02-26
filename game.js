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
const LEVEL_WIDTH = 5000; // Large level for exploration

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

// UI Elements
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
    if (key === ' ' || key === 'w') keys.space = true;
    else if (keys.hasOwnProperty(key)) keys[key] = true;

    if (key === 'e' && gameState === 'PLAYING') {
        player.attack();
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === ' ' || key === 'w') keys.space = false;
    else if (keys.hasOwnProperty(key)) keys[key] = false;
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

        // Ground Collision
        const groundY = canvas.height * GROUND_Y_RATIO - this.height;
        if (this.y > groundY) {
            this.y = groundY;
            this.vy = 0;
            this.onGround = true;
        }

        // Boundaries
        if (this.x < 0) this.x = 0;
        if (this.x > LEVEL_WIDTH - this.width) {
            this.x = LEVEL_WIDTH - this.width;
            showVictory();
        }

        // Camera Follow
        const targetCamX = this.x - canvas.width / 3;
        cameraX += (targetCamX - cameraX) * 0.1; // Smooth camera
        if (cameraX < 0) cameraX = 0;
        if (cameraX > LEVEL_WIDTH - canvas.width) cameraX = LEVEL_WIDTH - canvas.width;
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
        if (this.facing === -1) {
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
        this.y = canvas.height * GROUND_Y_RATIO - this.height;

        // Patrol logic
        if (this.x < this.spawnX - 400) this.vx = Math.abs(this.vx);
        if (this.x > this.spawnX + 400) this.vx = -Math.abs(this.vx);

        if (this.x < 0) this.vx = Math.abs(this.vx);
        if (this.x > LEVEL_WIDTH - this.width) this.vx = -Math.abs(this.vx);

        // Player collision
        if (checkCollision(this, player)) {
            takeDamage(0.3);
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
        ctx.shadowColor = '#0ff';
        ctx.fill();
        ctx.restore();
    }
}

// Collections
let player = new Player();
let enemies = [];
let projectiles = [];

function init() {
    resize();
    hideScreens();
    player.reset();
    createEnemies();
    projectiles = [];
    cameraX = 0;
    gameState = 'PLAYING';
    gameLoop();
}

function hideScreens() {
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    victoryScreen.classList.remove('active');
}

function createEnemies() {
    enemies = [];
    for (let i = 0; i < 12; i++) {
        enemies.push(new Enemy(800 + i * 500 + Math.random() * 200));
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
}

function gameOver() {
    gameState = 'GAMEOVER';
    hideScreens();
    gameOverScreen.classList.add('active');
}

function showVictory() {
    gameState = 'VICTORY';
    hideScreens();
    victoryScreen.classList.add('active');
}

function gameLoop() {
    if (gameState !== 'PLAYING') return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Parallax Background
    const bgWidth = canvas.height * (assets.background.width / assets.background.height || 1.77);
    for (let i = 0; i < Math.ceil(LEVEL_WIDTH / bgWidth) + 1; i++) {
        ctx.drawImage(assets.background, i * bgWidth - cameraX * 0.5, 0, bgWidth, canvas.height);
    }

    // Entities
    player.update();
    player.render();

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.update();
        p.render();

        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (p.x > e.x && p.x < e.x + e.width && p.y > e.y && p.y < e.y + e.height) {
                e.health--;
                projectiles.splice(i, 1);
                if (e.health <= 0) {
                    enemies.splice(j, 1);
                    hairballs += 2; // Reward for kill
                    updateHUD();
                }
                break;
            }
        }
        if (p.x < cameraX - 100 || p.x > cameraX + canvas.width + 100) projectiles.splice(i, 1);
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
startScreen.classList.add('active');
