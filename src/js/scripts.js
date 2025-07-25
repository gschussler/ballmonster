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
  updateGenDisplay();
  if(mode !== "more") {
    // clear effectMults and multOrder entirely if destination is "offense" or "defense"
    effectMults.clear();
    multOrder = new LinkedList();
    typeVisibility();
    const { primaryContainer, secondaryContainer } = await initInput();
    await SearchController.init(mode, gen, {
      primaryContainer,
      secondaryContainer
    });
  } else {
    await initGenSelect();
    await SearchController.init(mode, gen);
    restoreSummaryState();
    initSummaryState();
  };
  // console.log('[HTMX] afterSwap:', e.detail);
});

/**
 * Intercepts htmx requests to prevent unnecessary navigation and to manage clearing the result cache if generation hasn't changed between pages.
 * 
 * @listens htmx:beforeRequest
 * @param {Event} e - The event object for the htmx swap event
 */
document.addEventListener("htmx:beforeRequest", (e) => {
  const requestedMode = e.detail.elt?.id;

  if(requestedMode === mode) { // Prevent htmx request if user is already on the selected page
    // console.log(`Already on "${requestedMode}" page. Preventing unnecessary request.`);
    e.preventDefault();
    // return;
  } else if(!genChange) { // Clear cache if navigating between "offense" and "defense" pages or navigating away from "more" to a different page than previous.
    if(requestedMode !== prevMode && requestedMode !== "more") {
      // console.log(`Heading to "offense" or "defense" page. Not prevMode, so clearing cache...`)
      effectCache.clear();
      clearCache = true;
    }
  }
  // console.log('[HTMX] beforeRequest:', e.detail);
});

/**
 * Handles navigation link clicks to update the application's mode, aligning with expected swap triggers for htmx
 * 
 * @listens Event#click
 * @param {PointerEvent} e - The click event object.
 */
// Listen for clicks on navigation links to update the mode
document.querySelector("nav").addEventListener("click", (e) => {
  const link = e.target.closest("a");
  if(link && link.id) {
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

    // console.log(`Mode updating from ${mode} to: ${newMode}`);
    prevMode = mode;
    mode = newMode;
  }
});

// document.addEventListener('htmx:beforeSwap', (e) => {
//   if(prevMode === "more") {
//     saveSummaryState();
//   }
// });

// const initDropdowns = (main = document) => {
//   const dropdownLists = main.querySelectorAll(".dropdown-list");
//   dropdownLists.forEach(dropdownList => {
//     initDropdownList(dropdownList);
//   });
// };
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

let oAbility = "";
let dAbility = "";
let teraResult = false;

const summaryState = 'summaryDropdownState';

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
  "flash-fire-atk", "scrappy", "tinted-lens", "flying-press", "freeze-dry", "thousand-arrows", "water-bubble-atk",
  // Defense exceptions (Gen-ascending)
  "flash-fire-def", "levitate", "lightning-rod", "thick-fat", "volt-absorb", "water-absorb", "wonder-guard", "dry-skin", "filter", "heatproof", "motor-drive", "storm-drain", "sap-sipper", "delta-stream", "fluffy", "water-bubble-def", "earth-eater", "purifying-salt", "tera-shell", "well-baked-body", "forests-curse", "trick-or-treat"
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
  "flying-press": "fighting",
  "freeze-dry": "ice",
  "thousand-arrows": "ground"
};

/**
 * Maps target Pokémon types to special moves.
 * @constant {Object<string, string>}
 */
const dTypeMove = {
  "grass": "forests-curse",
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

/**
 * Maps generation labels to the number of Pokémon types available in that generation.
 * @constant {Object<string, number>}
 */
const genTypeCounts = {
  "1": 15,
  "2-5": 17,
  "6+": 19,
};

/**
 * Maps maximum generation numbers to their respective range label.
 * @constant {Object<string, number>}
 */
const genMaxNum = {
  "1": 1,
  "2-5": 5,
  "6+": Infinity
};

/**
 * Maps type effectiveness multipliers to sets of Pokémon types.
 * Populated dynamically by monotype relationship calculations (`getEffectiveness` operations).
 * @type {Map<string, Set<string>>}
 */
const effectMults = new Map();

/**
 * Stores effectiveness results to prevent redundant calculations.
 * @type {Map<string, Set<string>>}
 */
const effectCache = new Map();

class ListNode {
  constructor(mult) {
    this.mult = mult;
    this.next = null;
  }
}

class LinkedList {
  constructor() {
    this.head = null; // largest mult
  }

  /**
   * Inserts a new multiplier in sorted (descending) order.
   * @param {number} mult - The multiplier value.
   * @returns {ListNode} - The inserted or existing node.
   */
  insert(mult) {
    let newNode = new ListNode(mult);

    // empty list or new highest mult
    if(!this.head || this.head.mult < mult) {
      newNode.next = this.head;
      this.head = newNode;
      return newNode;
    }

    let current = this.head;
    while (current.next && current.next.mult > mult) {
      current = current.next;
    }

    // if mult already exists, return the existing node. shouldn't be possible to reach in current implementation
    if(current.next && current.next.mult === mult) {
      return current.next;
    }

    // insert the new node in order
    newNode.next = current.next;
    current.next = newNode;

    return newNode;
  }

  /**
   * Finds the node with the given multiplier.
   * @param {number} mult - The multiplier value.
   * @returns {ListNode|null} - The node if found, otherwise null.
   */
  find(mult) {
    let current = this.head;
    while (current) {
      if(current.mult === mult) return current;
      current = current.next;
    }
    return null;
  }
}

// create the linked list that keeps track of multiplier order
let multOrder = new LinkedList();

const addToEffectMults = (mult, typeName) => {
  if(!effectMults.has(mult)) {
    effectMults.set(mult, new Set());
    multOrder.insert(mult);
  }

  effectMults.get(mult).add(typeName);
};
/* ---------------------------------------------------------------------------------------------------------------- */
/* ----- JSON data loaders – Provide Pokemon type relationship data by generation as well as special type exception data ----- */
const generationDataCache = {};
let exceptionDataCache = null;
const searchDataCache = {
  offense: {},
  defense: {},
};

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
  // const cachedData = localStorage.getItem(`genData_${gen}`);
  // if(cachedData) {
  //   return JSON.parse(cachedData);
  // }
  if(generationDataCache[gen]) {
    return generationDataCache[gen];
  }

  const genData = {
    "1": "/json/gen1.json",
    "2-5": "/json/gen2-5.json",
    "6+": "/json/gen6+.json",
  };

  try {
    const res = await fetch(genData[gen]);
    if(!res.ok) {
      throw new Error(`Failed to fetch data for generation ${gen}.`);
    }
    const data = await res.json();
    generationDataCache[gen] = data;
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
  if(exceptionDataCache) {
    return exceptionDataCache;
  }

  try {
    const res = await fetch("/json/exceptions.json");
    if(!res.ok) {
      throw new Error("Failed to fetch data for exceptions.");
    }
    const data = await res.json();
    exceptionDataCache = data;
    return data; // target the exception array
  } catch (error) {
    console.error("Error loading exceptions data:", error);
    return {};
  }
};

const loadSearchSlice = async (mode, gen) => {
  const cache = searchDataCache[mode];

  if(cache[gen]) {
    return cache[gen];
  }

  const fileMap = {
    offense: {
      "1": "/json/gen1_move_search.json",
      "2-5": "/json/gen2-5_move_search.json",
      "6+": "/json/gen6+_move_search.json"
    },
    defense: {
      "1": "/json/gen1_mon_search.json",
      "2-5": "/json/gen2-5_mon_search.json",
      "6+": "/json/gen6+_mon_search.json"
    }
  };

  try {
    const res = await fetch(fileMap[mode][gen]);
    if (!res.ok) throw new Error(`Failed to load ${mode} search data for gen ${gen}`);
    const data = await res.json();

    cache[gen] = data;
    return data;
  } catch (error) {
    console.error(`Error loading ${mode} search data:`, error);
    return [];
  }
};

const flattenData = (nestedData) => nestedData.flat();

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
const typeVisibility = () => {
  const primaryContainer = document.querySelector(".primary-types");
  const secondaryContainer = document.querySelector(".secondary-types");
  
  const btns = primaryContainer.querySelector(".button-grid").children;

  for(let i = 15; i < btns.length; i++) {
    btns[i].style.display = genTypeCounts[gen] > i ? "block" : "none";
  }

  if(secondaryContainer) {
    const sbtns = secondaryContainer.querySelector(".button-grid").children;

    for(let i = 15; i < sbtns.length; i++) {
      sbtns[i].style.display = genTypeCounts[gen] > i ? "block" : "none";
    }
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
  container1.querySelector(`button[data-type="${moveType}"]`).disabled = true;
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
  // console.log(newEffectMults)
  if(clearCache) {
    newEffectMults.forEach((newSet, mult) => {
      if(!effectCache.has(mult) || !setsEqual(newSet, effectCache.get(mult))) {
        // Update only when necessary
        effectCache.set(mult, new Set(newSet));
        updateDOM(mult, newSet);
      }
    });
  } else { // clearCache flag used when applying the uncleared cache to the DOM (useful for render on the way to previous page)
    newEffectMults.forEach((newSet, mult) => {
        effectCache.set(mult, new Set(newSet));
        updateDOM(mult, newSet);
    });
  }
};

/**
 * Updates the DOM to reflect effectiveness changes.
 * @param {number} mult - The effectiveness multiplier.
 * @param {Set<string>} typeSet - The set of types corresponding to the multiplier.
 */
const updateDOM = (mult, typeSet) => {
  const resGroupsContainer = document.querySelector(".result-groups");
  let resGroup = document.getElementById(`${mult}`);

  // create the result group for the typeSet if it doesn't exist yet
  if(!resGroup) {
    resGroup = document.createElement("div");
    resGroup.classList.add("result-group");
    resGroup.id = `${mult}`;

    const header = document.createElement("h3");
    header.textContent = mode === "offense"
    ? `Deals ${mult}x to`
    : `Takes ${mult}x from`;
    const listEl = document.createElement("ul");
    
    resGroup.appendChild(header);
    resGroup.appendChild(listEl);

    // update resGroupsContainer DOM state with multOrder additions
    // check if this mult should be placed at the top of the container
    const currHighest = resGroupsContainer.firstChild;
    if(currHighest && parseFloat(currHighest.id) < mult) {
      // insert at the top if this mult is greater than the current highest
      resGroupsContainer.insertBefore(resGroup, currHighest);
    } else {
      // otherwise, insert in the correct position (or at the end)
      let node = multOrder.find(mult);
      let nextGroup = null;

      // traverse forward until we find the next existing DOM element
      while (node && node.next) {
        nextGroup = document.getElementById(`${node.next.mult}`);
        if(nextGroup) break; // stop once we find an existing element
        node = node.next;
      }

      // Insert in correct position or append at the end
      if(nextGroup) {
        resGroupsContainer.insertBefore(resGroup, nextGroup);
      } else {
        resGroupsContainer.appendChild(resGroup);
      }
    }
  }
  // clear and repopulate list even if result group ends up the same (reduces slowdowns from DOM access)
  const listEl = resGroup.querySelector("ul");
  listEl.innerHTML = "";

  typeSet.forEach(type => {
    if(type !== null) {
      const listItem = document.createElement("li");
      if(type !== "tera_pokemon") {
        listItem.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        listItem.setAttribute("data-type", type);
        listEl.classList.remove("tera-list");
      } else {
        listItem.textContent = "Tera Pokemon";
        listItem.setAttribute("data-type", "tera");
        listItem.classList.add("tera-item");
        listEl.classList.add("tera-list");
      }
      listEl.appendChild(listItem);
    }
  });

  // hide unused result groups
  resGroup.style.display = typeSet.size > 0 ? "grid" : "none";
};

const updateGenDisplay = () => {
  let genDisplay = document.getElementById("gen");
  if(genDisplay) {
    genDisplay.textContent = gen;
  }
};

const renderResults = (results) => {
  const container = document.getElementById("search-results");
  if(!container) return;

  if(!results.length) {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }

  const resultHTML = results
    .slice(0, 10) // limit visible results
    .map(result => `<div class="search-result">${result.item.n}</div>`)
    .join("");

  container.innerHTML = resultHTML;
  container.classList.remove("hidden");
};

const saveSummaryState = () => {
  const state = {};
  document.querySelectorAll('.info-sections details').forEach(detail => {
    state[detail.id] = detail.open;
  });
  sessionStorage.setItem(summaryState, JSON.stringify(state));
};

const restoreSummaryState = () => {
  const state = JSON.parse(sessionStorage.getItem(summaryState) || '{}');
  document.querySelectorAll('.info-sections details').forEach(detail => {
    const isOpen = state[detail.id];
    const summaryIcon = detail.querySelector('summary svg use');

    if (isOpen) {
      detail.setAttribute('open', '');
      if (summaryIcon) {
        summaryIcon.setAttribute('href', '/svg/icons.svg#minus');
      }
    } else {
      detail.removeAttribute('open');
      if (summaryIcon) {
        summaryIcon.setAttribute('href', '/svg/icons.svg#plus');
      }
    }
  });
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
  // let res = mode === "offense" ? "effectiveness" : "resistances";
  // Update effectiveness sublists with the results
  // console.log(`Checking ${res} of ${[...types]}`);
  // if(exceptions.size > 0) console.log(`...with ${[...exceptions]} applied`);
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
  // console.log(inTypes);
  // Clear the Map before processing new data
  effectMults.forEach(set => set.clear());
  // console.log(`Effectiveness of ${[...inTypes]}`)
  const outKeys = genTypeCounts[gen]; // Limit looping through types based on generation

  // If there are exceptions, only check type relationships that the exceptions apply to
    // some exceptions have unique interactions that require checks during result group placement
  const exceptionMap = new Map();
  const postProcessExceptAll = []; // if exceptions will target all types once they are already grouped, push them here
  if(exceptions.size > 0) {
    for (const exception of exceptions) {
      const exceptIndex = exceptMap[exception];
      const exceptEntry = exceptJSON.e[exceptIndex];
      if(exceptEntry.after === 1) {
        postProcessExceptAll.push(exceptEntry); // push except index to avoid pushing the whole object
        continue;
      }
      if(exceptEntry.targets) { // Exceptions that don't modify effectivity have been set to `-1` in JSON
        if(exceptEntry.targets["any"]) {
          // Special case for general "any" type exceptions that rely on outKey only (in defense mode)
          for (const outKey of Object.keys(exceptEntry.targets["any"])) {
            exceptionMap.set(`any,${parseInt(outKey, 10)}`, exceptEntry);
          }
        }
        
        // Generic exception case that relies on both inKey and outKey
        for (const [inKey, targets] of Object.entries(exceptEntry.targets)) {
          for (const outKey of Object.keys(targets)) {
            // console.log(`${inKey},${outKey}`)
            exceptionMap.set(`${parseInt(inKey, 10)},${parseInt(outKey, 10)}`, exceptEntry);
          }
        }
      }
      // } else break;
    }
  };

  // Loop through all Pokemon types in the current generation to output their effectiveness relationships
    // mode === "offense" –> selected ATK types are `inKeys`, opposing Pokemon DEF types are `outKeys`
    // mode === "defense" -> selected DEF types are `inKeys`, opposing Pokemon ATK types are `outKeys`
  for (let outKey = 0; outKey < outKeys; outKey++) {
    let totalMult = 1;
    let stellarInKey = false;
    let inKey;

    // Process input types to get their effectiveness relationship with output types
    for (const type of inTypes) {
      inKey = typeMap[type];
      if(inKey === 18) {
        stellarInKey = true;
        // console.log(`stellar is inKey ${inKey} at outKey ${outKey}`)
      }
      // if(inKey === undefined) continue; // ignore invalid types
      const effectMult = mode === "offense"
        ? genJSON.s[inKey][outKey] // Offense: `Deals ${n}x to`; inKey –> outKey
        : genJSON.s[outKey][inKey]; // Defense: `Takes ${n}x from`; outKey –> inKey

      totalMult *= effectMult;

      // modify totalMult if an exception has a direct effect on it
      let exception = exceptionMap.get(`${inKey},${outKey}`);
      let anyException = null;

      // check for the "any" case for defense exceptions
      if(mode !== "offense" && exceptionMap.has(`any,${outKey}`)) {
        // console.log(`"any" exception found`)
        anyException = exceptionMap.get(`any,${outKey}`);
      }
      
      if(exception) {
        // apply the specific exception first
        totalMult = exception.replace === 1 ? exception.mult : totalMult * exception.mult;
      }
      
      if(anyException) {
        // Apply the "any" exception after the specific exception
        const target = anyException.targets["any"][outKey.toString()];
        if(target) {
          // console.log("valid target for 'any' exception?")
          totalMult = target.replace === 1 ? target.mult : totalMult * target.mult;
        } else {
          totalMult = anyException.replace === 1 ? anyException.mult : totalMult * anyException.mult;
        }
      }
    };

    // Apply post-processing exceptions AFTER effectiveness is determined
    for (const exceptEntry of postProcessExceptAll) {
      if(exceptEntry.group) {
        if(!exceptEntry.replace) {
          totalMult *= exceptEntry.mult; // Filter or Tinted Lens
        } else {
          totalMult = exceptEntry.mult; // Wonder Guard
        }
      } else {
        if(totalMult !== 0) {
          totalMult = exceptEntry.mult; // Tera Shell
        }
      }
    }

    /** 
     * Stellar Considerations (on Offense):  
        - Stellar has no defensive property. In its place is `Tera Pokemon`, which is only present in results if Stellar is within selectedTypes (is selected).
          - Hide from results if any other type is selected. (NOTE: Current logic needs effectMults and effectCache to be the same size to prevent clearing). Possible solutions:
            - Allow calculations, but prevent display of `Tera Pokemon`. Change is somewhere in update effectiveness...
            - Do not hide Stellar, explicitly add `Tera Pokemon` to `2x` effectMults Set when inKey = 18 and outKey = 18
    */

    /**
     * Tera Considerations (on Defense):
     * - Stellar has 1x effectivity against all other types except Tera Pokemon (2x).
     * - Selecting a Tera Type should simply add `Stellar` to selectedTypes in order to reflect the 2x. No need to change logic here, just initDefenseExceptions logic to account for teraDropdown changes and initialization in case of cached tera type
     */
    let typeName = null;
    if(outKey === 18) {
      if(stellarInKey) {
        if(mode !== "defense") {
          typeName = "tera_pokemon"
        } else {
          typeName = typeNames[outKey];
        }
      } else if(mode !== "offense") {
        typeName = typeNames[outKey];
      }
    } else {
      typeName = typeNames[outKey]; // need type string for targeted types
    }
    
    // console.log(`${typeName}'s totalMult is...`)
    // console.log(totalMult);

    addToEffectMults(totalMult, typeName);
    
    // switch(totalMult) {
    //   case 8:
    //     effectMults.get("8x").add(typeName);
    //     break;
    //   case 4:
    //     effectMults.get("4x").add(typeName);
    //     break;
    //   case 3:
    //     effectMults.get("3x").add(typeName);
    //     break;
    //   case 2:
    //     effectMults.get("2x").add(typeName);
    //     break;
    //   case 1.5:
    //     effectMults.get("1.5x").add(typeName);
    //     break;
    //   case 1:
    //     effectMults.get("1x").add(typeName);
    //     break;
    //   case 0.75:
    //     effectMults.get("0.75x").add(typeName);
    //     break;
    //   case 0.5:
    //     effectMults.get("0.5x").add(typeName);
    //     break;
    //   case 0.25:
    //     effectMults.get("0.25x").add(typeName);
    //     break;
    //   case 0.125:
    //     effectMults.get("0.125x").add(typeName);
    //     break;
    //   case 0:
    //     effectMults.get("0x").add(typeName);
    //     break;
    //   default:
    //     throw new Error(`Invalid effectiveness multiplier: ${totalMult}`);
    // }
    // if(typeName === null) // Allow null type into effectMults to prevent stellar from displaying under certain conditions....
  }
  // console.log(effectMults);
  return effectMults;
};

const getRelevantData = (currGen) => {
  switch (currGen) {
    case "1":
      return ["1"];
    case "2-5":
      return ["2-5", "1"];
    case "6+":
      return ["6+", "2-5", "1"];
    default:
      return ["1"] // gen 1 fallback
  }
};

const loadSearchData = async (mode, gen) => {
  const genLoad = getRelevantData(gen);
  const loadedSlices = await Promise.all(genLoad.map(g => loadSearchSlice(mode, g)));
  return loadedSlices.flat();
};

/**
 * Handles primary type selection logic and updates application state accordingly.
 * 
 * Ensures that only one primary type is selected at a time. If a secondary container exists, it disables the same type in the secondary container to prevent duplicate selections. Updates the selectedTypes Set and manages button selection states.
 * 
 * @param {HTMLElement} button - The type button element that was clicked in the primary container.
 * @param {HTMLElement} primaryContainer - The container element holding the primary type buttons.
 * @param {HTMLElement} [secondaryContainer] - (Optional) The container element holding the secondary type buttons. If omitted, no secondary type disabling is applied.
 * 
 * @returns {void}
 */
const handlePrimarySelection = (button, primaryContainer, secondaryContainer) => {
  // const button = primaryContainer.querySelector(`button[data-type="${type}"]`);
  const type = button.dataset.type;
  if(!button) return;
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
          // console.log(`Removing ${existingType}`);
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
};

/**
 * Handles secondary type selection logic and updates the application state accordingly.
 * 
 * Prevents selecting the same type in both primary and secondary containers. Allows toggling the secondary type on or off and updates the selectedTypes Set and button selection states. Clears previous secondary selections before applying a new one.
 * 
 * @param {HTMLElement} button - The type button element that was clicked in the secondary container.
 * @param {HTMLElement} primaryContainer - The container element holding the primary type buttons.
 * @param {HTMLElement} secondaryContainer - The container element holding the secondary type buttons.
 * 
 * @returns {void}
 */
const handleSecondarySelection = (button, primaryContainer, secondaryContainer, fromSearch = false) => {
  // const button = secondaryContainer.querySelector(`button[data-type="${type}"]`);
  if(!button) return;
  const type = button.dataset.type;
  // If type is selected in primary container, we don't want to allow selecting it in secondary container
  // Shouldn't be selectable, further logic needed.
  if(lastPrimarySelected.getAttribute("data-type") === type) {
    console.log(`${type} is primary.`);
    clearSelections(secondaryContainer, selectedTypes);
    console.log(`Skipping secondary ${type} addition.`)
    refreshTypeResults(primaryContainer, secondaryContainer);
  }

  // Container only allows one type selection at a time
  // `selectedTypes` may have more than 1 type, but not duplicates
  if(selectedTypes.has(type) && button.classList.contains("selected")) {
    if(fromSearch) return;
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
};

/**
 * Handles defense type exceptions, including defensive special moves and Terastallization type changes.
 * 
 * For special defensive moves (`dMove` source), toggles move selection, adjusts the corresponding type in the selectedTypes Set, and enables/disables relevant type buttons.
 * For Terastallization (`dTera` source), replaces all selected types with the Tera type, disables further type selection, and adds the "stellar" type effect if applicable. 
 * 
 * @param {string} source - The source of the exception interaction. Either `"dMove"` for defensive special moves or `"dTera"` for Terastallization.
 * @param {HTMLElement|string} typeVar - Either the element containing move data or string containing the selected Tera type.
 * @param {HTMLElement} primaryContainer - The container element holding the primary type buttons.
 * @param {HTMLElement} secondaryContainer - The container element holding the secondary type buttons.
 * 
 * @returns {void}
 */
const handleDefenseException = (source, typeVar, primaryContainer, secondaryContainer) => {
  const allButtons = [
    ...primaryContainer.querySelectorAll("button"),
    ...secondaryContainer.querySelectorAll("button")
  ];

  const teraSelect = document.getElementById("tera-select");

  if(source === "dMove") {
    const container = typeVar;
    const move = typeVar.dataset.move;
    const mType = typeByMove.get(move);

    let pTypeDisabled;
    let sTypeDisabled;

    if(exceptions.has(move)) {
      exceptions.delete(move);
      
      let lastType;

      if(lastMoveSelected) {
        const lastMoveName = lastMoveSelected.dataset.move;
        lastType = typeByMove.get(lastMoveName);
        pTypeDisabled = primaryContainer.querySelector(`button[data-type=${lastType}]`);
        sTypeDisabled = secondaryContainer.querySelector(`button[data-type=${lastType}]`);

        lastMoveSelected.classList.remove("selected");
        lastMoveSelected = null;

        const teraOption = teraSelect.querySelector(`option[value="${lastType}"]`);
        if(teraOption) teraOption.disabled = false;
      }

      if(lastPrimarySelected?.dataset.type !== mType && lastSecondarySelected?.dataset.type !== mType) {
        selectedTypes.delete(mType);
      }

      if(!teraResult && pTypeDisabled.disabled === true && sTypeDisabled.disabled === true) {
        moveTypeEnable(primaryContainer, secondaryContainer, lastType, true);
      }
    } else {
      if(lastMoveSelected) {
        const lastMoveName = lastMoveSelected.dataset.move;
        lastType = typeByMove.get(lastMoveName);
        pTypeDisabled = primaryContainer.querySelector(`button[data-type=${lastType}]`);
        sTypeDisabled = secondaryContainer.querySelector(`button[data-type=${lastType}]`);
        exceptions.delete(lastMoveName);
        lastMoveSelected.classList.remove("selected");
        if(selectedTypes.has(lastType)) {
          selectedTypes.delete(lastType);
          if(!teraResult && pTypeDisabled.disabled === true && sTypeDisabled.disabled === true) {
            moveTypeEnable(primaryContainer, secondaryContainer, lastType, true);
          }
        }
        const teraOption = teraSelect.querySelector(`option[value="${lastType}"]`);
        if(teraOption) teraOption.disabled = false;
      }

      const teraOption = teraSelect.querySelector(`option[value="${mType}"]`);
      if(teraOption) teraOption.disabled = true;

      exceptions.add(move);
      lastMoveSelected = container;
      if(lastPrimarySelected?.dataset.type !== mType && lastSecondarySelected?.dataset.type !== mType) {
        selectedTypes.add(mType);
      }
      lastMoveSelected.classList.add("selected");
      moveTypeDisable(primaryContainer, secondaryContainer, mType, true);
    };
  } else { // source = 'dTera'
    /** 
    * Terastallization needs to result in a few things
    * - clear selectedTypes
    * - selected value is set as primaryContainer selection
    * - all type buttons are disabled
    * - add Stellar 2x effectivity to results (only interaction that Stellar has is super-effecitivity against Tera Pokemon)
    */
    const selectedType = typeVar;

    if(lastMoveSelected && selectedType === typeByMove.get(lastMoveSelected.dataset.move)) {
      console.log(`selectedType has the same type as ${lastMoveSelected.dataset.move}, so the selection did not succeed.`);
      return;
    }

    // if a type other than `""` is selected
    if(selectedType !== "") {
      // Clear secondary if selected
      if(lastSecondarySelected) {
        selectedTypes.delete(lastSecondarySelected.dataset.type);
        lastSecondarySelected.classList.remove("selected");
        lastSecondarySelected = null;
      }
      
      // any selection other than `""` disables all buttons since Tera Pokemon are monotype
      allButtons.forEach(button => {
        button.disabled = true;
      });

      // Clear primary if different from Tera type
      if(selectedType !== lastPrimarySelected.dataset.type) {
        selectedTypes.delete(lastPrimarySelected.dataset.type);
        lastPrimarySelected.classList.remove("selected");
      
        if(lastMoveSelected) { // all current exception moves include dual-typing
          const lastMoveType = typeByMove.get(lastMoveSelected.dataset.move);
          for(let type of selectedTypes) {
            if(type !== lastMoveType && type !== selectedType && type !== 'stellar') {
              selectedTypes.delete(type);
            }
          }
        }
          
        selectedTypes.add(selectedType);
        lastPrimarySelected = primaryContainer.querySelector(`button[data-type=${selectedType}]`);
        lastPrimarySelected.classList.add("selected");
      };
      
      // if not already present, add Stellar to calculations
      if(!teraResult) {
        selectedTypes.add("stellar");
      }

      teraResult = true;
    } else {
      // if default selected, renable all buttons as long as not interfering with special moves. lastPrimarySelected should keep its reference, so no need to clear selectedTypes
      allButtons.forEach(button => button.disabled = false);
      if(lastMoveSelected) {
        const lastMoveType = typeByMove.get(lastMoveSelected.dataset.move);
        moveTypeDisable(primaryContainer, secondaryContainer, lastMoveType, true);
      }
      // if present in selectedTypes, remove Stellar
      if(teraResult) {
        selectedTypes.delete("stellar");
      }
      teraResult = false;
    }
  };
  refreshTypeResults(primaryContainer, secondaryContainer);
};

/**
 * Handles offensive type exceptions by managing special damaging move selections.
 * 
 * Updates the selected types and button states based on the selected offensive move, including special handling for multi-type moves.
 * 
 * @param {HTMLElement} container - The button element representing the selected offensive move.
 * @param {HTMLElement} primaryContainer - The container element holding the primary type buttons.
 * 
 * @returns {void}
 */
const handleOffenseException = (container, primaryContainer) => {
  const allButtons = [
    ...primaryContainer.querySelectorAll("button"),
  ];

  const move = container.dataset.move;
  // console.log(move);

  if(exceptions.has(move)) {
    exceptions.delete(move);
    container.classList.remove("selected");
    lastMoveSelected = null;
    
    // Only flying-press has a second damage type to be deleted
    if(move === "flying-press") {
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

      // if(lastMoveName === "flying-press") {
      //   selectedTypes.delete("flying");
      // }
    }

    exceptions.add(move);
    container.classList.add("selected");
    lastMoveSelected = container;

    // if(typeByMove.get(move)) {
    const mType = typeByMove.get(move);
    // console.log('valid move type')
    selectedTypes.clear();
    selectedTypes.add(mType);
    // only flying press targets an additional entire type
    if(move === "flying-press") {
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
  refreshTypeResults(primaryContainer);
};

const handleMoveSearchSelection = (typeVar, primaryContainer, secondaryContainer) => {
  handlePrimarySelection(typeVar, primaryContainer, secondaryContainer);
};

// Need to account for edge cases unique to Mon selection before passing to handlers
  // Special Moves (forests curse and trick-or-treat)
    // if type is the same as special move, the special move is deactivated (moveTypeDisable)
  // Abilities
    // none involve type change, this should be acceptable
  // Tera type
    // clear teraResult, because otherwise changing Pokemon would do nothing
const handleMonSearchSelection = (typeVar, primaryContainer, secondaryContainer) => {
  const lastMove = lastMoveSelected ? lastMoveSelected.getAttribute("data-move") : null;

  if(teraResult) { // clear tera result since there is no point in keeping tera when selecting a new Pokemon
    const teraSelect = document.getElementById("tera-select");
    teraSelect.value = "";
    handleDefenseException("dTera", "", primaryContainer, secondaryContainer);
  }

  if(clearMonConflict(typeVar.primary, lastMove)) {
    handleDefenseException("dMove", lastMoveSelected, primaryContainer, secondaryContainer);
  }

  handlePrimarySelection(typeVar.primary, primaryContainer, secondaryContainer);

  if(typeVar.secondary) {
    if(clearMonConflict(typeVar.secondary, lastMove)) {
      handleDefenseException("dMove", lastMoveSelected, primaryContainer, secondaryContainer);
    }
    handleSecondarySelection(typeVar.secondary, primaryContainer, secondaryContainer, true);
  } else if(lastSecondarySelected) { // clear secondary if current Pokemon doesn't have one
    handleSecondarySelection(lastSecondarySelected, primaryContainer, secondaryContainer);
  }
};

const clearMonConflict = (monType, lastMove) => {
  return lastMove && dTypeMove[monType.dataset.type] === lastMove;
};

/**
 * Routes type or exception selections from interactive UI elements to their respective handlers.
 * 
 * Delegates processing based on the source of the interaction (e.g., type buttons, move exceptions, ability dropdowns).
 * 
 * @param {string} source - A label indicating the interaction source (e.g. "primary" or "secondary").
 * @param {HTMLElement} typeVar - The element containing type or exception data related to the source interaction.
 * @param {HTMLElement} primaryContainer - The container element holding the primary type buttons.
 * @param {HTMLElement} [secondaryContainer] - (Optional) The container element holding the secondary type buttons. If omitted, secondary type selection is disabled.
 * 
 * @async
 * @returns {Promise<void>} - A promise that resolves when the selection has been processed and the type results refreshed.
 */
const selectType = (source, typeVar, primaryContainer, secondaryContainer = null) => {
  // console.log(`enter select type from ${source} the type variable of '${typeVar}'`);
  switch (source) {
    case "primary":
      handlePrimarySelection(typeVar, primaryContainer, secondaryContainer);
      break;
    case "secondary":
      handleSecondarySelection(typeVar, primaryContainer, secondaryContainer);
      break;
    case "oException":
      handleOffenseException(typeVar, primaryContainer);
      break;
    case "dMove":
      handleDefenseException(source, typeVar, primaryContainer, secondaryContainer);
      break;
    case "dTera":
      handleDefenseException(source, typeVar, primaryContainer, secondaryContainer);
      break;
    case "mSearch":
      handleMoveSearchSelection(typeVar, primaryContainer, secondaryContainer);
      break;
    case "pSearch":
      handleMonSearchSelection(typeVar, primaryContainer, secondaryContainer);
      break;
    default:
      console.warn(`Unknown source: ${source}`);
      return;
  };
  refreshTypeResults(primaryContainer, secondaryContainer);
};

// clear selected types and reset globals
const initReset = (primaryContainer, secondaryContainer = null) => {
  const resetButton = document.getElementById("reset-button");
  resetButton.addEventListener("click", () => {
    window.scrollTo(0, 0);

    selectedTypes.clear();
    exceptions.clear();
    
    if(lastMoveSelected) {
      lastMoveSelected.classList.remove("selected");
    }


    // document.querySelectorAll("button:disabled").forEach(btn => btn.disabled = false);

    let abilitySelect;

    if(secondaryContainer) {
      const selectables = document.querySelector(".selectable-d");
      selectables.querySelectorAll("button:disabled").forEach(btn => btn.disabled = false);
      abilitySelect = document.getElementById("def-ability-select");
      abilitySelect.value = "";
      dAbility = "";

      if(gen === "6+" && teraResult) {
        const teraSelect = document.getElementById("tera-select");
        teraSelect.value = "";
        teraResult = null;
      }
      
      if(lastSecondarySelected) {
        lastSecondarySelected.classList.remove("selected");
        lastSecondarySelected = null;
      }
    } else {
      const selectables = document.querySelector(".selectable-o");
      selectables.querySelectorAll("button:disabled").forEach(btn => btn.disabled = false);
      abilitySelect = document.getElementById("atk-ability-select");
      abilitySelect.value = "";
      oAbility = "";
    }
    
    const defaultBtn = primaryContainer.querySelector('button[data-type="normal"');
    selectType("primary", defaultBtn, primaryContainer, secondaryContainer);
  });
};
/* ---------------------------------------------------------------------------------------------------------------- */
/* ----- INITIALIZATION FUNCTIONS – Functions that combine all of the above to provide interactivity for users and help determine application state. ----- */

/**
 * Initializes event listeners for various user input buttons, dropdowns, and searchbar. Manages type visibility, selection logic for primary and secondary types, and updates the application state based on user interactions.
 * 
 * @async
 * @returns {Promise<void>} - A promise that resolves when the initial page state of "offense" or "defense" has finished initial type calculations and display.
 */
const initInput = async () => {
  // console.log(`${mode}, gen ${gen}`);
  genJSON = await loadGenerationData(gen);
  exceptJSON = await loadExceptions();

  const primaryContainer = document.querySelector(".primary-types");
  // if(!primaryContainer) return; // ".type-buttons" doesn't exist in index.html on initial page load, so the first try for initializing always fails. skip it.
  const secondaryContainer = document.querySelector(".secondary-types");

  initTypeButtons(primaryContainer, secondaryContainer);

  // initSearchbar(primaryContainer, secondaryContainer);

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
      await initCachedResults(primaryContainer, secondaryContainer);
    } else {
      await initCachedResults(primaryContainer);
    }
  };

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
    initReset(primaryContainer, secondaryContainer);
  } else {
    initOffenseExceptions(primaryContainer);
    initReset(primaryContainer);
  }

  // Currently 'normal' type is selected upon initialization, display relevant results
  // console.log(`Getting initial type relationships on ${mode} for gen ${gen}...`);
  refreshTypeResults(primaryContainer, secondaryContainer);

  return { primaryContainer, secondaryContainer }; // SearchController needs references to containers
};

const refreshTypeResults = (primaryContainer, secondaryContainer = null) => {
  getTypeRelationship(selectedTypes, mode, gen, exceptions);
  // console.log(selectedTypes, exceptions);
  return updateSelections(primaryContainer, secondaryContainer);
};

/**
 * Initializes event listeners for the type selection buttons on the "offense" and "defense" pages.
 * 
 * Handles user interaction with primary and secondary type buttons in order to initiate type selection updates.
 * 
 * @param {HTMLElement} primaryContainer - The container element holding the primary type buttons.
 * @param {HTMLElement} [secondaryContainer] - (Optional) The container element holding the secondary type buttons. If omitted, secondary type selection is disabled.
 * @returns {void}
 */
const initTypeButtons = (primaryContainer, secondaryContainer) => {
  primaryContainer.addEventListener("click", async (e) => {
      const button = e.target.closest("button");
      if(!button || !button.dataset.type) return;
      selectType("primary", button, primaryContainer, secondaryContainer);
  });

  secondaryContainer?.addEventListener("click", async (e) => {
      const button = e.target.closest("button");
      if(!button || !button.dataset.type) return;
      selectType("secondary", button, primaryContainer, secondaryContainer);
  });
};

const initCachedResults = async (primaryContainer, secondaryContainer = null) => {
  // Handle non-move exceptions first (applies to both offense and defense)
  if(exceptions.size > 0) {
    // update ability if the currentAbility is a value other than "" in the cache
    const onDefense = mode === "defense";
    let abilitySelect;
    let currentAbility;
    if(onDefense) {
      abilitySelect = document.getElementById("def-ability-select");
      currentAbility = dAbility;
    } else {
      abilitySelect = document.getElementById("atk-ability-select");
      currentAbility = oAbility;
    }
    
    if(exceptions.has(currentAbility)) {
      abilitySelect.value = currentAbility;
    }
  }
  if(secondaryContainer) {
    for(const type of selectedTypes) {
      // if type has an association with a special move and the move is currently in exceptions, treat as if the move is being selected now
      const sdMove = moveByType.get(type);
      if(sdMove && exceptions.has(sdMove)) {
        // console.log("special defensive move found in initialization")
        lastMoveSelected = document.querySelector(`button[data-move="${sdMove}"]`);
        lastMoveSelected.classList.add("selected");

        moveTypeDisable(primaryContainer, secondaryContainer, type, true);

        // primaryContainer.querySelector(`button[data-type="${type}"]`).disabled = true;
        // lastSpecialDisabled = secondaryContainer.querySelector(`button[data-type="${type}"]`)
        // lastSpecialDisabled.disabled = true;
      } else if(teraResult && type !== "stellar") {
        // if a tera type had been selected before navigating away, reselect the relevant monotype
        // console.log("tera type found, selecting monotype...");
        lastPrimarySelected = primaryContainer.querySelector(`button[data-type="${type}"]`);
        lastPrimarySelected.classList.add("selected");

        const teraSelect = document.getElementById("tera-select");
        teraSelect.value = type;

        primaryContainer.querySelectorAll("button").forEach((btn) => {
          btn.disabled = true;
        });

        secondaryContainer.querySelectorAll("button").forEach((btn) => {
          btn.disabled = true;
        });
      } else {
        const fromPrimary = !lastPrimarySelected || lastPrimarySelected.dataset.type === type;
        const button = fromPrimary
          ? primaryContainer.querySelector(`button[data-type="${type}"]`)
          : secondaryContainer.querySelector(`button[data-type="${type}"]`);
        if(!button) continue;

        button.classList.add("selected");

        if(fromPrimary) {
          lastPrimarySelected = button;
          lastSecondaryDisabled = secondaryContainer.querySelector(`button[data-type="${type}"]`);
          lastSecondaryDisabled?.setAttribute("disabled", true);
        }
      }
    }
  } else {
    for(const type of selectedTypes) {
      const soMove = moveByType.get(type);
      if(soMove && exceptions.has(soMove)) {
        // console.log("special offensive move found in initialization");
        lastPrimarySelected = primaryContainer.querySelector(`button[data-type="${type}"]`);
        lastPrimarySelected.classList.add("selected");

        lastMoveSelected = document.querySelector(`button[data-move="${soMove}"]`);
        lastMoveSelected.classList.add("selected");

        primaryContainer.querySelectorAll("button").forEach((btn) => {
          btn.disabled = true;
        });
      } else if(type !== "flying") { // need to ignore unique flying-press case
        const button = primaryContainer.querySelector(`button[data-type="${type}"]`);
        button?.classList.add("selected");
      }
    }
  }
};

/**
 * Initializes event listeners and logic for managing exceptions in offense mode.
 * 
 * Handles user interaction with special damaging move buttons and offensive ability dropdown to initiate type selection and exception updates.
 * 
 * @param {HTMLElement} primaryContainer - The container element containing primary type buttons
 * 
 * @returns {void}
 */
// CONSIDER: secondaryContainer never exists on offense page. How should updateSelections be defined because of this fact?
const initOffenseExceptions = (primaryContainer) => {
  const moves = document.querySelector(".special-moves-o");
  const abilitySelect = document.getElementById("atk-ability-select");

  moves.addEventListener("click", async (e) => {
    const container = e.target.closest("button");
    if(!container || !container.dataset.move) return;
    selectType("oException", container, primaryContainer);
  });
  
  abilitySelect.addEventListener("change", (e) => {
    const selectedAbility = e.target.value;

    if(selectedAbility === oAbility) return;

    if(oAbility !== "") exceptions.delete(oAbility);
    if(selectedAbility !== "") exceptions.add(selectedAbility);

    oAbility = selectedAbility;

    refreshTypeResults(primaryContainer);
  });

  lastMoveSelected = moves.querySelector("button.selected") || null;
};

/**
 * Initializes event listeners and logic for managing type exceptions in defense mode.
 * 
 * Handles user interaction with special defensive move buttons, defensive ability dropdown, and Tera type dropdown to initiate type selection and exception updates.
 * 
 * @param {HTMLElement} primaryContainer - The container element containing primary type buttons
 * @param {HTMLElement} secondaryContainer - The container element containing secondary type buttons
 * 
 * @returns {void}
 */
const initDefenseExceptions = (primaryContainer, secondaryContainer) => {
  const moves = document.querySelector(".special-moves-d");
  const abilitySelect = document.getElementById("def-ability-select");
  const teraSelect = document.getElementById("tera-select");

  // hide tera types if not gen 6+
  if(gen !== "6+") {
    document.querySelector(".tera-types").style.display = "none";
  }
  
  moves.addEventListener("click", async (e) => {
    const container = e.target.closest("button");
    if(!container || !container.dataset.move) return;
    selectType("dMove", container, primaryContainer, secondaryContainer);
  });

  abilitySelect.addEventListener("change", (e) => {
    const selectedAbility = e.target.value;

    if(selectedAbility === dAbility) return;

    if(dAbility !== "") exceptions.delete(dAbility);
    if(selectedAbility !== "") exceptions.add(selectedAbility);

    dAbility = selectedAbility;

    refreshTypeResults(primaryContainer, secondaryContainer);
  });

  teraSelect.addEventListener("change", (e) => {
    const selectedType = e.target.value;
    selectType("dTera", selectedType, primaryContainer, secondaryContainer);

    teraResult = selectedType !== "";
  });

  teraResult = teraSelect.value !== "";
  lastMoveSelected = moves.querySelector("button.selected") || null;
};

/**
 * Initializes the event listeners for generation selection.
 */
const initGenSelect = async () => {
  const genContainer = document.querySelector(".gen-selection");
  if(!genContainer) {
    console.log("Gen Selection container not found.");
    return;
  }

  const radios = genContainer.querySelectorAll('input[type="radio"]');
  const current = genContainer.querySelector(`input[type="radio"][data-gen="${gen}"]`);

  if(current) {
    current.checked = true;
  }
  
  clearCache = false;

  radios.forEach(radio => {
    radio.addEventListener("change", () => {
      const newGen = radio.dataset.gen;
      if(newGen === gen) return;

      if(!genChange) {
        effectCache.clear();
        clearCache = true;
        // prevMode = null;
      }

      genChange = true;
      gen = newGen;
      localStorage.setItem("selectedGen", gen);

      updateGenDisplay();
    });
  });
};

const initSummaryState = () => {
  document.querySelectorAll('.info-sections details').forEach(detail => {
    const icon = detail.querySelector('summary use');
    const href = icon.getAttribute('href');

    if(href.includes('#minus')) {
      detail.setAttribute('open', '');
    }

    const updateIcon = () => {
      icon.setAttribute('href',
        detail.open ? '/svg/icons.svg#minus' : '/svg/icons.svg#plus'
      );
      saveSummaryState();
    };
    updateIcon();
    detail.addEventListener('toggle', updateIcon);
  })
};

// helper functions to determine whether to use current or original typing for moves/pokemon
const moveTypingByGen = (move, gen) => {
  return (move.tc && gen < move.tc) ? move.o[0] : move.t[0];
};

const monTypingByGen = (mon, gen) => {
  return (mon.tc && gen < mon.tc) ? mon.o : mon.t;
};

// control searchbar state
const SearchController = (() => {
  let currFuse = null;
  let searchData = null;
  let searchMode = null;
  let searchGen = null;
  let genMaxVal = null;

  let listenerAttached = false;
  let primaryContainer = null;
  let secondaryContainer = null;

  let lastInitToken = 0;

  const selectMove = (name, typeIndex) => {
    if(oMoveType[name]) {
      const moves = document.querySelector(".special-moves-o");
      const move = moves.querySelector(`button[data-move="${name}"]`);
      if(!move) return;

      selectType("oException", move, primaryContainer);
    } else {
      const typeName = typeNames[typeIndex];
      const button = primaryContainer.querySelector(`button[data-type="${typeName}"]`);
      if(!button) return;

      selectType("primary", button, primaryContainer); // non-exception moves do not have more than one type
    }
  };

  const selectPokemon = (name, typeIndices) => {
    const pTypeName = typeNames[typeIndices[0]];
    const sTypeName = typeIndices[1] ? typeNames[typeIndices[1]] : null;

    const pButton = primaryContainer.querySelector(`button[data-type="${pTypeName}"]`);
    if(!pButton) return;

    const sButton = sTypeName
      ? secondaryContainer?.querySelector(`button[data-type="${sTypeName}"]`)
      : null;

    selectType("pSearch", { primary: pButton, secondary: sButton }, primaryContainer, secondaryContainer);
  };

  const searchInput = document.getElementById("search");
  if(!searchInput) {
    console.warn("Search input not found.");
    return;
  };

  const searchHandler = (e) => {
    if (e.target.value.length > 30) {
      e.target.value = e.target.value.slice(0, 30);
    }
    const results = currFuse?.search(e.target.value) ?? [];
    // console.log(`[${searchMode}] Results:`, results);
    // console.log(results);
    if(searchMode === "offense") {
      SearchResultsRenderer.renderMoveResults(results, genMaxVal);
    } else if(searchMode === "defense") {
      SearchResultsRenderer.renderPokemonResults(results, genMaxVal);
    }
  };

  const attachInputListener = () => {
    if(!listenerAttached) {
      searchInput.addEventListener("input", searchHandler);

      const backdrop = document.getElementById("search-backdrop");
      
      searchInput.addEventListener("focus", () => {
        backdrop.classList.remove("hidden");
        // console.log('backdrop revealed')
      });

      searchInput.addEventListener("blur", () => {
        if(!SearchResultsRenderer.isClickInProgress?.()) {
          backdrop.classList.add("hidden");
          SearchResultsRenderer.clearResults();
        }
      });

      backdrop.addEventListener("click", () => {
        backdrop.classList.add("hidden");
        SearchResultsRenderer.clearResults();
        searchInput.blur();
        // console.log('leaving search via backdrop click')
      });

      listenerAttached = true;
    } else {
      searchInput.value = "";
      SearchResultsRenderer.clearResults();
    }
  };

  const hide = () => {
    searchInput.style.display = "none";
    SearchResultsRenderer.clearResults();
  };

  const show = () => {
    searchInput.style.display = "block";
    searchInput.placeholder = mode === 'offense' ? "Search by move name..." : "Search by Pokémon name..."
  };

  const rebuild = (newMode, newGen) => {
    return newMode !== searchMode || newGen !== searchGen || !currFuse;
  };

  const init = async (newMode, newGen, containers = {}) => {
    if(newMode === "more") {
      // console.log(`${newMode} gen ${newGen}, skipping search init...`);
      hide();
      return;
    }

    // console.log(`${newMode} ${newGen}, initializing searchbar...`);

    primaryContainer = containers.primaryContainer;
    secondaryContainer = containers.secondaryContainer ?? null;

    show();
    SearchResultsRenderer.clearResults(); // clear on mode/gen switch
    attachInputListener();

    const currToken = ++lastInitToken;

    if(!rebuild(newMode, newGen)) {
      // console.log("Reusing existing search instance.");
    } else {
      // console.log(`Rebuilding search for mode: ${newMode}, gen: ${newGen}`);
      loadedData = await loadSearchData(newMode, newGen);

      if(currToken !== lastInitToken) return;
      // console.log(`No Fuse build to interrupt. Building dictionary for ${newMode}, gen ${newGen}...`);

      searchData = loadedData;
      currFuse = new Fuse(searchData, {
        keys: ["n", "d"],
        threshold: 0.3,
        ignoreLocation: true,
      });

      // console.log(`Built Fuse with ${searchData.length} entries`);
      // const nameCounts = {};
      // for (const entry of searchData) {
      //   nameCounts[entry.n] = (nameCounts[entry.n] || 0) + 1;
      // }
      // for (const name in nameCounts) {
      //   if (nameCounts[name] > 1) {
      //     console.warn(`Duplicate found in searchData: ${name} x${nameCounts[name]}`);
      //   }
      // }
    }

    searchMode = newMode;
    searchGen = newGen;
    genMaxVal = genMaxNum[searchGen];

    const handleMoveClick = (name) => {
      const move = searchData.find((obj) => obj.n === name);
      if(!move) return;
      const typeIndex = moveTypingByGen(move, genMaxVal);
      selectMove(name, typeIndex);
    };

    const handlePokemonClick = (name) => {
      const mon = searchData.find((obj) => obj.n === name);
      if(!mon) return;
      const typeIndices = monTypingByGen(mon, genMaxVal);
      selectPokemon(name, typeIndices);
    };

    // connect search result clicks to handlers
    SearchResultsRenderer.initClickHandler(newMode, handleMoveClick, handlePokemonClick);
  };

  return { init };
})();

// render search results
const SearchResultsRenderer = (() => {
  const containerId = "search-results";
  let clickByMode = null;
  let resultClickInProgress = false;

  const getContainer = () => document.getElementById(containerId);

  const isClickInProgress = () => resultClickInProgress;

  const clearResults = () => {
    const container = getContainer();
    if(!container) return;
    container.innerHTML = "";
    container.classList.add("hidden");
  };

  const initClickHandler = (mode, handleMoveClick, handlePokemonClick) => {
    if(mode === "offense") {
      clickByMode = (name) => handleMoveClick(name);
    } else if(mode === "defense") {
      clickByMode = (name) => handlePokemonClick(name);
    }
  }

  const handleResultClick = (e) => {
    if(!clickByMode) {
      console.warn("Click handler not configured");
      return;
    }
    const resultEl = e.target.closest(".search-result");
    if(!resultEl) return;

    const name = resultEl.dataset.name;

    // console.log(`Clicked result: ${name}`);
    
    clickByMode(name);
    clearResults();
    const input = document.getElementById("search");
    if (input) {
      input.value = "";
      input.blur();
    }

    const backdrop = document.getElementById("search-backdrop");
    if (backdrop) {
      backdrop.classList.add("hidden");
    }

    resultClickInProgress = false;
  };

  const renderMoveResults = (results = [], gen) => {
    const container = getContainer();
    if(!container) return;
    if(!results.length) return clearResults();

    const html = results.slice(0, 10).map(({ item: move }) => {
      const typeIndex = moveTypingByGen(move, gen);
      const typeName = typeNames[typeIndex];
      // const typeIndex = getTypeForMove(move, gen);
      return `
      <div class="search-result" data-name="${move.n}">
        <h1>${move.d}</h1>
        <div class="search-typing">
          <svg class="icon" data-type="${typeName}">
            <use href="/svg/types-min.svg#${typeName}"></use>
          </svg>
        </div>
      </div>
    `;
    }).join("");

    container.innerHTML = html;
    container.classList.remove("hidden");
  };

  const renderPokemonResults = (results = [], gen) => {
    const container = getContainer();
    if(!container) return;
    if(!results.length) return clearResults();

    const html = results.slice(0, 10).map(({ item: mon }) => {
      const typeIndices = monTypingByGen(mon, gen);
      const typeIconsHTML = typeIndices.map((typeIndex) => {
        const typeName = typeNames[typeIndex];
        return `
          <svg class="icon" data-type="${typeName}">
            <use href="/svg/types-min.svg#${typeName}"></use>
          </svg>
        `;
      }).join("");

      const iconCount = typeIndices.length === 1 ? "mono" : "dual";

      return `
      <div class="search-result" data-name="${mon.n}">
        <h1>${mon.d}</h1>
        <div class="search-typing ${iconCount}">
          ${typeIconsHTML}
        </div>
      </div>
    `;
    }).join("");

    container.innerHTML = html;
    container.classList.remove("hidden");
  };

  (() => {
    const container = getContainer();
    if(container) {
      let activeRes = null;

      container.addEventListener("pointerdown", (e) => {
        const el = e.target.closest(".search-result");
        if(el) {
          activeRes = el;
          el.classList.add("active");
        }
        resultClickInProgress = true;
      });

      container.addEventListener("pointermove", (e) => {
        if (e.buttons === 1) {
          const el = e.target.closest(".search-result");
          if (el && el !== activeRes) {
            if (activeRes) activeRes.classList.remove("active");
            activeRes = el;
            el.classList.add("active");
          }
        }
      });

      container.addEventListener("pointerleave", () => {
        if (activeRes) {
          activeRes.classList.remove("active");
          activeRes = null;
        }
      });

      container.addEventListener("pointerup", (e) => {
        if (activeRes) {
          activeRes.classList.remove("active");
          activeRes = null;
        }
        handleResultClick(e);
      });
    }
  })();

  return { isClickInProgress, clearResults, initClickHandler, renderMoveResults, renderPokemonResults };
})();