(function () {
    const canvas = document.getElementById('flappy-shad-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    const BIRD_X = 70;
    const BIRD_RADIUS = 12;
    const FLAP_VELOCITY = -5;

    // Difficulty ramps from EASY at the start to HARD by the finish line.
    const EASY_GRAVITY = 0.14;
    const HARD_GRAVITY = 0.34;
    const EASY_MAX_FALL_SPEED = 3.5;
    const HARD_MAX_FALL_SPEED = 7.5;
    const EASY_SCROLL_SPEED = 1.2;
    const HARD_SCROLL_SPEED = 2.6;
    const EASY_PIPE_GAP = 175;
    const HARD_PIPE_GAP = 110;

    const PIPE_WIDTH = 50;
    const PIPE_SPACING = 220;
    const PIPE_COUNT = 6;
    const FINISH_GAP_AFTER_LAST_PIPE = 200;

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    const scoreEl = document.getElementById('flappy-shad-score');
    const bestEl = document.getElementById('flappy-shad-best');
    const messageEl = document.getElementById('flappy-shad-message');

    let birdY, birdVelocity, pipes, finishLineX, totalDistance, score, bestScore, state;

    function loadBest() {
        return Number(localStorage.getItem('flappyShadBest') || 0);
    }

    function saveBest(value) {
        localStorage.setItem('flappyShadBest', String(value));
    }

    function updateScoreboard() {
        scoreEl.textContent = 'Score: ' + score;
        bestEl.textContent = 'Best: ' + bestScore;
    }

    function setMessage(text) {
        messageEl.textContent = text;
    }

    function resetGame() {
        birdY = HEIGHT / 2;
        birdVelocity = 0;
        score = 0;
        bestScore = loadBest();
        state = 'ready';

        pipes = [];
        for (let i = 0; i < PIPE_COUNT; i++) {
            const x = 300 + i * PIPE_SPACING;
            const progress = PIPE_COUNT > 1 ? i / (PIPE_COUNT - 1) : 0;
            const gapSize = lerp(EASY_PIPE_GAP, HARD_PIPE_GAP, progress);
            const gapY = 40 + Math.random() * (HEIGHT - 80 - gapSize);
            pipes.push({ x, gapY, gapSize, passed: false });
        }
        totalDistance = 300 + (PIPE_COUNT - 1) * PIPE_SPACING + FINISH_GAP_AFTER_LAST_PIPE;
        finishLineX = totalDistance;

        updateScoreboard();
        setMessage('Click the game or press Space to flap. Starts slow, gets harder near the finish line.');
        draw();
    }

    function flap() {
        if (state === 'won' || state === 'lost') {
            resetGame();
            state = 'playing';
            setMessage('');
        } else if (state === 'ready') {
            state = 'playing';
            setMessage('');
        }
        if (state === 'playing') {
            birdVelocity = FLAP_VELOCITY;
        }
    }

    function endGame(won) {
        state = won ? 'won' : 'lost';
        if (score > bestScore) {
            bestScore = score;
            saveBest(bestScore);
        }
        updateScoreboard();
        setMessage(
            won
                ? 'Finished! Score ' + score + '/' + PIPE_COUNT + ' — click or press Space to play again.'
                : 'Game over — click or press Space to retry.'
        );
    }

    function update() {
        if (state !== 'playing') return;

        const traveled = totalDistance - finishLineX;
        const difficulty = Math.max(0, Math.min(1, traveled / totalDistance));
        const gravity = lerp(EASY_GRAVITY, HARD_GRAVITY, difficulty);
        const maxFallSpeed = lerp(EASY_MAX_FALL_SPEED, HARD_MAX_FALL_SPEED, difficulty);
        const scrollSpeed = lerp(EASY_SCROLL_SPEED, HARD_SCROLL_SPEED, difficulty);

        birdVelocity += gravity;
        if (birdVelocity > maxFallSpeed) birdVelocity = maxFallSpeed;
        birdY += birdVelocity;

        for (const pipe of pipes) pipe.x -= scrollSpeed;
        finishLineX -= scrollSpeed;

        if (birdY - BIRD_RADIUS < 0 || birdY + BIRD_RADIUS > HEIGHT) {
            endGame(false);
            return;
        }

        for (const pipe of pipes) {
            const withinX = BIRD_X + BIRD_RADIUS > pipe.x && BIRD_X - BIRD_RADIUS < pipe.x + PIPE_WIDTH;
            const withinGap = birdY - BIRD_RADIUS > pipe.gapY && birdY + BIRD_RADIUS < pipe.gapY + pipe.gapSize;
            if (withinX && !withinGap) {
                endGame(false);
                return;
            }
            if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) {
                pipe.passed = true;
                score += 1;
                updateScoreboard();
            }
        }

        if (finishLineX <= BIRD_X) {
            endGame(true);
        }
    }

    function drawBird() {
        ctx.beginPath();
        ctx.arc(BIRD_X, birdY, BIRD_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#000000';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(BIRD_X + BIRD_RADIUS, birdY);
        ctx.lineTo(BIRD_X + BIRD_RADIUS + 8, birdY - 4);
        ctx.lineTo(BIRD_X + BIRD_RADIUS + 8, birdY + 4);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    function drawFinishLine() {
        if (finishLineX < -20 || finishLineX > WIDTH + 20) return;
        const squareSize = 10;
        for (let row = 0; row < Math.ceil(HEIGHT / squareSize); row++) {
            for (let col = 0; col < 2; col++) {
                ctx.fillStyle = (row + col) % 2 === 0 ? '#000000' : '#ffffff';
                ctx.fillRect(finishLineX + col * squareSize, row * squareSize, squareSize, squareSize);
            }
        }
    }

    function draw() {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.fillStyle = '#000000';
        for (const pipe of pipes) {
            ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.gapY);
            ctx.fillRect(pipe.x, pipe.gapY + pipe.gapSize, PIPE_WIDTH, HEIGHT - pipe.gapY - pipe.gapSize);
        }

        drawFinishLine();
        drawBird();

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, WIDTH - 2, HEIGHT - 2);
    }

    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }

    canvas.addEventListener('click', function () {
        canvas.focus();
        flap();
    });
    canvas.addEventListener('keydown', function (e) {
        if (e.code === 'Space') {
            e.preventDefault();
            flap();
        }
    });

    resetGame();
    loop();
})();
