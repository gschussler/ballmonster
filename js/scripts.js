// typeMap.js
const typeMap = [
  "normal", // 0
  "fire", // 1
  "water", // 2
  "electric", // 3
  "grass", // 4
  "ice", // 5
  "fighting", // 6
  "poison", // 7
  "ground", // 8
  "flying", // 9
  "psychic", // 10
  "bug", // 11
  "rock", // 12
  "ghost", // 13
  "dragon", // 14
  "dark", // 15
  "steel", // 16
  "fairy", // 17
];

const getTypeKey = (typeName) => typeMap.indexOf(typeName);
const getTypeName = (typeKey) => typeMap[typeKey];

// cache.js
const caches = {
  "1": { offense: {}, defense: {} },
  "2-5": { offense: {}, defense: {} },
  "6+": { offense: {}, defense: {} },
};

const updateCache = (cache, typeKey, multiplier, operation = "add") => {
  for (const type in cache) {
    if (operation === "add") {
      cache[type] *= multiplier[typeKey];
    } else if (operation === "remove") {
      cache[type] /= multiplier[typeKey];
    }
  }
};

const genTypeCounts = {
  "1": 15,
  "2-5": 17,
  "6+": 18,
};

// effectiveness.js
const loadGenerationData = async(gen) => {
  // Load JSON data for the specified generation
  // (e.g., fetch from a file or use a preloaded object)
  const genData = {
    "1": "/json/gen1.json",
    "2-5": "/json/gen2-5.json",
    "6+": "/json/gen6+.json",
  };

  try {
    const response = await fetch(genData[gen]);
    if (!response.ok) {
      throw new Error(`Failed to fetch data for generation ${gen}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error loading generation data:", error);
    return {}; // empty object to prevent errors elsewhere
  }
};

const getEffectiveness = async (types, mode = "offense", gen = "6+") => {
  const data = await loadGenerationData(gen);
  const typeKeys = types.map(getTypeKey);
  const defTypes = genTypeCounts[gen];

  const effectivenessGroups = {
    "4x": [],
    "2x": [],
    "1x": [],
    "0.5x": [],
    "0x": [],
  };

  for (let defType = 0; defType < defTypes; defType++) {
    let totalMult = 1;

    for (const atkType of typeKeys) {
      const effectiveness = mode === "offense"
        ? data.s[atkType][defType] // Offense: atkType –> defType
        : data.s[defType][atkType]; // Defense: defType –> atkType
      totalMult *= effectiveness;
    }

    const typeName = getTypeName(defType);
    switch(totalMult) {
      case 4:
        effectivenessGroups["4x"].push(typeName);
        break;
      case 2:
        effectivenessGroups["2x"].push(typeName);
        break;
      case 1:
        effectivenessGroups["1x"].push(typeName);
        break;
      case 0.5:
        effectivenessGroups["0.5x"].push(typeName);
        break;
      case 0:
        effectivenessGroups["0x"].push(typeName);
        break;
      default:
        throw new Error(`Invalid effectiveness multiplier: ${totalMult}`);
    }
  }

  return effectivenessGroups;
};

// test
const testEffectiveness = async () => {
  const types = ["fire", "water"]; // Example types
  const mode = "offense"; // Example mode
  const gen = "1"; // Example generation

  try {
    const result = await getEffectiveness(types, mode, gen);
    console.log("Effectiveness Test Result:", result);
  } catch (error) {
    console.error("Error in effectiveness test:", error);
  }
};

// Run the test function after DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  testEffectiveness();
});

// Export for modular use (if needed)
export { getEffectiveness, updateCache, typeMap, getTypeKey, getTypeName };