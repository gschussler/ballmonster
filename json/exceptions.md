##### Special Exceptions
Notes:
- Array of special exception objects (see `exceptNames` in `scripts.js` for relevant indices)
- `mode` for inKey/outKey alignment
- `replace` to allow immunities to be removed
- `targets`: `"ATK Type": { "DEF Type": true, ... },"`
- Normal & Fighting can hit Ghost -> Foresight (`0`, Gen 2 move only -- effect after move), Odor Sleuth (`2`, Gen 3 only -- effect after move), Scrappy (`4`, Gen 4+ -- ability).
- Flash Fire revealed need for `0.75x`, `3x` sublists (if keeping offensive effects of Flash Fire in calc).

```json
{
  "e": [ // EXCEPTIONS ARRAY, starting with OFFENSIVE
    { // Foresight (Gen 2 only)
      "mode": "offense",
      "mult": 1,
      "replace": 1,
      "targets": {
        "0": { "13": 1 },
        "6": { "13": 1 }
      }
    },
    { // Flash Fire, offensive (Gen 3+, need to address new sublists)
      "mode": "offense",
      "mult": 1.5,
      "replace": 0,
      "targets": {
        "1": { "0": 1, "1": 1, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1, "7": 1, "8": 1, "9": 1, "10": 1, "11": 1, "12": 1, "13": 1, "14": 1, "15": 1, "16": 1, "17": 1, "18": 1, "19": 1 }
      }
    },
    { // Odor Sleuth (Gen 3 only)
      "mode": "offense",
      "mult": 1,
      "replace": 1,
      "targets": {
        "0": { "13": 1 },
        "6": { "13": 1 }
      }
    },
    { // Gravity, offensive (Gen 4+)
      "mode": "offense",
      "mult": 1,
      "replace": 1,
      "targets": {
        "8": { "9": 1 }
      }
    },
    { // Scrappy (takes over same effect as Foresight/Odor Sleuth from Gen 4 on)
      "mode": "offense",
      "mult": 1,
      "replace": 1,
      "targets": {
        "0": { "13": 1 },
        "6": { "13": 1 }
      }
    },
    -1, // Tinted Lens (Gen 4+, doubles "not very effective" damage, so shouldn't modify during calculations.)
    -1, // Flying Press (Gen 6+, doesn't change effectivity, just adds Flying to a Fighting-type move)
    {  // Freeze-Dry (Gen 6+)
      "mode": "offense",
      "mult": 2,
      "replace": 1,
      "targets": {
        "5": { "2": 1 }
      }
    },
    { // Thousand Arrows (Gen 6+)
      "mode": "offense",
      "mult": 1,
      "replace": 1,
      "targets": {
        "8": { "9": 1 }
      }
    },
    { // Water Bubble, offensive (Gen 7, same problem as Flash Fire)
      "mode": "offense",
      "mult": 2,
      "replace": 0,
      "targets": {
        "2": { "0": 1, "1": 1, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1, "7": 1, "8": 1, "9": 1, "10": 1, "11": 1, "12": 1, "13": 1, "14": 1, "15": 1, "16": 1, "17": 1, "18": 1, "19": 1 }
      }
    }, // DEFENSIVE EXCEPTIONS
    -1, // Flash Fire, defensive
    -1, // Levitate
    -1, // Lightning Rod
    -1, // Thick Fat
    -1, // Volt Absorb
    -1, // Water Absorb
    -1, // Wonder Guard
    -1, // Dry Skin
    -1, // Filter
    -1, // Gravity, defensive
    -1, // Heatproof
    -1, // Motor Drive
    -1, // Storm Drain
    -1, // Sap Sipper
    -1, // Delta Stream
    -1, // Fluffy
    -1, // Water Bubble, defensive
    -1, // Earth Eater
    -1, // Purifying Salt
    -1, // Tera Shell
    -1, // Well-Baked Body
    -1, // Forest's Curse
    -1 // Trick-Or-Treat
  ]
}
```