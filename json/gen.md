# Type Relationship JSON Template
### 18 Types by JSON array index
**Gen 1**: *0-14* –> **Gen 2-5**: *Dark (15) and Steel (16) types added* –> **Gen 6+**: *Fairy (17) type added*
- 0: Normal
- 1: Fire
- 2: Water
- 3: Electric
- 4: Grass
- 5: Ice
- 6: Fighting
- 7: Poison
- 8: Ground
- 9: Flying
- 10: Psychic
- 11: Bug
- 12: Rock
- 13: Ghost
- 14: Dragon
- 15: Dark
- 16: Steel
- 17: Fairy

```json
{
	"g": 6, // Generation
	"s": [  // Single-type effectiveness
		[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.5, 0, 1, 1, 0.5, 1, 1], // Normal
		[1, 0.5, 0.5, 1, 2, 2, 1, 1, 1, 1, 1, 2, 0.5, 1, 0.5, 1, 2, 1], // Fire
		// Repeat for all Pokemon types...
	],
	// Other top-level objects for special exceptions that affect effectiveness calculations...
}
```