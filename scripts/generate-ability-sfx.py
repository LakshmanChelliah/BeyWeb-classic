#!/usr/bin/env python3
"""Synthesize per-bey ability SFX lasting the full in-game effect duration.

Durations match js/game/abilities/impl.js (specials include effective windup =
base windup * SPECIAL_WINDUP_MULT 1.5). Hit/pulse clips stay short accents.

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

SPECIAL_WINDUP_MULT = 1.5
SPECIAL_LOGO_FLASH_DUR = 0.825

# (base_windup, active_duration) — special total = base*1.5 + active
DUR = {
    "special_logo_flash": SPECIAL_LOGO_FLASH_DUR,
    "pegasus_speed_boost": 3.0,
    "pegasus_star_blast": 0.5 * SPECIAL_WINDUP_MULT + 6.0,  # 6.75
    "pegasus_star_blast_hit": 0.55,
    "ldrago_upper_mode": 3.5,
    "ldrago_soaring_destruction": 0.5 * SPECIAL_WINDUP_MULT + 6.0,  # 6.75
    "ldrago_soaring_hit": 0.55,
    "ldrago_spin_steal": 4.0,
    "ldrago_absorb_break": 0.78 * SPECIAL_WINDUP_MULT + 4.0,  # 5.17
    "ldrago_absorb_hit": 0.55,
    "leone_wide_ball": 2.6,
    "leone_lion_wall": 0.45 * SPECIAL_WINDUP_MULT + 5.55,  # 6.225
    "leone_lion_wall_pulse": 0.35,
    "libra_sonic_shield": 3.4,
    "libra_sonic_buster": 1.55 * SPECIAL_WINDUP_MULT + 4.8,  # 7.125
    "libra_sonic_buster_pulse": 0.35,
    "eagle_counter_stance": 3.2,
    "eagle_diving_crush": 0.55 * SPECIAL_WINDUP_MULT + 3.1,  # 3.925
    "eagle_diving_hit": 0.5,
    "striker_blitz_charge": 3.0,
    "striker_lightning_flash": 0.35 * SPECIAL_WINDUP_MULT + 3.4,  # 3.925
    "striker_lightning_hit": 0.45,
    "bull_maximum_stampede": 3.0,
    "bull_red_horn_uppercut": 0.42 * SPECIAL_WINDUP_MULT + 9.0,  # 9.63
    "bull_red_horn_hit": 0.55,
}


def delay(samples: list[float], sec: float) -> list[float]:
    return [0.0] * max(0, int(SR * sec)) + samples


def env_asr(t: float, dur: float, attack: float = 0.08, release: float = 0.2) -> float:
    if t < 0 or t > dur:
        return 0.0
    if t < attack:
        return t / attack if attack > 0 else 1.0
    if t > dur - release:
        return max(0.0, (dur - t) / release) if release > 0 else 0.0
    return 1.0


def wind_bed(
    dur: float,
    *,
    amp: float = 0.4,
    f0: float = 400.0,
    f1: float = 200.0,
    seed: int = 1,
    swirl: float = 8.0,
) -> list[float]:
    n = int(SR * dur)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SR
        u = t / dur if dur > 0 else 1.0
        e = env_asr(t, dur, 0.06, 0.18)
        swirl_e = 0.65 + 0.35 * math.sin(2 * math.pi * swirl * t)
        # slow morph of center freq across the whole effect
        freq = f0 + (f1 - f0) * (0.5 + 0.5 * math.sin(math.pi * u))
        phase += 2 * math.pi * freq / SR
        s = noise(i, seed) * e * amp * swirl_e
        s += math.sin(phase) * e * amp * 0.2 * swirl_e
        s += noise(i, seed + 9) * e * amp * 0.16
        out.append(soft_clip(s))
    return out


def dark_drone(dur: float, *, amp: float = 0.4, f0: float = 55.0, seed: int = 1) -> list[float]:
    n = int(SR * dur)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SR
        e = env_asr(t, dur, 0.1, 0.25)
        freq = f0 * (1.0 + 0.04 * math.sin(2 * math.pi * 2.8 * t))
        phase += 2 * math.pi * freq / SR
        s = math.sin(phase) * amp * e
        s += math.sin(phase * 1.5) * amp * 0.32 * e
        s += noise(i, seed) * amp * 0.14 * e
        out.append(soft_clip(s))
    return out


def shimmer_bed(dur: float, *, amp: float = 0.22, base: float = 660.0, seed: int = 1) -> list[float]:
    n = int(SR * dur)
    out = []
    p1 = p2 = 0.0
    for i in range(n):
        t = i / SR
        e = env_asr(t, dur, 0.08, 0.2)
        vib = 1.0 + 0.02 * math.sin(2 * math.pi * 5 * t)
        p1 += 2 * math.pi * base * vib / SR
        p2 += 2 * math.pi * base * 1.5 * vib / SR
        pulse = 0.7 + 0.3 * math.sin(2 * math.pi * 3.2 * t)
        s = (math.sin(p1) * 0.55 + math.sin(p2) * 0.35 + noise(i, seed) * 0.08) * e * amp * pulse
        out.append(soft_clip(s))
    return out


def shriek_bed(dur: float, *, amp: float = 0.38, seed: int = 1) -> list[float]:
    """Sustained piercing Libra shriek with vibrato pulses."""
    n = int(SR * dur)
    out = []
    p1 = p2 = p3 = 0.0
    for i in range(n):
        t = i / SR
        e = env_asr(t, dur, 0.12, 0.25)
        # pulse intensity every ~0.35s like sonic waves
        wave = 0.55 + 0.45 * abs(math.sin(2 * math.pi * (1 / 0.35) * t))
        vib = 1.0 + 0.035 * math.sin(2 * math.pi * 26 * t)
        p1 += 2 * math.pi * 1700 * vib / SR
        p2 += 2 * math.pi * 2300 * vib / SR
        p3 += 2 * math.pi * 2900 * vib / SR
        s = (
            math.sin(p1) * 0.42
            + math.sin(p2) * 0.32
            + math.sin(p3) * 0.22
            + noise(i, seed) * 0.1
        ) * e * amp * wave
        out.append(soft_clip(s, 1.7))
    return out


def lightning_crackle_bed(dur: float, *, amp: float = 0.35, seed: int = 1) -> list[float]:
    n = int(SR * dur)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SR
        e = env_asr(t, dur, 0.05, 0.15)
        # intermittent arcs
        arc = 1.0 if abs(noise(i, seed)) > 0.55 or (int(t * 18) % 3 == 0 and abs(noise(i, seed + 2)) > 0.2) else 0.12
        freq = 1800 + 900 * math.sin(2 * math.pi * 7 * t)
        phase += 2 * math.pi * freq / SR
        s = (noise(i, seed) * arc + math.sin(phase) * 0.35 * arc) * e * amp
        out.append(soft_clip(s, 2.0))
    return out


def stampede_bed(dur: float, *, seed: int = 1) -> list[float]:
    """Repeating stomp hits across the stampede duration."""
    layers = []
    t = 0.0
    i = 0
    spacing = 0.12
    while t < dur - 0.15:
        hit = metal_hit(
            dur=0.16,
            base=70 + (i % 4) * 6,
            bright=420,
            amp=0.5 + 0.05 * (i % 3),
            scrape=0.3,
            seed=seed + i,
        )
        layers.append(delay(hit, t))
        t += spacing
        # accelerate slightly
        spacing = max(0.07, spacing - 0.004)
        i += 1
    rumble = dark_drone(dur, amp=0.32, f0=48, seed=seed + 99)
    charge = wind_bed(dur, amp=0.35, f0=200, f1=450, seed=seed + 50, swirl=5)
    return pad(mix(rumble, charge, *layers, gain=0.92), dur)


def accent_start(seed: int = 1) -> list[float]:
    return metal_hit(dur=0.18, base=220, bright=1600, amp=0.45, scrape=0.2, seed=seed)


def accent_end(seed: int = 1) -> list[float]:
    return whoosh(0.22, amp=0.35, f0=500, f1=120, seed=seed)


def with_bookends(bed: list[float], dur: float, *, seed: int = 1) -> list[float]:
    start = accent_start(seed)
    end = delay(accent_end(seed + 7), max(0.0, dur - 0.22))
    return pad(mix(bed, start, end, gain=0.95), dur)


# --- builders -----------------------------------------------------------------

def special_logo_flash() -> list[float]:
    dur = DUR["special_logo_flash"]
    rise = pitch_sweep(420, 1260, 0.22, amp=0.4, attack=0.008, noise_amt=0.04, seed=501)
    chord = mix(
        tone(523.25, dur * 0.9, amp=0.28, attack=0.01, decay=dur * 0.85),
        delay(tone(659.25, dur * 0.85, amp=0.24, attack=0.01, decay=dur * 0.8), 0.04),
        delay(tone(783.99, dur * 0.8, amp=0.2, attack=0.01, decay=dur * 0.75), 0.08),
        gain=0.95,
    )
    flash = pitch_sweep(1600, 3200, 0.12, amp=0.22, attack=0.002, seed=502)
    return pad(mix(rise, delay(chord, 0.05), delay(flash, 0.1), gain=0.95), dur)


def pegasus_speed_boost() -> list[float]:
    dur = DUR["pegasus_speed_boost"]
    bed = wind_bed(dur, amp=0.48, f0=700, f1=1300, seed=601, swirl=11)
    spark = shimmer_bed(dur, amp=0.18, base=880, seed=602)
    return with_bookends(mix(bed, spark, gain=0.95), dur, seed=603)


def pegasus_star_blast() -> list[float]:
    """Windup soar (~0.75s) then prolonged aerial/dive presence (~6s)."""
    dur = DUR["pegasus_star_blast"]
    windup = 0.5 * SPECIAL_WINDUP_MULT
    ascend = wind_bed(windup + 1.2, amp=0.5, f0=350, f1=1100, seed=611, swirl=6)
    stars = shimmer_bed(dur, amp=0.16, base=1175, seed=612)
    # mid-effect dive rush accents
    dive1 = delay(wind_bed(0.9, amp=0.55, f0=1400, f1=250, seed=613, swirl=2), windup + 1.5)
    dive2 = delay(wind_bed(0.85, amp=0.5, f0=1200, f1=200, seed=614, swirl=2), windup + 3.2)
    body = wind_bed(dur, amp=0.32, f0=500, f1=700, seed=615, swirl=5)
    return pad(mix(body, ascend, stars, dive1, dive2, accent_start(616), gain=0.93), dur)


def pegasus_star_blast_hit() -> list[float]:
    dur = DUR["pegasus_star_blast_hit"]
    dive = wind_bed(0.28, amp=0.55, f0=1600, f1=200, seed=612, swirl=2)
    smash = metal_hit(dur=0.4, base=140, bright=2200, amp=0.9, scrape=0.4, seed=613)
    boom = tone(65, 0.35, amp=0.45, attack=0.002, decay=0.32)
    return pad(mix(dive, delay(smash, 0.1), delay(boom, 0.1), gain=1.0), dur)


def ldrago_upper_mode() -> list[float]:
    dur = DUR["ldrago_upper_mode"]
    drone = dark_drone(dur, amp=0.42, f0=48, seed=621)
    scrape = metal_hit(dur=0.28, base=90, bright=700, amp=0.5, scrape=0.55, seed=622)
    snarl = wind_bed(dur, amp=0.28, f0=160, f1=90, seed=623, swirl=4)
    return pad(mix(drone, scrape, snarl, gain=0.95), dur)


def ldrago_soaring_destruction() -> list[float]:
    dur = DUR["ldrago_soaring_destruction"]
    vortex = wind_bed(dur, amp=0.52, f0=180, f1=520, seed=631, swirl=14)
    dark = dark_drone(dur, amp=0.45, f0=42, seed=632)
    charge = pitch_sweep(90, 380, min(0.8, dur * 0.2), amp=0.35, attack=0.05, noise_amt=0.15, seed=633)
    mid = delay(pitch_sweep(200, 500, 0.6, amp=0.28, attack=0.04, noise_amt=0.12, seed=634), dur * 0.35)
    return pad(mix(vortex, dark, charge, mid, gain=0.93), dur)


def ldrago_soaring_hit() -> list[float]:
    dur = DUR["ldrago_soaring_hit"]
    blast = metal_hit(dur=0.45, base=85, bright=900, amp=0.95, scrape=0.5, seed=634)
    dark_boom = tone(40, 0.45, amp=0.5, attack=0.002, decay=0.4)
    crush = wind_bed(0.35, amp=0.4, f0=600, f1=80, seed=635, swirl=3)
    return pad(mix(blast, dark_boom, crush, gain=1.05), dur)


def ldrago_spin_steal() -> list[float]:
    dur = DUR["ldrago_spin_steal"]
    # continuous drain pull
    n = int(SR * dur)
    suck = []
    phase = 0.0
    for i in range(n):
        t = i / SR
        e = env_asr(t, dur, 0.1, 0.25)
        # repeating suck pulses
        pulse = 0.6 + 0.4 * abs(math.sin(2 * math.pi * 1.4 * t))
        freq = 700 - 400 * (0.5 + 0.5 * math.sin(2 * math.pi * 0.7 * t))
        phase += 2 * math.pi * freq / SR
        s = math.sin(phase) * 0.35 * e * pulse
        s += noise(i, 641) * 0.2 * e * pulse
        suck.append(soft_clip(s))
    drone = dark_drone(dur, amp=0.3, f0=70, seed=642)
    siphon = wind_bed(dur, amp=0.28, f0=500, f1=150, seed=643, swirl=10)
    return pad(mix(suck, drone, siphon, gain=0.95), dur)


def ldrago_absorb_break() -> list[float]:
    dur = DUR["ldrago_absorb_break"]
    windup = 0.78 * SPECIAL_WINDUP_MULT
    absorb = wind_bed(windup + 0.8, amp=0.4, f0=500, f1=180, seed=651, swirl=8)
    coil = dark_drone(dur, amp=0.38, f0=55, seed=652)
    rush = delay(wind_bed(1.2, amp=0.55, f0=200, f1=900, seed=653, swirl=5), windup + 0.5)
    body = wind_bed(dur, amp=0.3, f0=250, f1=400, seed=654, swirl=6)
    return pad(mix(body, absorb, coil, rush, gain=0.93), dur)


def ldrago_absorb_hit() -> list[float]:
    dur = DUR["ldrago_absorb_hit"]
    impact = metal_hit(dur=0.4, base=120, bright=1000, amp=0.9, scrape=0.45, seed=654)
    devour = pitch_sweep(350, 60, 0.4, amp=0.4, attack=0.005, noise_amt=0.2, seed=655)
    return pad(mix(impact, devour, gain=1.0), dur)


def leone_wide_ball() -> list[float]:
    dur = DUR["leone_wide_ball"]
    dig = metal_hit(dur=0.3, base=60, bright=350, amp=0.65, scrape=0.55, seed=661)
    grit = wind_bed(dur, amp=0.38, f0=160, f1=70, seed=662, swirl=4)
    stone = dark_drone(dur, amp=0.35, f0=48, seed=663)
    # occasional rock ticks
    ticks = []
    t = 0.4
    k = 0
    while t < dur - 0.2:
        ticks.append(delay(metal_hit(dur=0.12, base=80, bright=400, amp=0.3, scrape=0.4, seed=664 + k), t))
        t += 0.55
        k += 1
    return pad(mix(dig, grit, stone, *ticks, gain=0.93), dur)


def leone_lion_wall() -> list[float]:
    dur = DUR["leone_lion_wall"]
    tornado = wind_bed(dur, amp=0.58, f0=220, f1=650, seed=671, swirl=18)
    roar = dark_drone(dur, amp=0.28, f0=85, seed=672)
    howl = wind_bed(dur, amp=0.25, f0=180, f1=420, seed=673, swirl=9)
    return pad(mix(tornado, roar, howl, accent_start(674), gain=0.93), dur)


def leone_lion_wall_pulse() -> list[float]:
    dur = DUR["leone_lion_wall_pulse"]
    burst = wind_bed(dur, amp=0.5, f0=700, f1=180, seed=674, swirl=8)
    thump = metal_hit(dur=0.2, base=85, bright=550, amp=0.5, scrape=0.25, seed=675)
    return pad(mix(burst, thump, gain=0.95), dur)


def libra_sonic_shield() -> list[float]:
    dur = DUR["libra_sonic_shield"]
    hum = shimmer_bed(dur, amp=0.28, base=440, seed=681)
    vib = wind_bed(dur, amp=0.22, f0=400, f1=520, seed=682, swirl=12)
    ring = tone(780, dur * 0.9, amp=0.12, attack=0.05, decay=dur * 0.85)
    return pad(mix(hum, vib, ring, gain=0.95), dur)


def libra_sonic_buster() -> list[float]:
    dur = DUR["libra_sonic_buster"]
    windup = 1.55 * SPECIAL_WINDUP_MULT
    vib = wind_bed(windup, amp=0.4, f0=300, f1=900, seed=691, swirl=20)
    sand = wind_bed(dur, amp=0.32, f0=400, f1=150, seed=692, swirl=7)
    scream = delay(shriek_bed(dur - windup * 0.5, amp=0.42, seed=693), windup * 0.55)
    return pad(mix(vib, sand, scream, gain=0.93), dur)


def libra_sonic_buster_pulse() -> list[float]:
    dur = DUR["libra_sonic_buster_pulse"]
    pulse = shriek_bed(dur, amp=0.4, seed=694)
    sand = wind_bed(dur, amp=0.4, f0=550, f1=120, seed=695, swirl=6)
    return pad(mix(pulse, sand, gain=0.95), dur)


def eagle_counter_stance() -> list[float]:
    dur = DUR["eagle_counter_stance"]
    wing = wind_bed(dur, amp=0.4, f0=750, f1=350, seed=701, swirl=5)
    ready = shimmer_bed(dur, amp=0.14, base=392, seed=702)
    snap = metal_hit(dur=0.12, base=550, bright=2200, amp=0.35, scrape=0.12, seed=703)
    return pad(mix(wing, ready, snap, gain=0.95), dur)


def eagle_diving_crush() -> list[float]:
    dur = DUR["eagle_diving_crush"]
    windup = 0.55 * SPECIAL_WINDUP_MULT
    soar = wind_bed(windup + 1.0, amp=0.48, f0=400, f1=1000, seed=711, swirl=7)
    cry = delay(pitch_sweep(900, 1400, 0.25, amp=0.22, attack=0.01, seed=712), windup * 0.4)
    dive = delay(wind_bed(1.1, amp=0.55, f0=1200, f1=220, seed=713, swirl=2), windup + 0.9)
    body = wind_bed(dur, amp=0.3, f0=500, f1=600, seed=714, swirl=4)
    return pad(mix(body, soar, cry, dive, gain=0.93), dur)


def eagle_diving_hit() -> list[float]:
    dur = DUR["eagle_diving_hit"]
    crush = metal_hit(dur=0.38, base=150, bright=1700, amp=0.85, scrape=0.35, seed=714)
    boom = tone(70, 0.32, amp=0.42, attack=0.002, decay=0.28)
    air = wind_bed(0.25, amp=0.35, f0=500, f1=100, seed=715, swirl=2)
    return pad(mix(crush, boom, air, gain=1.0), dur)


def striker_blitz_charge() -> list[float]:
    dur = DUR["striker_blitz_charge"]
    zap = lightning_crackle_bed(dur, amp=0.38, seed=721)
    rush = wind_bed(dur, amp=0.38, f0=900, f1=500, seed=722, swirl=9)
    charge = pitch_sweep(400, 1200, 0.3, amp=0.3, attack=0.01, noise_amt=0.1, seed=723)
    return pad(mix(zap, rush, charge, gain=0.95), dur)


def striker_lightning_flash() -> list[float]:
    dur = DUR["striker_lightning_flash"]
    windup = 0.35 * SPECIAL_WINDUP_MULT
    vanish = pitch_sweep(1800, 300, 0.18, amp=0.35, attack=0.001, noise_amt=0.12, seed=731)
    crackle = delay(lightning_crackle_bed(dur - windup * 0.3, amp=0.4, seed=732), windup * 0.5)
    slash = delay(wind_bed(0.5, amp=0.5, f0=1600, f1=280, seed=733, swirl=1), windup + 0.3)
    body = wind_bed(dur, amp=0.25, f0=700, f1=900, seed=734, swirl=6)
    return pad(mix(body, vanish, crackle, slash, gain=0.93), dur)


def striker_lightning_hit() -> list[float]:
    dur = DUR["striker_lightning_hit"]
    zap = lightning_crackle_bed(0.2, amp=0.55, seed=734)
    pierce = pitch_sweep(2400, 500, 0.2, amp=0.4, attack=0.001, noise_amt=0.1, seed=735)
    hit = metal_hit(dur=0.28, base=200, bright=3000, amp=0.75, scrape=0.2, seed=736)
    return pad(mix(zap, pierce, hit, gain=1.0), dur)


def bull_maximum_stampede() -> list[float]:
    return stampede_bed(DUR["bull_maximum_stampede"], seed=741)


def bull_red_horn_uppercut() -> list[float]:
    """Long uppercut cinematic (~9.6s including windup)."""
    dur = DUR["bull_red_horn_uppercut"]
    windup = 0.42 * SPECIAL_WINDUP_MULT
    scrape = metal_hit(dur=0.3, base=100, bright=700, amp=0.55, scrape=0.5, seed=751)
    snort = dark_drone(windup + 0.8, amp=0.35, f0=70, seed=752)
    rush = delay(wind_bed(1.4, amp=0.5, f0=250, f1=650, seed=753, swirl=3), windup)
    # sustained charge / chase body for the long active window
    body = wind_bed(dur, amp=0.35, f0=180, f1=320, seed=754, swirl=4)
    rumble = dark_drone(dur, amp=0.32, f0=50, seed=755)
    # mid accents like repeated horn threats
    accents = []
    t = windup + 1.5
    k = 0
    while t < dur - 0.8:
        accents.append(
            delay(metal_hit(dur=0.2, base=110, bright=800, amp=0.4, scrape=0.35, seed=756 + k), t)
        )
        t += 1.4
        k += 1
    return pad(mix(body, rumble, scrape, snort, rush, *accents, gain=0.92), dur)


def bull_red_horn_hit() -> list[float]:
    dur = DUR["bull_red_horn_hit"]
    horn = metal_hit(dur=0.42, base=95, bright=850, amp=0.95, scrape=0.45, seed=754)
    lift = pitch_sweep(160, 420, 0.28, amp=0.35, attack=0.002, seed=755)
    boom = tone(50, 0.4, amp=0.5, attack=0.002, decay=0.35)
    return pad(mix(horn, lift, boom, gain=1.05), dur)


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
        expected = DUR[name]
        actual = len(samples) / SR
        wav_path = OUT_DIR / f"{name}.wav"
        write_wav(wav_path, samples)
        try:
            convert(wav_path)
        except (FileNotFoundError, subprocess.CalledProcessError) as e:
            print(f"warn: convert failed for {name}: {e}", file=sys.stderr)
        print(f"wrote {name}  ({actual:.2f}s, target {expected:.2f}s)")
    print(f"done → {OUT_DIR} ({len(ABILITY_SFX)} full-duration clips)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
