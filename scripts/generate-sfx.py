#!/usr/bin/env python3
"""Synthesize arcade-metallic core-fight SFX for Bey Web.

Writes 16-bit mono WAV files to assets/sfx/, then (if ffmpeg is available)
converts each to OGG Vorbis for browser playback.
"""

from __future__ import annotations

import math
import struct
import subprocess
import sys
import wave
from pathlib import Path

SR = 44100
OUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "sfx"


def clamp(x: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return lo if x < lo else hi if x > hi else x


def env_ad(t: float, attack: float, decay: float) -> float:
    if t < 0:
        return 0.0
    if t < attack:
        return t / attack if attack > 0 else 1.0
    if t < attack + decay:
        return 1.0 - (t - attack) / decay
    return 0.0


def env_exp(t: float, tau: float) -> float:
    return math.exp(-t / tau) if t >= 0 and tau > 0 else 0.0


def noise(i: int, seed: int = 1) -> float:
    # Deterministic hash noise in [-1, 1]
    x = (i * 374761393 + seed * 668265263) & 0xFFFFFFFF
    x = ((x ^ (x >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((x & 0xFFFF) / 32768.0) - 1.0


def soft_clip(x: float, drive: float = 1.4) -> float:
    return math.tanh(x * drive)


def write_wav(path: Path, samples: list[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = bytearray()
        for s in samples:
            v = int(clamp(s) * 32767.0)
            frames += struct.pack("<h", v)
        w.writeframes(frames)


def tone(
    freq: float,
    dur: float,
    *,
    amp: float = 0.5,
    attack: float = 0.005,
    decay: float | None = None,
) -> list[float]:
    n = int(SR * dur)
    decay = dur - attack if decay is None else decay
    out = []
    for i in range(n):
        t = i / SR
        e = env_ad(t, attack, decay)
        out.append(math.sin(2 * math.pi * freq * t) * e * amp)
    return out


def mix(*layers: list[float], gain: float = 1.0) -> list[float]:
    length = max((len(l) for l in layers), default=0)
    out = [0.0] * length
    for layer in layers:
        for i, s in enumerate(layer):
            out[i] += s
    return [soft_clip(s * gain) for s in out]


def pad(samples: list[float], dur: float) -> list[float]:
    n = int(SR * dur)
    if len(samples) >= n:
        return samples[:n]
    return samples + [0.0] * (n - len(samples))


def pitch_sweep(
    f0: float,
    f1: float,
    dur: float,
    *,
    amp: float = 0.45,
    attack: float = 0.004,
    noise_amt: float = 0.0,
    seed: int = 1,
) -> list[float]:
    n = int(SR * dur)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SR
        u = t / dur if dur > 0 else 1.0
        freq = f0 + (f1 - f0) * u
        phase += 2 * math.pi * freq / SR
        e = env_ad(t, attack, dur - attack)
        s = math.sin(phase) * e * amp
        if noise_amt:
            s += noise(i, seed) * noise_amt * e
        out.append(s)
    return out


def metal_hit(
    *,
    dur: float = 0.28,
    base: float = 220.0,
    bright: float = 1800.0,
    amp: float = 0.7,
    scrape: float = 0.25,
    seed: int = 7,
) -> list[float]:
    n = int(SR * dur)
    out = []
    phase1 = phase2 = phase3 = 0.0
    for i in range(n):
        t = i / SR
        body = env_exp(t, 0.055) * amp
        ring = env_exp(t, 0.12) * amp * 0.55
        click = env_exp(t, 0.012) * amp
        phase1 += 2 * math.pi * base / SR
        phase2 += 2 * math.pi * (base * 2.17) / SR
        phase3 += 2 * math.pi * bright / SR
        s = (
            math.sin(phase1) * body
            + math.sin(phase2) * body * 0.45
            + math.sin(phase3) * ring * 0.35
            + noise(i, seed) * click * 0.55
            + noise(i, seed + 3) * scrape * env_exp(t, 0.04)
        )
        s += math.sin(phase1 * 3.0) * body * 0.18
        out.append(soft_clip(s, 1.6))
    return out


def whoosh(
    dur: float = 0.35,
    *,
    amp: float = 0.45,
    f0: float = 400.0,
    f1: float = 120.0,
    seed: int = 11,
) -> list[float]:
    n = int(SR * dur)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SR
        u = t / dur
        e = math.sin(math.pi * u) ** 1.4
        freq = f0 + (f1 - f0) * u
        phase += 2 * math.pi * freq / SR
        s = noise(i, seed) * e * amp
        s += math.sin(phase) * e * amp * 0.35
        out.append(soft_clip(s))
    return out


def launch_countdown_tick() -> list[float]:
    a = pitch_sweep(880, 1320, 0.08, amp=0.42, attack=0.002, noise_amt=0.08, seed=2)
    b = metal_hit(dur=0.12, base=660, bright=2400, amp=0.25, scrape=0.08, seed=2)
    return pad(mix(a, b, gain=0.95), 0.14)


def launch_rip_window() -> list[float]:
    w = whoosh(0.42, amp=0.4, f0=280, f1=900, seed=21)
    t = pitch_sweep(220, 440, 0.42, amp=0.22, attack=0.02, noise_amt=0.05, seed=22)
    return pad(mix(w, t, gain=0.9), 0.45)


def launch_rip() -> list[float]:
    w = whoosh(0.28, amp=0.55, f0=900, f1=180, seed=31)
    snap = metal_hit(dur=0.18, base=300, bright=2800, amp=0.55, scrape=0.35, seed=32)
    return pad(mix(w, snap, gain=1.0), 0.32)


def _grade(kind: str) -> list[float]:
    specs = {
        "miss": dict(freqs=(180, 140), amp=0.35, dur=0.28, bright=False),
        "weak": dict(freqs=(260, 300), amp=0.4, dur=0.3, bright=False),
        "good": dict(freqs=(360, 480), amp=0.48, dur=0.34, bright=True),
        "great": dict(freqs=(440, 660, 880), amp=0.55, dur=0.4, bright=True),
        "perfect": dict(freqs=(523, 784, 1046, 1568), amp=0.62, dur=0.55, bright=True),
    }
    s = specs[kind]
    layers = []
    for i, f in enumerate(s["freqs"]):
        layers.append(
            tone(f, s["dur"], amp=s["amp"] * (0.9 - i * 0.12), attack=0.006, decay=s["dur"] * 0.85)
        )
    if s["bright"]:
        layers.append(pitch_sweep(1200, 2400, 0.12, amp=0.18, attack=0.002, noise_amt=0.04, seed=40))
    else:
        layers.append(metal_hit(dur=0.15, base=140, bright=600, amp=0.2, scrape=0.1, seed=41))
    return pad(mix(*layers, gain=0.95), s["dur"] + 0.04)


def launch_drop() -> list[float]:
    thunk = metal_hit(dur=0.22, base=90, bright=700, amp=0.7, scrape=0.15, seed=51)
    whir = pitch_sweep(120, 520, 0.45, amp=0.28, attack=0.01, noise_amt=0.12, seed=52)
    return pad(mix(thunk, whir, gain=0.95), 0.5)


def clash_light() -> list[float]:
    return pad(
        metal_hit(dur=0.22, base=260, bright=2200, amp=0.55, scrape=0.2, seed=61),
        0.25,
    )


def clash_heavy() -> list[float]:
    a = metal_hit(dur=0.38, base=150, bright=1600, amp=0.85, scrape=0.4, seed=62)
    b = metal_hit(dur=0.25, base=90, bright=900, amp=0.5, scrape=0.2, seed=63)
    boom = tone(70, 0.25, amp=0.35, attack=0.002, decay=0.22)
    return pad(mix(a, b, boom, gain=1.05), 0.42)


def wall_hit() -> list[float]:
    clack = metal_hit(dur=0.18, base=200, bright=1400, amp=0.55, scrape=0.45, seed=71)
    scrape = whoosh(0.22, amp=0.25, f0=600, f1=200, seed=72)
    return pad(mix(clack, scrape, gain=0.95), 0.28)


def ring_out() -> list[float]:
    w = whoosh(0.55, amp=0.5, f0=700, f1=90, seed=81)
    fall = pitch_sweep(480, 80, 0.55, amp=0.35, attack=0.01, noise_amt=0.1, seed=82)
    return pad(mix(w, fall, gain=0.95), 0.6)


def sleep_out() -> list[float]:
    whir = pitch_sweep(380, 70, 0.85, amp=0.32, attack=0.02, noise_amt=0.08, seed=91)
    tip = metal_hit(dur=0.3, base=110, bright=500, amp=0.4, scrape=0.25, seed=92)
    tip_pad = [0.0] * int(SR * 0.55) + tip
    return pad(mix(whir, tip_pad, gain=0.95), 0.95)


def result_win() -> list[float]:
    notes = [523.25, 659.25, 783.99, 1046.5]
    layers = []
    for i, f in enumerate(notes):
        delay = int(SR * (0.07 * i))
        t = tone(f, 0.45, amp=0.42 - i * 0.04, attack=0.008, decay=0.4)
        layers.append([0.0] * delay + t)
    sparkle = pitch_sweep(1600, 3200, 0.2, amp=0.15, attack=0.002, seed=101)
    return pad(mix(*layers, sparkle, gain=0.95), 0.75)


def result_lose() -> list[float]:
    a = tone(392, 0.35, amp=0.4, attack=0.01, decay=0.32)
    b = [0.0] * int(SR * 0.12) + tone(311.13, 0.45, amp=0.38, attack=0.012, decay=0.4)
    c = [0.0] * int(SR * 0.28) + tone(233.08, 0.55, amp=0.35, attack=0.015, decay=0.5)
    dull = metal_hit(dur=0.25, base=100, bright=400, amp=0.2, scrape=0.1, seed=111)
    return pad(mix(a, b, c, dull, gain=0.9), 0.85)


def result_draw() -> list[float]:
    a = tone(440, 0.28, amp=0.38, attack=0.01, decay=0.25)
    b = [0.0] * int(SR * 0.18) + tone(440, 0.35, amp=0.32, attack=0.01, decay=0.3)
    return pad(mix(a, b, gain=0.9), 0.55)


SFX = {
    "launch_countdown_tick": launch_countdown_tick,
    "launch_rip_window": launch_rip_window,
    "launch_rip": launch_rip,
    "launch_grade_miss": lambda: _grade("miss"),
    "launch_grade_weak": lambda: _grade("weak"),
    "launch_grade_good": lambda: _grade("good"),
    "launch_grade_great": lambda: _grade("great"),
    "launch_grade_perfect": lambda: _grade("perfect"),
    "launch_drop": launch_drop,
    "clash_light": clash_light,
    "clash_heavy": clash_heavy,
    "wall_hit": wall_hit,
    "ring_out": ring_out,
    "sleep_out": sleep_out,
    "result_win": result_win,
    "result_lose": result_lose,
    "result_draw": result_draw,
}


def to_ogg(wav_path: Path) -> None:
    ogg_path = wav_path.with_suffix(".ogg")
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-i",
        str(wav_path),
        "-c:a",
        "libvorbis",
        "-q:a",
        "5",
        str(ogg_path),
    ]
    subprocess.run(cmd, check=True)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, builder in SFX.items():
        samples = builder()
        wav_path = OUT_DIR / f"{name}.wav"
        write_wav(wav_path, samples)
        try:
            to_ogg(wav_path)
        except (FileNotFoundError, subprocess.CalledProcessError) as e:
            print(f"warn: ogg convert failed for {name}: {e}", file=sys.stderr)
        print(f"wrote {name}")
    print(f"done → {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
