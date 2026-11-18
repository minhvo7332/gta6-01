# Azura Bay — Open World Crime

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/minhvo7332/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/minhvo7332/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

![Azura Bay](https://img.shields.io/badge/game-open%20world%20crime-ff7a3a)
![Players](https://img.shields.io/badge/players-1%20player-4a7ad8)
![Platform](https://img.shields.io/badge/platform-desktop%20Chrome-7ad87a)
![License](https://img.shields.io/badge/license-MIT-blue)

An original open-world crime game built for make.fun's **"Make GTA 6"**
bounty. Explore the sun-soaked coastal city of **Azura Bay** on foot and
by car, steal rides, outrun the Azura Police Department, and run five story
jobs for fixer Marlo Crane — ending with the Tide Job bank heist.

## Play

Serve `game/` with any static server and open `index.html` in desktop
Chrome. No build step, no network requests: every file it loads lives
under `game/`.

```sh
node serve.ts
# open http://localhost:8080
```

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive when in a car |
| Shift | Run |
| Mouse | Aim (click to shoot) |
| E | Steal / enter the nearest car, or get out |
| Space | Handbrake |
| G | Save the game (loads from the title screen with C) |
| P | Pause |
| M | Mute |

## What's in the city

- **Five districts** — Ironworks, Palm Court, Neon Mile, Harbor Lights and
  Coral Keys — with a beach, docks, parks and a living road grid.
- **Traffic and pedestrians** — cars follow the roads, peds walk the
  sidewalks and flee from gunfire and speeding cars.
- **Cars to steal** — six original models (Sunrunner, Comet GT, Hauler,
  Palm Cruiser, Neon Taxi, Dune Buggy), plus a clinic, a gun store and a
  garage.
- **Wanted level** — 0 to 5 stars. Stealing, shooting and running people
  over bring foot cops, patrol cars, roadblocks and gunfire. Lay low and
  the heat cools off; get caught and you're busted.
- **Missions and story** — five jobs for Marlo Crane: a delivery, a
  boosted Comet GT, a gang problem in the Ironworks Yard, a 60-second
  police heatwave, and the Tide Job bank heist with a beach escape.
- **Combat** — pistol shooting with mouse aim, rival gang members who
  shoot back, and cars that can be shot until they explode.
- **HUD and minimap** — health, cash, wanted stars, objective text, a
  live minimap with the mission marker and cop dots, and an off-screen
  objective arrow.
- **Sound** — fully synthesized with WebAudio: a bassline while you drive,
  sirens, gunshots, crashes and mission stings. No audio files.
- **Save** — press G any time; continue from the title screen.

## Layout

- `game/index.html` — the page and canvas.
- `game/src/boot.js` — entry point, game state, main loop, camera.
- `game/src/citymap.js` — seeded city generation, districts, collision.
- `game/src/actors.js` — Dana on foot and the pedestrians.
- `game/src/vehicles.js` — cars, traffic AI, driving and stealing.
- `game/src/wanted.js` — wanted level and police AI.
- `game/src/combat.js` — shooting, gang members, explosions.
- `game/src/missions.js` — the five story jobs.
- `game/src/hud.js` — HUD, minimap, title / pause / end screens.
- `game/src/audio.js` — synthesized sound and music.
- `game/src/savegame.js` — localStorage save / load.
- `game/src/input.js` — keyboard and mouse.
- `game/src/rng.js` — seeded random numbers.
- `main.ts` — the entry program that builds `/output` + `dossier.json`.
- `screenshots/` — four renders of the game itself (title, driving,
  police chase, mission).

## Originality

Azura Bay is entirely original: its city, districts, characters, vehicles,
names, story, art, sounds and music were made for this entry. Nothing in
it comes from Rockstar's Grand Theft Auto or any other commercial game.

## License

MIT — see `LICENSE`.
