let mode = document.getElementById('content').getAttribute("data-mode") || "offense";
let gen = localStorage.getItem("selectedGen") || "6+";

// Initialize type buttons on page load and between relevant pages
document.addEventListener("htmx:afterSwap", async (e) => {
    mode === "more" ? initGenButtons() : initTypeButtons(); // Reinitialize buttons when mode changes
});

// Intercept htmx requests if the page is already selected
document.addEventListener("htmx:beforeRequest", (e) => {
  const requestedMode = e.detail.elt?.id;
  
  // Prevent htmx request if clicking the active page
  if (requestedMode === mode) {
    console.log(`Already on ${requestedMode} page or navigated to "More". Preventing unnecessary request.`);
    e.preventDefault();
  }
});

// Listen for clicks on navigation links to update the mode
document.querySelector("nav").addEventListener("click", (e) => {
  const link = e.target.closest("a");
  if (link && link.id) {
    const newMode = link.id;

    // Skip if same mode to prevent reset
    if(newMode === mode) {
      console.log(`Already on ${newMode} page. Skipping mode update.`);
      return;
    }

    // Remove current active link
    document.querySelector(`nav a[id=${mode}]`)?.classList.remove("active");

    // Update `mode` parameter to new mode
    document.getElementById('content').setAttribute("data-mode", newMode);
    link.classList.add("active");

    console.log(`Mode updating from ${mode} to: ${newMode}`);
    mode = newMode;
  }
});

const initGenButtons = () => {
  const genContainer = document.querySelector(".generation-selection");
  if(!genContainer) {
    console.log("Gen Selection container not found.");
    return;
  }

  console.log("Gen buttons found, attaching event listener.");

  genContainer.querySelectorAll("button").forEach(button => {
    button.classList.toggle("selected", button.dataset.gen === gen);
  });

  // One event listener for the container
  genContainer.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if(!button || !button.dataset.gen) return;

    const newGen = button.dataset.gen;
    if(newGen === gen) return;

    genContainer.querySelector(".selected")?.classList.remove("selected");

    gen = newGen;
    localStorage.setItem("selectedGen", gen);
    button.classList.add("selected");

    console.log(`Gen changed to ${gen}.`);
  });
  // Set initial selected button
  genContainer.querySelector(`button[data-gen="${gen}"]`)?.classList.add("selected");
};

const initTypeButtons = async () => {
  console.log(`Mode: ${mode}`);
  console.log(`Gen: ${gen}`);

  const selectedTypes = new Set(["normal"]); // Track selected types, default to 'normal' type
  const primaryContainer = document.querySelector(".primary-type-buttons");
  if(!primaryContainer) return; // ".type-buttons" doesn't exist in index.html on initial page load, so the first try for initializing always fails. skip it.
  const secondaryContainer = document.querySelector(".secondary-type-buttons");

  // console.log("Initializing type buttons...");

  // Clear previous event listeners to prevent duplicates
  primaryContainer.replaceWith(primaryContainer.cloneNode(true));
  const newPrimaryContainer = document.querySelector(".primary-type-buttons");

  // Event Delegation: button clicks add/remove types to/from calculations
  newPrimaryContainer.addEventListener("click", async (e) => {
      const button = e.target.closest("button");
      if(!button || !button.dataset.type) return;

      const type = button.dataset.type;
      // console.log(`Clicked ${type}`);

      // Container only allows one type selection at a time
      // `selectedTypes` may have more than 1 type, but not duplicates
      // Must check for secondary type grid
      if(selectedTypes.has(type)) {
        if(secondaryContainer && document.querySelector(`.secondary-type-buttons button[data-type="${type}"].selected`)) {
          // Secondary Container exists and the type is selected in it
          // clear the Set and add the selected type
          selectedTypes.clear();
          selectedTypes.add(type);
          
          // remove all selections from both containers
          document.querySelector(".primary-type-buttons button.selected")?.classList.remove("selected");
          document.querySelector(".secondary-type-buttons button.selected")?.classList.remove("selected");
          // update type selection in Primary Container
          button.classList.add("selected");
        } else return;
      } else {
        // Selecting a new type in Primary Container
        if(secondaryContainer) {
          // Remove the existing primary type from `selectedTypes`
          selectedTypes.forEach((existingType) => {
            if(newPrimaryContainer.querySelector(`button[data-type="${existingType}"].selected`)) {
              console.log(`Removing ${existingType}`);
              selectedTypes.delete(existingType);
            }
          });
        } else {
          // No secondary container, clear is faster
          selectedTypes.clear();
        }
        // Remove selection from other primary type buttons
        document.querySelector(".primary-type-buttons button.selected").classList.remove("selected");
        selectedTypes.add(type);
        button.classList.add("selected");
      }
    return await getTypeRelationship(selectedTypes, mode);
  });

  if(mode === "defense") {
    if(secondaryContainer) {
      // Clear previous event listeners to prevent duplicates
      secondaryContainer.replaceWith(secondaryContainer.cloneNode(true));
      const newSecondaryContainer = document.querySelector(".secondary-type-buttons");

      newSecondaryContainer.addEventListener("click", async (e) => {
          const button = e.target.closest("button");
          if(!button || !button.dataset.type) return;

          const type = button.dataset.type;

          // If type is selected in primary container, we don't want to allow selecting it in secondary container
          // Shouldn't be selectable, further logic needed.
          if (document.querySelector(`.primary-type-buttons button[data-type="${type}"].selected`)) {
            console.log(`${type} is primary.`);
            document.querySelectorAll(".secondary-type-buttons button.selected").forEach(btn => {
              const existingType = btn.dataset.type;
              if(selectedTypes.has(existingType)) {
                selectedTypes.delete(existingType);
                btn.classList.remove("selected");
              }
            });
            console.log(`Skipping secondary ${type} addition.`)
            return await getTypeRelationship(selectedTypes, mode);
          }

          // Container only allows one type selection at a time
          // `selectedTypes` may have more than 1 type, but not duplicates
          if(selectedTypes.has(type) && button.classList.contains("selected")) {
            selectedTypes.delete(type);
            button.classList.remove("selected");
            // console.log(`Secondary ${type} deleted.`)
          } else {
            // Doesn't match current primary or secondary type
            // Delete the type that is "selected" in Secondary Container from `selectedTypes` if it exists
            document.querySelectorAll(".secondary-type-buttons button.selected").forEach(btn => {
              const existingType = btn.dataset.type;
              if(selectedTypes.has(existingType)) {
                selectedTypes.delete(existingType);
                btn.classList.remove("selected");
              }
            });
            // console.log(`Secondary ${type} added.`);
            selectedTypes.add(type);
            button.classList.add("selected");
          }
        return await getTypeRelationship(selectedTypes, mode);
      });
    }
  }
  // ensure 'normal' type is pre-selected on load
  document.querySelector(`.primary-type-buttons button[data-type="normal"]`)?.classList.add("selected");

  // 'normal' type should be selected upon initialization, with results displayed
  console.log(`Getting initial "Normal" type relationships for gen ${gen}...`);
  const newEffectMults = await getEffectiveness(['normal'], mode, gen);
  updateEffectiveness(newEffectMults);
};

const getTypeRelationship = async (types, mode) => {
  let res = mode === "offense" ? "effectiveness" : "resistances" 
  // Update effectiveness sublists with the results
  console.log(`Checking ${res} of ${[...types]}`);
  const newEffectMults = await getEffectiveness([...types], mode, gen);
  updateEffectiveness(newEffectMults);
}

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

const getEffectiveness = async (inTypes, mode, gen) => {
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

  // Get the parent `.result-group` div and toggle its visibility
  const resultGroup = listEl.closest(".result-group");
  if(resultGroup) {
    resultGroup.style.display = typeSet.size > 0 ? "block" : "none";
  }
}

const effectivenessCache = new Map([
  ["4x", new Set()],
  ["2x", new Set()],
  ["1x", new Set()],
  ["0.5x", new Set()],
  ["0.25x", new Set()],
  ["0x", new Set()],
]);