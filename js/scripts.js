// Initialize type buttons on page load
document.addEventListener("htmx:load", () => {
  initTypeButtons();
});

const initTypeButtons = () => {
  const selectedTypes = new Set(["normal"]); // Track selected types
  const container = document.querySelector(".type-buttons")
  if(!container) return; // ".type-buttons" doesn't exist in index.html on initial page load, so the first try for initializing always fails. skip it.
  // console.log("Initializing type buttons...");

  const normal = container.querySelector("[data-type='normal']");
  if(normal) normal.classList.add("selected");

  // event delegation to handle button clicks
  container.addEventListener("click", (e) => {
    if(e.target.tagName.toLowerCase() === 'button') {
      const button = e.target;
      const type = button.dataset.type;
      console.log(`Clicked ${type}`)

      if(selectedTypes.size === 1 && selectedTypes.has(type)) return; // prevent deselecting only active type

      // toggle type select
      if(selectedTypes.has(type)) {
        selectedTypes.delete(type);
        button.classList.remove("selected");
      } else {
        selectedTypes.add(type);
        button.classList.add("selected");
      };

      console.log(`Checking effectiveness of ${[...selectedTypes]}`)
      getEffectiveness([...selectedTypes]);
    }
  })
};

// typeMap.js
const typeNames = [
  "normal", "fire", "water", "electric",
  "grass", "ice", "fighting", "poison",
  "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark",
  "steel", "fairy"
];

const typeMap = Object.fromEntries(typeNames.map((name, index) => [name, index]));

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

const getEffectiveness = async (inTypes, mode = "offense", gen = "6+") => {
  // console.log(`effectiveness of ${[...inTypes]}`)
  const data = await loadGenerationData(gen); // Generation data to traverse
  const outKeys = genTypeCounts[gen]; // Limit looping through types based on generation

  // effectiveness multiplier lists
    //to be populated with all single Pokemon types that exist in current generation
  const effectMults = {
    "4x": [],
    "2x": [],
    "1x": [],
    "0.5x": [],
    "0.25x": [],
    "0x": [],
  };

  // Loop through all Pokemon types in the current generation to output their effectiveness relationships
  for (let outKey = 0; outKey < outKeys; outKey++) {
    let totalMult = 1;

    // Process input types to get their effectiveness relationship with output types
    for (const type of inTypes) {
      const inKey = typeMap[type];
      // if(inKey === undefined) continue; // ignore invalid types

      const effectMult = mode === "offense"
        ? data.s[inKey][outKey] // Offense: `Deals ${n}x to`; inKey –> outKey
        : data.s[outKey][inKey]; // Defense: `Takes ${n}x from`; outKey –> inKey 
      totalMult *= effectMult;
    }

    const typeName = typeNames[outKey]; // need type string for targeted types
    switch(totalMult) {
      case 4:
        effectMults["4x"].push(typeName);
        break;
      case 2:
        effectMults["2x"].push(typeName);
        break;
      case 1:
        effectMults["1x"].push(typeName);
        break;
      case 0.5:
        effectMults["0.5x"].push(typeName);
        break;
      case 0.25:
        effectMults["0.25x"].push(typeName);
        break;
      case 0:
        effectMults["0x"].push(typeName);
        break;
      default:
        throw new Error(`Invalid effectiveness multiplier: ${totalMult}`);
    }
  }

  console.log(effectMults);
  return effectMults;
};