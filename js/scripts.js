// Initialize type buttons on page load and between relevant pages
document.addEventListener("htmx:afterSwap", async (e) => {
  if(mode !== "more") {
    await initTypeButtons(); // Reinitialize buttons when mode changes
  } else {
    await initGenButtons();
  }
});

// Intercept htmx requests if the page is already selected
document.addEventListener("htmx:beforeRequest", (e) => {
  const requestedMode = e.detail.elt?.id;

  // Prevent htmx request if clicking the active page
  if (requestedMode === mode) {
    console.log(`Already on ${requestedMode} page or navigated to "More". Preventing unnecessary request.`);
    e.preventDefault();
  } else if (mode !== "more") {
    // If generation hasn't changed, not necessarily clearing...
    if(!clearCache) {
      console.log("clearing effectivenessCache")
      effectivenessCache.forEach(set => set.clear());
    }
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

let mode = document.getElementById('content').getAttribute("data-mode") || "offense";
let prevMode = null;
let gen = localStorage.getItem("selectedGen") || "6+";
let genChange = false;
let genJSON, exceptJSON;
let clearCache = false;

const selectedTypes = new Set(["normal"]); // Track selected types, default to 'normal' type
const exceptions = new Set([]); // Track selected exceptions, default to none
let lastPrimarySelected = null;
let lastSecondarySelected = null;
let lastSecondaryDisabled; // track secondary button disabled state outside of loop so primaryContainer event listener may access
let lastSpecialDisabled;
let lastMoveSelected = null;

// typeMap.js
const typeNames = [
  "normal", "fire", "water", "electric",
  "grass", "ice", "fighting", "poison",
  "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark",
  "steel", "fairy", "stellar"
];

const typeMap = Object.fromEntries(typeNames.map((name, index) => [name, index]));

const exceptNames = [
  // Offense exceptions (Gen-ascending)
  "foresight", "flash_fire_atk", "odor_sleuth", "gravity_atk", "scrappy", "tinted_lens", "flying_press", "freeze-dry", "thousand_arrows", "water_bubble_atk",
  // Defense exceptions (Gen-ascending)
  "flash_fire_def", "levitate", "lightning_rod", "thick_fat", "volt_absorb", "water_absorb", "wonder_guard", "dry_skin", "filter", "gravity_def", "heatproof", "motor_drive", "storm_drain", "sap_sipper", "delta_stream", "fluffy", "water_bubble_def", "earth_eater", "purifying_salt", "tera_shell", "well-baked_body", "forests_curse", "trick-or-treat"
];

const exceptMap = Object.fromEntries(exceptNames.map((name, index) => [name, index]));

// const selectedExceptions = new Set([]);

// cache.js
const caches = {
  "1": { offense: {}, defense: {} },
  "2-5": { offense: {}, defense: {} },
  "6+": { offense: {}, defense: {} },
};

const genTypeCounts = {
  "1": 15,
  "2-5": 17,
  "6+": 18,
};

// Effectiveness Multiplier lists
  //to be populated with all single Pokemon types that exist in current generation
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

const typeVisibility = (container) => {
  const btns = container.querySelector(".button-grid").children;
  for(let i = 15; i < btns.length; i++) {
    btns[i].style.display = (genTypeCounts[gen] > i) ? "block" : "none";
  }
};

const clearSelections = (container, selectedTypes) => {
  container.querySelectorAll("button.selected").forEach((button) => {
    const existingType = button.dataset.type;
    if(selectedTypes.has(existingType)) {
      selectedTypes.delete(existingType);
      button.classList.remove("selected");
    }
  })
};

const updateSelections = (primaryContainer, secondaryContainer) => {
  lastPrimarySelected = primaryContainer.querySelector("button.selected");
  lastSecondarySelected = secondaryContainer?.querySelector("button.selected");
};

// const disableSpecialMove = (type) => {
//   if(type === "grass") {
//     if(lastMoveSelected) {
//       lastMoveSelected.disabled = false;  
//     }
//     lastMoveSelected = document.querySelector(`button[data-move="forests_curse"]`);
//     lastMoveSelected.disabled = true;
//   } else if(type === "ghost") {
//     if(lastMoveSelected) {
//       lastMoveSelected.disabled = false;
//     }
//     lastMoveSelected = document.querySelector(`button[data-move="trick-or-treat"]`);
//     lastMoveSelected.disabled = true;
//   } else {
//     if(lastMoveSelected) {
//       lastMoveSelected.disabled = false;
//     } else return;
//   };
// }

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

const getTypeRelationship = (types, mode, generation, exceptions) => {
  let res = mode === "offense" ? "effectiveness" : "resistances";
  // Update effectiveness sublists with the results
  console.log(`Checking ${res} of ${[...types]}`);
  const newEffectMults = getEffectiveness([...types], mode, generation, exceptions);
  return updateEffectiveness(newEffectMults);
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

// effectiveness.js
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

const loadExceptions = async () => {
  try {
    const res = await fetch("/json/exceptions.json");
    if(!res.ok) {
      throw new Error("Failed to fetch data for exceptions.");
    }
    const data = await res.json();
    return data; // target the exception array
  } catch (error) {
    console.error("Error loading generation data:", error);
    return {};
  }
}

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
      if(exceptEntry !== -1) { // Exceptions that don't modify effectivity have been set to `-1` in JSON
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

const initTypeButtons = async () => {
  console.log(`Mode: ${mode}`);
  console.log(`Gen: ${gen}`);
  genJSON = await loadGenerationData(gen);
  exceptJSON = await loadExceptions();

  const primaryContainer = document.querySelector(".primary-types");
  typeVisibility(primaryContainer);
  // if(!primaryContainer) return; // ".type-buttons" doesn't exist in index.html on initial page load, so the first try for initializing always fails. skip it.
  const secondaryContainer = document.querySelector(".secondary-types");
  
  console.log(`Initializing ${mode} exceptions...`);

  // console.log("Initializing type buttons...");
  // // Clear previous event listeners to prevent duplicates -- htmx swap results in this already
  // primaryContainer.replaceChildren(...primaryContainer.cloneNode(true).childNodes);
  // secondaryContainer?.replaceChildren(...secondaryContainer.cloneNode(true).childNodes);

  // Event Delegation: button clicks add/remove types to/from calculations
  primaryContainer.addEventListener("click", async (e) => {
      const button = e.target.closest("button");
      if(!button || !button.dataset.type) return;

      const type = button.dataset.type;

      // if(type === "grass" && mode === "defense") {
      //   document.querySelector(`button[data-move="forests_curse"]`).disabled = true;
      //   if(lastSpecialDisabled?.dataset.move === "trick-or-treat") {
      //     document.querySelector(`button[data-move="trick-or-treat"]`).disabled = true;
      //   } else {
      //     document.querySelector(`button[data-move="trick-or-treat"]`).disabled = false;
      //   }
      // }

      // if(type === "ghost" && mode === "defense") {
      //   document.querySelector(`button[data-move="trick-or-treat"]`).disabled = true;
      //   if(lastSpecialDisabled?.dataset.move === "forests_curse") {
      //     document.querySelector(`button[data-move="forests_curse"]`).disabled = true; 
      //   } else {
      //     document.querySelector(`button[data-move="forests_curse"]`).disabled = false;                  
      //   }
      // }

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
          // Disable the type's corresponding special move if applicable
          // disableSpecialMove(type);
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
    typeVisibility(secondaryContainer);
    secondaryContainer.addEventListener("click", async (e) => {
        const button = e.target.closest("button");
        if(!button || !button.dataset.type) return;

        const type = button.dataset.type;

        // disableSpecialMove(type);

        // if(type === "grass") {
        //   if(lastSpecialDisabled) {
        //     if(lastSpecialDisabled.dataset.move !== "forests_curse") {
        //       document.querySelector(`button[data-move="forests_curse"]`).disabled = false;
        //       document.querySelector(`button[data-move="trick-or-treat"]`).disabled = true;
        //     } else {
        //       document.querySelector(`button[data-move="forests_curse"]`).disabled = true;
        //     }
        //   }
        //   if(lastSpecialDisabled?.dataset.move !== "forests_curse") {
        //     document.querySelector(`button[data-move="forests_curse"]`).disabled = true;
        //     document.querySelector(`button[data-move="trick-or-treat"]`).disabled = false;
        //   } else {
        //     document.querySelector(`button[data-move="forests_curse"]`).disabled = false;
        //     document.querySelector(`button[data-move="trick-or-treat"]`).disabled = true;
        //   }
        // }
  
        // if(type === "ghost") {
        //   document.querySelector(`button[data-move="trick-or-treat"]`).disabled = true;
        //   if(lastSpecialDisabled?.dataset.move === "forests_curse") {
        //     document.querySelector(`button[data-move="forests_curse"]`).disabled = true;        
        //   } else {
        //     document.querySelector(`button[data-move="forests_curse"]`).disabled = false;        
        //   }
        // }

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
  if(genChange || mode !== prevMode) {
    // If not because of genChange, need to clear the effectivenessCache to redisplay results of prevMode
    if(!genChange) {
      effectivenessCache.forEach(set => set.clear());
    }
    console.log(`Clearing selectedTypes because genChange: ${genChange} or different mode.`)
    // clear if new generation or "offense" <--> "defense" nav
    selectedTypes.clear();
    selectedTypes.add("normal");
    primaryContainer.querySelector(`button[data-type="normal"]`).classList.add("selected");
    lastSecondaryDisabled = secondaryContainer?.querySelector(`button[data-type="normal"]`);
    if(lastSecondaryDisabled) lastSecondaryDisabled.disabled = true;
    exceptions.clear();
  } else {
    const maxValid = genTypeCounts[gen] - 1;
    for(const type of selectedTypes) {
      if(typeMap[type] > maxValid) {
        selectedTypes.clear();
        selectedTypes.add("normal");
        break;
      }
    }

    if(mode === "defense") {
      const sMove = exceptions.has("forests_curse") ? "forests_curse"
      : exceptions.has("trick-or-treat") ? "trick-or-treat"
      : null;
  
      const sMoveType = sMove === null ? null
      : sMove === "forests_curse" ? "grass"
      : "ghost";
  
      // console.log(sMove, sMoveType);

      for(const type of selectedTypes) {
        if(sMoveType !== null && type === sMoveType) {
          console.log("exception found in initialization")
          lastMoveSelected = document.querySelector(`button[data-move="${sMove}"]`);
  
          lastMoveSelected.classList.add("selected");

          moveTypeDisable(primaryContainer, secondaryContainer, sMoveType, true);
  
          // primaryContainer.querySelector(`button[data-type="${sMoveType}"]`).disabled = true;
          // lastSpecialDisabled = secondaryContainer.querySelector(`button[data-type="${sMoveType}"]`)
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
        const button = primaryContainer.querySelector(`button[data-type="${type}"]`);
        if(!button) continue;

        button.classList.add("selected");
      }
    }
  
    // // Visual selection of current types and exceptions based on what has persisted (currently should only contain two types)
    // let typeIdx = 0;
    // for(const type of selectedTypes) {
    //   const button = document.querySelector(`button[data-type="${type}"]`);
    //   if(!button) continue;
    //     button.classList.add("selected");
    //     // disable secondary type that corresponds with current primary type -- if on defense
    //     if(mode === "defense" && typeIdx === 0) {
    //       lastSecondaryDisabled = secondaryContainer?.querySelector(`button[data-type="${type}"]`);
    //       if(lastSecondaryDisabled) lastSecondaryDisabled.disabled = true;
    //     }
    //   typeIdx++;
    // }
  }

  // Reset state flags
  genChange = false;
  prevMode = mode;

  // const [primaryType, secondaryType] = [...selectedTypes];

  // if(primaryType) {
  //   primaryContainer.querySelector(`button[data-type="${primaryType}"]`).classList.add("selected");
  // } else { //"normal" type is default selection on initial load
  //   primaryContainer.querySelector(`button[data-type="normal"]`).classList.add("selected");
  // }

  // // select secondary type if on defense mode
  // if(mode === "defense") {
  //   if(secondaryType) {
  //     secondaryContainer.querySelector(`button[data-type="${secondaryType}"]`).classList.add("selected");
  //   }
  // }
  
  // Prep currently selected button types for replacement if they exist
  // No secondary on initial page load (but caching type selections will be implemented)
  lastPrimarySelected = primaryContainer.querySelector("button.selected");
  lastSecondarySelected = secondaryContainer?.querySelector("button.selected");

  if(mode === "defense") {
    initDefenseExceptions(primaryContainer, secondaryContainer);
  } else {
    initOffenseExceptions(primaryContainer, secondaryContainer);
  }

  // Currently 'normal' type is selected upon initialization, display relevant results
  console.log(`Getting initial type relationships on ${mode} for gen ${gen}...`);
  getTypeRelationship(selectedTypes, mode, gen, exceptions);
  return updateSelections(primaryContainer, secondaryContainer);
};

const initOffenseExceptions = (primaryContainer, secondaryContainer) => {
  const allButtons = [
    ...primaryContainer.querySelectorAll("button"),
    ...secondaryContainer?.querySelectorAll("button") || []
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
      
      // Only freeze-dry has a second damage type to be deleted
      if(move !== "freeze-dry") {
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

        if(lastMoveName === "flying_press") {
          selectedTypes.delete("flying");
        }
      }

      exceptions.add(move);
      button.classList.add("selected");
      lastMoveSelected = button;

      const moveType = {
        "flying_press": "fighting",
        "freeze-dry": "ice",
        "thousand_arrows": "ground"
      }[move];

      if(moveType) {
        // console.log('valid move type')
        selectedTypes.clear();
        selectedTypes.add(moveType);

        // Highlight corresponding type in primaryContainer
        lastPrimarySelected?.classList.remove("selected");
        const moveTypeButton = primaryContainer.querySelector(`button[data-type="${moveType}"]`);
        if(moveTypeButton) {
          moveTypeButton.classList.add("selected");
          lastPrimarySelected = moveTypeButton;
        }
      }

      // only flying press targets an additional entire type
      if(move === "flying_press") {
        selectedTypes.add("flying");
      }

      //disableAllTypeButtons()
      allButtons.forEach(button => button.disabled = true);
    };
    getTypeRelationship(selectedTypes, mode, gen, exceptions);
    return updateSelections(primaryContainer, secondaryContainer);
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
    return updateSelections(primaryContainer, secondaryContainer);
  });

  lastMoveSelected = moves.querySelector("button.selected") || null;
};

const initDefenseExceptions = (primaryContainer, secondaryContainer) => {
  const moves = document.querySelector(".special-moves-d");
  const effects = document.querySelector(".special-effects");
  const teraContainer = document.querySelector(".tera-types");

  const moveType = {
    "forests_curse": "grass",
    "trick-or-treat": "ghost"
  };

  moves.addEventListener("click", async (e) => {
    const button = e.target.closest("button");
    if(!button || !button.dataset.move) return;

    const move = button.dataset.move;

    if(exceptions.has(move)) {
      exceptions.delete(move);
      lastMoveSelected.classList.remove("selected");
      lastMoveSelected = null;
      if(lastPrimarySelected.dataset.type !== moveType[move]) {
        selectedTypes.delete(moveType[move]);
      }
      moveTypeEnable(primaryContainer, secondaryContainer, moveType[move], true);
    } else {
      if(lastMoveSelected) {
        const lastMoveName = lastMoveSelected.dataset.move;
        exceptions.delete(lastMoveName);
        lastMoveSelected.classList.remove("selected");
        if(selectedTypes.has(moveType[lastMoveName])) {
          selectedTypes.delete(moveType[lastMoveName]);
          moveTypeEnable(primaryContainer, secondaryContainer, moveType[lastMoveName], true)
        }
      }

      exceptions.add(move);
      lastMoveSelected = button;
      if(lastPrimarySelected.dataset.type !== moveType[move]) {
        selectedTypes.add(moveType[move]);
      }
      lastMoveSelected.classList.add("selected");
      moveTypeDisable(primaryContainer, secondaryContainer, moveType[move], true);
    };
    getTypeRelationship(selectedTypes, mode, gen, exceptions);
    return updateSelections(primaryContainer, secondaryContainer);
  });

  lastMoveSelected = moves.querySelector("button.selected") || null;
};

const initGenButtons = async () => {
  const genContainer = document.querySelector(".gen-selection");
  if(!genContainer) {
    console.log("Gen Selection container not found.");
    return;
  }

  console.log("Gen buttons found, attaching event listener.");

  genContainer.querySelectorAll("button").forEach(button => {
    button.classList.toggle("selected", button.dataset.gen === gen);
  });

  // One event listener for the container
  genContainer.addEventListener("click", async (e) => {
    const button = e.target.closest("button");
    if(!button || !button.dataset.gen) return;

    const newGen = button.dataset.gen;
    if(newGen === gen) return;

    // Clear cache first time generation changes
    if(!genChange) {
      console.log("clearing effectivenessCache")
      effectivenessCache.forEach(set => set.clear());
      clearCache = true;
      prevMode = null; // remove prevMode reference since its use is to prevent cache clearing upon returning to "offense" or "defense" from "more"
    }
    genChange = true; // flag used to simplify initial offense/defense page interaction with selectedTypes

    genContainer.querySelector(".selected")?.classList.remove("selected");

    gen = newGen;
    localStorage.setItem("selectedGen", gen);
    button.classList.add("selected");

    console.log(`Gen changed to ${gen}.`);
  });
  // Set initial selected button
  genContainer.querySelector(`button[data-gen="${gen}"]`)?.classList.add("selected");
};