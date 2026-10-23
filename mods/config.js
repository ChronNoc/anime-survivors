'use strict';

/*
 * DBZ Survivor local mod configuration
 *
 * Change the numbers below, save this file, and restart the game.
 * 1 means the original value, 2 means double, and 0.5 means half.
 */
window.DBZ_MOD_CONFIG = {
  name: 'Local Mod Pack',

  playerHealth: 1,
  playerSpeed: 1,
  playerDamage: 1,

  enemyHealth: 1,
  enemySpeed: 1,
  enemyDamage: 1,

  // Full local roster, including characters that normally require achievements.
  unlockAllCharacters: true,

  // Chance per normal defeated enemy. 0.08 = 8% (10x the original rate).
  // Elite enemies use at least 35%; bosses always drop one.
  senzuDropRate: 0.08,
};
