---
name: tts
description: "Google Cloud Text-to-Speech — synthesize text or markdown into OGG, MP3 or WAV with multilingual voices, and list available voices. Use when the user asks to narrate text, read something aloud or generate an audio file."
---

# Google Cloud TTS

OAuth client and refresh token remain in 1Password. Access tokens are refreshed and cached only in memory. Long text is split into chunks and joined with the installed `ffmpeg` binary.

## Functions

- `tts.voices({ lang? })`
- `tts.speak({ text, out?, voice?, lang?, speed?, pitch?, format?, strip? })`
  - defaults: `ru-RU`, `Chirp3-HD-Puck`, `OGG_OPUS`;
  - `format`: `OGG_OPUS | MP3 | LINEAR16`;
  - returns `{ saved, chunks }`.

```ts
await ctx.fns.tts.voices({ lang: "ru-RU" });
await ctx.fns.tts.speak({ text: "Привет!", out: "/tmp/hello.ogg" });
```
