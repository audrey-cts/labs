const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const ui = {
    restartButton: document.getElementById("restartButton"),
    playerHealthBar: document.getElementById("playerHealthBar"),
    enemyHealthBar: document.getElementById("enemyHealthBar"),
    playerHealthText: document.getElementById("playerHealthText"),
    enemyHealthText: document.getElementById("enemyHealthText"),
    timerText: document.getElementById("timerText"),
    statusText: document.getElementById("statusText"),
    playerState: document.getElementById("playerState"),
    enemyState: document.getElementById("enemyState"),
    resultBanner: document.getElementById("resultBanner"),
    battleLog: document.getElementById("battleLog"),
};

const CONFIG = {
    width: 320,
    height: 180,
    groundY: 148,
    maxHealth: 100,
    timer: 60,
    gravity: 720,
    moveSpeed: 78,
    defendSpeed: 40,
    jumpVelocity: -240,
    attackDuration: 0.28,
    attackHitMoment: 0.11,
    attackCooldown: 0.48,
    attackRange: 26,
    attackDamage: 14,
    defendMultiplier: 0.35,
    knockback: 120,
};

const skyline = [
    { x: 0, w: 18, h: 28 },
    { x: 22, w: 26, h: 48 },
    { x: 54, w: 18, h: 34 },
    { x: 80, w: 34, h: 58 },
    { x: 118, w: 16, h: 28 },
    { x: 140, w: 22, h: 45 },
    { x: 168, w: 30, h: 66 },
    { x: 205, w: 18, h: 38 },
    { x: 228, w: 22, h: 52 },
    { x: 256, w: 18, h: 32 },
    { x: 280, w: 32, h: 60 },
];

const stateNames = {
    idle: "待机",
    run: "移动",
    jump: "跳跃",
    attack: "攻击",
    guard: "防御",
    hurt: "受创",
};

const input = {
    held: new Set(),
    pressed: new Set(),
};

const gameState = {
    lastTime: 0,
    timer: CONFIG.timer,
    running: true,
    winnerText: "",
    cameraShake: 0,
    sparks: [],
    logs: [],
    fighters: {},
};

function createFighter(options) {
    return {
        id: options.id,
        name: options.name,
        x: options.x,
        y: CONFIG.groundY - 30,
        w: 18,
        h: 30,
        vx: 0,
        vy: 0,
        facing: options.facing,
        health: CONFIG.maxHealth,
        attackTimer: 0,
        attackCooldown: 0,
        attackResolved: false,
        defending: false,
        hurtTimer: 0,
        state: "idle",
        animTime: 0,
        colors: options.colors,
        aiClock: 0,
        brain: {
            moveX: 0,
            wantsJump: false,
            wantsAttack: false,
            wantsDefend: false,
        },
    };
}

function resetGame() {
    gameState.timer = CONFIG.timer;
    gameState.running = true;
    gameState.winnerText = "";
    gameState.cameraShake = 0;
    gameState.sparks = [];
    gameState.logs = [];
    gameState.fighters.player = createFighter({
        id: "player",
        name: "苍穹先锋",
        x: 70,
        facing: 1,
        colors: {
            main: "#4ea5ff",
            dark: "#1f4c9c",
            light: "#d2f1ff",
            glow: "#7fe6ff",
        },
    });
    gameState.fighters.enemy = createFighter({
        id: "enemy",
        name: "赤焰袭击者",
        x: 250,
        facing: -1,
        colors: {
            main: "#ff6b67",
            dark: "#9d2626",
            light: "#ffd0bf",
            glow: "#ffb26a",
        },
    });
    ui.resultBanner.classList.add("hidden");
    logBattle("系统启动，竞技场能源已接通。");
    logBattle("苍穹先锋进入废土战区。");
    logBattle("赤焰袭击者开始索敌。");
    syncHud();
}

function logBattle(message) {
    gameState.logs.unshift(message);
    gameState.logs = gameState.logs.slice(0, 7);
    ui.battleLog.innerHTML = gameState.logs
        .map((line) => `<div class="log-line">${line}</div>`)
        .join("");
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function keysToCommand() {
    return {
        moveX: (input.held.has("KeyD") ? 1 : 0) - (input.held.has("KeyA") ? 1 : 0),
        wantsJump: input.pressed.has("KeyW"),
        wantsAttack: input.pressed.has("KeyJ"),
        wantsDefend: input.held.has("KeyK"),
    };
}

function startAttack(fighter) {
    if (!gameState.running || fighter.attackCooldown > 0 || fighter.attackTimer > 0 || fighter.hurtTimer > 0) {
        return;
    }
    fighter.attackTimer = CONFIG.attackDuration;
    fighter.attackCooldown = CONFIG.attackCooldown;
    fighter.attackResolved = false;
    fighter.defending = false;
    fighter.vx = fighter.facing * 92;
    logBattle(`${fighter.name} 发起近距斩击。`);
}

function applyCommand(fighter, command, dt) {
    fighter.attackCooldown = Math.max(0, fighter.attackCooldown - dt);
    fighter.hurtTimer = Math.max(0, fighter.hurtTimer - dt);
    fighter.animTime += dt;

    if (command.wantsAttack) {
        startAttack(fighter);
    }

    if (command.wantsJump && fighter.y >= CONFIG.groundY - fighter.h - 0.5) {
        fighter.vy = CONFIG.jumpVelocity;
        logBattle(`${fighter.name} 进行推进跳跃。`);
    }

    fighter.defending = Boolean(
        command.wantsDefend &&
        fighter.attackTimer <= 0 &&
        fighter.hurtTimer <= 0 &&
        fighter.y >= CONFIG.groundY - fighter.h - 0.5
    );

    if (fighter.attackTimer > 0) {
        fighter.attackTimer = Math.max(0, fighter.attackTimer - dt);
    }

    const canMove = fighter.hurtTimer <= 0 && fighter.attackTimer <= 0;
    const speed = fighter.defending ? CONFIG.defendSpeed : CONFIG.moveSpeed;
    if (canMove) {
        fighter.vx = command.moveX * speed;
        if (command.moveX !== 0) {
            fighter.facing = command.moveX > 0 ? 1 : -1;
        }
    } else if (fighter.hurtTimer > 0) {
        fighter.vx *= 0.92;
    }

    fighter.vy += CONFIG.gravity * dt;
    fighter.x += fighter.vx * dt;
    fighter.y += fighter.vy * dt;

    if (fighter.y >= CONFIG.groundY - fighter.h) {
        fighter.y = CONFIG.groundY - fighter.h;
        fighter.vy = 0;
    }

    fighter.x = clamp(fighter.x, 18, CONFIG.width - 18);

    if (fighter.hurtTimer > 0) {
        fighter.state = "hurt";
    } else if (fighter.attackTimer > 0) {
        fighter.state = "attack";
    } else if (fighter.defending) {
        fighter.state = "guard";
    } else if (fighter.y < CONFIG.groundY - fighter.h - 1) {
        fighter.state = "jump";
    } else if (Math.abs(fighter.vx) > 8) {
        fighter.state = "run";
    } else {
        fighter.state = "idle";
    }
}

function updateEnemyBrain(enemy, player, dt) {
    enemy.aiClock += dt;
    const dist = player.x - enemy.x;
    const closeEnough = Math.abs(dist) < CONFIG.attackRange + 10;

    enemy.brain.moveX = Math.abs(dist) > CONFIG.attackRange + 6 ? Math.sign(dist) : 0;
    enemy.brain.wantsDefend = player.attackTimer > 0 && Math.abs(dist) < CONFIG.attackRange + 16;
    enemy.brain.wantsAttack = false;
    enemy.brain.wantsJump = false;

    if (!enemy.brain.wantsDefend && closeEnough && enemy.attackCooldown <= 0) {
        enemy.brain.wantsAttack = true;
    }

    if (enemy.y >= CONFIG.groundY - enemy.h - 0.5 && Math.abs(dist) > 70 && Math.sin(enemy.aiClock * 3.2) > 0.995) {
        enemy.brain.wantsJump = true;
    }
}

function hitReady(fighter) {
    return fighter.attackTimer > 0 &&
        !fighter.attackResolved &&
        CONFIG.attackDuration - fighter.attackTimer >= CONFIG.attackHitMoment;
}

function tryResolveHit(attacker, defender) {
    if (!hitReady(attacker)) {
        return;
    }

    attacker.attackResolved = true;
    const distanceX = defender.x - attacker.x;
    const inFront = attacker.facing > 0 ? distanceX > -2 : distanceX < 2;
    const inRange = Math.abs(distanceX) < CONFIG.attackRange + defender.w * 0.9;
    const sameHeight = Math.abs(defender.y - attacker.y) < 24;

    if (!inFront || !inRange || !sameHeight) {
        logBattle(`${attacker.name} 的斩击落空。`);
        return;
    }

    const guarded = defender.defending;
    const damage = Math.round(CONFIG.attackDamage * (guarded ? CONFIG.defendMultiplier : 1));
    defender.health = Math.max(0, defender.health - damage);
    defender.hurtTimer = guarded ? 0.06 : 0.18;
    defender.vx = attacker.facing * (guarded ? CONFIG.knockback * 0.45 : CONFIG.knockback);
    defender.vy = guarded ? -24 : -48;
    gameState.cameraShake = guarded ? 1.5 : 3;
    spawnSpark(defender.x + attacker.facing * 8, defender.y + 12, guarded ? "#fff3a6" : "#ffffff");

    if (guarded) {
        logBattle(`${defender.name} 格挡成功，仅受到 ${damage} 点伤害。`);
    } else {
        logBattle(`${attacker.name} 命中目标，造成 ${damage} 点伤害。`);
    }
}

function spawnSpark(x, y, color) {
    for (let i = 0; i < 6; i += 1) {
        gameState.sparks.push({
            x,
            y,
            dx: (Math.random() - 0.5) * 70,
            dy: (Math.random() - 1) * 55,
            life: 0.2 + Math.random() * 0.12,
            ttl: 0.2 + Math.random() * 0.12,
            color,
        });
    }
}

function updateSparks(dt) {
    gameState.cameraShake = Math.max(0, gameState.cameraShake - dt * 10);
    gameState.sparks = gameState.sparks.filter((spark) => {
        spark.ttl -= dt;
        spark.x += spark.dx * dt;
        spark.y += spark.dy * dt;
        spark.dy += 160 * dt;
        return spark.ttl > 0;
    });
}

function finishMatch(message) {
    if (!gameState.running) {
        return;
    }
    gameState.running = false;
    gameState.winnerText = message;
    ui.resultBanner.textContent = `${message} 按“重新开战”再次挑战。`;
    ui.resultBanner.classList.remove("hidden");
    logBattle(message);
}

function update(dt) {
    const player = gameState.fighters.player;
    const enemy = gameState.fighters.enemy;
    const playerCommand = keysToCommand();

    if (gameState.running) {
        gameState.timer = Math.max(0, gameState.timer - dt);
        updateEnemyBrain(enemy, player, dt);
        applyCommand(player, playerCommand, dt);
        applyCommand(enemy, enemy.brain, dt);
        tryResolveHit(player, enemy);
        tryResolveHit(enemy, player);

        if (player.health <= 0 || enemy.health <= 0) {
            const winner = player.health > enemy.health ? player.name : enemy.name;
            finishMatch(`${winner} 获胜`);
        } else if (gameState.timer <= 0) {
            if (player.health === enemy.health) {
                finishMatch("时间到，双方平局");
            } else {
                const winner = player.health > enemy.health ? player.name : enemy.name;
                finishMatch(`时间到，${winner} 胜出`);
            }
        }
    }

    updateSparks(dt);
    syncHud();
    input.pressed.clear();
}

function syncHud() {
    const player = gameState.fighters.player;
    const enemy = gameState.fighters.enemy;
    const playerRatio = (player.health / CONFIG.maxHealth) * 100;
    const enemyRatio = (enemy.health / CONFIG.maxHealth) * 100;

    ui.playerHealthBar.style.width = `${playerRatio}%`;
    ui.enemyHealthBar.style.width = `${enemyRatio}%`;
    ui.playerHealthText.textContent = `${player.health} / ${CONFIG.maxHealth}`;
    ui.enemyHealthText.textContent = `${enemy.health} / ${CONFIG.maxHealth}`;
    ui.playerState.textContent = `状态：${stateNames[player.state]}`;
    ui.enemyState.textContent = `状态：${stateNames[enemy.state]}`;
    ui.timerText.textContent = String(Math.ceil(gameState.timer));
    ui.statusText.textContent = gameState.running ? "战斗进行中" : gameState.winnerText;
}

function pixelRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.height);
    gradient.addColorStop(0, "#33224f");
    gradient.addColorStop(0.55, "#6d3c57");
    gradient.addColorStop(1, "#0d0e17");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

    pixelRect(226, 18, 24, 24, "#ffcf6b");
    pixelRect(230, 22, 16, 16, "#ffe8a7");

    skyline.forEach((building, index) => {
        pixelRect(building.x, CONFIG.groundY - building.h - 18, building.w, building.h, index % 2 ? "#23192f" : "#2e2240");
        for (let row = 0; row < building.h - 6; row += 10) {
            for (let col = 3; col < building.w - 4; col += 7) {
                if ((row + col + index) % 3 === 0) {
                    pixelRect(building.x + col, CONFIG.groundY - building.h - 15 + row, 2, 3, "#f6c85d");
                }
            }
        }
    });

    pixelRect(0, CONFIG.groundY, CONFIG.width, CONFIG.height - CONFIG.groundY, "#2e3147");
    pixelRect(0, CONFIG.groundY + 9, CONFIG.width, 3, "#565b7b");

    for (let x = 0; x < CONFIG.width; x += 12) {
        pixelRect(x, CONFIG.groundY + 20, 6, 2, "#3c415d");
    }
}

function drawSparkEffects() {
    gameState.sparks.forEach((spark) => {
        const alpha = spark.ttl / spark.life;
        ctx.globalAlpha = alpha;
        pixelRect(spark.x, spark.y, 2, 2, spark.color);
        ctx.globalAlpha = 1;
    });
}

function drawAttackArc(fighter) {
    if (fighter.attackTimer <= 0) {
        return;
    }
    const intensity = 1 - fighter.attackTimer / CONFIG.attackDuration;
    const x = fighter.x + fighter.facing * 14;
    const y = fighter.y + 10;
    const color = fighter.id === "player" ? "#7fe8ff" : "#ffb36f";
    pixelRect(x, y, fighter.facing * 6, 2, color);
    pixelRect(x + fighter.facing * 4, y + 3, fighter.facing * 8, 2, color);
    if (intensity > 0.35) {
        pixelRect(x + fighter.facing * 8, y + 6, fighter.facing * 9, 2, "#ffffff");
    }
}

function drawFighter(fighter) {
    const runFrame = Math.floor(fighter.animTime * 8) % 2;
    const bob = fighter.state === "idle" ? (Math.sin(fighter.animTime * 4) > 0 ? 1 : 0) : 0;
    const legOffset = fighter.state === "run" ? (runFrame === 0 ? 1 : -1) : 0;

    ctx.save();
    ctx.translate(Math.round(fighter.x), Math.round(fighter.y + bob));
    ctx.scale(fighter.facing, 1);

    pixelRect(-8, 30, 16, 2, "rgba(0,0,0,0.35)");

    pixelRect(-7, 20 + legOffset, 4, 9, fighter.colors.dark);
    pixelRect(3, 20 - legOffset, 4, 9, fighter.colors.dark);
    pixelRect(-8, 8, 16, 14, fighter.colors.main);
    pixelRect(-5, 11, 10, 8, fighter.colors.light);
    pixelRect(-4, 1, 8, 8, fighter.colors.main);
    pixelRect(-3, 3, 6, 2, fighter.colors.glow);
    pixelRect(-10, 9, 3, 10, fighter.colors.dark);
    pixelRect(7, 9, 3, 10, fighter.colors.dark);

    if (fighter.state === "attack") {
        pixelRect(9, 10, 6, 3, fighter.colors.glow);
        pixelRect(13, 8, 3, 8, "#ffffff");
    } else if (fighter.state === "guard") {
        pixelRect(8, 8, 6, 16, "#99c5ff");
        pixelRect(10, 10, 2, 12, "#ffffff");
    } else {
        pixelRect(9, 10, 4, 8, fighter.colors.dark);
    }

    pixelRect(-12, 10, 4, 8, fighter.colors.dark);

    if (fighter.state === "hurt") {
        pixelRect(-6, 0, 12, 2, "#ffffff");
    }

    ctx.restore();
    drawAttackArc(fighter);
}

function drawScene() {
    ctx.save();
    if (gameState.cameraShake > 0) {
        const shakeX = (Math.random() - 0.5) * gameState.cameraShake;
        const shakeY = (Math.random() - 0.5) * gameState.cameraShake;
        ctx.translate(shakeX, shakeY);
    }

    drawBackground();
    drawFighter(gameState.fighters.player);
    drawFighter(gameState.fighters.enemy);
    drawSparkEffects();
    ctx.restore();
}

function loop(timestamp) {
    if (!gameState.lastTime) {
        gameState.lastTime = timestamp;
    }
    const dt = Math.min((timestamp - gameState.lastTime) / 1000, 0.033);
    gameState.lastTime = timestamp;
    update(dt);
    drawScene();
    requestAnimationFrame(loop);
}

function setupInput() {
    const relevantKeys = new Set(["KeyA", "KeyD", "KeyW", "KeyJ", "KeyK"]);

    window.addEventListener("keydown", (event) => {
        if (!relevantKeys.has(event.code)) {
            return;
        }
        event.preventDefault();
        if (!input.held.has(event.code)) {
            input.pressed.add(event.code);
        }
        input.held.add(event.code);
    });

    window.addEventListener("keyup", (event) => {
        if (!relevantKeys.has(event.code)) {
            return;
        }
        event.preventDefault();
        input.held.delete(event.code);
    });
}

ui.restartButton.addEventListener("click", () => {
    input.held.clear();
    input.pressed.clear();
    resetGame();
});

setupInput();
resetGame();
requestAnimationFrame(loop);
