# Original game audio

## Background loop

- File: `riverside-night-loop.mp3`
- Generated with `google/lyria-3-clip-preview` through OpenRouter, 2026-09-26 UTC.
- Provider: Google AI Studio. One successful generation; reported cost USD 0.04.
- API: Chat Completions with `modalities: ["audio"]` and `stream: true`.
- The credential was read only by an external local script. It is not shipped with the game.

### Exact prompt

Create an original 30-second instrumental background music loop for a cozy Thai riverside adventure game at night. Gentle khim hammered dulcimer, soft bamboo flute phrases, delicate wooden percussion, a very quiet warm low drone, subtle flowing water atmosphere. Relaxed but inviting walking rhythm around 88 BPM, soft pentatonic melody, warm lantern light and moonlit lotus ponds. Keep the arrangement sparse and its volume even, leaving room for game sound effects. No vocals, no speech, no recognizable existing melody, no dramatic crescendo, no loud impacts. Begin and end on the same soft harmonic texture with no long silence so it can loop seamlessly.

### Processing

The provider returned a 29.73-second MP3 at 44.1 kHz stereo. A 0.8-second tail/head crossfade smooths the loop boundary; loudness was normalized to −20 LUFS with a −2 dBTP ceiling. Final MP3: 28.97 seconds, 44.1 kHz stereo, 128 kbps, 463,978 bytes. The runtime keeps background volume low and pauses playback while the tab is hidden.

## Effects

Hit, critical-hit, item-drop, level-up, boss-arrival and boss-victory cues are original short Web Audio oscillator envelopes defined in `src/game/audio/game-audio-controller.ts`. No external sound recording or network request is used for effects. Overlap is limited to four voices and repeated cues are throttled.
