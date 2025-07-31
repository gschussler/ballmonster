/* ----- INITIALIZATION FUNCTIONS – Functions that combine all of the above to provide interactivity for users and help determine application state. ----- */
import state from './globals.js';
import {
  selectedTypes,
  exceptions,
  typeNames,
  oMoveType,
  moveByType,
  effectCache,
} from './globals.js';
import {
  getTypeRelationship,
  loadSearchData,
  selectType,
  initReset
} from './core.js';
import {
  loadGenerationData,
  loadExceptions
} from './load.js';
import {
  updateSelections,
  moveTypeDisable,
  updateGenDisplay,
  saveSummaryState
} from './ui.js';

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
 * Initializes event listeners for various user input buttons, dropdowns, and searchbar. Manages type visibility, selection logic for primary and secondary types, and updates the application state based on user interactions.
 * 
 * @async
 * @returns {Promise<void>} - A promise that resolves when the initial page state of "offense" or "defense" has finished initial type calculations and display.
 */
export const initInput = async () => {
  // console.log(`${mode}, gen ${gen}`);
  state.genJSON = await loadGenerationData(state.gen);
  state.exceptJSON = await loadExceptions();

  const primaryContainer = document.querySelector(".primary-types");
  // if(!primaryContainer) return; // ".type-buttons" doesn't exist in index.html on initial page load, so the first try for initializing always fails. skip it.
  const secondaryContainer = document.querySelector(".secondary-types");

  initTypeButtons(primaryContainer, secondaryContainer);

  // initSearchbar(primaryContainer, secondaryContainer);

  // Initial selectedTypes and button selection handling
  // If the generation has changed or the user is not returning to the previous page, clear selectedTypes and exceptions. (cache has already been cleared, so no need)
  if(state.genChange || state.mode !== state.prevMode) {
    // console.log(`Clearing selectedTypes because genChange: ${state.genChange} or different mode.`)
    // clear if new generation or "offense" <--> "defense" nav
    selectedTypes.clear();
    selectedTypes.add("normal");
    primaryContainer.querySelector(`button[data-type="normal"]`).classList.add("selected");
    state.lastSecondaryDisabled = secondaryContainer?.querySelector(`button[data-type="normal"]`);
    if(state.lastSecondaryDisabled) state.lastSecondaryDisabled.disabled = true;
    exceptions.clear();
  } else {
    // Otherwise the cache hasn't been cleared, so the proper reassignments need to occur for this page render
    if(state.mode === "defense") {
      await initCachedResults(primaryContainer, secondaryContainer);
    } else {
      await initCachedResults(primaryContainer);
    }
  };

  // Reset state flags
  state.genChange = false;
  state.prevMode = state.mode;
  
  // Prep currently selected button types for replacement if they exist
  // No secondary on initial page load (but caching type selections will be implemented)
  state.lastPrimarySelected = primaryContainer.querySelector("button.selected");
  state.lastSecondarySelected = secondaryContainer?.querySelector("button.selected");

  // console.log(`Initializing ${mode} exceptions...`);

  if(state.mode === "defense") {
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

export const refreshTypeResults = (primaryContainer, secondaryContainer = null) => {
  getTypeRelationship(selectedTypes, state.mode, state.gen, exceptions);
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
    const onDefense = state.mode === "defense";
    let abilitySelect;
    let currentAbility;
    if(onDefense) {
      abilitySelect = document.getElementById("def-ability-select");
      currentAbility = state.dAbility;
    } else {
      abilitySelect = document.getElementById("atk-ability-select");
      currentAbility = state.oAbility;
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
        state.lastMoveSelected = document.querySelector(`button[data-move="${sdMove}"]`);
        state.lastMoveSelected.classList.add("selected");

        moveTypeDisable(primaryContainer, secondaryContainer, type, true);

        // primaryContainer.querySelector(`button[data-type="${type}"]`).disabled = true;
        // state.lastSpecialDisabled = secondaryContainer.querySelector(`button[data-type="${type}"]`)
        // state.lastSpecialDisabled.disabled = true;
      } else if(state.teraResult && type !== "stellar") {
        // if a tera type had been selected before navigating away, reselect the relevant monotype
        // console.log("tera type found, selecting monotype...");
        state.lastPrimarySelected = primaryContainer.querySelector(`button[data-type="${type}"]`);
        state.lastPrimarySelected.classList.add("selected");

        const teraSelect = document.getElementById("tera-select");
        teraSelect.value = type;

        primaryContainer.querySelectorAll("button").forEach((btn) => {
          btn.disabled = true;
        });

        secondaryContainer.querySelectorAll("button").forEach((btn) => {
          btn.disabled = true;
        });
      } else {
        const fromPrimary = !state.lastPrimarySelected || state.lastPrimarySelected.dataset.type === type;
        const button = fromPrimary
          ? primaryContainer.querySelector(`button[data-type="${type}"]`)
          : secondaryContainer.querySelector(`button[data-type="${type}"]`);
        if(!button) continue;

        button.classList.add("selected");

        if(fromPrimary) {
          state.lastPrimarySelected = button;
          state.lastSecondaryDisabled = secondaryContainer.querySelector(`button[data-type="${type}"]`);
          state.lastSecondaryDisabled?.setAttribute("disabled", true);
        }
      }
    }
  } else {
    for(const type of selectedTypes) {
      const soMove = moveByType.get(type);
      if(soMove && exceptions.has(soMove)) {
        // console.log("special offensive move found in initialization");
        state.lastPrimarySelected = primaryContainer.querySelector(`button[data-type="${type}"]`);
        state.lastPrimarySelected.classList.add("selected");

        state.lastMoveSelected = document.querySelector(`button[data-move="${soMove}"]`);
        state.lastMoveSelected.classList.add("selected");

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

    if(selectedAbility === state.oAbility) return;

    if(state.oAbility !== "") exceptions.delete(state.oAbility);
    if(selectedAbility !== "") exceptions.add(selectedAbility);

    state.oAbility = selectedAbility;

    refreshTypeResults(primaryContainer);
  });

  state.lastMoveSelected = moves.querySelector("button.selected") || null;
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
  if(state.gen !== "6+") {
    document.querySelector(".tera-types").style.display = "none";
  }
  
  moves.addEventListener("click", async (e) => {
    const container = e.target.closest("button");
    if(!container || !container.dataset.move) return;
    selectType("dMove", container, primaryContainer, secondaryContainer);
  });

  abilitySelect.addEventListener("change", (e) => {
    const selectedAbility = e.target.value;

    if(selectedAbility === state.dAbility) return;

    if(state.dAbility !== "") exceptions.delete(state.dAbility);
    if(selectedAbility !== "") exceptions.add(selectedAbility);

    state.dAbility = selectedAbility;

    refreshTypeResults(primaryContainer, secondaryContainer);
  });

  teraSelect.addEventListener("change", (e) => {
    const selectedType = e.target.value;
    selectType("dTera", selectedType, primaryContainer, secondaryContainer);

    state.teraResult = selectedType !== "";
  });

  state.teraResult = teraSelect.value !== "";
  state.lastMoveSelected = moves.querySelector("button.selected") || null;
};

/**
 * Initializes the event listeners for generation selection.
 */
export const initGenSelect = async () => {
  const genContainer = document.querySelector(".gen-selection");
  if(!genContainer) {
    console.log("Gen Selection container not found.");
    return;
  }

  const radios = genContainer.querySelectorAll('input[type="radio"]');
  const current = genContainer.querySelector(`input[type="radio"][data-gen="${state.gen}"]`);

  if(current) {
    current.checked = true;
  }
  
  state.clearCache = false;

  radios.forEach(radio => {
    radio.addEventListener("change", () => {
      const newGen = radio.dataset.gen;
      if(newGen === state.gen) return;

      if(!state.genChange) {
        effectCache.clear();
        state.clearCache = true;
        // state.prevMode = null;
      }

      state.genChange = true;
      state.gen = newGen;
      localStorage.setItem("selectedGen", state.gen);

      updateGenDisplay();
    });
  });
};

export const initSummaryState = () => {
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
export const SearchController = (() => {
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
    searchInput.classList.remove("fade-in");
    searchInput.classList.add("fade-out");
    SearchResultsRenderer.clearResults();
  };

  const show = () => {
    searchInput.classList.remove("fade-out");
    searchInput.classList.add("fade-in");
    searchInput.placeholder =
      state.mode === "offense"
        ? "Search by move name..."
        : "Search by Pokémon name...";
  };

  const rebuild = (newMode, newGen) => {
    return newMode !== searchMode || newGen !== searchGen || !currFuse;
  };

  const init = async (newMode, newGen, containers = {}) => {
    if(newMode === "more") {
      // console.log(`${newMode} gen ${newGen}, skipping search init...`);
      // hide();
      return;
    }

    // console.log(`${newMode} ${newGen}, initializing searchbar...`);

    primaryContainer = containers.primaryContainer;
    secondaryContainer = containers.secondaryContainer ?? null;

    // show();
    SearchResultsRenderer.clearResults(); // clear on mode/gen switch
    attachInputListener();

    const currToken = ++lastInitToken;

    if(!rebuild(newMode, newGen)) {
      // console.log("Reusing existing search instance.");
    } else {
      // console.log(`Rebuilding search for mode: ${newMode}, gen: ${newGen}`);
      let loadedData = await loadSearchData(newMode, newGen);

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

  return { init, show, hide };
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