#!/usr/bin/env python3
"""Synthesize per-bey ability SFX tuned to Metal Saga anime move character.

References (anime/wiki characterizations):
- Starblast Attack: soar skyward, nose-dive crash
- Sonic Buster: ultra-fast vibration → piercing shriek + sand
- Lion Gale Force Wall: tornado wall / gale
- Dragon Emperor Soaring Destruction: dark vortex, slam from above
- Diving Crush: soar on wind, crushing dive
- Lightning Sword Flash: focus energy as purple lightning, pierce strike
- Red Horn Uppercut / Maximum Stampede: heavy charge / upward horn smash
- Meteo Absorb / Spin Steal: drain then explosive break

Writes WAV/OGG/MP3 into assets/sfx/. Preview-only until wired.
"""

from __future__ import annotations

import importlib.util
import math
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
env_ad = g.env_ad
write_wav = g.write_wav
SR = g.SR


def delay(samples: list[float], sec: float) -> list[float]:
    return [0.0] * max(0, int(SR * sec)) + samples


def wind(
    dur: float,
    *,
    amp: float = 0.4,
    f0: float = 400.0,
    f1: float = 200.0,
    seed: int = 1,
    swirl: float = 8.0,
) -> list[float]:
    """Broad-band wind with slow amplitude swirl (tornado / soar feel)."""
    n = int(SR * dur)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SR
        u = t / dur if dur > 0 else 1.0
        e = math.sin(math.pi * u) ** 1.15
        swirl_e = 0.65 + 0.35 * math.sin(2 * math.pi * swirl * t)
        freq = f0 + (f1 - f0) * u
        phase += 2 * math.pi * freq / SR
        s = noise(i, seed) * e * amp * swirl_e
        s += math.sin(phase) * e * amp * 0.22 * swirl_e
        # high air hiss
        s += noise(i, seed + 9) * e * amp * 0.18 * (0.4 + 0.6 * u)
        out.append(soft_clip(s))
    return out


def shriek(dur: float = 0.55, *, amp: float = 0.45, seed: int = 1) -> list[float]:
    """Piercing Libra-style scream: dissonant highs + vibrato."""
    n = int(SR * dur)
    out = []
    p1 = p2 = p3 = 0.0
    for i in range(n):
        t = i / SR
        u = t / dur
        # swell then cut
        e = (u / 0.15 if u < 0.15 else 1.0) * (1.0 if u < 0.7 else (1 - (u - 0.7) / 0.3))
        vib = 1.0 + 0.04 * math.sin(2 * math.pi * 28 * t)
        f1 = 1800 * vib
        f2 = 2400 * vib
        f3 = 3100 * vib
        p1 += 2 * math.pi * f1 / SR
        p2 += 2 * math.pi * f2 / SR
        p3 += 2 * math.pi * f3 / SR
        s = (
            math.sin(p1) * 0.45
            + math.sin(p2) * 0.35
            + math.sin(p3) * 0.25
            + noise(i, seed) * 0.12
        ) * e * amp
        out.append(soft_clip(s, 1.8))
    return out


def dark_drone(dur: float, *, amp: float = 0.4, f0: float = 55.0, seed: int = 1) -> list[float]:
    """L-Drago dark power bed."""
    n = int(SR * dur)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SR
        e = env_ad(t, 0.04, dur - 0.04)
        # slight pitch wobble
        freq = f0 * (1.0 + 0.03 * math.sin(2 * math.pi * 3.5 * t))
        phase += 2 * math.pi * freq / SR
        s = math.sin(phase) * amp * e
        s += math.sin(phase * 1.5) * amp * 0.35 * e
        s += noise(i, seed) * amp * 0.18 * e
        out.append(soft_clip(s))
    return out


def lightning_crack(dur: float = 0.2, *, amp: float = 0.55, seed: int = 1) -> list[float]:
    """Purple-lightning crackle for Striker."""
    n = int(SR * dur)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SR
        e = env_exp(t, 0.04) * amp
        freq = 2200 * math.exp(-t * 12)
        phase += 2 * math.pi * freq / SR
        crackle = 1.0 if abs(noise(i, seed)) > 0.4 else 0.2
        s = noise(i, seed) * e * crackle + math.sin(phase) * e * 0.4
        out.append(soft_clip(s, 2.0))
    return out


def stampede_hits(count: int = 4, *, spacing: float = 0.09, seed: int = 1) -> list[float]:
    layers = []
    for i in range(count):
        hit = metal_hit(
            dur=0.18,
            base=70 + i * 8,
            bright=450,
            amp=0.55 + i * 0.05,
            scrape=0.35,
            seed=seed + i,
        )
        layers.append(delay(hit, i * spacing))
    return mix(*layers, gain=0.95)


def anime_announce() -> list[float]:
    """Special-move callout / logo flash: bright rising Metal Fight sting."""
    rise = pitch_sweep(420, 1260, 0.22, amp=0.4, attack=0.008, noise_amt=0.04, seed=501)
    chord = mix(
        tone(523.25, 0.35, amp=0.32, attack=0.01, decay=0.3),
        delay(tone(659.25, 0.32, amp=0.28, attack=0.01, decay=0.28), 0.04),
        delay(tone(783.99, 0.3, amp=0.24, attack=0.01, decay=0.26), 0.08),
        gain=0.95,
    )
    flash = pitch_sweep(1600, 3200, 0.12, amp=0.22, attack=0.002, seed=502)
    hit = metal_hit(dur=0.12, base=700, bright=2800, amp=0.28, scrape=0.08, seed=503)
    return pad(mix(rise, delay(chord, 0.05), delay(flash, 0.1), delay(hit, 0.08), gain=0.95), 0.48)


# --- shared ---

def special_logo_flash() -> list[float]:
    return anime_announce()


# --- Pegasus (heroic wind + shooting-star dive) ---

def pegasus_speed_boost() -> list[float]:
    # Bright wind rush — Gingka acceleration aura
    w = wind(0.4, amp=0.48, f0=700, f1=1400, seed=601, swirl=12)
    spark = pitch_sweep(900, 1600, 0.25, amp=0.28, attack=0.005, seed=602)
    return pad(mix(w, spark, gain=0.95), 0.45)


def pegasus_star_blast() -> list[float]:
    # Soar into the sky (Shooting Star Attack windup)
    ascend = wind(0.55, amp=0.5, f0=350, f1=1100, seed=611, swirl=6)
    stars = mix(
        delay(tone(1175, 0.12, amp=0.22, attack=0.002), 0.15),
        delay(tone(1568, 0.12, amp=0.2, attack=0.002), 0.28),
        delay(tone(2093, 0.12, amp=0.18, attack=0.002), 0.4),
        gain=0.9,
    )
    return pad(mix(ascend, stars, gain=0.95), 0.7)


def pegasus_star_blast_hit() -> list[float]:
    # Nose-dive crash from the heavens
    dive = wind(0.28, amp=0.55, f0=1600, f1=200, seed=612, swirl=2)
    smash = metal_hit(dur=0.4, base=140, bright=2200, amp=0.9, scrape=0.4, seed=613)
    boom = tone(65, 0.35, amp=0.45, attack=0.002, decay=0.32)
    debris = whoosh(0.25, amp=0.3, f0=500, f1=120, seed=614)
    return pad(mix(dive, delay(smash, 0.12), delay(boom, 0.12), delay(debris, 0.15), gain=1.0), 0.55)


# --- Lightning L-Drago (dark power / dragon vortex) ---

def ldrago_upper_mode() -> list[float]:
    # Mode shift: dark metal scrape + low growl
    scrape = metal_hit(dur=0.28, base=90, bright=700, amp=0.5, scrape=0.55, seed=621)
    drone = dark_drone(0.45, amp=0.42, f0=48, seed=622)
    snarl = pitch_sweep(160, 90, 0.35, amp=0.3, attack=0.02, noise_amt=0.2, seed=623)
    return pad(mix(scrape, drone, snarl, gain=0.95), 0.5)


def ldrago_soaring_destruction() -> list[float]:
    # Dark vortex gather → spiraling energy blast charge
    vortex = wind(0.7, amp=0.5, f0=180, f1=520, seed=631, swirl=14)
    dark = dark_drone(0.7, amp=0.45, f0=42, seed=632)
    charge = pitch_sweep(90, 380, 0.55, amp=0.35, attack=0.05, noise_amt=0.15, seed=633)
    return pad(mix(vortex, dark, charge, gain=0.95), 0.8)


def ldrago_soaring_hit() -> list[float]:
    # Smash into opponent, launch skyward, slam to floor
    blast = metal_hit(dur=0.45, base=85, bright=900, amp=0.95, scrape=0.5, seed=634)
    dark_boom = tone(40, 0.45, amp=0.5, attack=0.002, decay=0.4)
    crush = wind(0.35, amp=0.4, f0=600, f1=80, seed=635, swirl=3)
    return pad(mix(blast, dark_boom, crush, gain=1.05), 0.55)


# --- Meteo L-Drago (absorb / drain / break) ---

def ldrago_spin_steal() -> list[float]:
    # Vampire drain pull
    suck = pitch_sweep(900, 140, 0.55, amp=0.42, attack=0.03, noise_amt=0.18, seed=641)
    pulse = dark_drone(0.5, amp=0.3, f0=70, seed=642)
    siphon = wind(0.45, amp=0.3, f0=500, f1=150, seed=643, swirl=10)
    return pad(mix(suck, pulse, siphon, gain=0.95), 0.6)


def ldrago_absorb_break() -> list[float]:
    # Coil / absorb then rush release
    absorb = pitch_sweep(500, 220, 0.4, amp=0.38, attack=0.04, noise_amt=0.15, seed=651)
    coil = dark_drone(0.5, amp=0.38, f0=55, seed=652)
    rush = wind(0.35, amp=0.5, f0=200, f1=900, seed=653, swirl=5)
    return pad(mix(absorb, coil, delay(rush, 0.28), gain=0.95), 0.75)


def ldrago_absorb_hit() -> list[float]:
    impact = metal_hit(dur=0.4, base=120, bright=1000, amp=0.9, scrape=0.45, seed=654)
    devour = pitch_sweep(350, 60, 0.4, amp=0.4, attack=0.005, noise_amt=0.2, seed=655)
    shatter = lightning_crack(0.18, amp=0.35, seed=656)
    return pad(mix(impact, devour, delay(shatter, 0.05), gain=1.0), 0.5)


# --- Leone (earth dig + gale tornado wall) ---

def leone_wide_ball() -> list[float]:
    # Dig into stadium / rock grind anchor
    dig = metal_hit(dur=0.3, base=60, bright=350, amp=0.65, scrape=0.55, seed=661)
    grit = wind(0.4, amp=0.35, f0=160, f1=70, seed=662, swirl=4)
    stone = tone(48, 0.45, amp=0.4, attack=0.02, decay=0.4)
    return pad(mix(dig, grit, stone, gain=0.95), 0.5)


def leone_lion_wall() -> list[float]:
    # Lion Gale Force Wall — roaring tornado
    tornado = wind(0.85, amp=0.58, f0=220, f1=650, seed=671, swirl=18)
    roar = dark_drone(0.7, amp=0.28, f0=85, seed=672)  # lion body in the gale
    howl = pitch_sweep(180, 420, 0.6, amp=0.28, attack=0.05, noise_amt=0.12, seed=673)
    return pad(mix(tornado, roar, howl, gain=0.95), 0.95)


def leone_lion_wall_pulse() -> list[float]:
    burst = wind(0.32, amp=0.5, f0=700, f1=180, seed=674, swirl=8)
    thump = metal_hit(dur=0.2, base=85, bright=550, amp=0.5, scrape=0.25, seed=675)
    return pad(mix(burst, thump, gain=0.95), 0.38)


# --- Libra (vibration + canon piercing shriek + sand) ---

def libra_sonic_shield() -> list[float]:
    # Vibrating defensive dome
    hum = tone(440, 0.4, amp=0.32, attack=0.02, decay=0.35)
    vib = pitch_sweep(440, 520, 0.35, amp=0.22, attack=0.01, noise_amt=0.08, seed=681)
    shimmer = tone(880, 0.3, amp=0.2, attack=0.01, decay=0.25)
    return pad(mix(hum, vib, shimmer, gain=0.95), 0.45)


def libra_sonic_buster() -> list[float]:
    # Fast vibration → terrible piercing shriek (wiki: Sonic Buster / Sonic Wave)
    vib = wind(0.35, amp=0.35, f0=300, f1=900, seed=691, swirl=20)
    sand = whoosh(0.4, amp=0.3, f0=400, f1=150, seed=692)
    scream = shriek(0.6, amp=0.5, seed=693)
    return pad(mix(vib, sand, delay(scream, 0.2), gain=0.95), 0.9)


def libra_sonic_buster_pulse() -> list[float]:
    pulse = shriek(0.28, amp=0.4, seed=694)
    sand = wind(0.28, amp=0.4, f0=550, f1=120, seed=695, swirl=6)
    thump = tone(160, 0.18, amp=0.35, attack=0.004, decay=0.15)
    return pad(mix(pulse, sand, thump, gain=0.95), 0.35)


# --- Eagle (wind soar + crushing dive) ---

def eagle_counter_stance() -> list[float]:
    wing = wind(0.3, amp=0.42, f0=800, f1=350, seed=701, swirl=5)
    snap = metal_hit(dur=0.12, base=550, bright=2200, amp=0.35, scrape=0.12, seed=702)
    ready = tone(392, 0.25, amp=0.28, attack=0.008, decay=0.2)
    return pad(mix(wing, snap, ready, gain=0.95), 0.4)


def eagle_diving_crush() -> list[float]:
    # Glide / soar gathering air resistance, then dive
    soar = wind(0.55, amp=0.48, f0=400, f1=1000, seed=711, swirl=7)
    cry = pitch_sweep(900, 1400, 0.25, amp=0.22, attack=0.01, seed=712)  # high eagle-ish call
    dive = wind(0.35, amp=0.55, f0=1200, f1=220, seed=713, swirl=2)
    return pad(mix(soar, cry, delay(dive, 0.35), gain=0.95), 0.8)


def eagle_diving_hit() -> list[float]:
    crush = metal_hit(dur=0.38, base=150, bright=1700, amp=0.85, scrape=0.35, seed=714)
    boom = tone(70, 0.32, amp=0.42, attack=0.002, decay=0.28)
    air = wind(0.25, amp=0.35, f0=500, f1=100, seed=715, swirl=2)
    return pad(mix(crush, boom, air, gain=1.0), 0.45)


# --- Striker (purple lightning sword) ---

def striker_blitz_charge() -> list[float]:
    zap = lightning_crack(0.22, amp=0.5, seed=721)
    rush = wind(0.35, amp=0.4, f0=900, f1=500, seed=722, swirl=9)
    charge = pitch_sweep(400, 1200, 0.3, amp=0.3, attack=0.01, noise_amt=0.1, seed=723)
    return pad(mix(zap, rush, charge, gain=0.95), 0.45)


def striker_lightning_flash() -> list[float]:
    # Vanish zip → purple lightning focus → sword slash
    vanish = pitch_sweep(1800, 300, 0.18, amp=0.35, attack=0.001, noise_amt=0.12, seed=731)
    focus = lightning_crack(0.25, amp=0.55, seed=732)
    slash = wind(0.28, amp=0.5, f0=1600, f1=280, seed=733, swirl=1)
    ring = tone(1240, 0.2, amp=0.2, attack=0.002, decay=0.18)
    return pad(mix(vanish, delay(focus, 0.1), delay(slash, 0.16), delay(ring, 0.18), gain=0.95), 0.55)


def striker_lightning_hit() -> list[float]:
    # Single-point pierce that "breaks through almost anything"
    zap = lightning_crack(0.2, amp=0.6, seed=734)
    pierce = pitch_sweep(2400, 500, 0.2, amp=0.4, attack=0.001, noise_amt=0.1, seed=735)
    hit = metal_hit(dur=0.28, base=200, bright=3000, amp=0.75, scrape=0.2, seed=736)
    return pad(mix(zap, pierce, hit, gain=1.0), 0.4)


# --- Bull (stampede charge + horn uppercut) ---

def bull_maximum_stampede() -> list[float]:
    # Charging herd / heavy stomps accelerating
    stomps = stampede_hits(5, spacing=0.08, seed=741)
    rumble = dark_drone(0.55, amp=0.35, f0=50, seed=742)
    charge = wind(0.5, amp=0.45, f0=180, f1=420, seed=743, swirl=4)
    return pad(mix(stomps, rumble, charge, gain=0.95), 0.6)


def bull_red_horn_uppercut() -> list[float]:
    # Horn lower / scrape, then upward charge
    scrape = metal_hit(dur=0.25, base=100, bright=700, amp=0.55, scrape=0.5, seed=751)
    snort = pitch_sweep(120, 200, 0.25, amp=0.3, attack=0.02, noise_amt=0.15, seed=752)
    rush = wind(0.35, amp=0.5, f0=250, f1=650, seed=753, swirl=3)
    return pad(mix(scrape, snort, delay(rush, 0.15), gain=0.95), 0.55)


def bull_red_horn_hit() -> list[float]:
    # Uppercut launch smash
    horn = metal_hit(dur=0.42, base=95, bright=850, amp=0.95, scrape=0.45, seed=754)
    lift = pitch_sweep(160, 420, 0.28, amp=0.35, attack=0.002, seed=755)
    boom = tone(50, 0.4, amp=0.5, attack=0.002, decay=0.35)
    return pad(mix(horn, lift, boom, gain=1.05), 0.5)


ABILITY_SFX = {
    "special_logo_flash": special_logo_flash,
    "pegasus_speed_boost": pegasus_speed_boost,
    "pegasus_star_blast": pegasus_star_blast,
    "pegasus_star_blast_hit": pegasus_star_blast_hit,
    "ldrago_upper_mode": ldrago_upper_mode,
    "ldrago_soaring_destruction": ldrago_soaring_destruction,
    "ldrago_soaring_hit": ldrago_soaring_hit,
    "ldrago_spin_steal": ldrago_spin_steal,
    "ldrago_absorb_break": ldrago_absorb_break,
    "ldrago_absorb_hit": ldrago_absorb_hit,
    "leone_wide_ball": leone_wide_ball,
    "leone_lion_wall": leone_lion_wall,
    "leone_lion_wall_pulse": leone_lion_wall_pulse,
    "libra_sonic_shield": libra_sonic_shield,
    "libra_sonic_buster": libra_sonic_buster,
    "libra_sonic_buster_pulse": libra_sonic_buster_pulse,
    "eagle_counter_stance": eagle_counter_stance,
    "eagle_diving_crush": eagle_diving_crush,
    "eagle_diving_hit": eagle_diving_hit,
    "striker_blitz_charge": striker_blitz_charge,
    "striker_lightning_flash": striker_lightning_flash,
    "striker_lightning_hit": striker_lightning_hit,
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
    print(f"done → {OUT_DIR} ({len(ABILITY_SFX)} anime-tuned clips)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
