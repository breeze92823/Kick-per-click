# Kick per Click: Landmark Map

Coordinates are in metres: +X east, +Z south, +Y up. Source: `SITES`, `LAWNS`, `ARENA` and `SPAWN` in `src/config.js`.

## Landmarks

| Landmark | X | Z | Lawn (w x d) | Notes |
|---|---|---|---|---|
| Spawn pad | 0 | 0 | none | Player spawns at y 0.6, facing -Z (training goals). Pad radius 7.2 m |
| Training goals | 0 | -30 | none | Row of goals, faces south |
| Wheel | 12 | -14 | 20 x 12 (centre 15, -14) | Shares lawn with sign board |
| Sign board | 21 | -17 | 20 x 12 (centre 15, -14) | Shares lawn with wheel |
| Chest | 27 | -2 | 10 x 8 | |
| Leaderboards | 33 | -18 | 14 x 9 | |
| Noob NPC | 14 | 0 | 9 x 9 | |
| Upgrade hill | -28 | 6 | none | 3-tier football shop, faces east toward spawn. See [Upgrade hill](#upgrade-hill) |
| Chili | -9 | -11 | 15 x 12 (centre -12, -16) | Shares lawn with Beach portal |
| Beach World portal | -12 | -16 | 15 x 12 (centre -12, -16) | Shares lawn with chili |

Extra lawns with no landmark: (-36, -32) 14 x 14 and (36, -36) 14 x 12. Both have `rot: 0`.

## Upgrade hill

Source: `buildUpgrades` in `src/landmarks.js`, `BALLS`, `BALL_ROWS`, `BLACK_HOLE_BALL` in `src/config.js`. Footballs are bought with total wins and each gives a permanent kick power per click; walking onto a pad buys or equips the ball.

The hill is 34 m wide (running roughly north-south) and rotated about 102 degrees to face the spawn, so the front tier is on the east side and the hill climbs westward. Approximate world positions:

| Tier | Step height | Centre (X, Z) | Pads | Contents |
|---|---|---|---|---|
| Front | 1.2 m | -23, 5 | 7 | Balls 1 to 6 (+1 to +7 kick), then the **Black Hole ball** on the north end (about -26, -8) |
| Middle | 2.4 m | -28, 6 | 6 | Balls 7 to 12 (+10 to +21 kick) |
| Back | 3.6 m | -32, 7 | 8 | Balls 13 to 20 (+23 to +56 kick) |
| Summit | 6 m | -39, 8 | none | Grassy platform with the purple `UPGRADES!` sign at 10.5 m |

Stepped flanks (4 m wide) sit on both ends of each tier. Each tier is 4.6 m deep and walkable by stepping up (1.2 m steps are above the 0.6 m walk-up limit, so jump between tiers).

| # | Ball | Wins to unlock | Kick |
|---|---|---|---|
| 1 | White | 0 | +1 |
| 2 | Black | 10 | +2 |
| 3 | Tan | 30 | +3 |
| 4 | Brown | 140 | +5 |
| 5 | Red | 500 | +7 |
| 6 | Pink | 1,300 | +10 |
| 7 | Light pink | 1,600 | +11 |
| 8 | Magenta | 2,000 | +12 |
| 9 | Orchid | 2,500 | +13 |
| 10 | Purple | 3,100 | +16 |
| 11 | Royal blue | 3,900 | +18 |
| 12 | Blue | 4,900 | +21 |
| 13 | Sky blue | 6,400 | +23 |
| 14 | Cyan | 8,500 | +26 |
| 15 | Teal | 11,000 | +30 |
| 16 | Green | 15,000 | +34 |
| 17 | Lime | 19,000 | +40 |
| 18 | Yellow | 25,000 | +44 |
| 19 | Gold | 34,000 | +49 |
| 20 | Red (top) | 44,000 | +56 |

Balls fill the tiers in `BALLS` order, front to back, following `BALL_ROWS` (6, 6, 8).

The Black Hole ball costs 349 gems (not wins) and is always 2x your best ball.

## Arena

- Bounds: X -46 to 46, Z -46 to 40.
- Cliff walls: two rings, 6 m thick each, 18 to 28 m high.
- Kick lane: X -22 to 2, running south to Z 200, with walls 12 to 18 m high.
- World bounds (invisible backstop): -215 to 215 on both axes. The ground is 440 m square.

## Top-down map

Each character is about 4 m east-west and 4 m north-south. North (-Z) is up. `S` = spawn.

```
  X: -46      -30      -10   0    10   20   30   46
Z -46 +--------------------------------------------+
      |                                            |
-36   |   [Lawn]        [Leaderb.]        [Lawn]   |
      |                                            |
-16   |            [Chest]       [Noob]            |
-10   |  [Training                      [Upgrade   |
  0   |    goals]           S             hill]    |
 10   |                                            |
 18   |            [Wheel]       [Chili]           |
 26   |      [Sign]                     [Beach]    |
      |                                            |
 40   +-----------------+-------+------------------+
                        | Kick  | lane (X -10..10)
                        | runs  | south to Z 200
                        v       v
```
