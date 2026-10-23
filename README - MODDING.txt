DBZ SURVIVOR - LOCAL MODDABLE COPY
==================================

PLAY
----
Double-click "Start Game.cmd". The launcher starts the server first and then opens
the correct address in your browser. Keep its black window open while playing.
Close that window, or press Ctrl+C in it, when finished.

CONTROLS
--------
Solo:        WASD / arrow keys to move - Space, Shift or E for the Ki power.
Local co-op: Player 1 = WASD + Space/E. Player 2 = arrow keys + Right Ctrl
             (RCTRL) only, for Ki/transformation - never shared with P1's key.
Other keys:  M map - N music - B sound effects - P pause.

LOCAL CO-OP & SPLIT-SCREEN
---------------------------
Choose "Co-op local" on the main menu, then pick Player 1 and Player 2's
fighters. Each player has fully independent health, Ki, upgrades, attacks,
transformations, animations, deaths and revives.

When the two living players move far enough apart, the game automatically
opens a split-screen: vertical (side by side) on a wide/landscape window,
horizontal (stacked) on a narrow/portrait one. It uses hysteresis (splits at
a larger distance, rejoins at a smaller one) so the divider never flickers
back and forth. Each half has its own camera, its own name/transformation-
timer label, its own floating damage text, and its own visible enemies.

If a teammate is off your screen (in shared-camera mode or in their own split
half), an arrow at the edge points toward them with distance and a health-
colored tint (green/yellow/red), or a pulsing "down" arrow if they need
reviving. A downed player no longer drags the camera toward their body - the
living player gets full, unconstrained movement until they're revived.

ONLINE MULTIPLAYER
-------------------
"Create online room" hosts a match over the internet using PeerJS/WebRTC (not
just LAN/localhost). "Join" with a 5-character room code connects to one.
The host is authoritative: it runs the real simulation (enemies, damage,
drops, bosses, progression) and streams it to guests ~15 times/second with
delta-compressed snapshots; guests move their own character instantly
(no input lag) and everything else is smoothed/interpolated so remote players
and enemies never visibly teleport. All characters - including every
crossover fighter - their attacks, projectiles, beams, shadow soldiers,
clones, stretched limbs, pickups, Senzu Beans, upgrades, bosses, hazards,
revives and the win/lose screen all sync automatically, since the sync
tables are built from the live character/attack lists (adding a character
or move elsewhere in the mod never needs separate networking code).

A small badge in the top-right of the HUD during an online match shows your
real ping (ms, color-coded), whether the connection is direct or going
through a relay server, and (for the host) how many players are connected.

If a connection drops briefly (wifi hiccup, a moment of lost signal), the
game does not end immediately: the disconnected player's character, HP, Ki,
attacks and position are held for about 25 seconds while they're shown as
"(reconnecting...)" with a few seconds of invulnerability, and the client
automatically retries connecting and rejoining the same seat during that
window. If it doesn't reconnect in time, they're dropped for good with a
clear announcement, and the match continues for the others.

Room version checking: if players load different versions of the game/mod,
the lobby shows a visible warning instead of starting a silently-broken
match. Once a match starts, the room locks (no late joins) with a clear
"room is full / match already started" message for anyone trying to join
after - this was a deliberate choice over letting someone join mid-fight.

NAT traversal / self-hosting your own signaling or TURN server
----------------------------------------------------------------
By default this uses PeerJS's free public broker (to find the other player)
and Google's public STUN servers (to help the two browsers connect directly).
That's enough for most home connections, but it is NOT guaranteed to work
through every router/NAT combination - in particular, if both players are
behind a "symmetric" NAT (common on some mobile carriers and some strict
corporate/university networks), a direct peer-to-peer connection can fail,
and nothing short of a TURN relay server fixes that. This has not been
tested against a real TURN deployment in this build - that part is an
honest, acknowledged limitation, not something silently "handled."

To point the game at your own PeerJS signaling server and/or your own TURN
server (e.g. a self-hosted coturn), add this BEFORE js/net.js loads - the
simplest place is the top of mods/config.js:

  window.DBZ_NET_CONFIG = {
    iceServers: [
      { urls: 'stun:your.stun.server:3478' },
      { urls: 'turn:your.turn.server:3478', username: 'user', credential: 'pass' },
    ],
    host: 'your-peerjs-server.example.com', // omit to keep using the public PeerJS broker
    port: 443, path: '/peerjs', secure: true,
  };

No credentials are hardcoded anywhere in this codebase - this config object
is the only way networking options are supplied, and it's entirely optional.

LOCAL/OFFLINE NOTES
--------------------
Single-player code, images, fonts, audio synthesis, and game data are local.
Rankings, news, weekly-challenge data, telemetry, and update checks try to
contact the original site's public API and will fail quietly (404/timeout)
on this local copy - that's expected and does not affect local single-player
or local co-op play, saves, or character selection in any way.

ADMIN / TEST PANEL (hidden)
-----------------------------
Click the version number in the main menu footer 7 times within 2 seconds
to bring up a password prompt (no special link needed). The password is
"dbzadmin" - change it by replacing TEST_PASS_HASH near the top of js/game.js
with the SHA-256 hash of a new password (use the browser console:
await crypto.subtle.digest('SHA-256', new TextEncoder().encode('newpass')),
then hex-encode the result).

Once unlocked, a red bar appears with one-key shortcuts (F1 instant level,
F2 fill Ki, F3 spawn next boss, F4 give a Dragon Ball, F5 max technique
levels, F6 open the full Powers/Admin panel, F8 god mode, F9 5x game speed,
F10 stop enemy spawns). The Powers panel (F6, scrollable) lets you add/
remove any technique or passive for the current character, shows that
character's signature ability text, and has one-click Admin actions: full
HP/Ki, +1000 Zeni, unlock every warrior, jump to a character's strongest
transformation tier, undo a transformation, clear all common enemies, and
summon any specific boss or enemy type from a dropdown (not just "whichever
comes next"). Nothing done in this mode is saved to your real save file.

CROSSOVER FIGHTERS
--------------------
Naruto, Luffy, Sung Jinwoo, Killua Zoldyck, Asta, Beerus and Yoshiyuki Taira
are all available in the character selector alongside the original Dragon
Ball roster - 16 fighters total, all unlocked by default in this build.

  Naruto    - Rasengan, Shadow Clone Barrage, Wind Style: Rasenshuriken,
              Nine-Tails Chakra Arms, plus a separate Nine-Tails Chakra Mode
              / Sage Mode / Baryon Mode tiered transformation.
  Luffy     - Gum-Gum Pistol, Gum-Gum Gatling, Red Hawk, Elephant Gun, with
              his whole arm visibly stretching from shoulder to fist (never
              a detached floating fist), plus Gear 2/4/5 transformations.
  Jinwoo    - Monarch's Dagger Rush, Ruler's Authority, Arise: Shadow Army
              (summons distinct dark-armored shadow soldiers, not copies of
              Jinwoo), Shadow Exchange, plus a Shadow Monarch transformation.
              Signature passive: a kill has a chance to rise as a soldier.
  Killua    - Lightning Needle, Thunder Yo-Yo, Electrodynamic Discharge,
              Godspeed: Execution (ultimate). Signature passive: Godspeed -
              dodges leave him faster for a moment. Godspeed: Blitz tier.
  Asta      - Anti-Magic Slash, Demon-Slayer Rush, Black Divider, Devil
              Union (ultimate). Signature passive: immune to petrify/candy/
              body-swap status effects. Black Asta / Devil Union tiers.
  Beerus    - Hakai Wave, God of Destruction Palm, Sphere of Destruction,
              Complete Annihilation (ultimate). Signature passive: a
              standing damage aura to anything nearby. Awakened Destroyer /
              Unleashed tiers.
  Taira     - Sound Wave Slash, Rock Beat Barrage, Amp Overdrive, Encore
              Finale (ultimate). Signature passive: a bass-drop stun pulse
              every 8s, with its own synthesized bass sound. Overdrive /
              Encore tiers.

Every crossover character's own "ultimate" technique above is NOT learned
through normal leveling - it's granted by a rare glowing Ultimate Orb pickup
(elites/bosses only), a one-time-per-run find, never a permanent unlock.

Their data lives in mods/anime-crossover.js (Naruto/Luffy/Jinwoo) and
mods/new-heroes.js (Killua/Asta/Beerus/Taira). Sprite sheets are in
assets/sprites/ - *-crossover.png/.svg for the base form, *-crossover-tf.png
for the transformed form, sliced and background-cleaned from supplied
reference art. If a custom sprite sheet ever fails to load, the character
silently falls back to the game's own procedural pixel-art renderer instead
of breaking the menu.

MAKE A SIMPLE MOD
-------------------
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
  senzuOnGroundCap: 14,       max uncollected beans on the ground at once

This build starts with the complete roster unlocked. Healing beans are set to
8% from regular enemies, at least 35% from elites, and 100% from bosses - an
uncollected bean despawns after ~55s and a soft on-ground cap keeps the floor
from filling up forever, without ever lowering that drop rate itself.

MAKE A CODE MOD
------------------
The main game data is in js\data.js and gameplay code is in js\game.js.
The supplied mod is split into:
  mods\config.js       settings that are safe and easy to edit
  mods\apply-mods.js   code that applies those settings
  mods\anime-crossover.js   Naruto / Luffy / Jinwoo data + sprites
  mods\new-heroes.js        Killua / Asta / Beerus / Taira data + sprites

Back up a file before changing core game code (this project keeps a local
git history for that - `git log` in the project folder shows past snapshots,
and `git diff`/`git checkout -- <file>` can undo an in-progress edit).
Browser progress is stored locally for the local address and is separate
from progress on the public website.

TROUBLESHOOTING
------------------
- "Could not load the online module": the PeerJS library failed to load
  (no internet, or the public broker is down). Local solo/co-op still works.
- Online room never connects: see "NAT traversal" above - try again, or set
  up your own TURN server if it keeps failing on the same network.
- A character looks like a plain pixel-art fallback instead of its real
  sprite: its sprite file failed to load (check the browser console for a
  404) - the game intentionally falls back rather than crashing.
- Split-screen won't trigger: it only activates in local co-op, and only
  once the two living players are far enough apart (it has deliberate
  hysteresis so it doesn't flicker at the boundary).

PERSONAL-USE NOTE
--------------------
This local crossover build is intended for private play. Do not redistribute it
without permission from the relevant game and character rights holders.
