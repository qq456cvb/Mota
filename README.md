# Mota

A **Magic Tower (魔塔) clone that runs inside the Bilibili video player**, written for the advanced-danmaku (高级弹幕) scripting sandbox — the third of my danmaku-engine games alongside [danmuku_game](https://github.com/qq456cvb/danmuku_game) and [MineCraft](https://github.com/qq456cvb/MineCraft). Everything lives in one ~1900-line script, `mota.js`, with all sprites embedded as base64 resources.

## Gameplay Systems

A faithful subset of the classic Mota formula, on a tile grid with multi-floor maps:

- **Turn-based combat** with the genre's signature deterministic math: damage per exchange is `ATK − DEF` (floored at 1 for the hero), animated blow-by-blow on a timer while input is locked, with hero/monster stat panels on either side of the map.
- **Tiles and items**: yellow/blue/red keys and matching doors, attack/defense gems, HP potions, walls, lava, void, and up/down staircases. Monster roster includes green/red slimes, skeletons, bats, and a low-tier mage.
- **NPCs**: three shop types, a trade NPC, and a fairy, with a dialog/log system.
- **Map sharing via danmaku**: maps serialize to base64 (`saveMap2Base64`) and a comment trigger loads maps back from the video's danmaku stream (`loadMapFromBase64`), plus an in-game tile-editing mode — the same comments-as-level-database trick as danmuku_game.

## Running

Paste `mota.js` into the "高级弹幕" editor on a Bilibili video. Bilibili has since retired the Flash-era danmaku engine, so today it needs a BiliScript-compatible emulator implementing the `Player`/`Bitmap`/`ScriptManager`/`$` API surface. Note the in-game text is GBK-encoded Chinese, so keep the file in its original encoding.
