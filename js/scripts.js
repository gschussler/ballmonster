let mode = document.getElementById('content').getAttribute("data-mode") || "offense";

// Initialize type buttons on page load
document.addEventListener("htmx:afterSwap", (e) => {
  initTypeButtons(); // Reinitialize buttons when mode changes
});

// Listen for clicks on navigation links to update the mode
document.querySelector("nav").addEventListener("click", (e) => {
  const link = e.target.closest("a");
  if (link && link.hasAttribute("data-mode")) {
    const newMode = link.getAttribute("data-mode");
    document.getElementById('content').setAttribute("data-mode", newMode);
    console.log(`Mode updating to: ${newMode}`);
    mode = newMode;
  }
});

const initTypeButtons = async () => {
  console.log(`Mode: ${mode}`)
  const selectedTypes = new Set(["normal"]); // Track selected types, default to 'normal' type
  const container = document.querySelector(".type-buttons")
  if(!container) return; // ".type-buttons" doesn't exist in index.html on initial page load, so the first try for initializing always fails. skip it.
  // console.log("Initializing type buttons...");

  // Clear previous event listeners to prevent duplicates
  container.replaceWith(container.cloneNode(true));
  const newContainer = document.querySelector(".type-buttons");

  // Event Delegation: button clicks add/remove types to/from calculations
  newContainer.addEventListener("click", async (e) => {
    if(e.target.tagName.toLowerCase() === 'button') {
      const button = e.target;
      const type = button.dataset.type;
      // console.log(`Clicked ${type}`);

      if(mode === "offense") {
        // Offense mode: one type at a time
        if(selectedTypes.has(type)) {
          return;
        }
        selectedTypes.clear();
        selectedTypes.add(type);
        document.querySelectorAll(".type-buttons button").forEach(btn => btn.classList.remove("selected"));
        button.classList.add("selected");
      } else {
        // Defense mode: multiple types allowed
        if(selectedTypes.has(type) && selectedTypes.size > 1) {
          selectedTypes.delete(type);
          button.classList.remove("selected");
        } else {
          selectedTypes.add(type);
          button.classList.add("selected");
        }
      }

      // if(selectedTypes.size === 1 && selectedTypes.has(type)) return; // prevent deselecting the only active type

      // // inform html of add/delete methods for type calculations
      // if(selectedTypes.has(type)) {
      //   selectedTypes.delete(type);
      //   button.classList.remove("selected");
      // } else {
      //   selectedTypes.add(type);
      //   button.classList.add("selected");
      // };

      // Run type relationship calculations,
      // update effectiveness sublists with the results
      console.log(`Checking effectiveness of ${[...selectedTypes]}`);
      const newEffectMults = await getEffectiveness([...selectedTypes], mode);
      updateEffectiveness(newEffectMults);
    }
  });

  // ensure 'normal' type is pre-selected on load
  document.querySelector(`.type-buttons button[data-type="normal"]`)?.classList.add("selected");
  
  // 'normal' type should be selected upon initialization, with results displayed
  console.log(`Getting initial "Normal" type relationships...`);
  const newEffectMults = await getEffectiveness(['normal'], mode);
  updateEffectiveness(newEffectMults);
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
const loadGenerationData = async (gen) => {
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

// Effectiveness Multiplier lists
    //to be populated with all single Pokemon types that exist in current generation
const effectMults = new Map([
  ["4x", new Set()],
  ["2x", new Set()],
  ["1x", new Set()],
  ["0.5x", new Set()],
  ["0.25x", new Set()],
  ["0x", new Set()],
]);

const getEffectiveness = async (inTypes, mode = "offense", gen = "6+") => {
  // Clear the Map before processing new data
  effectMults.forEach(set => set.clear());

  // console.log(`effectiveness of ${[...inTypes]}`)
  const data = await loadGenerationData(gen); // Generation data to traverse
  const outKeys = genTypeCounts[gen]; // Limit looping through types based on generation

  // Loop through all Pokemon types in the current generation to output their effectiveness relationships
    // mode === "offense" –> selected ATK types are `inKeys`, opposing Pokemon DEF types are `outKeys`
    // mode === "defense" -> selected DEF types are `inKeys`, opposing Pokemon ATK types are `outKeys`
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
        effectMults.get("4x").add(typeName);
        break;
      case 2:
        effectMults.get("2x").add(typeName);
        break;
      case 1:
        effectMults.get("1x").add(typeName);
        break;
      case 0.5:
        effectMults.get("0.5x").add(typeName);
        break;
      case 0.25:
        effectMults.get("0.25x").add(typeName);
        break;
      case 0:
        effectMults.get("0x").add(typeName);
        break;
      default:
        throw new Error(`Invalid effectiveness multiplier: ${totalMult}`);
    }
  }
  // console.log(effectMults);
  return effectMults;
};

const setsEqual = (setA, setB) => {
  return setA.size === setB.size && [...setA].every(x => setB.has(x));
}

const updateEffectiveness = (newEffectMults) => {
  newEffectMults.forEach((newSet, mult) => {
    if(!setsEqual(newSet, effectivenessCache.get(mult))) {
      // Update only when necessary
      effectivenessCache.set(mult, new Set(newSet));
      updateDOM(mult, newSet);
    }
  });
}

const updateDOM = (mult, typeSet) => {
  const listEl = document.getElementById(mult);
  listEl.innerHTML = "";

  typeSet.forEach(type => {
    const listItem = document.createElement("li");
    listItem.textContent = type;
    listEl.appendChild(listItem);
  });
}

const effectivenessCache = new Map([
  ["4x", new Set()],
  ["2x", new Set()],
  ["1x", new Set()],
  ["0.5x", new Set()],
  ["0.25x", new Set()],
  ["0x", new Set()],
]);