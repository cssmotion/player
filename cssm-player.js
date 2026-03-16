/**
 * cssm-player.js — The <cssm-player> web component
 *
 * Loads a .cssm file (ZIP bundle), injects the SVG + CSS into a shadow DOM,
 * and manages playback state, triggers, and reduced motion — all declaratively
 * from the manifest. Zero runtime dependencies. The animation itself is pure CSS.
 *
 * Usage:
 *   <cssm-player src="confetti-burst.cssm"></cssm-player>
 *   <cssm-player src="confetti-burst.cssm" variant="dark"></cssm-player>
 *
 * Attributes:
 *   src          — path to the .cssm file (required)
 *   variant      — variant id to apply (matches manifest.theming.variants[].id)
 *   autoplay     — override autoplay (present = true, absent = use manifest value)
 *   loop         — override iterationCount to infinite
 *
 * CSS custom property overrides (match manifest tokens):
 *   cssm-player { --cssm-primary-color: hotpink; }
 *
 * Events:
 *   cssm:ready   — fired when the animation is loaded and ready to play
 *   cssm:play    — fired when animation starts
 *   cssm:end     — fired when animation finishes (non-looping only)
 *   cssm:error   — fired if the bundle fails to load
 *
 * Methods:
 *   play()       — start the animation
 *   replay()     — reset and restart
 *   stop()       — stop and reset to initial state
 */

import { unzipSync, strFromU8 } from 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js';

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

class CssmPlayer extends HTMLElement {

  static get observedAttributes() {
    return ['src', 'variant'];
  }

  constructor() {
    super();
    this._manifest = null;
    this._ready = false;
    this._shadow = this.attachShadow({ mode: 'open' });
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  connectedCallback() {
    const src = this.getAttribute('src');
    if (src) this._load(src);
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (!this.isConnected || oldVal === newVal) return;
    if (name === 'src') this._load(newVal);
    if (name === 'variant') this._applyVariant(newVal);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  play() {
    if (!this._ready) return;
    if (REDUCED_MOTION.matches && this._manifest?.accessibility?.reducedMotionBehavior === 'static') {
      return;
    }
    this.setAttribute('playing', '');
    this.dispatchEvent(new CustomEvent('cssm:play', { bubbles: true }));
    this._scheduleEndEvent();
  }

  stop() {
    this.removeAttribute('playing');
  }

  replay() {
    this.stop();
    // Force a reflow so removing/re-adding the attribute restarts CSS animations
    void this._shadow.host.offsetWidth;
    requestAnimationFrame(() => this.play());
  }

  // ─── Loading ──────────────────────────────────────────────────────────────

  async _load(src) {
    this._ready = false;
    this._shadow.innerHTML = this._loadingTemplate();

    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${src}`);

      const buffer = await response.arrayBuffer();
      const files = unzipSync(new Uint8Array(buffer));

      // Parse manifest
      if (!files['manifest.json']) throw new Error('manifest.json not found in bundle');
      const manifest = JSON.parse(strFromU8(files['manifest.json']));
      this._manifest = manifest;

      // Get SVG and CSS
      const svgPath = manifest.assets?.svg || 'animation.svg';
      const cssPath = manifest.assets?.css || 'animation.css';

      if (!files[svgPath]) throw new Error(`${svgPath} not found in bundle`);
      if (!files[cssPath]) throw new Error(`${cssPath} not found in bundle`);

      const svgText = strFromU8(files[svgPath]);
      let cssText = strFromU8(files[cssPath]);

      // Apply variant if requested
      const variantId = this.getAttribute('variant');
      if (variantId && manifest.theming?.variants) {
        const variant = manifest.theming.variants.find(v => v.id === variantId);
        if (variant?.file && files[variant.file]) {
          cssText += '\n' + strFromU8(files[variant.file]);
        }
      }

      // Auto-apply media-query-matched variants
      if (manifest.theming?.variants) {
        for (const variant of manifest.theming.variants) {
          if (variant.mediaQuery && window.matchMedia(variant.mediaQuery).matches) {
            if (variant.file && files[variant.file]) {
              cssText += '\n' + strFromU8(files[variant.file]);
            }
          }
        }
      }

      // Render into shadow DOM
      this._shadow.innerHTML = `
        <style>
          :host {
            display: inline-block;
            width: 100%;
            aspect-ratio: ${manifest.dimensions?.aspectRatio || '1/1'};
            max-width: ${manifest.dimensions?.width || 400}px;
          }
          :host svg {
            width: 100%;
            height: 100%;
          }
          ${cssText}
        </style>
        ${svgText}
      `;

      this._ready = true;
      this.dispatchEvent(new CustomEvent('cssm:ready', { bubbles: true, detail: { manifest } }));

      // Set up triggers
      this._setupTriggers(manifest);

      // Autoplay
      const shouldAutoplay = this.hasAttribute('autoplay') || manifest.playback?.autoplay;
      if (shouldAutoplay && !manifest.playback?.triggers?.inView) {
        this.play();
      }

    } catch (err) {
      console.error('[cssm-player]', err);
      this._shadow.innerHTML = this._errorTemplate(err.message);
      this.dispatchEvent(new CustomEvent('cssm:error', { bubbles: true, detail: { error: err } }));
    }
  }

  // ─── Triggers ─────────────────────────────────────────────────────────────

  _setupTriggers(manifest) {
    const triggers = manifest.playback?.triggers || {};

    if (triggers.click) {
      this.style.cursor = 'pointer';
      this.addEventListener('click', () => this.replay());
    }

    if (triggers.hover) {
      this.addEventListener('mouseenter', () => this.play());
      this.addEventListener('mouseleave', () => this.stop());
    }

    if (triggers.inView || (manifest.playback?.autoplay && triggers.inView !== false)) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.play();
            // Only play once on first view
            if (!this.hasAttribute('loop')) observer.disconnect();
          }
        });
      }, { threshold: 0.3 });
      observer.observe(this);
    }
  }

  // ─── End event ────────────────────────────────────────────────────────────

  _scheduleEndEvent() {
    const manifest = this._manifest;
    if (!manifest) return;

    const duration = manifest.playback?.duration || 1200;
    const maxDelay = 120; // max animation-delay in ms across all particles
    const totalDuration = duration + maxDelay;

    setTimeout(() => {
      if (this.hasAttribute('playing')) {
        this.dispatchEvent(new CustomEvent('cssm:end', { bubbles: true }));
        if (!this.hasAttribute('loop') && manifest.playback?.iterationCount !== 'infinite') {
          // Leave in final state (fillMode: forwards)
        }
      }
    }, totalDuration);
  }

  // ─── Variant ──────────────────────────────────────────────────────────────

  _applyVariant(variantId) {
    // Reload to apply the new variant
    const src = this.getAttribute('src');
    if (src) this._load(src);
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  _loadingTemplate() {
    return `
      <style>
        :host { display: inline-block; width: 100%; aspect-ratio: 1/1; }
        .cssm-loading {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          opacity: 0.3; font-size: 12px; font-family: sans-serif;
          color: currentColor;
        }
      </style>
      <div class="cssm-loading">Loading…</div>
    `;
  }

  _errorTemplate(message) {
    return `
      <style>
        :host { display: inline-block; width: 100%; aspect-ratio: 1/1; }
        .cssm-error {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-family: monospace;
          color: #ff6b6b; padding: 8px; box-sizing: border-box;
          text-align: center;
        }
      </style>
      <div class="cssm-error">⚠ ${message}</div>
    `;
  }
}

customElements.define('cssm-player', CssmPlayer);
