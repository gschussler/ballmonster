/* ----- SEARCH CONTROL AND RENDER – Handle fuzzy search input and results for Pokemon names and Move names. ----- */
import state from './globals.js';
import {
  typeNames,
  oMoveType
} from './globals.js';
import {
  loadSearchData,
  selectType
} from './core.js';

/**
 * Maps maximum generation numbers to their respective range label.
 * @constant {Object<string, number>}
 */
const genMaxNum = {
  "1": 1,
  "2-5": 5,
  "6+": Infinity
};

// helper functions to determine whether to use current or original typing for moves/pokemon
const moveTypingByGen = (move, gen) => {
  return (move.tc && gen < move.tc) ? move.o[0] : move.t[0];
};

const monTypingByGen = (mon, gen) => {
  return (mon.tc && gen < mon.tc) ? mon.o : mon.t;
};

/**
 * Toggles pointer events on type selection containers during search
 * @param {boolean} enabled - Whether type selection should be enabled
 */
const toggleTypeSelection = (enabled) => {
  const primaryContainer = document.querySelector('.primary-types');
  const secondaryContainer = document.querySelector('.secondary-types');
  
  const action = enabled ? 'remove' : 'add';
  primaryContainer?.classList[action]('search-disabled');
  secondaryContainer?.classList[action]('search-disabled');
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
        toggleTypeSelection(false);
        // console.log('backdrop revealed')
      });

      searchInput.addEventListener("blur", () => {
        if(!SearchResultsRenderer.isClickInProgress?.()) {
          backdrop.classList.add("hidden");
          toggleTypeSelection(true);
          SearchResultsRenderer.clearResults();
        }
      });

      backdrop.addEventListener("click", () => {
        backdrop.classList.add("hidden");
        toggleTypeSelection(true);
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
    // console.log('=== SEARCH RESULT EVENT ===');
    // console.log('Event type:', e.type);
    // console.log('Event timestamp:', e.timeStamp);
    // console.log('Event target:', e.target);
    // console.log('Event currentTarget:', e.currentTarget);
    // console.log('Pointer type:', e.pointerType); // Should show 'touch' on mobile
    // console.log('===============================');
  
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
      setTimeout(() => { // patchwork setTimeout due to mobile browser constraints. big sad
        toggleTypeSelection(true);
      }, 100);
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