import state from './globals.js';
import {
  typeMap,
  selectedTypes,
  exceptions,
  typeByMove
} from './globals.js'

/**
 * Reads window.__INIT_STATE__ and applies URL parameters to application state. Should be called before any calculations or UI initialization.
 * 
 * @returns {boolean} - True if URL state was applied, false otherwise.
 */
export const applyURLState = () => {
  const urlState = window.__INIT_STATE__;

  if(!urlState) {
    return false;
  }

  // set mode flags to treat URL state as "cached" state
  if(urlState.mode) {
    state.prevMode = urlState.mode;
  }

  if(urlState.gen) {
    const gen = urlState.gen === "6plus" ? "6+" : urlState.gen;
    state.gen = gen;
    localStorage.setItem("selectedGen", gen);
  }

  if(urlState.types) {
    selectedTypes.clear();
    urlState.types.forEach(type => {
      if(typeMap.hasOwnProperty(type)) { // eslint-disable-line no-prototype-builtins
        selectedTypes.add(type);
      }
    });
  }

  if(urlState.mode === 'offense') {
    if(urlState.move) {
      // state.lastMoveSelected needs to be urlState.move;
      exceptions.add(urlState.move);
    }

    if(urlState.ability) {
      state.oAbility = urlState.ability;
      exceptions.add(urlState.ability);
    }

  } else if (urlState.mode === 'defense') {
    if(urlState.move) {
      // state.lastMoveSelected needs to be urlState.move;
      exceptions.add(urlState.move);
    }

    if(urlState.ability) {
      state.dAbility = urlState.ability;
      exceptions.add(urlState.ability);
    }

    if(urlState.tera) {
      if(typeMap.hasOwnProperty(urlState.tera)) { // eslint-disable-line no-prototype-builtins
        selectedTypes.clear();
        selectedTypes.add(urlState.tera);
        state.teraResult = true;
      }
    }
  }

  return true;
};

/**
 * Cleans URL params after state has been applied, leaving only the clean path (e.g. `/defense`)
 * 
 * @returns {void}
 */
export const cleanURL = () => {
  const cleanPath = `/${state.mode}`;
  window.history.replaceState({}, '', cleanPath);
};

/**
 * Generates a shareable URL with query parameters representing current page state
 * @returns {string} - Full URL with query params
 */
export const generateShareableURL = () => {
  const params = new URLSearchParams();

  const genParam = state.gen === "6+" ? "6plus" : state.gen;
  params.set('gen', genParam);
  
  // add tera type (defense only, mutually exclusive with types)
  if (state.mode === "defense" && state.teraResult) {
    const teraType = Array.from(selectedTypes)[0];
    if (teraType && teraType !== "stellar") {
      params.set('tera', teraType);
      // skip types when tera is active (they're mutually exclusive)
    }
  } else {
    if (selectedTypes.size > 0) {
      // filter out "normal" default and any move-related types if move is selected
      let typesToShare = Array.from(selectedTypes);
      
      if (typesToShare.length === 1 && typesToShare[0] === "normal") {
        typesToShare = [];
      }

      if (state.lastMoveSelected) {
        const moveName = state.lastMoveSelected.dataset.move;
        const moveType = typeByMove.get(moveName);

        // if there's a selected move on offense, don't include types (move selects its own type)
        if (state.mode === "offense") {
          typesToShare = [];
        } else {
          // on def: filter out the move's type but keep other selected types
          typesToShare = typesToShare.filter(t => t !== moveType);
        }
      }
      
      if (typesToShare.length > 0) {
        params.set('types', typesToShare.join(','));
      }
    }
  }
  
  if (state.lastMoveSelected) {
    const moveName = state.lastMoveSelected.dataset.move;
    params.set('move', moveName);
  }
  
  const ability = state.mode === "offense" ? state.oAbility : state.dAbility;
  if (ability) {
    params.set('ability', ability);
  }
  
  const baseURL = window.location.origin + '/' + state.mode;
  const queryString = params.toString();
  
  return queryString ? `${baseURL}?${queryString}` : baseURL;
};

let swapTimeout = null;

const swapCopyIcon = (id) => {
  const copyBtn = document.getElementById("copy-button");
  const icon = copyBtn.querySelector("svg");
  const use = icon.querySelector("use");

  if(swapTimeout) clearTimeout(swapTimeout);

  use.setAttribute("href", `/svg/icons.svg#${id}`);
  icon.classList.add(id);

  copyBtn.childNodes[2].textContent = id === "check" ? "Copied!" : "Failed...";

  swapTimeout = setTimeout(() => {
    use.setAttribute("href", `/svg/icons.svg#copy`);
    icon.classList.remove(id);
    copyBtn.childNodes[2].textContent = "Copy Link"
    swapTimeout = null;
  }, 1000);
};

/**
 * Copies the current page URL to clipboard
 * Must be called from a user gesture (e.g., button click)
 * @returns {Promise<boolean>}
 */
export const copyURLToClipboard = async () => {
  const url = generateShareableURL();

  try {
    await navigator.clipboard.writeText(url);
    swapCopyIcon("check");
    return true;
  } catch (err) {
    console.error('Failed to copy URL:', err);
    swapCopyIcon("error");
    return false;
  }
};