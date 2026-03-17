<p align="center">
  <img src="../cssm-brand/badge/cssm-badge-dark.svg" alt="CSSMotion" />
</p>

# @cssm/player

> The `<cssm-player>` web component. Load and play `.cssm` animations in any browser — zero runtime, pure CSS.

## Quick start

```html
<script type="module" src="https://cdn.cssmotion.dev/player/1.x/cssm-player.js"></script>
<cssm-player src="my-animation.cssm"></cssm-player>
```

## Attributes

| Attribute | Description |
|---|---|
| `src` | Path to the `.cssm` file (required) |
| `variant` | Variant ID to apply (matches `manifest.theming.variants[].id`) |
| `autoplay` | Override autoplay on/off |
| `loop` | Loop the animation |

## CSS token overrides

```css
cssm-player {
  --cssm-primary-color: #6C63FF;
  --cssm-duration-scale: 1.5;
}
```

## JavaScript API

```js
const player = document.querySelector('cssm-player');

player.play();    // Start
player.stop();    // Stop and reset
player.replay();  // Restart from beginning
```

## Events

```js
player.addEventListener('cssm:ready', (e) => console.log(e.detail.manifest));
player.addEventListener('cssm:play',  () => console.log('playing'));
player.addEventListener('cssm:end',   () => console.log('finished'));
player.addEventListener('cssm:error', (e) => console.error(e.detail.error));
```

## Building the demo

```bash
npm install
npm run build   # packages src/ → dist/confetti-burst.cssm
npm run dev     # serves the demo on localhost:3000
```

## Spec

The `.cssm` format spec lives at [github.com/cssmotion/spec](https://github.com/cssmotion/spec).
