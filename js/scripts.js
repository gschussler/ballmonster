/** 
 * @file scripts.js
 * @description Global scripts for handling dynamic DOM events, managing state, and processing Pokemon type effectiveness data. 
 */

/* ----- DOM EVENT LISTENERS – handles page navigation and UI initialization. ----- */

/**
 * Handles the `htmx:afterSwap` event to initialize relevant button functionality after an HTMX swap event occurs, based on the current page.
 * 
 * @listens htmx:afterSwap
 * @param {Event} e - The event object for the htmx swap event.
 * @returns {Promise<void>} Resolves after initializing the appropriate buttons.
 */
document.addEventListener("htmx:afterSwap", async (e) => {
  if(mode !== "more") {
    await initTypeButtons();
  } else {
    await initGenButtons();
  }
});

/**
 * Intercepts htmx requests to prevent unnecessary navigation and to manage clearing the result cache if generation hasn't changed between pages.
 * 
 * @listens htmx:beforeRequest
 * @param {Event} e - The event object for the htmx swap event
 */
document.addEventListener("htmx:beforeRequest", (e) => {
  const requestedMode = e.detail.elt?.id;

  if (requestedMode === mode) { // Prevent htmx request if user is already on the selected page
    console.log(`Already on "${requestedMode}" page. Preventing unnecessary request.`);
    e.preventDefault();
    // return;
  } else if (!genChange) { // Clear cache if navigating between "offense" and "defense" pages or navigating away from "more" to a different page than previous.
    if(requestedMode !== prevMode && requestedMode !== "more") {
      // console.log(`Heading to "offense" or "defense" page. Not prevMode, so clearing cache...`)
      effectivenessCache.forEach(set => set.clear());
      clearCache = true;
    }
  }
});

/**
 * Handles navigation link clicks to update the application's mode, aligning with expected swap triggers for htmx
 * 
 * @listens Event#click
 * @param {MouseEvent} e - The click event object.
 */
// Listen for clicks on navigation links to update the mode
document.querySelector("nav").addEventListener("click", (e) => {
  const link = e.target.closest("a");
  if (link && link.id) {
    const newMode = link.id;

    // Skip if same mode to prevent reset
    if(newMode === mode) {
      // console.log(`Already on ${newMode} page. Skipping mode update.`);
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
/* ---------------------------------------------------------------------------------------------------------------- */
/* ----- GLOBAL VARIABLES – Data primitives and structures used for application state as well as within one or more functional components ----- */

let mode = document.getElementById('content').getAttribute("data-mode") || "offense";
let prevMode = null;
let gen = localStorage.getItem("selectedGen") || "6+";

let genChange = false;
let clearCache = true;

let genJSON, exceptJSON;

let lastPrimarySelected = null;
let lastSecondarySelected = null;
let lastMoveSelected = null;

let lastSecondaryDisabled = null;
let lastSpecialDisabled = null;

/**
 * Tracks currently selected Pokémon types.
 * Defaults to "normal" type.
 * @type {Set<string>}
 */
const selectedTypes = new Set(["normal"]);

/**
 * Tracks currently selected exceptions.
 * Defaults to none.
 * @type {Set<string>}
 */
const exceptions = new Set([]);

/**
 * List of all Pokémon type names.
 * @constant {string[]}
 */
const typeNames = [
  "normal", "fire", "water", "electric",
  "grass", "ice", "fighting", "poison",
  "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark",
  "steel", "fairy", "stellar"
];

/**
 * Maps Pokémon type names to numerical indices.
 * @constant {Object<string, number>}
 */
const typeMap = Object.fromEntries(typeNames.map((name, index) => [name, index]));

/**
 * List of all offensive and defensive exceptions.
 * @constant {string[]}
 */
const exceptNames = [
  // Offense exceptions (Gen-ascending)
  "foresight", "flash_fire_atk", "odor_sleuth", "gravity_atk", "scrappy", "tinted_lens", "flying_press", "freeze-dry", "thousand_arrows", "water_bubble_atk",
  // Defense exceptions (Gen-ascending)
  "flash_fire_def", "levitate", "lightning_rod", "thick_fat", "volt_absorb", "water_absorb", "wonder_guard", "dry_skin", "filter", "gravity_def", "heatproof", "motor_drive", "storm_drain", "sap_sipper", "delta_stream", "fluffy", "water_bubble_def", "earth_eater", "purifying_salt", "tera_shell", "well-baked_body", "forests_curse", "trick-or-treat"
];

/**
 * Maps exception names to numerical indices.
 * @constant {Object<string, number>}
 */
const exceptMap = Object.fromEntries(exceptNames.map((name, index) => [name, index]));

/**
 * Maps special offensive moves to their source Pokémon types.
 * @constant {Object<string, string>}
 */
const oMoveType = {
  "flying_press": "fighting",
  "freeze-dry": "ice",
  "thousand_arrows": "ground"
};

/**
 * Maps target Pokémon types to special moves.
 * @constant {Object<string, string>}
 */
const dTypeMove = {
  "grass": "forests_curse",
  "ghost": "trick-or-treat"
};

/**
 * Precomputed Map for fast type-to-move lookups.
 * @constant {Map<string, string>}
 */
const moveByType = new Map();

/**
 * Precomputed Map for fast move-to-type lookups.
 * @constant {Map<string, string>}
 */
const typeByMove = new Map();

const populateMoveMaps = async () => {
  exceptJSON = await loadExceptions();
  const exceptArr = exceptJSON.e;

  for(let i = 0; i < exceptArr.length; i++) {
    const entry = exceptArr[i];
    if(!entry.move) continue;

    const moveType = entry.move;
    const moveName = exceptNames[i];

    moveByType.set(moveType, moveName);
    typeByMove.set(moveName, moveType);
  }
}

// /**
//  * Maps target Pokémon types to an existing special move. (O(1) lookup for move toggling)
//  * @constant {Object<string, string>}
//  */
// const dTypeMove = {
//   "grass": "forests_curse",
//   "ghost": "trick-or-treat"
// };

// /**
//  * Stores cached effectiveness calculations for different generations. CURRENTLY UNUSED.
//  * @constant {Object<string, { offense: Object, defense: Object }>}
//  */
// const caches = {
//   "1": { offense: {}, defense: {} },
//   "2-5": { offense: {}, defense: {} },
//   "6+": { offense: {}, defense: {} },
// };

/**
 * Maps generation labels to the number of Pokémon types available in that generation.
 * @constant {Object<string, number>}
 */
const genTypeCounts = {
  "1": 15,
  "2-5": 17,
  "6+": 18,
};

/**
 * Maps type effectiveness multipliers to sets of Pokémon types.
 * Populated dynamically by monotype relationship calculations (`getEffectiveness` operations).
 * @type {Map<string, Set<string>>}
 */
const effectMults = new Map([
  ["8x", new Set()],
  ["4x", new Set()],
  ["3x", new Set()],
  ["2x", new Set()],
  ["1.5x", new Set()],
  ["1x", new Set()],
  ["0.75x", new Set()],
  ["0.5x", new Set()],
  ["0.25x", new Set()],
  ["0.125x", new Set()],
  ["0x", new Set()],
]);

/**
 * Stores effectiveness results to prevent redundant calculations.
 * @type {Map<string, Set<string>>}
 */
const effectivenessCache = new Map([
  ["8x", new Set()],
  ["4x", new Set()],
  ["3x", new Set()],
  ["2x", new Set()],
  ["1.5x", new Set()],
  ["1x", new Set()],
  ["0.75x", new Set()],
  ["0.5x", new Set()],
  ["0.25x", new Set()],
  ["0.125x", new Set()],
  ["0x", new Set()],
]);
/* ---------------------------------------------------------------------------------------------------------------- */
/* ----- JSON data loaders – Provide Pokemon type relatioship data by generation as well as special type exception data ----- */

/**
 * Loads type effectiveness data for a specified generation.
 * Checks localStorage for cached data before fetching from a JSON file.
 * 
 * @async
 * @param {string} gen - The generation identifier (e.g., "1", "2-5", "6+").
 * @returns {Promise<Object>} A promise that resolves to the generation data object.
 */
const loadGenerationData = async (gen) => {
  // Load JSON data for the specified generation
  // (e.g., fetch from a file or use a preloaded object)
  const cachedData = localStorage.getItem(`genData_${gen}`);
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  const genData = {
    "1": "/json/gen1.json",
    "2-5": "/json/gen2-5.json",
    "6+": "/json/gen6+.json",
  };

  try {
    const res = await fetch(genData[gen]);
    if (!res.ok) {
      throw new Error(`Failed to fetch data for generation ${gen}.`);
    }
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error loading generation data:", error);
    return {}; // empty object to prevent errors elsewhere
  }
};

/**
 * Loads exception data from a JSON file.
 * 
 * @async
 * @returns {Promise<Object>} A promise that resolves to the exceptions data object.
 */
const loadExceptions = async () => {
  try {
    const res = await fetch("/json/exceptions.json");
    if(!res.ok) {
      throw new Error("Failed to fetch data for exceptions.");
    }
    const data = await res.json();
    return data; // target the exception array
  } catch (error) {
    console.error("Error loading exceptions data:", error);
    return {};
  }
};

// Need to populate move maps asynchronously at top level
(async () => {
  await populateMoveMaps();
  // console.log("Move maps populated:", moveByType, typeByMove);
})();
/* ---------------------------------------------------------------------------------------------------------------- */
/* ----- UI HELPER FUNCTIONS – Functions that provide dynamic UI rendering capabilities to event listeners. ----- */

/**
 * Adjusts the visibility of type buttons based on number of Pokemon within a generation.
 * @param {HTMLElement} container - The container element holding the type buttons
 */
const typeVisibility = (container, gen) => {
  const btns = container.querySelector(".button-grid").children;
  for(let i = 15; i < btns.length; i++) {
    btns[i].style.display = (genTypeCounts[gen] > i) ? "block" : "none";
  }
};

/**
 * Clears selected types within a container.
 * @param {HTMLElement} container - The container holding the buttons.
 * @param {Set<string>} selectedTypes - A set of selected Pokemon type names.
 */
const clearSelections = (container, selectedTypes) => {
  container.querySelectorAll("button.selected").forEach((button) => {
    const existingType = button.dataset.type;
    if(selectedTypes.has(existingType)) {
      selectedTypes.delete(existingType);
      button.classList.remove("selected");
    }
  })
};

/**
 * 
 * @param {HTMLElement} primaryContainer - The container for primary type selection .
 * @param {HTMLElement} secondaryContainer - The container for secondary type selection.
 */
const updateSelections = (primaryContainer, secondaryContainer = null) => {
  lastPrimarySelected = primaryContainer.querySelector("button.selected");
  lastSecondarySelected = secondaryContainer?.querySelector("button.selected");
  
  if(mode === "defense") {
    const pToggleType = lastPrimarySelected?.dataset.type;
    const sToggleType = lastSecondarySelected?.dataset.type;
    toggleDefSpecialMoves(pToggleType, sToggleType);
  }
};

/**
 * Enables or disables special move buttons based on selected types. (currently only on defense)
 * @param {string} pToggleType 
 * @param {string} sToggleType 
 */

const toggleDefSpecialMoves = (pToggleType, sToggleType) => {
  let moveDisabledP;
  let moveDisabledS;

  if(dTypeMove[pToggleType]) moveDisabledP = moveByType.get(pToggleType);
  if(dTypeMove[sToggleType]) moveDisabledS = moveByType.get(sToggleType);
  
  if(moveDisabledP) document.querySelector(`button[data-move="${moveDisabledP}"]`).disabled = true;

  if(moveDisabledS) document.querySelector(`button[data-move="${moveDisabledS}"]`).disabled = true;

  document.querySelectorAll("button[data-move]").forEach(btn => {
    const move = btn.dataset.move;
    if(move !== moveDisabledP && move !== moveDisabledS) {
      btn.disabled = false;
    }
  });
};

/**
 * Disables a move type button in both primary and secondary containers.
 * @param {HTMLElement} container1 - The first container holding type buttons.
 * @param {HTMLElement} container2 - The second container holding type buttons.
 * @param {string} moveType - The type to disable.
 * @param {boolean} [special=false] - Whether this applies to special moves.
 */
// CONSIDER: pass containers in specific order to define operations. Will not work with current variables.
const moveTypeDisable = (container1, container2, moveType, special = false) => {
  container1.querySelector(`button[data-type="${moveType}"]`).disabled = true
  if(!special) {
    lastSecondaryDisabled = container2.querySelector(`button[data-type="${moveType}"]`);
    lastSecondaryDisabled.disabled = true;
  } else {
    lastSpecialDisabled = container2.querySelector(`button[data-type="${moveType}"]`);
    lastSpecialDisabled.disabled = true;
  }
};

/**
 * Enables a move type button in both primary and secondary containers.
 * @param {HTMLElement} container1 - The first container holding type buttons.
 * @param {HTMLElement} container2 - The second container holding type buttons.
 * @param {string} moveType - The type to enable.
 * @param {boolean} [special=false] - Whether this applies to special moves.
 */
// CONSIDER: pass containers in specific order to define operations. Will not work with current variables.
const moveTypeEnable = (container1, container2, moveType, special = false) => {
  container1.querySelector(`button[data-type="${moveType}"]`).disabled = false;
  if(!special) {
    if(lastSecondaryDisabled.dataset.type !== moveType) {
      lastSecondaryDisabled.disabled = false;
    }
    lastSecondaryDisabled = null;
  } else {
    lastSpecialDisabled.disabled = false;
    lastSpecialDisabled = null;
  }
};

// /**
//  * Updates cached effectiveness multipliers. CURRENTLY UNUSED
//  * @param {Object} cache - The cache storing effectiveness multipliers.
//  * @param {string} typeKey - The type key being modified.
//  * @param {Object} multiplier - The effectiveness multiplier values.
//  * @param {string} [operation="add"] - The operation to perform ("add" or "remove").
//  */
// const updateCache = (cache, typeKey, multiplier, operation = "add") => {
//   for (const type in cache) {
//     if (operation === "add") {
//       cache[type] *= multiplier[typeKey];
//     } else if (operation === "remove") {
//       cache[type] /= multiplier[typeKey];
//     }
//   }
// };

/**
 * Checks whether two Maps of Sets are equal.
 * @param {Set<any>} setA - The first set.
 * @param {Set<any>} setB - The second set.
 * @returns {boolean} - True if sets are equal, false otherwise.
 */
const setsEqual = (setA, setB) => {
  return setA.size === setB.size && [...setA].every(x => setB.has(x));
}

/**
 * Updates effectiveness multipliers in the DOM (clearCache state determines whether to use cache when populating.)
 * @param {Map<number, Set<string>>} newEffectMults - The new effectiveness multipliers.
 */
const updateEffectiveness = (newEffectMults) => {
  // console.log(`clearCache in updateEffectiveness is: ${clearCache}`)
  if(clearCache) {
    newEffectMults.forEach((newSet, mult) => {
      if(!setsEqual(newSet, effectivenessCache.get(mult))) {
        // Update only when necessary
        effectivenessCache.set(mult, new Set(newSet));
        updateDOM(mult, newSet);
      }
    });
  } else { // clearCache flag used when applying the uncleared cache to the DOM (useful for render on the way to previous page)
    newEffectMults.forEach((newSet, mult) => {
        effectivenessCache.set(mult, new Set(newSet));
        updateDOM(mult, newSet);
    });
  }
}

/**
 * Updates the DOM to reflect effectiveness changes.
 * @param {number} mult - The effectiveness multiplier.
 * @param {Set<string>} typeSet - The set of types corresponding to the multiplier.
 */
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
};
/* ---------------------------------------------------------------------------------------------------------------- */
/* ----- CORE FUNCTIONS – Functions that centralize processes for UI rendering and type effectiveness calculation. ----- */

/**
 * Retrieves type effectiveness data based on the selected types, mode, generation, and selected exceptions. Notifies functions to try and update the DOM.
 * 
 * @param {string[]} types - An array of selected Pokemon types.
 * @param {string} mode - The mode of the current page, either "offense" or "defense"
 * @param {string} generation - The current Pokemon game generation.
 * @param {Map} exceptions - A map of selected exceptions containing special Pokemon type interactions.
 */
const getTypeRelationship = (types, mode, generation, exceptions) => {
  let res = mode === "offense" ? "effectiveness" : "resistances";
  // Update effectiveness sublists with the results
  console.log(`Checking ${res} of ${[...types]}`);
  const newEffectMults = getEffectiveness([...types], mode, generation, exceptions);
  updateEffectiveness(newEffectMults);
};

/**
 * Calculates the effectiveness multipliers between the selected types and the opposing types based on the current mode,generation, and exceptions.
 * 
 * @param {string[]} inTypes - The array of input types (offensive or defensive).
 * @param {string} mode - The mode of the current page, either "offense" or "defense".
 * @param {string} gen - The current Pokemon game generation.
 * @param {Map} exceptions - A map of selected exceptions containing special Pokemon type interactions.
 * 
 * @returns {Map} A Map of effectiveness multipliers, where the key is the multiplier value and the value is a set of affected types.
 */
const getEffectiveness = (inTypes, mode, gen, exceptions) => {
  // Clear the Map before processing new data
  effectMults.forEach(set => set.clear());

  // console.log(`Effectiveness of ${[...inTypes]}`)
  const outKeys = genTypeCounts[gen]; // Limit looping through types based on generation

  // If there are exceptions, only check type relationships that the exceptions apply to
    // some exceptions have unique interactions that require checks during result group placement
  const exceptionMap = new Map();
  let tintedLens = 0;
  if (exceptions.size > 0) {
    for (const exception of exceptions) {
      const exceptIndex = exceptMap[exception];
      if(exceptIndex === 5) tintedLens = 1; 
      const exceptEntry = exceptJSON.e[exceptIndex];
      if(exceptEntry.targets) { // Exceptions that don't modify effectivity have been set to `-1` in JSON
        for (const [inKey, targets] of Object.entries(exceptEntry.targets)) {
          for (const outKey of Object.keys(targets)) {
            // console.log(`${inKey},${outKey}`)
            exceptionMap.set(`${parseInt(inKey, 10)},${parseInt(outKey, 10)}`, exceptEntry);
          }
        }
      } else break;
    }
  };

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
        ? genJSON.s[inKey][outKey] // Offense: `Deals ${n}x to`; inKey –> outKey
        : genJSON.s[outKey][inKey]; // Defense: `Takes ${n}x from`; outKey –> inKey 
      totalMult *= effectMult;

      // CURRENT IDEA for applying exception 3/4/2025
      const exception = exceptionMap.get(`${inKey},${outKey}`);
      if(exception) {
        totalMult = exception.replace === 1 ? exception.mult : totalMult * exception.mult;
      }
    }

    const typeName = typeNames[outKey]; // need type string for targeted types
    switch(totalMult) {
      case 8:
        effectMults.get("8x").add(typeName);
        break;
      case 4:
        effectMults.get("4x").add(typeName);
        break;
      case 3:
        effectMults.get("3x").add(typeName);
        break;
      case 2:
        effectMults.get("2x").add(typeName);
        break;
      case 1.5:
        effectMults.get("1.5x").add(typeName);
        break;
      case 1:
        effectMults.get("1x").add(typeName);
        break;
      case 0.75:
        effectMults.get("0.75x").add(typeName);
        break;
      case 0.5:
        effectMults.get(tintedLens ? "1x" : "0.5x").add(typeName);
        break;
      case 0.25:
        effectMults.get("0.25x").add(typeName);
        break;
      case 0.125:
        effectMults.get("0.125x").add(typeName);
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

/* ---------------------------------------------------------------------------------------------------------------- */
/* ----- INITIALIZATION FUNCTIONS – Functions that combine all of the above to provide interactivity for users and help determine application state. ----- */

/**
 * Initializes the event listeners for the type selection buttons on the "offense" and "defense" pages, manages type visibility, selection logic for primary and secondary types, and updates the application state based on user interactions.
 * 
 * @async
 * @returns {Promise<void>} - A promise that resolves when the initial page state of "offense" or "defense" has finished initial type calculations and display.
 */
const initTypeButtons = async () => {
  console.log(`Mode: ${mode}`);
  console.log(`Gen: ${gen}`);
  genJSON = await loadGenerationData(gen);
  exceptJSON = await loadExceptions();

  const primaryContainer = document.querySelector(".primary-types");
  typeVisibility(primaryContainer, gen);
  // if(!primaryContainer) return; // ".type-buttons" doesn't exist in index.html on initial page load, so the first try for initializing always fails. skip it.
  const secondaryContainer = document.querySelector(".secondary-types");

  // console.log("Initializing type buttons...");
  // // Clear previous event listeners to prevent duplicates -- htmx swap results in this already
  // primaryContainer.replaceChildren(...primaryContainer.cloneNode(true).childNodes);
  // secondaryContainer?.replaceChildren(...secondaryContainer.cloneNode(true).childNodes);

  // Event Delegation: button clicks add/remove types to/from calculations
  primaryContainer.addEventListener("click", async (e) => {
      const button = e.target.closest("button");
      if(!button || !button.dataset.type) return;

      const type = button.dataset.type;

      // Container only allows one type selection at a time
      // `selectedTypes` may have more than 1 type, but not duplicates
      // Must check for secondary type grid
      if(selectedTypes.has(type)) {
        // if(secondaryContainer?.querySelector(`button[data-type="${type}"].selected`)) {
        if(lastSecondarySelected?.dataset.type === type) {
          // Secondary Container exists and the type is selected in it
          // clear the Set and add the selected type
          selectedTypes.clear();
          selectedTypes.add(type);
          
          // remove all selections from both containers
          lastPrimarySelected.classList.remove("selected");
          lastSecondarySelected?.classList.remove("selected");
          // update type selection in Primary Container
          button.classList.add("selected");
          lastPrimarySelected = button;
          lastSecondaryDisabled.disabled = false;
          lastSecondaryDisabled = secondaryContainer.querySelector(`button[data-type="${type}"]`);
          lastSecondaryDisabled.disabled = true;
        } else return;
      } else {
        // Selecting a new type in Primary Container
        if(secondaryContainer) {
          // Remove ONLY the existing primary type from `selectedTypes`
          selectedTypes.forEach((existingType) => {
            // `selectedTypes` contains one type previously selected in each container
            if(primaryContainer.querySelector(`button[data-type="${existingType}"].selected`)) {
              console.log(`Removing ${existingType}`);
              selectedTypes.delete(existingType);
            }
          });
          if(lastSecondaryDisabled) lastSecondaryDisabled.disabled = false;
          // moveTypeDisable(primaryContainer, secondaryContainer, type);
          lastSecondaryDisabled = secondaryContainer.querySelector(`button[data-type="${type}"]`);
          lastSecondaryDisabled.disabled = true;
        } else {
          // No secondary container, clear is faster
          selectedTypes.clear();
        }
        // Remove selection from selected primary type button
        lastPrimarySelected.classList.remove("selected");
        selectedTypes.add(type);
        button.classList.add("selected");
        lastPrimarySelected = button;
      }
    getTypeRelationship(selectedTypes, mode, gen, exceptions);
    return updateSelections(primaryContainer, secondaryContainer);
  });

  // Additional initialization for "defense.html"
  if(secondaryContainer) {
    typeVisibility(secondaryContainer, gen);
    secondaryContainer.addEventListener("click", async (e) => {
        const button = e.target.closest("button");
        if(!button || !button.dataset.type) return;

        const type = button.dataset.type;

        // If type is selected in primary container, we don't want to allow selecting it in secondary container
        // Shouldn't be selectable, further logic needed.
        if (lastPrimarySelected.getAttribute("data-type") === type) {
          console.log(`${type} is primary.`);
          clearSelections(secondaryContainer, selectedTypes);
          console.log(`Skipping secondary ${type} addition.`)
          getTypeRelationship(selectedTypes, mode, gen, exceptions);
          return updateSelections(primaryContainer, secondaryContainer);
        }

        // Container only allows one type selection at a time
        // `selectedTypes` may have more than 1 type, but not duplicates
        if(selectedTypes.has(type) && button.classList.contains("selected")) {
          // type is already the selected secondary, deletion of secondary allowed
          selectedTypes.delete(type);
          button.classList.remove("selected");
          lastSecondarySelected = null; // clear to prevent errors in optional chaining conditionals
          // console.log(`Secondary ${type} deleted.`)
        } else {
          // Doesn't match current primary or secondary type
          // Delete the type that is "selected" in Secondary Container from `selectedTypes` if it exists
          clearSelections(secondaryContainer, selectedTypes);

          // console.log(`Secondary ${type} added.`);
          selectedTypes.add(type);
          button.classList.add("selected");
          lastSecondarySelected = button;
        }
      getTypeRelationship(selectedTypes, mode, gen, exceptions);
      return updateSelections(primaryContainer, secondaryContainer);
    });
  };

  // Initial selectedTypes and button selection handling
  // If the generation has changed or the user is not returning to the previous page, clear selectedTypes and exceptions. (cache has already been cleared, so no need)
  if(genChange || mode !== prevMode) {
    // console.log(`Clearing selectedTypes because genChange: ${genChange} or different mode.`)
    // clear if new generation or "offense" <--> "defense" nav
    selectedTypes.clear();
    selectedTypes.add("normal");
    primaryContainer.querySelector(`button[data-type="normal"]`).classList.add("selected");
    lastSecondaryDisabled = secondaryContainer?.querySelector(`button[data-type="normal"]`);
    if(lastSecondaryDisabled) lastSecondaryDisabled.disabled = true;
    exceptions.clear();
  } else {
    // Otherwise the cache hasn't been cleared, so the proper reassignments need to occur for this page render
    if(mode === "defense") {
      for(const type of selectedTypes) {
        // if type has an association with a special move and the move is currently in exceptions, treat as if the move is being selected now
        const sdMove = moveByType.get(type);
        if(sdMove && exceptions.has(sdMove)) {
          console.log("exception found in initialization")
          lastMoveSelected = document.querySelector(`button[data-move="${sdMove}"]`);
  
          lastMoveSelected.classList.add("selected");

          moveTypeDisable(primaryContainer, secondaryContainer, type, true);
  
          // primaryContainer.querySelector(`button[data-type="${type}"]`).disabled = true;
          // lastSpecialDisabled = secondaryContainer.querySelector(`button[data-type="${type}"]`)
          // lastSpecialDisabled.disabled = true;
        } else {
          let button;
          if(lastPrimarySelected.dataset.type === type || !lastPrimarySelected) {
            button = primaryContainer.querySelector(`button[data-type="${type}"]`);
            if(!button) continue;
            lastPrimarySelected = button;
            lastSecondaryDisabled = secondaryContainer.querySelector(`button[data-type="${type}"]`);
            if(lastSecondaryDisabled) lastSecondaryDisabled.disabled = true;
          } else {
            button = secondaryContainer.querySelector(`button[data-type="${type}"]`);
            if(!button) continue;
          }
          button.classList.add("selected");
        }
      }
    } else {
      for(const type of selectedTypes) {
        const soMove = moveByType.get(type);
        if(soMove && exceptions.has(soMove)) {
          console.log("special offensive move found in initialization");
          lastPrimarySelected = primaryContainer.querySelector(`button[data-type="${type}"]`);
          lastPrimarySelected.classList.add("selected");

          lastMoveSelected = document.querySelector(`button[data-move="${soMove}"]`);
          lastMoveSelected.classList.add("selected");

          primaryContainer.querySelectorAll("button").forEach((btn) => {
            btn.disabled = true;
          });
        } else {
          if(type === "flying") {
            continue;
          } else {
            const button = primaryContainer.querySelector(`button[data-type="${type}"]`);
            if(!button) continue;
    
            button.classList.add("selected");
          }
        }
      }
    }
  }

  // Reset state flags
  genChange = false;
  prevMode = mode;
  
  // Prep currently selected button types for replacement if they exist
  // No secondary on initial page load (but caching type selections will be implemented)
  lastPrimarySelected = primaryContainer.querySelector("button.selected");
  lastSecondarySelected = secondaryContainer?.querySelector("button.selected");

  // console.log(`Initializing ${mode} exceptions...`);

  if(mode === "defense") {
    initDefenseExceptions(primaryContainer, secondaryContainer);
  } else {
    initOffenseExceptions(primaryContainer);
  }

  // Currently 'normal' type is selected upon initialization, display relevant results
  // console.log(`Getting initial type relationships on ${mode} for gen ${gen}...`);
  getTypeRelationship(selectedTypes, mode, gen, exceptions);
  return updateSelections(primaryContainer, secondaryContainer);
};

/**
 * Initializes the event listeners and logic for managing exceptions related to offense mode.
 * 
 * @param {HTMLElement} primaryContainer - The container element containing primary type buttons
 * @param {HTMLElement} secondaryContainer - The container element containing secondary type buttons
 */
// CONSIDER: secondaryContainer never exists on offense page. How should updateSelections be defined because of this fact?
const initOffenseExceptions = (primaryContainer) => {
  const allButtons = [
    ...primaryContainer.querySelectorAll("button"),
  ];
  
  const moves = document.querySelector(".special-moves-o");
  const effects = document.querySelector(".special-effects");

  moves.addEventListener("click", async (e) => {
    const button = e.target.closest("button");
    if(!button || !button.dataset.move) return;
    
    const move = button.dataset.move;
    // console.log(move);

    if(exceptions.has(move)) {
      exceptions.delete(move);
      button.classList.remove("selected");
      lastMoveSelected = null;
      
      // Only flying_press has a second damage type to be deleted
      if(move === "flying_press") {
        selectedTypes.delete("flying");
      }

      // enableAllTypeButtons()
      allButtons.forEach(button => button.disabled = false);

      // // Clear type selection from primaryContainer
      // lastPrimarySelected?.classList.remove("selected");
      // lastPrimarySelected = null;
    } else {
      if(lastMoveSelected) {
        const lastMoveName = lastMoveSelected.dataset.move;
        exceptions.delete(lastMoveName);
        lastMoveSelected.classList.remove("selected");

        // if(lastMoveName === "flying_press") {
        //   selectedTypes.delete("flying");
        // }
      }

      exceptions.add(move);
      button.classList.add("selected");
      lastMoveSelected = button;

      // if(typeByMove.get(move)) {
      const mType = typeByMove.get(move);
      // console.log('valid move type')
      selectedTypes.clear();
      selectedTypes.add(mType);
      // only flying press targets an additional entire type
      if(move === "flying_press") {
        selectedTypes.add("flying");
      }

      // Highlight corresponding type in primaryContainer
      lastPrimarySelected?.classList.remove("selected");
      const moveTypeButton = primaryContainer.querySelector(`button[data-type="${mType}"]`);
      if(moveTypeButton) {
        moveTypeButton.classList.add("selected");
        lastPrimarySelected = moveTypeButton;
      }
      // }

      //disableAllTypeButtons()
      allButtons.forEach(button => button.disabled = true);
    };
    getTypeRelationship(selectedTypes, mode, gen, exceptions);
    return updateSelections(primaryContainer);
  });

  effects.addEventListener("change", async (e) => {
    const checkbox = e.target.closest(".effect-checkbox");
    if(!checkbox) return;
    const effect = checkbox.value;
    // console.log(effect);

    if(checkbox.checked) {
      exceptions.add(effect);
    } else {
      exceptions.delete(effect);
    };
    getTypeRelationship(selectedTypes, mode, gen, exceptions);
    return updateSelections(primaryContainer);
  });

  lastMoveSelected = moves.querySelector("button.selected") || null;
};

/**
 * Initializes the event listeners and logic for managing exceptions related to defense mode.
 * 
 * @param {HTMLElement} primaryContainer - The container element containing primary type buttons
 * @param {HTMLElement} secondaryContainer - The container element containing secondary type buttons
 */
const initDefenseExceptions = (primaryContainer, secondaryContainer) => {
  const moves = document.querySelector(".special-moves-d");
  const effects = document.querySelector(".special-effects");
  const teraContainer = document.querySelector(".tera-types");

  moves.addEventListener("click", async (e) => {
    const button = e.target.closest("button");
    if(!button || !button.dataset.move) return;

    const move = button.dataset.move;

    if(exceptions.has(move)) {
      exceptions.delete(move);
      
      const mType = typeByMove.get(move);

      if(lastMoveSelected) {
        lastMoveSelected.classList.remove("selected");
        lastMoveSelected = null;
      }
      if(lastPrimarySelected?.dataset.type !== mType && lastSecondarySelected?.dataset.type !== mType) {
        selectedTypes.delete(mType);
      }
      moveTypeEnable(primaryContainer, secondaryContainer, mType, true);
    } else {
      const mType = typeByMove.get(move);
      if(lastMoveSelected) {
        const lastType = typeByMove.get(move);
        const lastMoveName = lastMoveSelected.dataset.move;
        exceptions.delete(lastMoveName);
        lastMoveSelected.classList.remove("selected");
        if(selectedTypes.has(lastType)) {
          selectedTypes.delete(lastType);
          moveTypeEnable(primaryContainer, secondaryContainer, lastType, true)
        }
      }

      exceptions.add(move);
      lastMoveSelected = button;
      if(lastPrimarySelected?.dataset.type !== mType && lastSecondarySelected?.dataset.type !== mType) {
        selectedTypes.add(mType);
      }
      lastMoveSelected.classList.add("selected");
      moveTypeDisable(primaryContainer, secondaryContainer, mType, true);
    };
    getTypeRelationship(selectedTypes, mode, gen, exceptions);
    return updateSelections(primaryContainer, secondaryContainer);
  });

  lastMoveSelected = moves.querySelector("button.selected") || null;
};

/**
 * Initializes the event listeners for generation selection.
 */
const initGenButtons = async () => {
  const genContainer = document.querySelector(".gen-selection");
  if(!genContainer) {
    console.log("Gen Selection container not found.");
    return;
  }

  // console.log("Gen buttons found, attaching event listener.");

  genContainer.querySelectorAll("button").forEach(button => {
    button.classList.toggle("selected", button.dataset.gen === gen);
  });

  clearCache = false;

  // One event listener for the container
  genContainer.addEventListener("click", async (e) => {
    const button = e.target.closest("button");
    if(!button || !button.dataset.gen) return;

    const newGen = button.dataset.gen;
    if(newGen === gen) return;

    // Clear cache first time generation changes
    if(!genChange) {
      // console.log("clearing effectivenessCache on gen change")
      effectivenessCache.forEach(set => set.clear());
      clearCache = true;
      prevMode = null; // remove prevMode reference since its use is to prevent cache clearing upon returning to "offense" or "defense" from "more"
    }
    genChange = true; // flag used to simplify initial offense/defense page interaction with selectedTypes

    genContainer.querySelector(".selected")?.classList.remove("selected");

    gen = newGen;
    localStorage.setItem("selectedGen", gen);
    button.classList.add("selected");

    // console.log(`Gen changed to ${gen}.`);
  });
  // Set initial selected button
  genContainer.querySelector(`button[data-gen="${gen}"]`)?.classList.add("selected");
};