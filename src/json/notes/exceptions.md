##### Special Exceptions
Notes:
- Array of special exception objects (see `exceptNames` in `scripts.js` for relevant indices)
- `mode` for inKey/outKey alignment
- `replace` to allow immunities to be removed
- `targets`: `"ATK Type": { "DEF Type": true, ... },"`
- `move`: move's type as string, used as source move variable in `scripts.js`.
- Normal & Fighting can hit Ghost -> Foresight (`0`, Gen 2 move only -- effect after move), Odor Sleuth (`2`, Gen 3 only -- effect after move), Scrappy (`4`, Gen 4+ -- ability).
- "all types" does not include `Stellar` unless specified – not a defensive property.
- Defensive abilities/effects that provide immunity SHOULD be restricted to only the types that have access to the ability/effect, but ignoring for now.
- Defensive abilities/effects that introduce need for additional logic (grouped by logic needed):
  - Gravity, defensive (its effects on DEF Pokemon are more nuanced).
  - Tinted Lens
  - Levitate
  - Wonder Guard & Filter
  - Dry Skin
  - Tera Shell

```json
{
  "e": [ // EXCEPTIONS ARRAY, starting with OFFENSIVE
    { // Flash Fire, offensive (Gen 3+) – Fire deals 50% more damage to all types
      "mode": "offense",
      "mult": 1.5,
      "replace": 0,
      "targets": {
        "1": { "0": 1, "1": 1, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1, "7": 1, "8": 1, "9": 1, "10": 1, "11": 1, "12": 1, "13": 1, "14": 1, "15": 1, "16": 1, "17": 1 }
      }
    },
    { // Scrappy (Gen 4+) - Normal and Fighting deal 1x to Ghost
      "mode": "offense",
      "mult": 1,
      "replace": 1,
      "targets": {
        "0": { "13": 1 },
        "6": { "13": 1 }
      }
    },
    { // Tinted Lens (Gen 4+, doubles "not very effective" damage, which is distinctive from simply 0.5x effectivity relationship.)
      "mode": "defense",
      "mult": 2,
      "replace": 0,
      "after": 1,
      "group": 0.5
    },
    { // Flying Press (Gen 6+, Fighting-type move that also deals Flying-type damage.)
      "move": "fighting",
    },
    {  // Freeze-Dry (Gen 6+) – Ice deals 2x to Water
      "mode": "offense",
      "move": "ice",
      "mult": 2,
      "replace": 1,
      "targets": {
        "5": { "2": 1 }
      }
    },
    { // Thousand Arrows (Gen 6+) – Bypasses non-grounded Pokemon damage immunity (at the moment, simplified to 'Ground deals 1x to Flying')
      "mode": "offense",
      "move": "ground",
      "mult": 1,
      "replace": 1,
      "targets": {
        "8": { "9": 1 }
      }
    },
    { // Water Bubble, offensive (Gen 7) – Water doubles damage to all types.
      "mode": "offense",
      "mult": 2,
      "replace": 0,
      "targets": {
        "2": { "0": 1, "1": 1, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1, "7": 1, "8": 1, "9": 1, "10": 1, "11": 1, "12": 1, "13": 1, "14": 1, "15": 1, "16": 1, "17": 1 }
      }
    }, // DEFENSIVE EXCEPTIONS (Note: Exceptions that provide immunity are accessible by all types for now.)
    { // Flash Fire, defensive – Immune to Fire-type damage
      "mode": "defense",
      "mult": 0,
      "replace": 1,
      "targets": {
        "0": { "1": 1 }, "1": { "1": 1 }, "2": { "1": 1 }, "3": { "1": 1 }, "4": { "1": 1 }, "5": { "1": 1 }, "6": { "1": 1 }, "7": { "1": 1 }, "8": { "1": 1 }, "9": { "1": 1 }, "10": { "1": 1 }, "11": { "1": 1 }, "12": { "1": 1 }, "13": { "1": 1 }, "14": { "1": 1 }, "15": { "1": 1 }, "16": { "1": 1 }, "17": { "1": 1 }, "18": { "1": 1}
      }
    },
    { // Levitate (Gen 3) – Immune to Ground-type damage (except when struck by Thousand Arrows, affected by Gravity, etc. Perhaps need to add Flying type immunities but ignore that change if the aforementioned moves/effects are involved?)
      "mode": "defense",
      "mult": 0,
      "replace": 1,
      "targets": {
        "0": { "8": 1 }, "1": { "8": 1 }, "2": { "8": 1 }, "3": { "8": 1 }, "4": { "8": 1 }, "5": { "8": 1 }, "6": { "8": 1 }, "7": { "8": 1 }, "8": { "8": 1 }, "9": { "8": 1 }, "10": { "8": 1 }, "11": { "8": 1 }, "12": { "8": 1 }, "13": { "8": 1 }, "14": { "8": 1 }, "15": { "8": 1 }, "16": { "8": 1 }, "17": { "8": 1 }, "18": { "8": 1}
      }
    },
    { // Lightning Rod (Gen 3, only Gen 5+ is relevant) - Immune to Electric
      "mode": "defense",
      "mult": 0,
      "replace": 1,
      "targets": {
        "0": { "3": 1 }, "1": { "3": 1 }, "2": { "3": 1 }, "3": { "3": 1 }, "4": { "3": 1 }, "5": { "3": 1 }, "6": { "3": 1 }, "7": { "3": 1 }, "8": { "3": 1 }, "9": { "3": 1 }, "10": { "3": 1 }, "11": { "3": 1 }, "12": { "3": 1 }, "13": { "3": 1 }, "14": { "3": 1 }, "15": { "3": 1 }, "16": { "3": 1 }, "17": { "3": 1 }
      }
    },
    { // Thick Fat (Gen 3) – Reduces Ice or Fire-type damage by 50%
      "mode": "defense",
      "mult": 0.5,
      "replace": 0,
      "targets": {
        "0": { "1": 1, "5": 1 }, "1": { "1": 1, "5": 1 }, "2": { "1": 1, "5": 1 }, "3": { "1": 1, "5": 1 }, "4": { "1": 1, "5": 1 }, "5": { "1": 1, "5": 1 }, "6": { "1": 1, "5": 1 }, "7": { "8": 1, "5": 1 }, "8": { "1": 1, "5": 1 }, "9": { "1": 1, "5": 1 }, "10": { "1": 1, "5": 1 }, "11": { "1": 1, "5": 1 }, "12": { "1": 1, "5": 1 }, "13": { "1": 1, "5": 1 }, "14": { "1": 1, "5": 1 }, "15": { "1": 1, "5": 1 }, "16": { "1": 1, "5": 1 }, "17": { "1": 1, "5": 1 }
      }
    },
    { // Volt Absorb (Gen 3) – Immune to Electric-type moves
      "mode": "defense",
      "mult": 0,
      "replace": 1,
      "targets": {
        "0": { "3": 1 }, "1": { "3": 1 }, "2": { "3": 1 }, "3": { "3": 1 }, "4": { "3": 1 }, "5": { "3": 1 }, "6": { "3": 1 }, "7": { "3": 1 }, "8": { "3": 1 }, "9": { "3": 1 }, "10": { "3": 1 }, "11": { "3": 1 }, "12": { "3": 1 }, "13": { "3": 1 }, "14": { "3": 1 }, "15": { "3": 1 }, "16": { "3": 1 }, "17": { "3": 1 }
      }
    },
    { // Water Absorb (Gen 3) - Immune to Water-type moves
      "mode": "defense",
      "mult": 0,
      "replace": 1,
      "targets": {
        "0": { "2": 1 }, "1": { "2": 1 }, "2": { "2": 1 }, "3": { "2": 1 }, "4": { "2": 1 }, "5": { "2": 1 }, "6": { "2": 1 }, "7": { "2": 1 }, "8": { "2": 1 }, "9": { "2": 1 }, "10": { "2": 1 }, "11": { "2": 1 }, "12": { "2": 1 }, "13": { "2": 1 }, "14": { "2": 1 }, "15": { "2": 1 }, "16": { "2": 1 }, "17": { "2": 1 }
      }
    },
    { // Wonder Guard (Gen 3) – Immune to ALL damaging move types except those super-effective. This is distinctive from simply '2x'.)
      "mode": "defense",
      "mult": 0,
      "replace": 1,
      "after": 1,
      "group": 2
    },
    { // Dry Skin (Gen 4) – Fire-type damage increased by 25%. Immune to Water-type damage. Need to handle multiple values for type change.)
      "mode": "defense",
      "targets": {
        "any": { "1": { "mult": 1.25, "replace": 0 }, "2": { "mult": 0, "replace": 1 } } // DEF Type -> Fire damage increased by 25% && DEF Type -> Water damage immunity
      }
    },
    { // Filter (Gen 4) – Reduces damage from super-effective moves by 25%. "Super-effective" distinctive from '2x'.
      "mode": "defense",
      "mult": 0.75,
      "replace": 0,
      "after": 1,
      "group": 2
    },
    { // Heatproof (Gen 4) – Fire-type damaging moves deal 50% less damage
      "mode": "defense",
      "mult": 0.5,
      "replace": 0,
      "targets": {
        "0": { "1": 1 }, "1": { "1": 1 }, "2": { "1": 1 }, "3": { "1": 1 }, "4": { "1": 1 }, "5": { "1": 1 }, "6": { "1": 1 }, "7": { "8": 1 }, "8": { "1": 1 }, "9": { "1": 1 }, "10": { "1": 1 }, "11": { "1": 1 }, "12": { "1": 1 }, "13": { "1": 1 }, "14": { "1": 1 }, "15": { "1": 1 }, "16": { "1": 1 }, "17": { "1": 1 }
      }
    },
    { // Motor Drive (Gen 4) – Immune to Electric-type damage
      "mode": "defense",
      "mult": 0,
      "replace": 1,
      "targets": {
        "0": { "3": 1 }, "1": { "3": 1 }, "2": { "3": 1 }, "3": { "3": 1 }, "4": { "3": 1 }, "5": { "3": 1 }, "6": { "3": 1 }, "7": { "3": 1 }, "8": { "3": 1 }, "9": { "3": 1 }, "10": { "3": 1 }, "11": { "3": 1 }, "12": { "3": 1 }, "13": { "3": 1 }, "14": { "3": 1 }, "15": { "3": 1 }, "16": { "3": 1 }, "17": { "3": 1 }
      }
    },
    { // Storm Drain (Gen 4, only Gen 5+ is relevant) – Immune to Water-type damage
      "mode": "defense",
      "mult": 0,
      "replace": 1,
      "targets": {
        "0": { "2": 1 }, "1": { "2": 1 }, "2": { "2": 1 }, "3": { "2": 1 }, "4": { "2": 1 }, "5": { "2": 1 }, "6": { "2": 1 }, "7": { "2": 1 }, "8": { "2": 1 }, "9": { "2": 1 }, "10": { "2": 1 }, "11": { "2": 1 }, "12": { "2": 1 }, "13": { "2": 1 }, "14": { "2": 1 }, "15": { "2": 1 }, "16": { "2": 1 }, "17": { "2": 1 }
      }
    },
    { // Sap Sipper (Gen 5) – Immune to Grass-type damage
      "mode": "defense",
      "mult": 0,
      "replace": 1,
      "targets": {
        "0": { "4": 1 }, "1": { "4": 1 }, "2": { "4": 1 }, "3": { "4": 1 }, "4": { "4": 1 }, "5": { "4": 1 }, "6": { "4": 1 }, "7": { "4": 1 }, "8": { "4": 1 }, "9": { "4": 1 }, "10": { "4": 1 }, "11": { "4": 1 }, "12": { "4": 1 }, "13": { "4": 1 }, "14": { "4": 1 }, "15": { "4": 1 }, "16": { "4": 1 }, "17": { "4": 1 }
      }
    },
    { // Delta Stream (Gen 6) - Removes weaknesses of Flying-type Pokemon (simplified to 'Electric, Ice, and Rock-type damage reduced to '1x').
      "mode": "defense",
      "mult": 1,
      "replace": 1,
      "targets": {
        "9": { "3": 1, "5": 1, "12": 1 }
      }
    },
    { // Fluffy (Gen 7) – Fire-type damage against this Pokemon is doubled, but moves that "make contact" are halved. (nightmare implementation it seems...simply doubles Fire-damage for now.)
      "mode": "defense",
      "mult": 2,
      "replace": 1,
      "targets": {
        "0": { "1": 1 }, "1": { "1": 1 }, "2": { "1": 1 }, "3": { "1": 1 }, "4": { "1": 1 }, "5": { "1": 1 }, "6": { "1": 1 }, "7": { "1": 1 }, "8": { "1": 1 }, "9": { "1": 1 }, "10": { "1": 1 }, "11": { "1": 1 }, "12": { "1": 1 }, "13": { "1": 1 }, "14": { "1": 1 }, "15": { "1": 1 }, "16": { "1": 1 }, "17": { "1": 1 }
      }
    },
    { // Water Bubble, defensive (Gen 7) – Fire-type damage is reduced to 0.5x
      "mode": "defense",
      "mult": 0.5,
      "replace": 1,
      "targets": {
        "0": { "1": 1 }, "1": { "1": 1 }, "2": { "1": 1 }, "3": { "1": 1 }, "4": { "1": 1 }, "5": { "1": 1 }, "6": { "1": 1 }, "7": { "1": 1 }, "8": { "1": 1 }, "9": { "1": 1 }, "10": { "1": 1 }, "11": { "1": 1 }, "12": { "1": 1 }, "13": { "1": 1 }, "14": { "1": 1 }, "15": { "1": 1 }, "16": { "1": 1 }, "17": { "1": 1 }
      }
    },
    { // Earth Eater (Gen 9) – Immune to Ground-type damage
      "mode": "defense",
      "mult": 0,
      "replace": 1,
      "targets": {
        "0": { "8": 1 }, "1": { "8": 1 }, "2": { "8": 1 }, "3": { "8": 1 }, "4": { "8": 1 }, "5": { "8": 1 }, "6": { "8": 1 }, "7": { "8": 1 }, "8": { "8": 1 }, "9": { "8": 1 }, "10": { "8": 1 }, "11": { "8": 1 }, "12": { "8": 1 }, "13": { "8": 1 }, "14": { "8": 1 }, "15": { "8": 1 }, "16": { "8": 1 }, "17": { "8": 1 }
      }
    },
    { // Purifying Salt (Gen 9) – Ghost-type damage is reduced by 50%
      "mode": "defense",
      "mult": 0.5,
      "replace": 0,
      "targets": {
        "0": { "13": 1 }, "1": { "13": 1 }, "2": { "13": 1 }, "3": { "13": 1 }, "4": { "13": 1 }, "5": { "13": 1 }, "6": { "13": 1 }, "7": { "13": 1 }, "8": { "13": 1 }, "9": { "13": 1 }, "10": { "13": 1 }, "11": { "13": 1 }, "12": { "13": 1 }, "13": { "13": 1 }, "14": { "13": 1 }, "15": { "13": 1 }, "16": { "13": 1 }, "17": { "13": 1 }
      }
    },
    { // Tera Shell (Gen 9) – Damage-dealing moves of all types are set to 0.5x, "not very effective". This is the sole ability that includes a reduction to Stellar-type damage.
      "mode": "defense",
      "mult": 0.5,
      "replace": 1,
      "after": 1
    },
    { // Well-Baked Body (Gen 9) – Immune to Fire-type damage
      "mode": "defense",
      "mult": 0,
      "replace": 1,
      "targets": {
        "0": { "1": 1 }, "1": { "1": 1 }, "2": { "1": 1 }, "3": { "1": 1 }, "4": { "1": 1 }, "5": { "1": 1 }, "6": { "1": 1 }, "7": { "1": 1 }, "8": { "1": 1 }, "9": { "1": 1 }, "10": { "1": 1 }, "11": { "1": 1 }, "12": { "1": 1 }, "13": { "1": 1 }, "14": { "1": 1 }, "15": { "1": 1 }, "16": { "1": 1 }, "17": { "1": 1 }
      }
    },
    { // Forest's Curse
      "move": "grass"
    },
    { // Trick-Or-Treat
      "move": "ghost"
    }
  ]
}
```