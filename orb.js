/**
 * Interactive 3D System Core Orb
 * High-performance native canvas animation with 3D orbital rings,
 * depth-projected particle swarm, and magnetic cursor interaction.
 */

(function () {
  'use strict';

  class HeroOrb {
    constructor() {
      this.wrapper = document.getElementById('hero-orb-trigger');
      this.canvas = document.getElementById('hero-orb-canvas');
      if (!this.canvas || !this.wrapper) return;

      this.ctx = this.canvas.getContext('2d');
      this.size = 220;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      this.canvas.width = this.size * this.dpr;
      this.canvas.height = this.size * this.dpr;
      this.ctx.scale(this.dpr, this.dpr);

      // Core rotation & tilt angles
      this.rotX = 0.25;
      this.rotY = 0;
      this.rotZ = 0.1;
      this.targetRotX = 0.25;
      this.targetRotY = 0;
      this.baseSpeed = 0.012;
      this.currentSpeed = 0.012;
      this.targetSpeed = 0.012;

      this.isHovered = false;
      this.pulseTime = 0;
      this.shockwaves = [];
      this.isVisible = true;

      // Generate 3D spherical particle cloud
      this.numParticles = 44;
      this.particles = [];
      for (let i = 0; i < this.numParticles; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const radius = 45 + Math.random() * 48;
        this.particles.push({
          x: radius * Math.sin(phi) * Math.cos(theta),
          y: radius * Math.sin(phi) * Math.sin(theta),
          z: radius * Math.cos(phi),
          baseRadius: radius,
          size: Math.random() * 2 + 1.2,
          speed: (Math.random() * 0.008 + 0.004) * (Math.random() > 0.5 ? 1 : -1),
          color: Math.random() > 0.35 ? '#a78bfa' : '#3ecf8e',
        });
      }

      // 3 Orbital data rings
      this.rings = [
        { radius: 52, tiltX: 0.65, tiltY: 0.2, speed: 0.022, progress: 0, color: 'rgba(124, 106, 245, 0.45)', packetColor: '#a78bfa' },
        { radius: 72, tiltX: -0.45, tiltY: 0.5, speed: -0.018, progress: 0.4, color: 'rgba(62, 207, 142, 0.35)', packetColor: '#3ecf8e' },
        { radius: 90, tiltX: 0.3, tiltY: -0.6, speed: 0.015, progress: 0.8, color: 'rgba(56, 189, 248, 0.3)', packetColor: '#38bdf8' },
      ];

      this.bindEvents();
      this.observeVisibility();
      this.loop(0);
    }

    bindEvents() {
      // Mouse move on wrapper tracks tilt
      this.wrapper.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        const ny = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        this.targetRotY = nx * 0.6;
        this.targetRotX = -ny * 0.5 + 0.2;
      });

      this.wrapper.addEventListener('mouseenter', () => {
        this.isHovered = true;
        this.targetSpeed = 0.028;
      });

      this.wrapper.addEventListener('mouseleave', () => {
        this.isHovered = false;
        this.targetRotY = 0;
        this.targetRotX = 0.25;
        this.targetSpeed = 0.012;
      });

      // Click to trigger shockwave + launch game
      this.wrapper.addEventListener('click', (e) => {
        e.preventDefault();
        this.shockwaves.push({ r: 20, maxR: 110, alpha: 1 });
        
        // Trigger game open if game modal exists
        setTimeout(() => {
          const gameModal = document.getElementById('game-modal');
          if (gameModal) {
            const openBtn = document.getElementById('open-game-btn');
            if (openBtn) {
              openBtn.click();
            } else {
              gameModal.classList.add('active');
            }
          }
        }, 120);
      });

      // Keyboard enter/space on focused wrapper
      this.wrapper.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.wrapper.click();
        }
      });
    }

    observeVisibility() {
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          this.isVisible = entries[0].isIntersecting;
        }, { threshold: 0.05 });
        observer.observe(this.wrapper);
      }
    }

    project(x, y, z, cx, cy) {
      const focal = 180;
      const scale = focal / (focal + z);
      return {
        x: cx + x * scale,
        y: cy + y * scale,
        scale: scale,
        depth: z,
      };
    }

    rotateX(x, y, z, angle) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return { x: x, y: y * cos - z * sin, z: y * sin + z * cos };
    }

    rotateY(x, y, z, angle) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return { x: x * cos + z * sin, y: y, z: -x * sin + z * cos };
    }

    update() {
      // Smooth interpolation of speed and tilt
      this.currentSpeed += (this.targetSpeed - this.currentSpeed) * 0.08;
      this.rotY += this.currentSpeed;
      this.rotX += (this.targetRotX - this.rotX) * 0.06;

      this.pulseTime += 0.025;

      // Update shockwaves
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const sw = this.shockwaves[i];
        sw.r += 3.8;
        sw.alpha = Math.max(0, 1 - sw.r / sw.maxR);
        if (sw.r >= sw.maxR) this.shockwaves.splice(i, 1);
      }

      // Update rings
      for (const ring of this.rings) {
        ring.progress = (ring.progress + ring.speed * (this.isHovered ? 1.6 : 1)) % (Math.PI * 2);
      }
    }

    draw() {
      const ctx = this.ctx;
      const cx = this.size / 2;
      const cy = this.size / 2;

      ctx.clearRect(0, 0, this.size, this.size);

      // 1. Central Core Glowing Aura
      const pulse = Math.sin(this.pulseTime) * 4;
      const hoverBoost = this.isHovered ? 6 : 0;
      const coreR = 28 + pulse + hoverBoost;

      const auraGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, coreR * 2.2);
      auraGrad.addColorStop(0, 'rgba(167, 139, 250, 0.85)');
      auraGrad.addColorStop(0.35, 'rgba(124, 106, 245, 0.45)');
      auraGrad.addColorStop(0.7, 'rgba(62, 207, 142, 0.18)');
      auraGrad.addColorStop(1, 'rgba(10, 10, 12, 0)');

      ctx.save();
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Inner dense core
      const innerGrad = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, coreR);
      innerGrad.addColorStop(0, '#ffffff');
      innerGrad.addColorStop(0.3, '#c4b5fd');
      innerGrad.addColorStop(0.75, '#7c6af5');
      innerGrad.addColorStop(1, 'rgba(62, 207, 142, 0.4)');

      ctx.fillStyle = innerGrad;
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#7c6af5';
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Shockwaves on click
      for (const sw of this.shockwaves) {
        ctx.save();
        ctx.strokeStyle = `rgba(167, 139, 250, ${sw.alpha * 0.9})`;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#7c6af5';
        ctx.beginPath();
        ctx.arc(cx, cy, sw.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 3. Project and Sort Particles + Ring Packets by Depth (Z-buffer)
      const renderList = [];

      // Add particles
      for (const p of this.particles) {
        // Rotate around Y and X
        let r1 = this.rotateY(p.x, p.y, p.z, this.rotY);
        let r2 = this.rotateX(r1.x, r1.y, r1.z, this.rotX);
        const proj = this.project(r2.x, r2.y, r2.z, cx, cy);

        renderList.push({
          type: 'particle',
          x: proj.x,
          y: proj.y,
          z: proj.depth,
          scale: proj.scale,
          size: p.size * proj.scale,
          color: p.color,
          alpha: Math.max(0.15, Math.min(0.95, (proj.depth + 100) / 200)),
        });
      }

      // Add rings and packets
      this.rings.forEach((ring, rIdx) => {
        // Sample points along ring to draw ellipse
        const steps = 48;
        const ringPoints = [];
        for (let s = 0; s < steps; s++) {
          const a = (s / steps) * Math.PI * 2;
          let rx = Math.cos(a) * ring.radius;
          let ry = Math.sin(a) * ring.radius * 0.35;
          let rz = Math.sin(a) * ring.radius * 0.7;

          // Apply ring tilt
          let tilted = this.rotateX(rx, ry, rz, ring.tiltX);
          tilted = this.rotateY(tilted.x, tilted.y, tilted.z, ring.tiltY + this.rotY);
          tilted = this.rotateX(tilted.x, tilted.y, tilted.z, this.rotX);

          const proj = this.project(tilted.x, tilted.y, tilted.z, cx, cy);
          ringPoints.push(proj);
        }

        renderList.push({
          type: 'ring',
          z: ringPoints.reduce((acc, pt) => acc + pt.depth, 0) / ringPoints.length,
          points: ringPoints,
          color: ring.color,
        });

        // Add orbiting packet node
        const pa = ring.progress;
        let px = Math.cos(pa) * ring.radius;
        let py = Math.sin(pa) * ring.radius * 0.35;
        let pz = Math.sin(pa) * ring.radius * 0.7;

        let pTilted = this.rotateX(px, py, pz, ring.tiltX);
        pTilted = this.rotateY(pTilted.x, pTilted.y, pTilted.z, ring.tiltY + this.rotY);
        pTilted = this.rotateX(pTilted.x, pTilted.y, pTilted.z, this.rotX);

        const packetProj = this.project(pTilted.x, pTilted.y, pTilted.z, cx, cy);
        renderList.push({
          type: 'packet',
          x: packetProj.x,
          y: packetProj.y,
          z: packetProj.depth,
          scale: packetProj.scale,
          color: ring.packetColor,
        });
      });

      // Sort back-to-front
      renderList.sort((a, b) => a.z - b.z);

      // Render items in depth order
      for (const item of renderList) {
        if (item.type === 'particle') {
          ctx.save();
          ctx.globalAlpha = item.alpha;
          ctx.fillStyle = item.color;
          ctx.shadowBlur = 6 * item.scale;
          ctx.shadowColor = item.color;
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (item.type === 'ring') {
          ctx.save();
          ctx.strokeStyle = item.color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          item.points.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        } else if (item.type === 'packet') {
          ctx.save();
          ctx.fillStyle = item.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = item.color;
          ctx.beginPath();
          ctx.arc(item.x, item.y, 3.5 * item.scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    loop(time) {
      if (this.isVisible) {
        this.update();
        this.draw();
      }
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  // Initialize once DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new HeroOrb());
  } else {
    new HeroOrb();
  }
})();
