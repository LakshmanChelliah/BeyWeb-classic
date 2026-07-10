/**
 * Loading-screen tips: player advice, stadium facts, and random bey ability blurbs.
 * Ability lines are built from ABILITY_REGISTRY so descriptions stay accurate.
 */
import { BEYS, isBeyPlayable } from './beys.js';
import { ABILITY_REGISTRY } from './abilities.js';

const GAME_TIPS = Object.freeze([
  { kind: 'tip', text: 'Three KO pockets sit in the stadium rim. Get knocked through one and you\'re out.' },
  { kind: 'tip', text: 'Sleep Out happens when your spin hits zero and your bey tips over. Keep it spinning!' },
  { kind: 'tip', text: 'If both beys sleep out while still on the platform, the battle ends in a draw.' },
  { kind: 'tip', text: 'ATK boosts knockback you deal. DEF softens hits you take. STA slows spin decay.' },
  { kind: 'tip', text: 'MOVE controls how hard you steer. It\'s separate from combat ATK.' },
  { kind: 'tip', text: 'Wall hits cost spin. Riding the rim too hard can drain you before a clash.' },
  { kind: 'tip', text: 'Power and Special buttons charge before the first use. Wait for them to fill.' },
  { kind: 'tip', text: 'Power moves are usually instant. Specials wind up with a logo flash first.' },
  { kind: 'tip', text: 'You can\'t steer once spin drops too low. Protect your stamina in long battles.' },
  { kind: 'tip', text: 'Tournament is best of 3 vs seven bladers in rising order: Benkei to Ryuga.' },
  { kind: 'tip', text: 'Casual is best of 3 vs a random CPU rival. Win the series, then face a new one.' },
  { kind: 'tip', text: 'On PC: WASD to steer, Q for power, E for special. In 2P, P2 uses arrows + N/M.' },
  { kind: 'tip', text: 'On mobile: tilt the phone or drag the joystick to steer, then tap a move button.' },
  { kind: 'tip', text: 'Lightning L-Drago and Meteo L-Drago spin left, opposite of most beys on the roster.' },
  { kind: 'tip', text: 'Earth Eagle\'s WD tip drifts in wide arcs. Use that orbit to control the dish.' },
  { kind: 'tip', text: 'Flame Libra\'s high stamina lets it outlast aggressive attackers in long matches.' },
  { kind: 'tip', text: 'Rock Leone\'s Wide Ball Anchor shrugs off knockback and spin loss while it digs in.' },
  { kind: 'tip', text: 'Dark Bull\'s Red Horn Uppercut launches hardest near the rim. Set it up on the edge.' },
  { kind: 'tip', text: 'Missed specials can cost spin. Star Blast, Soaring Destruction, and Lightning Sword Flash punish whiffs.' },
  { kind: 'tip', text: 'KO beats Sleep Out when both could apply. Pocket exits decide the match first.' },
  { kind: 'fact', text: 'Storm Pegasus runs a Rubber Flat tip, the fastest, most aggressive steer on the field.' },
  { kind: 'fact', text: 'Meteo L-Drago\'s Spin Steal drains rival spin on every clash while cutting knockback taken.' },
  { kind: 'fact', text: 'Libra\'s Sonic Buster rushes center, then opens quicksand that pulls rivals inward.' },
  { kind: 'fact', text: 'Leone\'s Lion Gale Force Wall spins up a green tornado that repels rivals, at a stamina cost.' },
]);

function buildAbilityTips() {
  const tips = [];
  for (const bey of BEYS) {
    if (!isBeyPlayable(bey) || !bey.gimmicks) continue;
    for (const slot of ['power', 'special', 'passive']) {
      const id = bey.gimmicks[slot];
      if (!id) continue;
      const ability = ABILITY_REGISTRY[id];
      if (!ability?.name || !ability?.desc) continue;
      const slotTag = slot === 'power' ? 'Power' : slot === 'special' ? 'Special' : 'Passive';
      tips.push({
        kind: 'ability',
        text: `${bey.name}: ${ability.name} (${slotTag}): ${ability.desc}`,
      });
    }
  }
  return tips;
}

const ABILITY_TIPS = Object.freeze(buildAbilityTips());

const ALL_TIPS = Object.freeze([...GAME_TIPS, ...ABILITY_TIPS]);

const KIND_LABEL = Object.freeze({
  tip: 'TIP',
  fact: 'FACT',
  ability: 'ABILITY',
});

function randomIndex(length, avoid = -1) {
  if (length <= 1) return 0;
  let next = Math.floor(Math.random() * length);
  if (next === avoid) next = (next + 1) % length;
  return next;
}

/**
 * Picks a loading tip. Pass previousIndex to avoid immediate repeats when rotating.
 * @returns {{ tip: { kind: string, text: string }, index: number, label: string }}
 */
export function pickLoadingTip(previousIndex = -1) {
  const index = randomIndex(ALL_TIPS.length, previousIndex);
  const tip = ALL_TIPS[index];
  return {
    tip,
    index,
    label: KIND_LABEL[tip.kind] || 'TIP',
  };
}

export function getLoadingTipCount() {
  return ALL_TIPS.length;
}
