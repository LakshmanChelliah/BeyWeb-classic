/**
 * Splits js/game/abilities/impl.js into focused modules.
 * Run from repo root: node scripts/dev/split-abilities.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('js/game/abilities');
const IMPL = path.join(ROOT, 'impl.js');
const lines = fs.readFileSync(IMPL, 'utf8').split('\n');

function slice(a, b) {
  return lines.slice(a - 1, b).join('\n');
}

function findLine(pattern) {
  const idx = lines.findIndex((l) => pattern.test(l));
  if (idx < 0) throw new Error(`Pattern not found: ${pattern}`);
  return idx + 1;
}

const lineRegistry = findLine(/^\/\/ ---- registry/);
const lineRuntime = findLine(/^\/\/ ---- runtime/);
const lineLeoneVis = findLine(/^\/\/ ---- Leone cinematic/);
const lineEagleVis = findLine(/^\/\/ ---- Earth Eagle cinematic/);
const lineLibraVis = findLine(/^\/\/ ---- Libra cinematic/);
const lineLdragoVis = findLine(/^\/\/ ---- L-Drago cinematic/);
const lineContact = findLine(/^\/\/ ---- contact resolution/);

const sharedRaw = slice(35, lineRegistry - 1);
const sharedNames = [...sharedRaw.matchAll(/^function (\w+)/gm)].map((m) => m[1]);
const exportedShared = new Set(
  [...sharedRaw.matchAll(/^export function (\w+)/gm)].map((m) => m[1])
);

function exportSharedFunctions(src) {
  return src.replace(/^function /gm, (m, offset, str) => {
    const name = str.slice(offset + m.length).match(/^(\w+)/)?.[1];
    if (name && !exportedShared.has(name)) return 'export function ';
    return m;
  });
}

const constantsSrc = slice(27, 34) + '\n' + slice(41, lineRegistry - 1).replace(/^function /gm, (m, offset, str) => {
  const rest = str.slice(offset);
  if (rest.startsWith('function slotWindupTotal') || rest.startsWith('function groundY')) return 'export function ';
  return m;
});

// Re-extract constants more cleanly: lines 27-221 + libraBusterSandRadius block
const constantsBlock = lines
  .slice(26, lineRegistry - 1)
  .filter((l, i, arr) => {
    const n = 26 + i + 1;
    if (n >= 223 && n <= 243) return l.startsWith('export ') || l.startsWith('const ease') || l.trim() === '';
    if (n >= 244) return false;
    return true;
  })
  .join('\n');

const sharedBlock = lines
  .slice(243, lineRegistry - 1)
  .join('\n');

const sharedExported = exportSharedFunctions(
  sharedBlock.replace(/^const ease/g, 'export const ease')
);

function prefixShared(src) {
  let out = src;
  const names = [...new Set(sharedNames)].sort((a, b) => b.length - a.length);
  for (const name of names) {
    out = out.replace(new RegExp(`\\b${name}\\b`, 'g'), `shared.${name}`);
  }
  return out;
}

// Registry split by bey prefix
const registryRaw = slice(lineRegistry + 1, lineRuntime - 1);
const registryBody = registryRaw.replace(/^export const ABILITY_REGISTRY = \{/, '').replace(/\};\s*$/, '');

const PREFIX_MAP = {
  pegasus: 'pegasus',
  eagle: 'eagle',
  ldrago: 'ldrago',
  leone: 'leone',
  libra: 'libra',
  bull: 'bull',
  striker: 'striker',
};

function splitRegistry(body) {
  const entries = {};
  const re = /^\s{2}(\w+):\s*\{/gm;
  let match;
  const starts = [];
  while ((match = re.exec(body)) !== null) {
    starts.push({ id: match[1], index: match.index });
  }
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].index;
    const end = i + 1 < starts.length ? starts[i + 1].index : body.length;
    const chunk = body.slice(start, end).replace(/,\s*$/, '');
    const prefix = starts[i].id.split('_')[0];
    const file = PREFIX_MAP[prefix] || prefix;
    if (!entries[file]) entries[file] = [];
    entries[file].push(chunk);
  }
  return entries;
}

const registryEntries = splitRegistry(registryBody);
const registryDir = path.join(ROOT, 'registry');
const visualsDir = path.join(ROOT, 'visuals');
fs.mkdirSync(registryDir, { recursive: true });
fs.mkdirSync(visualsDir, { recursive: true });

const registryImports = `import * as CANNON from 'cannon-es';
import { CONFIG } from '../../../config.js';
import { setBodyCollisions } from '../../../physics/top.js';
import { isAtPocketAngle } from '../../../physics/arena.js';
import { clamp01 } from '../../../utils/math.js';
import * as C from '../constants.js';
import * as shared from '../shared.js';
`;

for (const [file, chunks] of Object.entries(registryEntries)) {
  let body = prefixShared(chunks.join(',\n\n'));
  // Prefix constant refs with C.
  const constNames = [...constantsBlock.matchAll(/^export const (\w+)/gm)].map((m) => m[1]);
  for (const name of [...constNames].sort((a, b) => b.length - a.length)) {
    body = body.replace(new RegExp(`\\b${name}\\b`, 'g'), `C.${name}`);
  }
  fs.writeFileSync(
    path.join(registryDir, `${file}.js`),
    `${registryImports}
export const ${file}Abilities = {
${body}
};
`
  );
}

const registryIndex = `import { pegasusAbilities } from './pegasus.js';
import { eagleAbilities } from './eagle.js';
import { ldragoAbilities } from './ldrago.js';
import { leoneAbilities } from './leone.js';
import { libraAbilities } from './libra.js';
import { bullAbilities } from './bull.js';
import { strikerAbilities } from './striker.js';

export const ABILITY_REGISTRY = {
  ...pegasusAbilities,
  ...eagleAbilities,
  ...ldragoAbilities,
  ...leoneAbilities,
  ...libraAbilities,
  ...bullAbilities,
  ...strikerAbilities,
};
`;
fs.writeFileSync(path.join(registryDir, 'index.js'), registryIndex);

// constants.js
fs.writeFileSync(
  path.join(ROOT, 'constants.js'),
  `import { CONFIG } from '../../config.js';
import { clamp01 } from '../../utils/math.js';

${constantsBlock}
`
);

// shared.js
fs.writeFileSync(
  path.join(ROOT, 'shared.js'),
  `import * as CANNON from 'cannon-es';
import { CONFIG } from '../../config.js';
import { setBodyCollisions } from '../../physics/top.js';
import { isAtPocketAngle } from '../../physics/arena.js';
import { clamp01 } from '../../utils/math.js';
export * from './constants.js';

${sharedExported}
`
);

// runtime.js
let runtimeBlock = prefixShared(slice(lineRuntime + 1, lineLeoneVis - 1));
runtimeBlock = runtimeBlock
  .replace(/^function makeSlot/m, 'export function makeSlot')
  .replace(/^function makeCtx/m, 'export function makeCtx')
  .replace(/^function activateSlot/m, 'export function activateSlot');
for (const name of [...constantsBlock.matchAll(/^export const (\w+)/gm)].map((m) => m[1]).sort((a, b) => b.length - a.length)) {
  runtimeBlock = runtimeBlock.replace(new RegExp(`\\b${name}\\b`, 'g'), `C.${name}`);
}
fs.writeFileSync(
  path.join(ROOT, 'runtime.js'),
  `import { CONFIG } from '../../config.js';
import * as shared from './shared.js';
import * as C from './constants.js';
import { ABILITY_REGISTRY } from './registry/index.js';

${runtimeBlock}
`
);

// Visual modules
const visualSections = [
  ['pegasus.js', lineRuntime + 1, lineLeoneVis - 1, 'tickAbilityVisuals'],
  ['leone.js', lineLeoneVis, lineLeoneVis + 11, 'tickLeoneAbilityVisuals'],
  ['bull.js', lineLeoneVis + 12, lineEagleVis - 1, 'tickBullAbilityVisuals'],
  ['striker.js', lineEagleVis - 87, lineEagleVis - 1, 'tickStrikerAbilityVisuals'],
  ['eagle.js', lineEagleVis, lineLibraVis - 1, 'tickEagleAbilityVisuals'],
  ['libra.js', lineLibraVis, lineLdragoVis - 1, 'tickLibraAbilityVisuals'],
  ['ldrago.js', lineLdragoVis, lineContact - 86, 'tickLdragoAbilityVisuals'],
];

// Fix visual line ranges by finding export function lines
function findExportLine(name) {
  return findLine(new RegExp(`^export function ${name}`));
}

const visRanges = [
  ['pegasus.js', findExportLine('tickAbilityVisuals'), findExportLine('tickLeoneAbilityVisuals') - 1],
  ['leone.js', findExportLine('tickLeoneAbilityVisuals'), findExportLine('tickBullAbilityVisuals') - 1],
  ['bull.js', findExportLine('tickBullAbilityVisuals'), findExportLine('tickStrikerAbilityVisuals') - 1],
  ['striker.js', findExportLine('tickStrikerAbilityVisuals'), findExportLine('tickEagleAbilityVisuals') - 1],
  ['eagle.js', findExportLine('tickEagleAbilityVisuals'), findExportLine('tickLibraAbilityVisuals') - 1],
  ['libra.js', findExportLine('tickLibraAbilityVisuals'), findExportLine('tickLdragoAbilityVisuals') - 1],
  ['ldrago.js', findExportLine('tickLdragoAbilityVisuals'), findExportLine('shouldStarBlastGlow') - 1],
];

for (const [file, start, end] of visRanges) {
  let vis = prefixShared(slice(start, end));
  for (const name of [...constantsBlock.matchAll(/^export const (\w+)/gm)].map((m) => m[1]).sort((a, b) => b.length - a.length)) {
    vis = vis.replace(new RegExp(`\\b${name}\\b`, 'g'), `C.${name}`);
  }
  fs.writeFileSync(
    path.join(visualsDir, file),
    `import { CONFIG } from '../../config.js';
import { setBodyCollisions } from '../../physics/top.js';
import { clamp01 } from '../../utils/math.js';
import * as shared from '../shared.js';
import * as C from '../constants.js';

${vis}
`
  );
}

// presentation.js
let presentation = prefixShared(slice(findExportLine('shouldStarBlastGlow'), findExportLine('tickAbilityTimers') - 1));
for (const name of [...constantsBlock.matchAll(/^export const (\w+)/gm)].map((m) => m[1]).sort((a, b) => b.length - a.length)) {
  presentation = presentation.replace(new RegExp(`\\b${name}\\b`, 'g'), `C.${name}`);
}
fs.writeFileSync(
  path.join(ROOT, 'presentation.js'),
  `import * as C from './constants.js';
import * as shared from './shared.js';

${presentation}
`
);

// timers.js
let timers = prefixShared(slice(findExportLine('tickAbilityTimers'), lineContact - 1));
timers = timers.replace(/^function /gm, (m, offset, str) => {
  const rest = str.slice(offset);
  if (rest.match(/^function (activateSlot|makeCtx|finish|release|clear)/)) return m;
  return m;
});
for (const name of [...constantsBlock.matchAll(/^export const (\w+)/gm)].map((m) => m[1]).sort((a, b) => b.length - a.length)) {
  timers = timers.replace(new RegExp(`\\b${name}\\b`, 'g'), `C.${name}`);
}
fs.writeFileSync(
  path.join(ROOT, 'timers.js'),
  `import { CONFIG } from '../../config.js';
import * as shared from './shared.js';
import * as C from './constants.js';
import { activateSlot, makeCtx } from './runtime.js';

${timers}
`
);

// contact.js
let contact = prefixShared(slice(lineContact + 1, lines.length));
contact = contact.replace(/^export \{ isLibraBusterChannelingBody \};\n?/m, '');
for (const name of [...constantsBlock.matchAll(/^export const (\w+)/gm)].map((m) => m[1]).sort((a, b) => b.length - a.length)) {
  contact = contact.replace(new RegExp(`\\b${name}\\b`, 'g'), `C.${name}`);
}
fs.writeFileSync(
  path.join(ROOT, 'contact.js'),
  `import { CONFIG } from '../../config.js';
import * as CANNON from 'cannon-es';
import { setBodyCollisions } from '../../physics/top.js';
import * as shared from './shared.js';
import * as C from './constants.js';

${contact}
`
);

// index.js
fs.writeFileSync(
  path.join(ROOT, 'index.js'),
  `export * from './constants.js';
export * from './shared.js';
export { ABILITY_REGISTRY } from './registry/index.js';
export {
  createAbilityRuntime,
  triggerAbility,
  stepAbilities,
  cancelAbilitiesOnSpinStop,
  activateSlot,
  makeCtx,
} from './runtime.js';
export { tickAbilityVisuals } from './visuals/pegasus.js';
export { tickLeoneAbilityVisuals } from './visuals/leone.js';
export { tickBullAbilityVisuals } from './visuals/bull.js';
export { tickStrikerAbilityVisuals } from './visuals/striker.js';
export { tickEagleAbilityVisuals } from './visuals/eagle.js';
export { tickLibraAbilityVisuals } from './visuals/libra.js';
export { tickLdragoAbilityVisuals } from './visuals/ldrago.js';
export {
  shouldStarBlastGlow,
  getCinematicFlightLift,
  getCameraCue,
  resetStarBlastCamera,
} from './presentation.js';
export { tickAbilityTimers } from './timers.js';
export {
  resolveContactAbilities,
  isLibraBusterChannelingBody,
  isBodyInSpecialMove,
  canTopsContactVertically,
  clearAbilityFlags,
} from './contact.js';
`
);

console.log('Split complete — review generated files, then delete impl.js');
