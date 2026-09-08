/**
 * Packet Router (sys_defense.sh)
 * Minimalist retro backend defense easter egg game for Olayemi Samuel's portfolio.
 */

(function () {
  'use strict';

  // Audio synthesizer via Web Audio API (zero external assets)
  class SoundFx {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    play(freq, type = 'sine', duration = 0.08, gainVal = 0.12) {
      if (!this.enabled || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {
        // audio muted or failed
      }
    }

    catchGood() {
      this.play(520, 'triangle', 0.07, 0.15);
      setTimeout(() => this.play(780, 'sine', 0.09, 0.12), 40);
    }

    catchSpecial() {
      this.play(600, 'sine', 0.06, 0.15);
      setTimeout(() => this.play(900, 'triangle', 0.08, 0.14), 50);
      setTimeout(() => this.play(1200, 'sine', 0.12, 0.12), 100);
    }

    hitBad() {
      this.play(140, 'sawtooth', 0.18, 0.2);
    }

    gameOver() {
      this.play(260, 'sawtooth', 0.15, 0.2);
      setTimeout(() => this.play(180, 'sawtooth', 0.2, 0.2), 120);
      setTimeout(() => this.play(110, 'sawtooth', 0.35, 0.22), 260);
    }
  }

  const sfx = new SoundFx();

  // Particle engine
  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.color = color;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.5 + 1.2;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed - 1.2;
      this.life = 1.0;
      this.decay = Math.random() * 0.035 + 0.025;
      this.size = Math.random() * 3 + 2;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.08; // subtle gravity
      this.life -= this.decay;
    }

    draw(ctx) {
      if (this.life <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.life);
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = this.color;
      ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
      ctx.restore();
    }
  }

  // Floating text indicator (+200, CACHE HIT, etc.)
  class FloatText {
    constructor(x, y, text, color) {
      this.x = x;
      this.y = y;
      this.text = text;
      this.color = color;
      this.life = 1.0;
      this.vy = -1.5;
    }

    update() {
      this.y += this.vy;
      this.life -= 0.03;
    }

    draw(ctx) {
      if (this.life <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.life);
      ctx.fillStyle = this.color;
      ctx.font = 'bold 11px "Geist Mono", monospace';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 6;
      ctx.shadowColor = this.color;
      ctx.fillText(this.text, this.x, this.y);
      ctx.restore();
    }
  }

  // Main Game Controller
  class SysDefenseGame {
    constructor() {
      this.modal = document.getElementById('game-modal');
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.soundBtn = document.getElementById('game-sound-toggle');
      this.closeBtn = document.getElementById('game-close-btn');

      this.width = 600;
      this.height = 380;
      this.running = false;
      this.state = 'MENU'; // 'MENU', 'PLAYING', 'GAMEOVER'

      // Player server paddle
      this.player = {
        x: 300,
        y: 350,
        w: 90,
        h: 12,
        speed: 7,
        targetX: 300,
      };

      this.keys = { left: false, right: false };
      this.particles = [];
      this.floatingTexts = [];
      this.packets = [];

      this.score = 0;
      this.combo = 0;
      this.health = 3;
      this.highScore = parseInt(localStorage.getItem('sys_defense_high_score') || '0', 10);
      this.lastSpawn = 0;
      this.spawnInterval = 900;
      this.gameStartTime = 0;
      this.shakeAmount = 0;

      this.animId = null;

      this.initDpi();
      this.bindEvents();
    }

    initDpi() {
      if (!this.canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      this.ctx.scale(dpr, dpr);
    }

    bindEvents() {
      // Open triggers
      const openBtn = document.getElementById('open-game-btn');
      const cursorEgg = document.getElementById('cursor-easter-egg');

      if (openBtn) {
        openBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.open();
        });
      }

      if (cursorEgg) {
        cursorEgg.style.cursor = 'pointer';
        cursorEgg.addEventListener('click', (e) => {
          e.preventDefault();
          this.open();
        });
      }

      // Keyboard shortcuts
      window.addEventListener('keydown', (e) => {
        // Tilde / backtick or 'g' when not in input
        if (
          (e.key === '`' || e.key === '~' || (e.key.toLowerCase() === 'g' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName))) &&
          !this.running
        ) {
          e.preventDefault();
          this.open();
          return;
        }

        if (!this.running) return;

        if (e.key === 'Escape') {
          this.close();
          return;
        }

        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          this.keys.left = true;
        }
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          this.keys.right = true;
        }

        if (e.code === 'Space') {
          e.preventDefault();
          if (this.state === 'MENU' || this.state === 'GAMEOVER') {
            this.start();
          }
        }
      });

      window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          this.keys.left = false;
        }
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          this.keys.right = false;
        }
      });

      // Canvas pointer / mouse tracking
      if (this.canvas) {
        const updatePointer = (clientX) => {
          const rect = this.canvas.getBoundingClientRect();
          const scale = this.width / rect.width;
          const mouseX = (clientX - rect.left) * scale;
          this.player.targetX = Math.max(this.player.w / 2, Math.min(this.width - this.player.w / 2, mouseX));
        };

        this.canvas.addEventListener('mousemove', (e) => updatePointer(e.clientX));
        this.canvas.addEventListener('touchmove', (e) => {
          if (e.touches.length > 0) {
            updatePointer(e.touches[0].clientX);
            e.preventDefault();
          }
        }, { passive: false });

        this.canvas.addEventListener('click', () => {
          if (this.state === 'MENU' || this.state === 'GAMEOVER') {
            this.start();
          }
        });
      }

      // Close button
      if (this.closeBtn) {
        this.closeBtn.addEventListener('click', () => this.close());
      }

      // Modal backdrop click
      if (this.modal) {
        this.modal.addEventListener('click', (e) => {
          if (e.target === this.modal) this.close();
        });
      }

      // Sound toggle
      if (this.soundBtn) {
        this.soundBtn.addEventListener('click', () => {
          sfx.enabled = !sfx.enabled;
          this.soundBtn.textContent = sfx.enabled ? '♪ sound: on' : '✕ sound: off';
          this.soundBtn.classList.toggle('muted', !sfx.enabled);
        });
      }
    }

    open() {
      if (!this.modal) return;
      sfx.init();
      this.modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      this.running = true;
      this.state = 'MENU';
      this.loop(0);
    }

    close() {
      if (!this.modal) return;
      this.modal.classList.remove('active');
      document.body.style.overflow = '';
      this.running = false;
      if (this.animId) cancelAnimationFrame(this.animId);
    }

    start() {
      this.state = 'PLAYING';
      this.score = 0;
      this.combo = 0;
      this.health = 3;
      this.packets = [];
      this.particles = [];
      this.floatingTexts = [];
      this.lastSpawn = performance.now();
      this.gameStartTime = performance.now();
      this.spawnInterval = 850;
      this.player.x = this.width / 2;
      this.player.targetX = this.width / 2;
      sfx.catchSpecial();
    }

    spawnPacket() {
      const types = [
        { label: '200 OK', color: '#3ecf8e', bg: 'rgba(62, 207, 142, 0.15)', border: '#3ecf8e', kind: 'good', score: 100 },
        { label: '200 OK', color: '#3ecf8e', bg: 'rgba(62, 207, 142, 0.15)', border: '#3ecf8e', kind: 'good', score: 100 },
        { label: 'gRPC', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.2)', border: '#8b5cf6', kind: 'good', score: 250 },
        { label: 'CACHE HIT', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.2)', border: '#0284c7', kind: 'special', score: 400 },
        { label: '500 ERR', color: '#f87171', bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', kind: 'hazard', score: 0 },
        { label: 'OOM BUG', color: '#fb923c', bg: 'rgba(249, 115, 22, 0.2)', border: '#ea580c', kind: 'hazard', score: 0 },
      ];

      // Weight towards good packets, with hazards scaling slightly over time
      const elapsedSec = (performance.now() - this.gameStartTime) / 1000;
      let rand = Math.random();
      let picked;

      const hazardChance = Math.min(0.38, 0.20 + elapsedSec * 0.003);
      if (rand < hazardChance) {
        picked = types[Math.random() > 0.5 ? 4 : 5];
      } else if (rand < hazardChance + 0.22) {
        picked = types[2]; // gRPC
      } else if (rand < hazardChance + 0.32) {
        picked = types[3]; // CACHE HIT
      } else {
        picked = types[0]; // 200 OK
      }

      const pw = picked.label.length * 8 + 16;
      const px = Math.random() * (this.width - pw - 20) + 10;
      const speed = 2.2 + Math.min(2.5, elapsedSec * 0.04) + Math.random() * 0.6;

      this.packets.push({
        x: px,
        y: -24,
        w: pw,
        h: 22,
        speed: speed,
        ...picked,
      });
    }

    addParticles(x, y, color, count = 10) {
      for (let i = 0; i < count; i++) {
        this.particles.push(new Particle(x, y, color));
      }
    }

    update(now) {
      if (this.shakeAmount > 0) this.shakeAmount *= 0.88;

      // Handle keyboard move
      if (this.keys.left) this.player.targetX -= this.player.speed;
      if (this.keys.right) this.player.targetX += this.player.speed;

      this.player.targetX = Math.max(this.player.w / 2, Math.min(this.width - this.player.w / 2, this.player.targetX));
      // Smooth lerp to target
      this.player.x += (this.player.targetX - this.player.x) * 0.35;

      if (this.state === 'PLAYING') {
        // Spawn rate scaling
        const elapsed = (now - this.gameStartTime) / 1000;
        const currentInterval = Math.max(480, 850 - elapsed * 8);
        if (now - this.lastSpawn > currentInterval) {
          this.spawnPacket();
          this.lastSpawn = now;
        }

        // Update packets
        for (let i = this.packets.length - 1; i >= 0; i--) {
          const p = this.packets[i];
          p.y += p.speed;

          // Paddle collision
          const paddleTop = this.player.y;
          const paddleBottom = this.player.y + this.player.h;
          const paddleLeft = this.player.x - this.player.w / 2;
          const paddleRight = this.player.x + this.player.w / 2;

          if (
            p.y + p.h >= paddleTop &&
            p.y <= paddleBottom &&
            p.x + p.w >= paddleLeft &&
            p.x <= paddleRight
          ) {
            // Collision occurred
            if (p.kind === 'hazard') {
              this.health--;
              this.combo = 0;
              this.shakeAmount = 6;
              sfx.hitBad();
              this.addParticles(p.x + p.w / 2, p.y + p.h / 2, p.color, 16);
              this.floatingTexts.push(new FloatText(p.x + p.w / 2, p.y - 4, '-1 HEALTH (500)', '#f87171'));

              if (this.health <= 0) {
                this.gameOver();
                this.packets.splice(i, 1);
                break;
              }
            } else {
              this.combo++;
              const multiplier = Math.min(4, 1 + Math.floor(this.combo / 4));
              const pts = p.score * multiplier;
              this.score += pts;
              this.shakeAmount = 1.2;

              if (p.kind === 'special') {
                sfx.catchSpecial();
                this.addParticles(p.x + p.w / 2, p.y + p.h / 2, p.color, 18);
                this.floatingTexts.push(new FloatText(p.x + p.w / 2, p.y - 4, `+${pts} CACHE HIT!`, p.color));
              } else {
                sfx.catchGood();
                this.addParticles(p.x + p.w / 2, p.y + p.h / 2, p.color, 9);
                const tag = multiplier > 1 ? `+${pts} (x${multiplier})` : `+${pts}`;
                this.floatingTexts.push(new FloatText(p.x + p.w / 2, p.y - 4, tag, p.color));
              }
            }

            this.packets.splice(i, 1);
            continue;
          }

          // Packet reached bottom
          if (p.y > this.height + 25) {
            // If missed a good packet, reset combo softly
            if (p.kind === 'good' && this.combo > 0) {
              this.combo = 0;
            }
            this.packets.splice(i, 1);
          }
        }
      }

      // Update particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        this.particles[i].update();
        if (this.particles[i].life <= 0) this.particles.splice(i, 1);
      }

      // Update floating texts
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        this.floatingTexts[i].update();
        if (this.floatingTexts[i].life <= 0) this.floatingTexts.splice(i, 1);
      }
    }

    gameOver() {
      this.state = 'GAMEOVER';
      sfx.gameOver();
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('sys_defense_high_score', this.highScore.toString());
      }
    }

    draw() {
      const ctx = this.ctx;
      if (!ctx) return;

      ctx.save();
      // Camera shake
      if (this.shakeAmount > 0.1) {
        const ox = (Math.random() - 0.5) * this.shakeAmount * 2;
        const oy = (Math.random() - 0.5) * this.shakeAmount * 2;
        ctx.translate(ox, oy);
      }

      // Background
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, this.width, this.height);

      // Subtle background grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const gridSize = 30;
      for (let x = 0; x < this.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.height);
        ctx.stroke();
      }
      for (let y = 0; y < this.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.width, y);
        ctx.stroke();
      }

      // Draw Packets
      for (const p of this.packets) {
        ctx.save();
        ctx.fillStyle = p.bg;
        ctx.strokeStyle = p.border;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;

        // Rounded pill box
        const r = 4;
        ctx.beginPath();
        ctx.moveTo(p.x + r, p.y);
        ctx.lineTo(p.x + p.w - r, p.y);
        ctx.arcTo(p.x + p.w, p.y, p.x + p.w, p.y + p.h, r);
        ctx.lineTo(p.x + p.w, p.y + p.h - r);
        ctx.arcTo(p.x + p.w, p.y + p.h, p.x, p.y + p.h, r);
        ctx.lineTo(p.x + r, p.y + p.h);
        ctx.arcTo(p.x, p.y + p.h, p.x, p.y, r);
        ctx.lineTo(p.x, p.y + r);
        ctx.arcTo(p.x, p.y, p.x + p.w, p.y, r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Packet text
        ctx.fillStyle = p.color;
        ctx.font = '500 10px "Geist Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.label, p.x + p.w / 2, p.y + p.h / 2 + 0.5);
        ctx.restore();
      }

      // Draw Particles
      for (const pt of this.particles) pt.draw(ctx);

      // Draw Floating Texts
      for (const ft of this.floatingTexts) ft.draw(ctx);

      // Draw Player Server Paddle (Node buffer)
      const px = this.player.x - this.player.w / 2;
      const py = this.player.y;
      const pw = this.player.w;
      const ph = this.player.h;

      ctx.save();
      // Glow
      ctx.shadowColor = '#7c6af5';
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(124, 106, 245, 0.25)';
      ctx.strokeStyle = '#7c6af5';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 4);
      ctx.fill();
      ctx.stroke();

      // Core server light bar
      ctx.fillStyle = '#a78bfa';
      ctx.fillRect(px + 10, py + ph / 2 - 1, pw - 20, 2);

      // Node label
      ctx.fillStyle = '#e5e5e5';
      ctx.font = '600 8.5px "Geist Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SERVER_CLUSTER', this.player.x, py - 6);
      ctx.restore();

      // Top HUD
      this.drawHUD(ctx);

      // Overlays for MENU & GAMEOVER
      if (this.state === 'MENU') {
        this.drawMenu(ctx);
      } else if (this.state === 'GAMEOVER') {
        this.drawGameOver(ctx);
      }

      ctx.restore();
    }

    drawHUD(ctx) {
      ctx.save();
      ctx.font = '500 11px "Geist Mono", monospace';

      // Score / Throughput
      ctx.fillStyle = '#a3a3a3';
      ctx.textAlign = 'left';
      ctx.fillText('THROUGHPUT: ', 16, 24);
      ctx.fillStyle = '#3ecf8e';
      ctx.fillText(`${this.score.toLocaleString()} req/s`, 94, 24);

      // Combo
      if (this.combo > 1) {
        ctx.fillStyle = '#a78bfa';
        ctx.fillText(`STREAK: ${this.combo}x`, 220, 24);
      }

      // High Score
      ctx.fillStyle = '#737373';
      ctx.textAlign = 'right';
      ctx.fillText(`BEST: ${this.highScore.toLocaleString()}`, this.width - 110, 24);

      // Health / Buffer indicators
      ctx.textAlign = 'right';
      ctx.fillStyle = '#737373';
      ctx.fillText('BUFFER: ', this.width - 45, 24);

      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(this.width - 32 + i * 12, 21, 4, 0, Math.PI * 2);
        if (i < this.health) {
          ctx.fillStyle = '#3ecf8e';
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#3ecf8e';
        } else {
          ctx.fillStyle = '#262626';
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      }
      ctx.restore();
    }

    drawMenu(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 10, 12, 0.75)';
      ctx.fillRect(0, 40, this.width, this.height - 40);

      ctx.fillStyle = '#7c6af5';
      ctx.font = '600 18px "Geist Mono", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#7c6af5';
      ctx.shadowBlur = 10;
      ctx.fillText('PACKET ROUTER // SYS_DEFENSE.sh', this.width / 2, 130);

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#a3a3a3';
      ctx.font = '400 12px "Geist Mono", monospace';
      ctx.fillText('Route incoming traffic to prevent buffer overflow.', this.width / 2, 160);

      // Instructions
      ctx.fillStyle = '#737373';
      ctx.font = '400 11px "Geist Mono", monospace';
      ctx.fillText('Catch: [ 200 OK ] [ gRPC ] [ CACHE HIT ]', this.width / 2, 195);
      ctx.fillText('Dodge: [ 500 ERR ] [ OOM BUG ]', this.width / 2, 218);

      // Start prompt
      ctx.fillStyle = '#3ecf8e';
      ctx.font = '600 13px "Geist Mono", monospace';
      const blink = Math.floor(Date.now() / 450) % 2 === 0;
      if (blink) {
        ctx.fillText('> PRESS SPACE OR CLICK TO INITIALIZE <', this.width / 2, 270);
      }

      ctx.fillStyle = '#525252';
      ctx.font = '400 10px "Geist Mono", monospace';
      ctx.fillText('Controls: Move with [Mouse] or [A / D] / [Arrow Keys] · [ESC] Exit', this.width / 2, 315);
      ctx.restore();
    }

    drawGameOver(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 10, 12, 0.82)';
      ctx.fillRect(0, 40, this.width, this.height - 40);

      ctx.fillStyle = '#f87171';
      ctx.font = '600 20px "Geist Mono", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 10;
      ctx.fillText('SYSTEM DOWN // 503 SERVICE UNAVAILABLE', this.width / 2, 135);

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e5e5e5';
      ctx.font = '500 14px "Geist Mono", monospace';
      ctx.fillText(`Peak Throughput: ${this.score.toLocaleString()} req/s`, this.width / 2, 175);

      ctx.fillStyle = '#a3a3a3';
      ctx.font = '400 11px "Geist Mono", monospace';
      if (this.score >= this.highScore && this.score > 0) {
        ctx.fillStyle = '#3ecf8e';
        ctx.fillText('★ NEW ALL-TIME HIGH SCORE ★', this.width / 2, 205);
      } else {
        ctx.fillText(`Best Record: ${this.highScore.toLocaleString()} req/s`, this.width / 2, 205);
      }

      // Restart prompt
      ctx.fillStyle = '#7c6af5';
      ctx.font = '600 13px "Geist Mono", monospace';
      const blink = Math.floor(Date.now() / 450) % 2 === 0;
      if (blink) {
        ctx.fillText('> PRESS SPACE OR CLICK TO REBOOT NODE <', this.width / 2, 260);
      }

      ctx.fillStyle = '#525252';
      ctx.font = '400 10px "Geist Mono", monospace';
      ctx.fillText('[ESC] Return to portfolio', this.width / 2, 305);
      ctx.restore();
    }

    loop(now) {
      if (!this.running) return;
      this.update(now);
      this.draw();
      this.animId = requestAnimationFrame((t) => this.loop(t));
    }
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new SysDefenseGame());
  } else {
    new SysDefenseGame();
  }
})();
