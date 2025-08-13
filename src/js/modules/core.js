/* ----- CORE FUNCTIONS – Functions that centralize processes for UI rendering and type effectiveness calculation. ----- */
import state from './globals.js';
import {
  selectedTypes,
  exceptions,
  typeNames,
  typeMap,
  exceptNames,
  dTypeMove,
  typeByMove,
  genTypeCounts,
  effectMults,
} from './globals.js';
import { refreshTypeResults } from './init.js';
import { loadSearchSlice } from './load.js';
import {
  clearSelections,
  moveTypeDisable,
  moveTypeEnable,
  updateEffectiveness
} from './ui.js';

/**
 * Maps exception names to numerical indices.
 * @constant {Object<string, number>}
 */
const exceptMap = Object.fromEntries(exceptNames.map((name, index) => [name, index]));

const addToEffectMults = (mult, typeName) => {
  if(!effectMults.has(mult)) {
    effectMults.set(mult, new Set());
    state.multOrder.insert(mult);
  }

  effectMults.get(mult).add(typeName);
};

/**
 * Retrieves type effectiveness data based on the selected types, mode, generation, and selected exceptions. Notifies functions to try and update the DOM.
 * 
 * @param {string[]} types - An array of selected Pokemon types.
 * @param {string} mode - The mode of the current page, either "offense" or "defense"
 * @param {string} generation - The current Pokemon game generation.
 * @param {Map} exceptions - A map of selected exceptions containing special Pokemon type interactions.
 */
export const getTypeRelationship = (types, mode, generation, exceptions) => {
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
      const exceptEntry = state.exceptJSON.e[exceptIndex];
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
        ? state.genJSON.s[inKey][outKey] // Offense: `Deals ${n}x to`; inKey –> outKey
        : state.genJSON.s[outKey][inKey]; // Defense: `Takes ${n}x from`; outKey –> inKey

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

export const loadSearchData = async (mode, gen) => {
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
    if(state.lastSecondarySelected?.dataset.type === type) {
      // Secondary Container exists and the type is selected in it
      // clear the Set and add the selected type
      selectedTypes.clear();
      selectedTypes.add(type);
      
      // remove all selections from both containers
      state.lastPrimarySelected.classList.remove("selected");
      state.lastSecondarySelected?.classList.remove("selected");
      // update type selection in Primary Container
      button.classList.add("selected");
      state.lastPrimarySelected = button;

      state.lastSecondaryDisabled.disabled = false;
      state.lastSecondaryDisabled = secondaryContainer.querySelector(`button[data-type="${type}"]`);
      state.lastSecondaryDisabled.disabled = true;
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
      if(state.lastSecondaryDisabled) state.lastSecondaryDisabled.disabled = false;
      // moveTypeDisable(primaryContainer, secondaryContainer, type);
      state.lastSecondaryDisabled = secondaryContainer.querySelector(`button[data-type="${type}"]`);
      state.lastSecondaryDisabled.disabled = true;
    } else {
      // No secondary container, clear is faster
      selectedTypes.clear();
    }
    // Remove selection from selected primary type button
    state.lastPrimarySelected.classList.remove("selected");

    selectedTypes.add(type);
    button.classList.add("selected");
    state.lastPrimarySelected = button;
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
  if(state.lastPrimarySelected.getAttribute("data-type") === type) {
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
    state.lastSecondarySelected = null; // clear to prevent errors in optional chaining conditionals
    // console.log(`Secondary ${type} deleted.`)
  } else {
    // Doesn't match current primary or secondary type
    // Delete the type that is "selected" in Secondary Container from `selectedTypes` if it exists
    clearSelections(secondaryContainer, selectedTypes);

    // console.log(`Secondary ${type} added.`);
    selectedTypes.add(type);
    button.classList.add("selected");
    state.lastSecondarySelected = button;
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

      if(state.lastMoveSelected) {
        const lastMoveName = state.lastMoveSelected.dataset.move;
        lastType = typeByMove.get(lastMoveName);
        pTypeDisabled = primaryContainer.querySelector(`button[data-type=${lastType}]`);
        sTypeDisabled = secondaryContainer.querySelector(`button[data-type=${lastType}]`);

        state.lastMoveSelected.classList.remove("selected");
        state.lastMoveSelected = null;

        const teraOption = teraSelect.querySelector(`option[value="${lastType}"]`);
        if(teraOption) teraOption.disabled = false;
      }

      if(state.lastPrimarySelected?.dataset.type !== mType && state.lastSecondarySelected?.dataset.type !== mType) {
        selectedTypes.delete(mType);
      }

      if(!state.teraResult && pTypeDisabled.disabled === true && sTypeDisabled.disabled === true) {
        moveTypeEnable(primaryContainer, secondaryContainer, lastType, true);
      }
    } else {
      if(state.lastMoveSelected) {
        const lastMoveName = state.lastMoveSelected.dataset.move;
        lastType = typeByMove.get(lastMoveName);
        pTypeDisabled = primaryContainer.querySelector(`button[data-type=${lastType}]`);
        sTypeDisabled = secondaryContainer.querySelector(`button[data-type=${lastType}]`);
        exceptions.delete(lastMoveName);
        state.lastMoveSelected.classList.remove("selected");
        if(selectedTypes.has(lastType)) {
          selectedTypes.delete(lastType);
          if(!state.teraResult && pTypeDisabled.disabled === true && sTypeDisabled.disabled === true) {
            moveTypeEnable(primaryContainer, secondaryContainer, lastType, true);
          }
        }
        const teraOption = teraSelect.querySelector(`option[value="${lastType}"]`);
        if(teraOption) teraOption.disabled = false;
      }

      const teraOption = teraSelect.querySelector(`option[value="${mType}"]`);
      if(teraOption) teraOption.disabled = true;

      exceptions.add(move);
      state.lastMoveSelected = container;
      if(state.lastPrimarySelected?.dataset.type !== mType && state.lastSecondarySelected?.dataset.type !== mType) {
        selectedTypes.add(mType);
      }
      state.lastMoveSelected.classList.add("selected");
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

    if(state.lastMoveSelected && selectedType === typeByMove.get(state.lastMoveSelected.dataset.move)) {
      console.log(`selectedType has the same type as ${state.lastMoveSelected.dataset.move}, so the selection did not succeed.`);
      return;
    }

    // if a type other than `""` is selected
    if(selectedType !== "") {
      // Clear secondary if selected
      if(state.lastSecondarySelected) {
        selectedTypes.delete(state.lastSecondarySelected.dataset.type);
        state.lastSecondarySelected.classList.remove("selected");
        state.lastSecondarySelected = null;
      }
      
      // any selection other than `""` disables all buttons since Tera Pokemon are monotype
      allButtons.forEach(button => {
        button.disabled = true;
      });

      // Clear primary if different from Tera type
      if(selectedType !== state.lastPrimarySelected.dataset.type) {
        selectedTypes.delete(state.lastPrimarySelected.dataset.type);
        state.lastPrimarySelected.classList.remove("selected");
      
        if(state.lastMoveSelected) { // all current exception moves include dual-typing
          const lastMoveType = typeByMove.get(state.lastMoveSelected.dataset.move);
          for(let type of selectedTypes) {
            if(type !== lastMoveType && type !== selectedType && type !== 'stellar') {
              selectedTypes.delete(type);
            }
          }
        }
          
        selectedTypes.add(selectedType);
        state.lastPrimarySelected = primaryContainer.querySelector(`button[data-type=${selectedType}]`);
        state.lastPrimarySelected.classList.add("selected");
      };
      
      // if not already present, add Stellar to calculations
      if(!state.teraResult) {
        selectedTypes.add("stellar");
      }

      state.teraResult = true;
    } else {
      // if default selected, renable all buttons as long as not interfering with special moves. lastPrimarySelected should keep its reference, so update lastSecondaryDisabled after re-enabling other buttons
      allButtons.forEach(button => button.disabled = false);
      state.lastSecondaryDisabled = secondaryContainer.querySelector(`button[data-type=${state.lastPrimarySelected.dataset.type}]`);
      state.lastSecondaryDisabled.disabled = true;
      if(state.lastMoveSelected) {
        const lastMoveType = typeByMove.get(state.lastMoveSelected.dataset.move);
        moveTypeDisable(primaryContainer, secondaryContainer, lastMoveType, true);
      }
      // if present in selectedTypes, remove Stellar
      if(state.teraResult) {
        selectedTypes.delete("stellar");
      }
      state.teraResult = false;
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
    state.lastMoveSelected = null;
    
    // Only flying-press has a second damage type to be deleted
    if(move === "flying-press") {
      selectedTypes.delete("flying");
    }

    // enableAllTypeButtons()
    allButtons.forEach(button => button.disabled = false);

    // // Clear type selection from primaryContainer
    // state.lastPrimarySelected?.classList.remove("selected");
    // state.lastPrimarySelected = null;
  } else {
    if(state.lastMoveSelected) {
      const lastMoveName = state.lastMoveSelected.dataset.move;
      exceptions.delete(lastMoveName);
      state.lastMoveSelected.classList.remove("selected");

      // if(lastMoveName === "flying-press") {
      //   selectedTypes.delete("flying");
      // }
    }

    exceptions.add(move);
    container.classList.add("selected");
    state.lastMoveSelected = container;

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
    state.lastPrimarySelected?.classList.remove("selected");

    const moveTypeButton = primaryContainer.querySelector(`button[data-type="${mType}"]`);
    if(moveTypeButton) {
      moveTypeButton.classList.add("selected");
      state.lastPrimarySelected = moveTypeButton;
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
  const lastMove = state.lastMoveSelected ? state.lastMoveSelected.getAttribute("data-move") : null;

  if(state.teraResult) { // clear tera result since there is no point in keeping tera when selecting a new Pokemon
    const teraSelect = document.getElementById("tera-select");
    teraSelect.value = "";
    handleDefenseException("dTera", "", primaryContainer, secondaryContainer);
  }

  if(clearMonConflict(typeVar.primary, lastMove)) {
    handleDefenseException("dMove", state.lastMoveSelected, primaryContainer, secondaryContainer);
  }

  handlePrimarySelection(typeVar.primary, primaryContainer, secondaryContainer);

  if(typeVar.secondary) {
    if(clearMonConflict(typeVar.secondary, lastMove)) {
      handleDefenseException("dMove", state.lastMoveSelected, primaryContainer, secondaryContainer);
    }
    handleSecondarySelection(typeVar.secondary, primaryContainer, secondaryContainer, true);
  } else if(state.lastSecondarySelected) { // clear secondary if current Pokemon doesn't have one
    handleSecondarySelection(state.lastSecondarySelected, primaryContainer, secondaryContainer);
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
export const selectType = (source, typeVar, primaryContainer, secondaryContainer = null) => {
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
export const initReset = (primaryContainer, secondaryContainer = null) => {
  const resetButton = document.getElementById("reset-button");
  resetButton.addEventListener("click", () => {
    window.scrollTo(0, 0);

    selectedTypes.clear();
    exceptions.clear();
    
    if(state.lastMoveSelected) {
      state.lastMoveSelected.classList.remove("selected");
    }

    // document.querySelectorAll("button:disabled").forEach(btn => btn.disabled = false);

    let abilitySelect;

    if(secondaryContainer) {
      const selectables = document.querySelector(".selectable-d");
      selectables.querySelectorAll("button:disabled").forEach(btn => btn.disabled = false);
      abilitySelect = document.getElementById("def-ability-select");
      abilitySelect.value = "";
      state.dAbility = "";

      if(state.gen === "6+" && state.teraResult) {
        const teraSelect = document.getElementById("tera-select");
        teraSelect.value = "";
        state.teraResult = null;
      }
      
      if(state.lastSecondarySelected) {
        state.lastSecondarySelected.classList.remove("selected");
        state.lastSecondarySelected = null;
      }
    } else {
      const selectables = document.querySelector(".selectable-o");
      selectables.querySelectorAll("button:disabled").forEach(btn => btn.disabled = false);
      abilitySelect = document.getElementById("atk-ability-select");
      abilitySelect.value = "";
      state.oAbility = "";
    }
    
    const defaultBtn = primaryContainer.querySelector('button[data-type="normal"');
    selectType("primary", defaultBtn, primaryContainer, secondaryContainer);
  });
};