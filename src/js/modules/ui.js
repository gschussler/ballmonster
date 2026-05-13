/* ----- UI HELPER FUNCTIONS – Functions that provide dynamic UI rendering capabilities to event listeners. ----- */
import state from './globals.js';
import {
  dTypeMove,
  moveByType,
  genTypeCounts,
  effectCache,
} from './globals.js';

/**
 * Adjusts the visibility of type buttons based on number of Pokemon within a generation.
 * @param {HTMLElement} container - The container element holding the type buttons
 */
export const typeVisibility = () => {
  const primaryContainer = document.getElementById("details-primary");
  const secondaryContainer = document.getElementById("details-secondary");
  
  const btns = primaryContainer.querySelector(".button-grid").children;

  for(let i = 15; i < btns.length; i++) {
    btns[i].style.display = genTypeCounts[state.gen] > i ? "block" : "none";
  }

  if(secondaryContainer) {
    const sbtns = secondaryContainer.querySelector(".button-grid").children;

    for(let i = 15; i < sbtns.length; i++) {
      sbtns[i].style.display = genTypeCounts[state.gen] > i ? "block" : "none";
    }
  }
};

/**
 * Clears selected types within a container.
 * @param {HTMLElement} container - The container holding the buttons.
 * @param {Set<string>} selectedTypes - A set of selected Pokemon type names.
 */
export const clearSelections = (container, selectedTypes) => {
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
export const updateSelections = (primaryContainer, secondaryContainer = null) => {
  state.lastPrimarySelected = primaryContainer.querySelector("button.selected");
  state.lastSecondarySelected = secondaryContainer?.querySelector("button.selected");
  
  if(state.mode === "defense") {
    const pToggleType = state.lastPrimarySelected?.dataset.type;
    const sToggleType = state.lastSecondarySelected?.dataset.type;
    toggleDefSpecialMoves(pToggleType, sToggleType);
  }

  updateDisplayType(state.lastPrimarySelected.dataset.type, "primary");
  if(state.lastSecondarySelected) {
    updateDisplayType(state.lastSecondarySelected.dataset.type, "secondary");
  } else if(state.mode !== "offense") {
    updateDisplayType(null, "secondary");
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

  if(moveDisabledP) {
    const disabledByP = document.querySelector(`button[data-move="${moveDisabledP}"]`);
    disabledByP.disabled = true;
    // console.log(`moveDisabledP (${moveDisabledP}) disabled state is -- ${disabledByP.disabled}`);
  }

  if(moveDisabledS) {
    const disabledByS = document.querySelector(`button[data-move="${moveDisabledS}"]`);
    disabledByS.disabled = true;
    // console.log(`moveDisabledS (${moveDisabledS}) disabled state is -- ${disabledByS.disabled}`);
  }

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
export const moveTypeDisable = (container1, container2, moveType, special = false) => {
  container1.querySelector(`button[data-type="${moveType}"]`).disabled = true;
  if(!special) {
    state.lastSecondaryDisabled = container2.querySelector(`button[data-type="${moveType}"]`);
    state.lastSecondaryDisabled.disabled = true;
  } else {
    state.lastMoveDisabled = container2.querySelector(`button[data-type="${moveType}"]`);
    state.lastMoveDisabled.disabled = true;
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
export const moveTypeEnable = (container1, container2, moveType, special = false) => {
  container1.querySelector(`button[data-type="${moveType}"]`).disabled = false;
  if(!special) {
    if(state.lastSecondaryDisabled.dataset.type !== moveType) {
      state.lastSecondaryDisabled.disabled = false;
    }
    state.lastSecondaryDisabled = null;
  } else {
    state.lastMoveDisabled.disabled = false;
    state.lastMoveDisabled = null;
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
export const updateEffectiveness = (newEffectMults) => {
  // console.log(`clearCache in updateEffectiveness is: ${state.clearCache}`)
  // console.log(newEffectMults)
  if(state.clearCache) {
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
    header.textContent = state.mode === "offense"
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
      let node = state.multOrder.find(mult);
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

/**
 * Updates DOM to reflect Gen selection changes
 */
export const updateGenDisplay = () => {
  let genDisplay = document.getElementById("gen");
  if(genDisplay) {
    genDisplay.textContent = state.gen;
  }
};

/**
 * Updates DOM to reflect type selection changes
 * 
 * @param {string|null} type - The selected type name, or `null` if the slot is being cleared
 * @param {string} container - The container of a selected type. Denotes the slot to update.
 * @returns {void}
 */
const updateDisplayType = (type, container) => {
  const displayType = container === "primary" ? document.getElementById("type1") : document.getElementById("type2");
  const displayTypeBtn = displayType.querySelector("button");
  const typeDetails = container === "primary" ? document.getElementById("details-primary") : document.getElementById("details-secondary");
  
  if(type !== null) {
    if(displayTypeBtn.classList.contains(type)) return;
    const capitalType = type[0].toUpperCase() + type.slice(1);
    const appendedClass = typeDetails.open === true ? `${type} active` : `${type}`;

    displayTypeBtn.className = `display-type ${appendedClass}`;
    displayTypeBtn.innerHTML = `
      <svg class="icon">
        <use href="/svg/types-min.svg#${type}"></use>
      </svg>
      ${capitalType}
    `;
    return;
  }

  displayTypeBtn.innerHTML = `
    <svg class="add-icon" aria-hidden="true">
      <use href="/svg/icons.svg#plus"></use>
    </svg>
  `;
  
  // account for secondary grid deselection
  if (displayTypeBtn.classList.contains("active")) {
    displayTypeBtn.className = `display-type empty active`;
  } else {
    displayTypeBtn.className = `display-type empty`;
  }
};

/**
 * Toggles a details element open/close state, closing the other if both are present.
 *
 * @param {HTMLDetailsElement} target - The details element to toggle.
 * @param {HTMLDetailsElement|null} other - The other details element to close when toggling. `null` if only one is present.
 * @returns {void}
 */
export const toggleDetails = (target, other = null) => {
  const opening = !target.hasAttribute('open');
  
  if(other) {
    other.removeAttribute('open');
    target.toggleAttribute('open', opening);
  } else {
    target.toggleAttribute('open', opening);
  }
}

/**
 * Toggles the arrow indicator on the target details element, resetting the other's arrow to down if both are present.
 *
 * @param {HTMLDetailsElement} type - The details element whose arrow indicator is being toggled.
 * @param {HTMLDetailsElement|null} other - The other details element whose arrow is reset to down. `null` if only one is present.
 * @returns {void}
 */
export const toggleArrow = (type, other = null) => {
  const symbolPath = "/svg/icons.svg";
  const down = (el) => {
    return el.getAttribute("href") === `${symbolPath}#arrowdown` ? true : false;
  }

  // const typeBtn = type.querySelector('.display-type');
  const otherBtn = other?.querySelector('.display-type');
  const arrow = type.querySelector(".toggle-icon use");

  if(other) {
    const otherArrow = other.querySelector(".toggle-icon use");
    if(!down(other)) {
      if(otherBtn.classList[1] !== "empty") {
        otherArrow.setAttribute("href", `${symbolPath}#arrowdown`);
      }
    }
  }

  if(down(arrow)) {
    arrow.setAttribute("href", `${symbolPath}#arrowup`);
  } else {
    arrow.setAttribute("href", `${symbolPath}#arrowdown`);
  }

  // if(other) {
  //   const otherArrow = other.querySelector(".toggle-icon use");
  //   if(!down(otherArrow)) {
  //     otherArrow.setAttribute("href", `${symbolPath}#arrowdown`);
  //   }
  // }
};

/**
 * Toggles the `active` class on a display type button, removing it from the other if both are present.
 *
 * @param {HTMLDetailsElement} type - The details element whose display type button is being toggled.
 * @param {HTMLDetailsElement|null} other - The other details element whose `active` class is removed if present. `null` if only one exists.
 * @returns {void}
 */
export const toggleSelectedStyles = (type, other = null) => {
  const typeBtn = type.querySelector('.display-type');
  const otherBtn = other?.querySelector('.display-type');

  if(!typeBtn.classList.contains("active")) {
    typeBtn.classList.add("active");

    if(other && otherBtn.classList.contains("active")) {
      otherBtn.classList.remove("active");
    }
  } else {
    typeBtn.classList.remove("active");
  }
}

/**
 * Resets the display type buttons' active states, open details, and arrow indicators on a full reset.
 *
 * @returns {void}
 */
export const handleDisplayTypeReset = () => {
  const type1 = document.getElementById('type1');
  const type1Btn = type1.querySelector('.display-type');
  const primary = document.getElementById("details-primary");

  if(state.mode === "defense") {
    const type2 = document.getElementById('type2');
    const type2Btn = type2 ? type2.querySelector('.display-type') : null;
    const secondary = type2 ? document.getElementById("details-secondary") : null;
    if(type2Btn.classList.contains("active")) {
      toggleSelectedStyles(type2, type1);
      toggleDetails(secondary, primary);
      toggleArrow(type2, type1);
    } else if(type1Btn.classList.contains("active")) {
      toggleSelectedStyles(type1);
      toggleDetails(primary, secondary);
      toggleArrow(type1);
    }
  } else if(type1Btn.classList.contains("active")) {
    toggleSelectedStyles(type1);
    if(primary.hasAttribute("open")) {
      toggleDetails(primary);
    }
    toggleArrow(type1);
  }
}

// const renderResults = (results) => {
//   const container = document.getElementById("search-results");
//   if(!container) return;

//   if(!results.length) {
//     container.classList.add("hidden");
//     container.innerHTML = "";
//     return;
//   }

//   const resultHTML = results
//     .slice(0, 10) // limit visible results
//     .map(result => `<div class="search-result">${result.item.n}</div>`)
//     .join("");

//   container.innerHTML = resultHTML;
//   container.classList.remove("hidden");
// };

/**
 * Saves the open/closed state of all summary details elements to session storage.
 *
 * @returns {void}
 */
export const saveSummaryState = () => {
  const summaryState = {};
  document.querySelectorAll('.info-sections details').forEach(detail => {
    summaryState[detail.id] = detail.open;
  });
  sessionStorage.setItem(state.summary, JSON.stringify(summaryState));
};

/**
 * Restores the open/closed state and icons of all summary details elements from session storage.
 *
 * @returns {void}
 */
export const restoreSummaryState = () => {
  const stored = sessionStorage.getItem(state.summary);
  if (!stored) return;

  const summaryState = JSON.parse(stored);
  document.querySelectorAll('.info-sections details').forEach(detail => {
    const isOpen = summaryState[detail.id];
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