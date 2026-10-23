# Graph Report - C:\Users\roiga\OneDrive\Desktop\DBZ Survivor Moddable  (2026-10-22)

## Corpus Check
- 147 files · ~196,445 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 889 nodes · 2114 edges · 60 communities (43 shown, 17 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 105 edges (avg confidence: 0.65)
- Token cost: 71,495 input · 0 output

## Community Hubs (Navigation)
- Game Loop Core
- Map/World Building
- HUD & Aim Rendering
- Terrain Chunk Drawing
- Game Data Definitions
- PeerJS Vendor Lib
- Combat Event Handling
- Sprite Rendering Engine
- Player Combat Stats
- Bonus Minigame (Snake)
- PeerJS Connection Mgmt
- Boss AI & Pathing
- PeerJS Media Connection
- Beam/Projectile Rendering
- Special Attack Effects
- Level Select & Unlocks
- PeerJS Binary Packing
- PeerJS Binary Unpacking
- Achievements & Run End
- HUD Tooltips & Formatting
- Gamepad & Test Powers
- PeerJS Peer Discovery
- Combos & News Panel
- i18n Translation
- PeerJS WebRTC Data Channel
- Menu Presentation
- PWA Manifest
- PeerJS Data Chunking
- Wishes & Help Panel
- PeerJS Heartbeat
- Audio System
- Pause Menu & Replays
- Fusion/Evolve Options
- Local Launcher Server
- Weekly Challenge
- Difficulty Scaling
- Shop & Upgrades
- PeerJS Browser Detection
- Stat Comparison Cards
- PeerJS Buffer Utils
- Modding Crossover Fighters
- Maintenance/Report Screens
- Local Co-op & Netplay
- Player Profile Stats
- Mod Config Hooks
- News & Changelog
- Language Toggle UI
- Menu Hero Canvas
- Telemetry MOTD
- Profile Screen Wiring
- Analytics Test Mode
- Update Banner
- Custom Sprite Overrides
- English Language Data
- Update Checker
- Modding Data/Game Refs
- Personal Use Note

## God Nodes (most connected - your core abstractions)
1. `sfx()` - 35 edges
2. `update()` - 34 edges
3. `addText()` - 29 edges
4. `renderWorldView()` - 28 edges
5. `eZ` - 27 edges
6. `burst()` - 26 edges
7. `drawHUD()` - 23 edges
8. `renderPause()` - 22 edges
9. `e()` - 22 edges
10. `log()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `updateHelpers()` --indirect_call--> `h()`  [INFERRED]
  js/game.js → vendor/peerjs.min.js
- `comboPanel()` --indirect_call--> `el()`  [INFERRED]
  js/combos.js → vendor/peerjs.min.js
- `makeSpire()` --indirect_call--> `m()`  [INFERRED]
  js/draw.js → vendor/peerjs.min.js
- `makeNamekTree()` --indirect_call--> `y()`  [INFERRED]
  js/draw.js → vendor/peerjs.min.js
- `chunkProps()` --indirect_call--> `y()`  [INFERRED]
  js/draw.js → vendor/peerjs.min.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Anime crossover fighter roster** — readme_modding_naruto, readme_modding_luffy, readme_modding_sung_jinwoo, readme_modding_anime_crossover_js, readme_modding_sprites_assets [EXTRACTED 1.00]
- **Local modding system (config + apply + core data/game)** — readme_modding_config_js, readme_modding_apply_mods_js, readme_modding_data_js, readme_modding_game_js [EXTRACTED 1.00]
- **Backoffice-driven live UI controls** — index_backoffice, index_maint_screen, index_reset_notice, index_report_screen, index_motd, index_telemetry_js [EXTRACTED 1.00]

## Communities (60 total, 17 thin omitted)

### Community 0 - "Game Loop Core"
Cohesion: 0.03
Nodes (74): bctx, BIGBANG_LOOK, blockedAt(), bodyChange(), BOSS_SPECIAL, bossBeams(), buf, candyBeam() (+66 more)

### Community 1 - "Map/World Building"
Cohesion: 0.06
Nodes (44): DERIVED, exitRoad(), inPlanet(), KAI, KAI_IMG, KAI_SPOTS, kaiCloudZone(), kaiDeco() (+36 more)

### Community 2 - "HUD & Aim Rendering"
Cohesion: 0.07
Nodes (50): aimAngle(), ballArrow(), ballsNeeded(), choicePlayer(), drawAimReticle(), drawAttackIcon(), drawBlind(), drawBossPointers() (+42 more)

### Community 3 - "Terrain Chunk Drawing"
Cohesion: 0.10
Nodes (44): auraPath(), buildChunk(), buildChunkSteps(), CAM, CHUNK_POOL, chunkProps(), CHUNKS, chunkSolids() (+36 more)

### Community 4 - "Game Data Definitions"
Cohesion: 0.06
Nodes (34): ACH_CATEGORIES, ALL_BOSS_IDS(), ATTACKS, AUTHOR, bigSprite(), BONUS_LEVELS, bossDef(), BOSSES (+26 more)

### Community 5 - "PeerJS Vendor Lib"
Cohesion: 0.09
Nodes (23): B(), blobToArrayBuffer(), d(), ea(), ec(), eg(), eJ, el() (+15 more)

### Community 6 - "Combat Event Handling"
Cohesion: 0.19
Nodes (33): achEvent(), announce(), applyOption(), applyPick(), applyWish(), baseBalls(), bigBang(), burst() (+25 more)

### Community 7 - "Sprite Rendering Engine"
Cohesion: 0.10
Nodes (31): drawAreaMap(), renderMap(), ANIMS, BALD, BROW, BROW_BALD, buildFrame(), buildPalette() (+23 more)

### Community 8 - "Player Combat Stats"
Cohesion: 0.10
Nodes (31): alivePlayers(), attackStats(), bounceProjectile(), cdMult(), dmgMult(), furyBonus(), hurtPlayer(), isFused() (+23 more)

### Community 9 - "Bonus Minigame (Snake)"
Cohesion: 0.14
Nodes (23): BONUS_RANKS, bonusSection(), kintonSpots(), snakeCpAt(), snakeInit(), snakeRankId(), snakeSpawnPos(), snakeUpdate() (+15 more)

### Community 10 - "PeerJS Connection Mgmt"
Cohesion: 0.13
Nodes (3): eZ, isSecure(), setLogFunction()

### Community 11 - "Boss AI & Pathing"
Cohesion: 0.16
Nodes (24): bossAI(), bossTeleport(), clearLine(), enemyFire(), enemyShot(), enemyTerrain(), enemyTricks(), findPath() (+16 more)

### Community 12 - "PeerJS Media Connection"
Cohesion: 0.19
Nodes (3): e(), ey(), log()

### Community 13 - "Beam/Projectile Rendering"
Cohesion: 0.10
Nodes (22): allyPass(), beamKind(), beamTile(), CAPSULE_ART, drawAnimFx(), drawBeamBody(), drawCapsule(), drawGem() (+14 more)

### Community 14 - "Special Attack Effects"
Cohesion: 0.16
Nodes (18): absorbEnergy(), addText(), barrier(), blind(), bossCharge(), cellSpecial(), crusherBall(), energyStream() (+10 more)

### Community 15 - "Level Select & Unlocks"
Cohesion: 0.24
Nodes (17): buildLevels(), buildMenu(), buyUnlock(), isLevelOpen(), isUnlocked(), levelPic(), myChar(), myLevel() (+9 more)

### Community 18 - "Achievements & Run End"
Cohesion: 0.22
Nodes (15): ACHIEVEMENTS, achEndRun(), achTick(), bestOf(), bossDefeated(), checkUnlocks(), endRun(), localAchEvent() (+7 more)

### Community 19 - "HUD Tooltips & Formatting"
Cohesion: 0.21
Nodes (15): achToast(), attackTip(), bestRunHtml(), buildHudTips(), dmgChartHtml(), endStatsHtml(), esc(), fmtNum() (+7 more)

### Community 20 - "Gamepad & Test Powers"
Cohesion: 0.17
Nodes (15): gainXp(), isAuthority(), maybeStartRound(), pollGamepad(), renderTestPowers(), requestTransform(), showTestBadge(), syncTestButtons() (+7 more)

### Community 21 - "PeerJS Peer Discovery"
Cohesion: 0.19
Nodes (4): eh(), ei(), ek(), error()

### Community 22 - "Combos & News Panel"
Cohesion: 0.23
Nodes (10): COMBO, comboIcon(), comboPanel(), comboX(), renderCombos(), buildNews(), cmpVersion(), newsInline() (+2 more)

### Community 23 - "i18n Translation"
Cohesion: 0.22
Nodes (10): EN_TEXT, I18N_MISSING, LANG, NAME_EN, NAME_ES, normKey(), t(), tn() (+2 more)

### Community 24 - "PeerJS WebRTC Data Channel"
Cohesion: 0.18
Nodes (4): es(), eW, _print(), warn()

### Community 25 - "Menu Presentation"
Cohesion: 0.18
Nodes (12): beginWorld(), frame(), hasTransformLook(), musicFor(), PARADE, presentWorld(), renderMenuBackground(), renderMenuHero() (+4 more)

### Community 26 - "PWA Manifest"
Cohesion: 0.17
Nodes (11): background_color, description, display, icons, lang, name, orientation, scope (+3 more)

### Community 28 - "Wishes & Help Panel"
Cohesion: 0.27
Nodes (10): WISHES, wishById(), wishList(), buildAchs(), buildHelp(), buildTechs(), enemyTraits(), fmtInt() (+2 more)

### Community 30 - "Audio System"
Cohesion: 0.22
Nodes (9): AudioCore, AudioVolume, CHORD_TONES, Music, MUSIC_TRACKS, SFX, openSetup(), toggleMusic() (+1 more)

### Community 31 - "Pause Menu & Replays"
Cohesion: 0.24
Nodes (9): clearHudTips(), hideTip(), resetRestartBtn(), rollMenuDuel(), syncPauseOptions(), togglePause(), toMenu(), buildReplays() (+1 more)

### Community 32 - "Fusion/Evolve Options"
Cohesion: 0.28
Nodes (9): awakenTarget(), buildOptions(), canEvolve(), canWishFusion(), canWishOtherworld(), rule(), shuffle(), tickFx() (+1 more)

### Community 33 - "Local Launcher Server"
Cohesion: 0.31
Nodes (7): LocalGameHandler, LocalGameServer, main(), make_server(), Start DBZ Survivor's local web server and open it in the default browser., SimpleHTTPRequestHandler, ThreadingHTTPServer

### Community 34 - "Weekly Challenge"
Cohesion: 0.32
Nodes (8): artDay(), bossSchedule(), cleanPerks(), makePlayer(), maxPerks(), newGame(), useWeeklyTry(), weeklyTriesLeft()

### Community 35 - "Difficulty Scaling"
Cohesion: 0.29
Nodes (8): bossHp(), coop(), dmgScale(), eliteCap(), hpScale(), kaioRound(), lateRamp(), levelBoss()

### Community 36 - "Shop & Upgrades"
Cohesion: 0.48
Nodes (7): SHOP_UPGRADES, buyUpgrade(), myPerks(), renderShop(), resetUpgrades(), shopSpent(), u()

### Community 37 - "PeerJS Browser Detection"
Cohesion: 0.57
Nodes (7): constructor(), getBrowser(), getVersion(), isBrowserSupported(), isUnifiedPlanSupported(), isWebRTCSupported(), toString()

### Community 38 - "Stat Comparison Cards"
Cohesion: 0.47
Nodes (6): attackStatLines(), cardCombo(), evolveHint(), fmtStat(), optionCard(), statDiff()

### Community 40 - "Modding Crossover Fighters"
Cohesion: 0.60
Nodes (5): mods/anime-crossover.js, Luffy (crossover fighter), Naruto (crossover fighter), assets/sprites (crossover SVG sprite sheets), Sung Jinwoo (crossover fighter)

### Community 41 - "Maintenance/Report Screens"
Cohesion: 0.50
Nodes (4): Backoffice admin system, Maintenance mode screen (#maint), Report a problem screen (#report), Progress reset notice (#resetNotice)

### Community 42 - "Local Co-op & Netplay"
Cohesion: 0.50
Nodes (4): Main menu screen (#menu), Local Co-op Mode, PeerJS/WebRTC online multiplayer, Automatic split-screen on distance

### Community 43 - "Player Profile Stats"
Cohesion: 0.83
Nodes (3): buildProfile(), fmtHours(), topOf()

### Community 44 - "Mod Config Hooks"
Cohesion: 0.67
Nodes (3): Local mod hooks note (mods/config.js), mods/apply-mods.js, mods/config.js

## Ambiguous Edges - Review These
- `Start Game.cmd launcher` → `Personal-use / no-redistribution restriction`  [AMBIGUOUS]
  README - MODDING.txt · relation: rationale_for

## Knowledge Gaps
- **141 isolated node(s):** `AudioVolume`, `AudioCore`, `MUSIC_TRACKS`, `CHORD_TONES`, `COMBO` (+136 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Start Game.cmd launcher` and `Personal-use / no-redistribution restriction`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._
- **Why does `o()` connect `PeerJS Vendor Lib` to `Map/World Building`, `HUD & Aim Rendering`, `Player Combat Stats`, `PeerJS Media Connection`, `Beam/Projectile Rendering`, `PeerJS Binary Packing`, `PeerJS Data Chunking`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **Why does `rgbPal()` connect `Map/World Building` to `PeerJS Vendor Lib`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Why does `renderWorldView()` connect `Beam/Projectile Rendering` to `Game Loop Core`, `HUD & Aim Rendering`, `Game Data Definitions`, `PeerJS Vendor Lib`, `Player Combat Stats`, `Boss AI & Pathing`, `Menu Presentation`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `renderWorldView()` (e.g. with `d()` and `f()`) actually correct?**
  _`renderWorldView()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AudioVolume`, `AudioCore`, `MUSIC_TRACKS` to the rest of the system?**
  _141 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Game Loop Core` be split into smaller, more focused modules?**
  _Cohesion score 0.032278481012658226 - nodes in this community are weakly interconnected._