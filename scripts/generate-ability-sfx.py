#!/usr/bin/env python3
"""Synthesize per-bey power/special ability SFX + special logo flash.

Reuses helpers from generate-sfx.py. Writes WAV/OGG/MP3 into assets/sfx/.
Preview-only until wired into the game.
"""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT_DIR = ROOT / "assets" / "sfx"

spec = importlib.util.spec_from_file_location("gensfx", HERE / "generate-sfx.py")
g = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(g)

tone = g.tone
mix = g.mix
pad = g.pad
pitch_sweep = g.pitch_sweep
metal_hit = g.metal_hit
whoosh = g.whoosh
noise = g.noise
soft_clip = g.soft_clip
env_exp = g.env_exp
write_wav = g.write_wav
SR = g.SR


def delay(samples: list[float], sec: float) -> list[float]:
    return [0.0] * int(SR * sec) + samples


def buzz(freq: float, dur: float, *, amp: float = 0.35, seed: int = 1) -> list[float]:
    """Harsh saw-ish buzz via summed harmonics + noise."""
    n = int(SR * dur)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SR
        e = env_exp(t, dur * 0.55) * (1.0 if t < dur else 0.0)
        # soft envelope attack
        if t < 0.01:
            e *= t / 0.01
        phase += 2 * 3.141592653589793 * freq / SR
        s = (
            soft_clip(phase % (2 * 3.141592653589793) / 3.141592653589793 - 1.0, 1.2) * amp * 0.55
            + __import__("math").sin(phase * 2) * amp * 0.25
            + noise(i, seed) * amp * 0.2
        ) * e
        out.append(s)
    return out


def pulse_train(freqs: list[float], dur: float, *, amp: float = 0.4, gap: float = 0.08) -> list[float]:
    layers = []
    t = 0.0
    for i, f in enumerate(freqs):
        layers.append(delay(tone(f, 0.12, amp=amp * (0.95 - i * 0.08), attack=0.003), t))
        t += gap
    return pad(mix(*layers, gain=0.95), dur)


# --- shared ---

def special_logo_flash() -> list[float]:
    """Bright UI sting for the special logo flash overlay."""
    a = pitch_sweep(900, 1800, 0.12, amp=0.35, attack=0.002, noise_amt=0.05, seed=201)
    b = tone(660, 0.28, amp=0.4, attack=0.004, decay=0.25)
    c = delay(tone(990, 0.22, amp=0.28, attack=0.004), 0.06)
    spark = metal_hit(dur=0.15, base=800, bright=3200, amp=0.25, scrape=0.1, seed=202)
    return pad(mix(a, b, c, spark, gain=0.95), 0.4)


# --- Pegasus ---

def pegasus_speed_boost() -> list[float]:
    w = whoosh(0.35, amp=0.45, f0=500, f1=1400, seed=301)
    t = pitch_sweep(440, 880, 0.3, amp=0.28, attack=0.01, seed=302)
    return pad(mix(w, t, gain=0.95), 0.4)


def pegasus_star_blast() -> list[float]:
    rise = pitch_sweep(220, 900, 0.35, amp=0.4, attack=0.02, noise_amt=0.08, seed=311)
    sparkle = pulse_train([880, 1175, 1568], 0.45, amp=0.35, gap=0.07)
    return pad(mix(rise, sparkle, gain=0.95), 0.5)


def pegasus_star_blast_hit() -> list[float]:
    hit = metal_hit(dur=0.35, base=180, bright=2400, amp=0.8, scrape=0.35, seed=312)
    boom = tone(80, 0.28, amp=0.4, attack=0.002, decay=0.25)
    star = pitch_sweep(2000, 600, 0.2, amp=0.25, attack=0.002, seed=313)
    return pad(mix(hit, boom, star, gain=1.0), 0.42)


# --- Lightning L-Drago ---

def ldrago_upper_mode() -> list[float]:
    growl = pitch_sweep(120, 90, 0.4, amp=0.4, attack=0.02, noise_amt=0.15, seed=321)
    snarl = buzz(90, 0.35, amp=0.35, seed=322)
    return pad(mix(growl, snarl, gain=0.95), 0.45)


def ldrago_soaring_destruction() -> list[float]:
    rise = pitch_sweep(160, 700, 0.4, amp=0.42, attack=0.025, noise_amt=0.12, seed=331)
    dark = buzz(70, 0.4, amp=0.3, seed=332)
    return pad(mix(rise, dark, gain=0.95), 0.5)


def ldrago_soaring_hit() -> list[float]:
    hit = metal_hit(dur=0.4, base=100, bright=1200, amp=0.85, scrape=0.4, seed=333)
    crack = pitch_sweep(1800, 200, 0.22, amp=0.3, attack=0.002, noise_amt=0.1, seed=334)
    return pad(mix(hit, crack, gain=1.0), 0.45)


# --- Meteo L-Drago ---

def ldrago_spin_steal() -> list[float]:
    suck = pitch_sweep(700, 180, 0.45, amp=0.4, attack=0.02, noise_amt=0.12, seed=341)
    pulse = tone(220, 0.35, amp=0.25, attack=0.01, decay=0.3)
    return pad(mix(suck, pulse, gain=0.95), 0.5)


def ldrago_absorb_break() -> list[float]:
    coil = pitch_sweep(300, 500, 0.3, amp=0.35, attack=0.02, noise_amt=0.1, seed=351)
    rush = whoosh(0.3, amp=0.45, f0=200, f1=900, seed=352)
    return pad(mix(coil, delay(rush, 0.12), gain=0.95), 0.55)


def ldrago_absorb_hit() -> list[float]:
    impact = metal_hit(dur=0.38, base=140, bright=900, amp=0.85, scrape=0.45, seed=353)
    devour = pitch_sweep(400, 80, 0.35, amp=0.35, attack=0.005, noise_amt=0.15, seed=354)
    return pad(mix(impact, devour, gain=1.0), 0.45)


# --- Leone ---

def leone_wide_ball() -> list[float]:
    dig = metal_hit(dur=0.25, base=70, bright=400, amp=0.55, scrape=0.35, seed=361)
    rumble = tone(55, 0.4, amp=0.4, attack=0.02, decay=0.35)
    grit = whoosh(0.3, amp=0.25, f0=180, f1=80, seed=362)
    return pad(mix(dig, rumble, grit, gain=0.95), 0.45)


def leone_lion_wall() -> list[float]:
    gale = whoosh(0.5, amp=0.5, f0=250, f1=700, seed=371)
    roar = buzz(85, 0.45, amp=0.32, seed=372)
    return pad(mix(gale, roar, gain=0.95), 0.55)


def leone_lion_wall_pulse() -> list[float]:
    p = whoosh(0.28, amp=0.4, f0=400, f1=150, seed=373)
    thump = metal_hit(dur=0.2, base=90, bright=600, amp=0.45, scrape=0.2, seed=374)
    return pad(mix(p, thump, gain=0.95), 0.32)


# --- Libra ---

def libra_sonic_shield() -> list[float]:
    dome = tone(520, 0.35, amp=0.35, attack=0.01, decay=0.3)
    ring = tone(780, 0.3, amp=0.25, attack=0.008, decay=0.25)
    shimmer = pitch_sweep(1000, 1600, 0.25, amp=0.2, attack=0.005, seed=381)
    return pad(mix(dome, ring, shimmer, gain=0.95), 0.42)


def libra_sonic_buster() -> list[float]:
    charge = pitch_sweep(200, 900, 0.55, amp=0.4, attack=0.03, noise_amt=0.1, seed=391)
    shriek = buzz(420, 0.4, amp=0.28, seed=392)
    return pad(mix(charge, delay(shriek, 0.15), gain=0.95), 0.65)


def libra_sonic_buster_pulse() -> list[float]:
    pulse = tone(180, 0.2, amp=0.4, attack=0.005, decay=0.18)
    sand = whoosh(0.25, amp=0.35, f0=500, f1=120, seed=393)
    hi = pitch_sweep(1400, 400, 0.18, amp=0.22, attack=0.002, seed=394)
    return pad(mix(pulse, sand, hi, gain=0.95), 0.3)


# --- Eagle ---

def eagle_counter_stance() -> list[float]:
    wing = whoosh(0.32, amp=0.4, f0=600, f1=300, seed=401)
    stance = tone(370, 0.28, amp=0.32, attack=0.01, decay=0.24)
    click = metal_hit(dur=0.12, base=500, bright=2000, amp=0.3, scrape=0.1, seed=402)
    return pad(mix(wing, stance, click, gain=0.95), 0.38)


def eagle_diving_crush() -> list[float]:
    ascend = pitch_sweep(300, 900, 0.35, amp=0.38, attack=0.02, seed=411)
    dive = whoosh(0.35, amp=0.5, f0=1000, f1=180, seed=412)
    return pad(mix(ascend, delay(dive, 0.2), gain=0.95), 0.6)


def eagle_diving_hit() -> list[float]:
    hit = metal_hit(dur=0.35, base=160, bright=1800, amp=0.8, scrape=0.3, seed=413)
    crush = tone(70, 0.3, amp=0.4, attack=0.002, decay=0.28)
    return pad(mix(hit, crush, gain=1.0), 0.4)


# --- Striker ---

def striker_blitz_charge() -> list[float]:
    zap = pitch_sweep(800, 1600, 0.18, amp=0.35, attack=0.002, noise_amt=0.12, seed=421)
    charge = buzz(200, 0.3, amp=0.3, seed=422)
    trail = whoosh(0.28, amp=0.35, f0=700, f1=400, seed=423)
    return pad(mix(zap, charge, trail, gain=0.95), 0.4)


def striker_lightning_flash() -> list[float]:
    vanish = pitch_sweep(1200, 200, 0.2, amp=0.35, attack=0.002, noise_amt=0.1, seed=431)
    flash = metal_hit(dur=0.15, base=900, bright=3500, amp=0.45, scrape=0.15, seed=432)
    slash = whoosh(0.28, amp=0.45, f0=1400, f1=300, seed=433)
    return pad(mix(vanish, delay(flash, 0.12), delay(slash, 0.14), gain=0.95), 0.48)


def striker_lightning_hit() -> list[float]:
    zap = pitch_sweep(2200, 400, 0.18, amp=0.4, attack=0.001, noise_amt=0.15, seed=434)
    hit = metal_hit(dur=0.28, base=220, bright=2800, amp=0.75, scrape=0.25, seed=435)
    return pad(mix(zap, hit, gain=1.0), 0.35)


# --- Bull ---

def bull_maximum_stampede() -> list[float]:
    stomp = metal_hit(dur=0.22, base=80, bright=500, amp=0.7, scrape=0.3, seed=441)
    charge = whoosh(0.4, amp=0.45, f0=200, f1=500, seed=442)
    rumble = tone(60, 0.4, amp=0.4, attack=0.015, decay=0.35)
    return pad(mix(stomp, charge, rumble, gain=0.95), 0.48)


def bull_red_horn_uppercut() -> list[float]:
    wind = pitch_sweep(150, 400, 0.28, amp=0.35, attack=0.02, noise_amt=0.1, seed=451)
    snort = buzz(100, 0.25, amp=0.3, seed=452)
    rush = whoosh(0.3, amp=0.45, f0=300, f1=700, seed=453)
    return pad(mix(wind, snort, delay(rush, 0.1), gain=0.95), 0.5)


def bull_red_horn_hit() -> list[float]:
    horn = metal_hit(dur=0.4, base=110, bright=900, amp=0.9, scrape=0.4, seed=454)
    upper = pitch_sweep(180, 90, 0.3, amp=0.35, attack=0.002, seed=455)
    boom = tone(55, 0.35, amp=0.45, attack=0.002, decay=0.3)
    return pad(mix(horn, upper, boom, gain=1.05), 0.45)


ABILITY_SFX = {
    "special_logo_flash": special_logo_flash,
    # Pegasus
    "pegasus_speed_boost": pegasus_speed_boost,
    "pegasus_star_blast": pegasus_star_blast,
    "pegasus_star_blast_hit": pegasus_star_blast_hit,
    # Lightning L-Drago
    "ldrago_upper_mode": ldrago_upper_mode,
    "ldrago_soaring_destruction": ldrago_soaring_destruction,
    "ldrago_soaring_hit": ldrago_soaring_hit,
    # Meteo L-Drago
    "ldrago_spin_steal": ldrago_spin_steal,
    "ldrago_absorb_break": ldrago_absorb_break,
    "ldrago_absorb_hit": ldrago_absorb_hit,
    # Leone
    "leone_wide_ball": leone_wide_ball,
    "leone_lion_wall": leone_lion_wall,
    "leone_lion_wall_pulse": leone_lion_wall_pulse,
    # Libra
    "libra_sonic_shield": libra_sonic_shield,
    "libra_sonic_buster": libra_sonic_buster,
    "libra_sonic_buster_pulse": libra_sonic_buster_pulse,
    # Eagle
    "eagle_counter_stance": eagle_counter_stance,
    "eagle_diving_crush": eagle_diving_crush,
    "eagle_diving_hit": eagle_diving_hit,
    # Striker
    "striker_blitz_charge": striker_blitz_charge,
    "striker_lightning_flash": striker_lightning_flash,
    "striker_lightning_hit": striker_lightning_hit,
    # Bull
    "bull_maximum_stampede": bull_maximum_stampede,
    "bull_red_horn_uppercut": bull_red_horn_uppercut,
    "bull_red_horn_hit": bull_red_horn_hit,
}


def convert(wav_path: Path) -> None:
    for codec, ext, extra in (
        ("libvorbis", ".ogg", ["-q:a", "5"]),
        ("libmp3lame", ".mp3", ["-q:a", "4"]),
    ):
        out = wav_path.with_suffix(ext)
        cmd = [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(wav_path),
            "-c:a",
            codec,
            *extra,
            str(out),
        ]
        subprocess.run(cmd, check=True)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, builder in ABILITY_SFX.items():
        samples = builder()
        wav_path = OUT_DIR / f"{name}.wav"
        write_wav(wav_path, samples)
        try:
            convert(wav_path)
        except (FileNotFoundError, subprocess.CalledProcessError) as e:
            print(f"warn: convert failed for {name}: {e}", file=sys.stderr)
        print(f"wrote {name}")
    print(f"done → {OUT_DIR} ({len(ABILITY_SFX)} ability clips)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
