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

let currentLevel = 1;
const MAX_LEVELS = 25;

// Game State
let gameState = 'START';
let health = MAX_HEALTH;
let hairballs = 15;
let cameraX = 0;
let animationId;
let playerDamageBonus = 0;
let heavyAttackCooldown = 20000;

// Asset Loading
const assets = {
    hero: new Image(),
    enemy: new Image(),
    background: new Image(),
    boss: new Image()
};

function processImage(img, callback) {
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Filtro agressivo para o xadrez fake e fundos pretos
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];

            // Branco/Cinza (xadrez)
            const isWhiteOrGray = (r > 200 && g > 200 && b > 200) ||
                (Math.abs(r - 192) < 35 && Math.abs(g - 192) < 35 && Math.abs(b - 192) < 35);

            // Preto (para a nova imagem do gato)
            const isBlack = r < 50 && g < 50 && b < 50;

            if (isWhiteOrGray || isBlack) {
                data[i + 3] = 0; // Fica transparente
            }
        }

        ctx.putImageData(imageData, 0, 0);
        const newImg = new Image();
        newImg.src = canvas.toDataURL();
        newImg.onload = () => callback(newImg);
    };
}

assets.hero.src = 'assets/hero_cat.png';
processImage(assets.hero, (img) => { assets.hero = img; });

assets.enemy.src = 'assets/mafia_cat.png';
processImage(assets.enemy, (img) => {
    assets.enemy = img;
    assets.boss = img;
});

assets.background.src = 'assets/background.png';

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
    space: false, e: false, f: false
};

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === ' ' || key === 'w' || key === 'arrowup') keys.space = true;
    else if (key === 'a' || key === 'arrowleft') keys.a = true;
    else if (key === 'd' || key === 'arrowright') keys.d = true;
    else if (key === 's' || key === 'arrowdown') keys.s = true;
    else if (key === 'e') keys.e = true;
    else if (key === 'f') keys.f = true;

    if (gameState === 'PLAYING') {
        if (key === 'e') player.attack();
        if (key === 'f') player.heavyAttack();
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === ' ' || key === 'w' || key === 'arrowup') keys.space = false;
    else if (key === 'a' || key === 'arrowleft') keys.a = false;
    else if (key === 'd' || key === 'arrowright') keys.d = false;
    else if (key === 's' || key === 'arrowdown') keys.s = false;
    else if (key === 'e') keys.e = false;
    else if (key === 'f') keys.f = false;
});


// Classes
class Player {
    constructor() {
        this.width = 120;
        this.height = 120;
        this.lastAttackTime = 0;
        this.lastHeavyAttackTime = 0;
        this.reset();
    }

    reset() {
        this.x = 100;
        this.y = canvas.height * GROUND_Y_RATIO - this.height;
        this.vx = 0;
        this.vy = 0;
        this.facing = 1;
        this.onGround = false;
        // Permite usar logo de cara
        this.lastHeavyAttackTime = Date.now() - heavyAttackCooldown;
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
        if (now - this.lastAttackTime > 350) {
            projectiles.push(new Projectile(this.x + this.width / 2, this.y + this.height / 2, this.facing));
            this.lastAttackTime = now;
        }
    }

    heavyAttack() {
        const now = Date.now();
        if (now - this.lastHeavyAttackTime > heavyAttackCooldown) {
            projectiles.push(new Projectile(this.x + this.width / 2, this.y + this.height / 2, this.facing, true));
            this.lastHeavyAttackTime = now;
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
    constructor(x, type = 'normal') {
        const diff = levelConfig.difficulty || 1;
        this.type = type;
        this.width = type === 'fast' ? 75 : 110;
        this.height = type === 'fast' ? 75 : 110;
        this.x = x;
        this.y = canvas.height * GROUND_Y_RATIO - this.height;

        // Escala velocidade de acordo com dificuldade
        let baseSpeed = type === 'fast' ? ENEMY_SPEED * 2.2 + Math.random() : ENEMY_SPEED + Math.random() * 1.5;
        this.speed = baseSpeed * (1 + (diff - 1) * 0.2);

        // Escala vida de acordo com dificuldade
        let baseHealth = type === 'fast' ? 1 : 2;
        this.health = Math.floor(baseHealth * diff);

        this.vx = -this.speed;
        this.vy = 0;
        this.onGround = false;
        this.spawnX = x;
        this.jumpCooldown = 0;
    }

    update() {
        this.x += this.vx;

        // Gravity
        this.vy += GRAVITY;
        this.y += this.vy;

        // Platform & Ground Collision
        const groundY = canvas.height * GROUND_Y_RATIO - this.height;
        this.onGround = false;

        // Check Platforms
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

        // Jump AI: Jump if hitting player height difference or randomly to climb
        if (this.onGround && this.jumpCooldown <= 0) {
            // Se o player estiver acima e próximo horizontalmente
            const distToPlayer = Math.abs(this.x - player.x);
            if (player.y < this.y - 50 && distToPlayer < 200) {
                this.vy = JUMP_FORCE * 1.1; // Jump a bit higher
                this.onGround = false;
                this.jumpCooldown = 100; // frames
            }
            // Ou pular aleatoriamente se estiver perto de uma plataforma
            else if (Math.random() < 0.01) {
                this.vy = JUMP_FORCE;
                this.onGround = false;
                this.jumpCooldown = 60;
            }
        }
        if (this.jumpCooldown > 0) this.jumpCooldown--;

        // Patrol logic
        if (this.x < this.spawnX - 300) {
            this.vx = Math.abs(this.vx);
            this.x = this.spawnX - 300;
        }
        if (this.x > this.spawnX + 300) {
            this.vx = -Math.abs(this.vx);
            this.x = this.spawnX + 300;
        }

        // Stay within level boundaries
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
        ctx.shadowColor = this.type === 'fast' ? 'rgba(0, 200, 255, 0.7)' : 'rgba(255, 0, 85, 0.4)';
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
    constructor(x, y, dir, isHeavy = false) {
        this.x = x;
        this.y = y;
        this.isHeavy = isHeavy;
        this.radius = isHeavy ? 28 : 12;

        // Dano escala com o bônus do jogador
        let baseDamage = isHeavy ? 4 : 1;
        this.damage = baseDamage + (playerDamageBonus * (isHeavy ? 2 : 1));

        // Velocidade baseada no poder do jogador (Aumentada signficativamente pós-bosses)
        let baseSpeed = isHeavy ? HAIRBALL_SPEED * 1.3 : HAIRBALL_SPEED;
        let speedBonus = playerDamageBonus * 3.5; // +3.5 velocidade extra por boss!
        this.vx = dir * (baseSpeed + speedBonus);

        this.hitEntities = new Set();
    }

    update() {
        this.x += this.vx;
    }

    render() {
        ctx.save();
        ctx.translate(-cameraX, 0);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

        if (this.isHeavy) {
            ctx.fillStyle = '#ff9900';
            ctx.shadowColor = '#ff5500';
            ctx.shadowBlur = 25;
        } else {
            ctx.fillStyle = '#fff';
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#fff';
        }

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
        const diff = levelConfig.difficulty || 1;
        this.width = 250;
        this.height = 250;
        this.x = Math.max(2800, levelConfig.width - 700);
        this.y = canvas.height * GROUND_Y_RATIO - this.height;

        // Vida e velocidade escalam de acordo com as fases superadas
        this.maxHealth = Math.floor(20 * diff * 1.5);
        this.health = this.maxHealth;
        this.vx = -4 * (1 + (diff - 1) * 0.2);

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
            // Spawn an enemy (chance to be fast)
            const type = Math.random() > 0.4 ? 'fast' : 'normal';
            enemies.push(new Enemy(this.x, type));
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

// Geração procedural de fases
function generateLevelConfig(lvl) {
    const isBoss = lvl % 5 === 0;
    // Multiplicador de status que sobe a cada grupo de 5 fases
    const difficultyMultiplier = 1 + Math.floor((lvl - 1) / 5) * 0.6;

    // Extensão do nível e quantidade de inimigos baseados na fase atual
    const width = isBoss ? 3500 : 3000 + (lvl * 300);
    const enemyCount = isBoss ? 4 : Math.floor(6 + lvl * 1.5 * difficultyMultiplier);

    // Gerar plataformas dinamicamente parecidas com as originais
    const platforms = [];
    const numPlatforms = isBoss ? 4 : 4 + Math.floor(lvl / 2);

    for (let i = 0; i < numPlatforms; i++) {
        let px = 600 + i * ((width - 1000) / numPlatforms) + (Math.random() * 200 - 100);
        let py = 250 + Math.random() * 200;
        let pw = 150 + Math.random() * 100;
        platforms.push(new Platform(px, py, pw, 20));
    }

    return {
        width,
        enemyCount,
        platforms,
        hasBoss: isBoss,
        difficulty: difficultyMultiplier
    };
}

let levelConfig = null;
let player = new Player();
let enemies = [];
let projectiles = [];
let platforms = [];
let boss = null;

function init() {
    currentLevel = 1;
    playerDamageBonus = 0;
    heavyAttackCooldown = 20000;
    levelConfig = generateLevelConfig(1);
    startLevel(1);
}

function startLevel(lvl) {
    resize();
    hideScreens();
    currentLevel = lvl;
    levelConfig = generateLevelConfig(lvl);

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
    if (levelConfig.hasBoss) {
        // Derrotou chefe: Fica mais forte!
        playerDamageBonus += 1;
        // Bônus: Dano aumentado e cooldown menor (mínimo de 5s)
        heavyAttackCooldown = Math.max(5000, heavyAttackCooldown - 3000);

        // Mostra uma animação visual do heal/buff (recupera até limite de vida + 50)
        health = Math.min(MAX_HEALTH, health + 50);
        updateHUD();
    }

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
        // 60% chance of being a fast enemy
        const type = Math.random() > 0.4 ? 'fast' : 'normal';
        enemies.push(new Enemy(800 + i * (levelConfig.width / (count + 1)) + Math.random() * 200, type));
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
    hairballCount.innerText = '∞';
    const levelDisplay = document.getElementById('level-display');
    if (levelDisplay) {
        levelDisplay.innerText = `Level ${currentLevel}${(levelConfig && levelConfig.hasBoss) ? ' (BOSS)' : ''}`;
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
    const requiredBgWidth = levelConfig.width + (levelConfig.width * 0.5); // Garante renderização da câmera + parallax
    for (let i = 0; i < Math.ceil(requiredBgWidth / bgWidth) + 1; i++) {
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
                if (!p.hitEntities.has(e)) {
                    e.health -= p.damage;
                    p.hitEntities.add(e);

                    if (e.health <= 0) {
                        enemies.splice(j, 1);
                        updateHUD();
                    }

                    if (!p.isHeavy) {
                        projectiles.splice(i, 1);
                        break;
                    }
                }
            }
        }

        // Check boss
        if (boss && !boss.isDead && projectiles[i]) {
            if (p.x > boss.x && p.x < boss.x + boss.width && p.y > boss.y && p.y < boss.y + boss.height) {
                if (!p.hitEntities.has(boss)) {
                    boss.health -= p.damage;
                    p.hitEntities.add(boss);

                    if (boss.health <= 0) {
                        boss.isDead = true;
                        updateHUD();
                    }

                    if (!p.isHeavy) {
                        projectiles.splice(i, 1);
                    }
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

    // Cooldown UI Update
    const now = Date.now();
    const cdLeft = Math.max(0, heavyAttackCooldown - (now - player.lastHeavyAttackTime));
    const heavyUI = document.getElementById('heavy-cooldown');
    if (heavyUI) {
        if (cdLeft === 0) {
            heavyUI.innerText = 'Pronto (F)';
            heavyUI.style.color = '#fff';
            heavyUI.style.fontWeight = 'bold';
        } else {
            heavyUI.innerText = `(${(cdLeft / 1000).toFixed(1)}s)`;
            heavyUI.style.color = '#777';
            heavyUI.style.fontWeight = 'normal';
        }
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
