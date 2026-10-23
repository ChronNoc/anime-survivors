DBZ SURVIVOR - LOCAL MODDABLE COPY
==================================

PLAY
----
Double-click "Start Game.cmd". The launcher starts the server first and then opens
the correct address in your browser. Keep its black window open while playing.
Close that window, or press Ctrl+C in it, when finished.

LOCAL CO-OP
------------
Choose "Co-op local" on the main menu, then select Player 1 and Player 2's
fighters. Player 1 uses WASD and Space/E for Ki. Player 2 uses the arrow keys
and Right Ctrl (RCTRL) for Ki. Each player has independent health, Ki, attacks,
transformations, upgrades, animations and revives.

When the two living local players move too far apart, the game automatically
opens a vertical split-screen (horizontal on a portrait display). It rejoins
into one camera after both players come close again.

CROSSOVER FIGHTERS
------------------
Naruto (Naruto), Luffy (One Piece), and Sung Jinwoo (Solo Leveling) are available
in the character selector.
They now have higher-detail, Dragon Ball-style side/front/back sprite animation,
knockout/recovery frames, and separate Nine-Tails Chakra Mode / Gear Fifth art.
Luffy's Pistol, Gatling, Red Hawk and Elephant Gun draw his complete elastic arm
from shoulder to fist; Naruto's chakra techniques have their own visible effects.

Naruto's personal pool includes Rasengan, Shadow Clone Barrage, Wind Style:
Rasenshuriken, and Nine-Tails Chakra Arms. Luffy's includes Gum-Gum Pistol,
Gum-Gum Gatling, Red Hawk, and Elephant Gun. Sung Jinwoo's includes Monarch's
Dagger Rush, Ruler's Authority, Arise: Shadow Army, and Shadow Exchange, plus a
separate Shadow Monarch transformation. Their definitions are in
mods\anime-crossover.js; their SVG sprite sheets are in assets\sprites.

MAKE A SIMPLE MOD
-----------------
Open mods\config.js in Notepad. Change the values, save, and refresh the game.

Examples:
  playerHealth: 2,            double player health
  playerSpeed: 1.5,           50% faster movement
  playerDamage: 3,            triple player damage
  enemyHealth: 0.5,           half enemy health
  enemySpeed: 0.75,           enemies move 25% slower
  enemyDamage: 0,             enemies cause no damage
  unlockAllCharacters: true,  remove character unlock requirements
  senzuDropRate: 0.08,        8% bean chance (original was 0.8%)

This build starts with the complete roster unlocked. Healing beans are set to
8% from regular enemies, at least 35% from elites, and 100% from bosses.

MAKE A CODE MOD
---------------
The main game data is in js\data.js and gameplay code is in js\game.js.
The supplied mod is split into:
  mods\config.js       settings that are safe and easy to edit
  mods\apply-mods.js   code that applies those settings

Back up a file before changing core game code. Browser progress is stored locally
for the local address and is separate from progress on the public website.

LOCAL/OFFLINE NOTES
-------------------
Single-player code, images, fonts, audio synthesis, and game data are local.
Online multiplayer uses PeerJS/WebRTC and still needs networking/signalling.
Rankings, news, weekly data, telemetry, and update checks may contact the original
site's public API. Those failures do not prevent normal local single-player play.

PERSONAL-USE NOTE
-----------------
This local crossover build is intended for private play. Do not redistribute it
without permission from the relevant game and character rights holders.
