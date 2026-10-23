'use strict';

(() => {
  const cfg = window.DBZ_MOD_CONFIG || {};
  const number = (value, fallback = 1) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  const playerHealth = Math.max(0.05, number(cfg.playerHealth));
  const playerSpeed = Math.max(0.05, number(cfg.playerSpeed));
  const playerDamage = Math.max(0.05, number(cfg.playerDamage));
  const enemyHealth = Math.max(0.05, number(cfg.enemyHealth));
  const enemySpeed = Math.max(0.05, number(cfg.enemySpeed));
  const enemyDamage = Math.max(0, number(cfg.enemyDamage));

  for (const character of Object.values(CHARACTERS)) {
    character.hp = Math.round(character.hp * playerHealth);
    character.speed *= playerSpeed;
    character.dmgBonus = (1 + (character.dmgBonus || 0)) * playerDamage - 1;
    if (cfg.unlockAllCharacters) delete character.unlock;
  }

  for (const enemy of Object.values(ENEMIES)) {
    enemy.hp = Math.max(1, Math.round(enemy.hp * enemyHealth));
    enemy.speed *= enemySpeed;
    enemy.dmg *= enemyDamage;
  }

  for (const boss of BOSSES) {
    boss.hp = Math.max(1, Math.round(boss.hp * enemyHealth));
    boss.speed *= enemySpeed;
    boss.dmg *= enemyDamage;
  }

  window.DBZ_MOD_ACTIVE = true;
  console.info(`[DBZ Mod] ${cfg.name || 'Local mods'} loaded`, cfg);
})();
