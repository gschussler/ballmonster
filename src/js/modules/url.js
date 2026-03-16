import {
  state,
  typeMap,
  selectedTypes,
  exceptions
} from 'globals.js'

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
    localStorage.setItem("selectedGen", urlState.gen);
  }

  if(urlState.types) {
    selectedTypes.clear();
    urlState.types.forEach(type => {
      if(typeMap.hasOwnProperty(type)) {
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
      if(typeMap.hasOwnProperty(urlState.tera)) {
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