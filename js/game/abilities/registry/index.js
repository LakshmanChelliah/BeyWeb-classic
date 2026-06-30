import { pegasusAbilities } from './pegasus.js';
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
