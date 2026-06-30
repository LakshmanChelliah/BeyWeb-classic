import { CONFIG } from '../../config.js';
import { clamp01 } from '../../utils/math.js';

/** Special-move logo flash and windup are 50% longer than base ability.windup values. */
export const SPECIAL_WINDUP_MULT = 1.5;
export const SPECIAL_LOGO_FLASH_DUR = 0.825;

export function effectiveSpecialWindup(baseWindup) {
  return (baseWindup || 0) * SPECIAL_WINDUP_MULT;
}

export function slotWindupTotal(slot, fallback = 0) {
  if (slot.windupDuration > 0) return slot.windupDuration;
  const base = slot.ability?.windup ?? fallback;
  return base > 0 ? effectiveSpecialWindup(base) : base;
}

// ---- Star Blast tuning ------------------------------------------------------
export const STAR_APEX = 38;
export const STAR_DASH_DUR = 0.8;           // smoother, slower run-up to the wall
export const STAR_WALL_IMPACT_DUR = 0.36;   // longer squash + recoil so it reads
export const STAR_WALL_RECOIL = 1.6;        // how far it rebounds off the wall (XZ units)
export const STAR_ASCEND_DUR = 0.92;        // one continuous wall-hit → apex arc (no mid-air pause)
export const STAR_DIVE_DUR = 0.82;          // slower accelerating plunge
export const STAR_FALL_PITCH = -Math.PI / 2;
export const STAR_FALL_ROLL = Math.PI / 2;
export const STAR_LAND_LIFT = 0.25;
// Big slam bounces (integrated; lower gravity = slower, floatier hops).
export const STAR_BOUNCE_GRAVITY = 62;
export const STAR_BOUNCE_VELOCITY = 14;
export const STAR_BOUNCE_RESTITUTION = 0.48;
export const STAR_BOUNCE_MIN_V = 4.2;
export const STAR_BOUNCE_KNOCKBACK = 3.4;   // XZ push on each ground tap
export const STAR_BOUNCE_KB_SCALE = 0.16;   // scales knockback with impact speed
export const STAR_BOUNCE_OPP_MULT = 1.2;    // extra push on the foe when discs overlap
export const STAR_BLAST_HIT_KNOCKBACK = 5.2; // slam connect on the opponent
export const LDRAGO_LIGHTNING_HIT_KNOCKBACK = STAR_BLAST_HIT_KNOCKBACK;
export const STAR_BLAST_IMPULSE_MULT = 4.8;  // bey-vs-bey radial pop on Star Blast hit
export const STAR_KB_DAMP = 10;             // decay rate; v0 = distance * damp → ~distance travel
export const STAR_PHYSICS_KB_SCALE = 7;     // opponent knockback via velocity only (no position snap)
export const STAR_BOUNCE_PULSE_DUR = 0.2;   // squash stretch per contact
export const STAR_BOUNCE_UPRIGHT_RATE = 0.00035; // slower tilt recovery between hops
// Settle: a few little decaying hops + a slow, gentle wobble as it rebalances.
export const STAR_SETTLE_DUR = 1.35;
export const STAR_SETTLE_HOPS = 3;          // number of little hops
export const STAR_SETTLE_HOP_HEIGHT = 0.32;
export const STAR_SETTLE_WOBBLES = 3;       // gentle sways over the settle (slower = fewer)
export const STAR_SETTLE_WOBBLE_AMP = 0.08; // radians, kept subtle
export const STAR_BLAST_HIT_SPIN = 0.24;    // opponent spin loss on a connected slam
export const STAR_BLAST_MISS_SELF = 0.05;   // self spin loss when the dive whiffs
// Star Blast camera: full stadium in frame at normal FOV, walls + a little sky above.
export const STAR_BLAST_CAM_Y = 28;
export const STAR_BLAST_CAM_Z = 24;
export const STAR_BLAST_CAM_LOOK_Y = 1.5;
export const SLAM_IMPULSE_MULT = 2.6;
export const SLAM_SPIN_MULT = 2.4;
export const SLAM_SELF_IMPULSE = 0.25;
export const BOOST_STEER_MULT = 1.85;
export const FLIGHT_LIFT = 0.12;
export const LDRAGO_FLIGHT_WINDUP = 0.65;
export const LDRAGO_FLIGHT_DURATION = 3.05;
export const LDRAGO_FLIGHT_LAND_DUR = 0.28;
export const LDRAGO_FLIGHT_LAUNCH_DUR = 0.85;
export const LDRAGO_LIGHTNING_COUNT = 5;
export const LDRAGO_LIGHTNING_CHARGE_DUR = 0.85;
export const LDRAGO_LIGHTNING_STRIKE_INTERVAL = 0.17;
export const LDRAGO_LIGHTNING_RADIUS = 2.35;
export const LDRAGO_SPIN_STEAL_DURATION = 4;
export const LDRAGO_FLIGHT_APEX = 15;
export const LDRAGO_FLIGHT_BOB = 0.35;
export const LDRAGO_FLIGHT_LAUNCH_PEAK = 0.58;
export const LDRAGO_LIGHTNING_POST_DUR = 0.2;
export const GUARD_IMPULSE_MULT = 3.4;
export const GUARD_SPIN_MULT = 2.2;
export const GUARD_SELF_IMPULSE = 0.04;
export const SPIN_STEAL_KB_MULT = 0.4; // 60% knockback reduction while Spin Steal is active

// Meteo L-Drago — Absorb Break (anime dragon-rush finisher that devours rival spin).
export const LDRAGO_ABSORB_DURATION = 3.2;
export const LDRAGO_ABSORB_WINDUP = 0.55;
export const LDRAGO_ABSORB_DASH_SPEED = 30;
export const LDRAGO_ABSORB_DASH_AIM_TRACK = 0.28;
export const LDRAGO_ABSORB_COAST_ARRIVE = 0.35;
export const LDRAGO_ABSORB_HIT_KB = 5.6;
export const LDRAGO_ABSORB_HIT_SPIN = 0.24;
export const LDRAGO_ABSORB_STEAL_GAIN = 0.1;
export const LDRAGO_ABSORB_MISS_SELF = 0.045;
export const LDRAGO_ABSORB_PULL_RATE = 5.5;
export const METEO_GLOW = '#ef4444';

// Lightning L-Drago — Upper Mode (Smash Attack knockback boost; wiki mode-change gimmick).
export const LDRAGO_GLOW = '#5B21D9';
export const LDRAGO_UPPER_MODE_DUR = 3.5;
export const LDRAGO_UPPER_MODE_KB_MULT = 1.5; // +50% outgoing collision knockback

// Rock Leone — Wide Ball anchor + Lion Gale Force Wall (defense-tuned, low ATK).
export const LEONE_ANCHOR_KB_OUT = 0.82;  // outgoing (low ATK stat)
export const LEONE_ANCHOR_DAMAGE_TAKEN = 0.2; // knockback felt while planted
export const LEONE_ANCHOR_STEER = 0.68;
export const LEONE_ANCHOR_DAMPING = 0.44;
export const LEONE_WALL_REPULSE = 4.2;    // max radial push per tornado pulse (XZ)
export const LEONE_WALL_REPULSE_SPIN = 0.0065; // opponent spin chip per strong pulse
export const LEONE_WALL_SELF_SPIN = 0.012; // passive drain per second during the wall
export const LEONE_WALL_PULSE = 0.12;
export const LEONE_WALL_REACH_MULT = 5.5; // reach = (rSelf + rOpp) * this — full tornado radius
export const LEONE_WALL_HOVER_BASE = 2.75; // disc center height — above ground bey reach
export const LEONE_WALL_HOVER_BOB = 0.2;
export const LEONE_WALL_DURATION = 5.55;  // active tornado time (3× original 1.85s)
/** Leone takes 15% less spin loss from bey-vs-bey hits and slams. */
export const LEONE_SPIN_LOSS_TAKEN = 0.85;
export const LEONE_DIG_DUR = 0.25;
export const LEONE_SQUASH_HOLD = 0.82;
export const LEONE_SHAKE_AMP = 0.04;

// Flame Libra — Sonic Shield + Sonic Buster (stamina / control tuned).
export const LIBRA_SHIELD_REPULSE = 3.6;
export const LIBRA_SHIELD_REPULSE_SPIN = 0.0055;
export const LIBRA_SHIELD_SELF_SPIN = 0.009;
export const LIBRA_SHIELD_PULSE = 0.13;
export const LIBRA_SHIELD_REACH_MULT = 2.75;
export const LIBRA_SHIELD_DURATION = 3.4;

export const LIBRA_BUSTER_RADIUS_MULT = 9.0;
export const LIBRA_BUSTER_DURATION = 4.8;
export const LIBRA_BUSTER_SPREAD_DUR = 3.5;
export const LIBRA_BUSTER_WINDUP_DUR = 1.55;
export const LIBRA_BUSTER_SLOW_STEER = 0.36;
export const LIBRA_BUSTER_DRAG = 3.1;
export const LIBRA_BUSTER_SLOW_RATE = 2;
export const LIBRA_BUSTER_VIBRATE_HZ = 200;
export const LIBRA_BUSTER_VIBRATE_LIFT = 0.34;
export const LIBRA_BUSTER_VIBRATE_XY = 0.07;
export const LIBRA_BUSTER_VISUAL_SPIN = 4.5;
export const LIBRA_BUSTER_QUICKSAND_PULL = CONFIG.SONIC_QUICKSAND_PULL_MULT;
export const LIBRA_BUSTER_QUICKSAND_SINK = 14;
export const LIBRA_BUSTER_DAMAGE_TAKEN = 0.1;

// Dark Bull — Maximum Stampede + Red Horn Uppercut (balance-tuned).
export const BULL_STAMPEDE_DURATION = 3;
export const BULL_STAMPEDE_KB_OUT = 1.35;
export const BULL_STAMPEDE_STEER = 1.35;
export const BULL_UPPERCUT_DURATION = 9;
export const BULL_UPPERCUT_WINDUP = 0.42;
export const BULL_DASH_BUILD_DUR = 0.32;
export const BULL_CHARGE_DUR = BULL_DASH_BUILD_DUR;
export const BULL_DASH_SPEED = 28;
export const BULL_DASH_LEAN = 0.36;
export const BULL_COAST_ARRIVE = 0.35;
export const BULL_DASH_AIM_TRACK_DUR = 0.14;
export const BULL_RECOVER_DUR = 0.45;
export const BULL_UPPERCUT_BASE_KB = 2.4;
export const BULL_UPPERCUT_SPIN_MIN = 0.25;
export const BULL_UPPERCUT_SPIN_MAX = 0.30;
export const BULL_UPPERCUT_MISS_SELF = 0.04;
export const BULL_AIR_RISE_DUR = 0.88;
export const BULL_AIR_GRAVITY = 24;
export const BULL_AIR_WOBBLE_AMP = 0.2;
export const BULL_AIR_WOBBLE_RATE = 7.8;
export const BULL_FLIP_DUR = BULL_AIR_RISE_DUR + 1.5;

export function isBullFlipActive(body) {
  return body?.userData?.bullFlipPhase != null;
}
export const BULL_UPPERCUT_SLAM_MULT = 1.2;
export const BULL_UPPERCUT_LIFT = 14;

// Ray Striker — Blitz Charge + Lightning Sword Flash (Ray wheel / CS tip rush).
export const STRIKER_GLOW = '#14b8a6';
export const STRIKER_BLITZ_STEER = 1.95;
export const STRIKER_FLASH_DURATION = 3.4;
export const STRIKER_FLASH_WINDUP = 0.35;
export const STRIKER_VANISH_DUR = 0.16;
export const STRIKER_REAPPEAR_DUR = 0.12;
export const STRIKER_TELEPORT_LEAD = 2.4;
export const STRIKER_DASH_SPEED = 32;
export const STRIKER_DASH_AIM_TRACK = 0.2;
export const STRIKER_FLASH_KB = 4.4;
export const STRIKER_FLASH_SPIN = 0.17;
export const STRIKER_FLASH_MISS_SELF = 0.035;
export const STRIKER_COAST_ARRIVE = 0.35;

// Earth Eagle — Counter Stance + Diving Crush.
export const EAGLE_GLOW = '#f59e0b';
export const EAGLE_COUNTER_DUR = 3.2;
export const EAGLE_COUNTER_KB_MULT = 2.2;
export const EAGLE_COUNTER_SELF_MULT = 0.18;
export const EAGLE_COUNTER_SPIN_MULT = 2.15;
export const EAGLE_DIVE_APEX = 24;
export const EAGLE_DIVE_ASCEND_DUR = 0.74;
export const EAGLE_DIVE_HOVER_DUR = 0.34;
export const EAGLE_DIVE_DUR = 0.44;
export const EAGLE_DIVE_SETTLE_DUR = 0.75;
export const EAGLE_DIVE_HIT_SPIN = 0.22;
export const EAGLE_DIVE_MISS_SELF = 0.045;
export const EAGLE_DIVE_IMPULSE_MULT = 4.0;
export const EAGLE_DIVE_MIN_IMPULSE = 8.0;

export function groundY(body) {
  const r = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  return CONFIG.FLOOR_Y + r + CONFIG.FLOOR_EPSILON;
}

// ---- easing helpers (0..1 -> 0..1) -----------------------------------------
export const easeInQuad = (t) => t * t;
export const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/** Quicksand radius grows outward from Libra over the buster (windup + active). */
export function libraBusterSandRadius(fullReach, elapsed) {
  const spread = easeOutCubic(clamp01(elapsed / LIBRA_BUSTER_SPREAD_DUR));
  return fullReach * Math.max(0.08, spread);
}
export const easeInCubic = (t) => t * t * t;
export const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
// Damped oscillation that settles to 0 — used for the upright wobble.
export const dampedWobble = (t) => Math.cos(t * Math.PI * 3.2) * Math.pow(1 - t, 2.2);
