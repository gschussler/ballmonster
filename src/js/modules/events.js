/* ----- DOM EVENT LISTENERS - handle page navigation and UI initialization. ----- */
import state from './globals.js';
import {
  effectMults,
  effectCache,
  LinkedList
} from './globals.js';
import {
  initInput,
  initGenSelect,
  initSummaryState,
  SearchController
} from './init.js';
import {
  typeVisibility,
  updateGenDisplay,
  restoreSummaryState
} from './ui.js';

let spinnerTimeout;
let spinnerShown = false;

/**
 * Handles initial setup when the DOM is fully loaded but before the site should be revealed (before initial HTMX swap).
 *
 * @listens DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  // display generation before reveal
  updateGenDisplay();
  
  // initialize the search input placeholder
  const searchInput = document.getElementById("search");
  if (!searchInput) return;

  if (state.mode === "offense") {
    searchInput.placeholder = "Search by move name...";
  } else if (state.mode === "defense") {
    searchInput.placeholder = "Search by Pokémon name...";
  }

  // slight delay before showing spinner to account for fast and slow connections
  spinnerTimeout = setTimeout(() => {
    const spinner = document.getElementById('spinner');
    spinner?.classList.remove('hidden');
    spinnerShown = true;
  }, 500);

  // remove preload class from html
  document.documentElement.classList.remove('preload');
});

// prevent body dragstart
document.body.addEventListener('dragstart', function(e) {
  e.preventDefault();
});

/**
 * Handles the `htmx:afterSwap` event to initialize relevant button functionality after an HTMX swap event occurs, based on the current page.
 * 
 * @listens htmx:afterSwap
 * @param {Event} e - The event object for the htmx swap event.
 * @returns {Promise<void>} Resolves after initializing the appropriate buttons.
 */
document.addEventListener("htmx:afterSwap", async (e) => {
  updateGenDisplay();
  if(state.mode !== "more") {
    // clear effectMults and multOrder entirely if destination is "offense" or "defense"
    effectMults.clear();
    state.multOrder = new LinkedList();
    typeVisibility();
    const { primaryContainer, secondaryContainer } = await initInput();
    await SearchController.init(state.mode, state.gen, {
      primaryContainer,
      secondaryContainer
    });
  } else {
    restoreSummaryState();
    initSummaryState();
    await initGenSelect();
    await SearchController.init(state.mode, state.gen);
  };
  revealInitialContent();
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

  if(requestedMode === state.mode) { // Prevent htmx request if user is already on the selected page
    // console.log(`Already on "${requestedMode}" page. Preventing unnecessary request.`);
    e.preventDefault();
    // return;
  } else if(!state.genChange) { // Clear cache if navigating between "offense" and "defense" pages or navigating away from "more" to a different page than previous.
    if(requestedMode !== state.prevMode && requestedMode !== "more") {
      // console.log(`Heading to "offense" or "defense" page. Not prevMode, so clearing cache...`)
      effectCache.clear();
      state.clearCache = true;
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
    if(newMode === state.mode) {
      // console.log(`Already on ${newMode} page. Skipping mode update.`);
      return;
    }

    // Remove current active link
    document.querySelector(`nav a[id=${state.mode}]`)?.classList.remove("active");

    // Update `mode` parameter to new mode
    document.getElementById('content').setAttribute("data-mode", newMode);
    link.classList.add("active");

    // console.log(`Mode updating from ${mode} to: ${newMode}`);
    state.prevMode = state.mode;
    state.mode = newMode;
  }
});

document.addEventListener('htmx:beforeSwap', (e) => {
  const content = htmx.find('#content');

  if (e.detail.target.id !== 'content') return;

  // handle search visibility based on destination
  if (state.mode === "more") {
    SearchController.hide();
  } else {
    SearchController.show();
  }

  // cancel default swap
  e.detail.shouldSwap = false;
  
  // fade-out
  htmx.removeClass(content, 'fade-in');
  htmx.addClass(content, 'fade-out');

  content.innerHTML = e.detail.serverResponse;

  // fade-in, 10ms delay to give DOM time to initialize update/render
  htmx.removeClass(content, 'fade-out');
  htmx.addClass(content, 'fade-in', 10);

  // // below TRANSITION LOGIC to be added back in later

  // content.addEventListener('transitionend', function handleFadeOut() {
  //   content.removeEventListener('transitionend', handleFadeOut);

  //   // swap in new content
  //   content.innerHTML = e.detail.serverResponse;

  //   // // force reflow (optional but helps with reliability)
  //   // void content.offsetWidth;

  //   // fade-in, 10ms delay to give DOM time to initialize update/render
  //   htmx.removeClass(content, 'fade-out');
  //   htmx.addClass(content, 'fade-in', 10);

  //   // clean up fade-in class after transition end
  //   content.addEventListener('transitionend', function handleFadeIn() {
  //     content.removeEventListener('transitionend', handleFadeIn);
  //     htmx.removeClass(content, 'fade-in');
  //   });

    // let htmx process newly swapped content
    htmx.process(content);

    // manually fire htmx:afterSwap since swap was cancelled
    const swapEvent = new CustomEvent('htmx:afterSwap', {
      bubbles: true,
      detail: {
        target: content,
        serverResponse: e.detail.serverResponse,
        xhr: e.detail.xhr,
      }
    });
    content.dispatchEvent(swapEvent);
  // });
});

// const initDropdowns = (main = document) => {
//   const dropdownLists = main.querySelectorAll(".dropdown-list");
//   dropdownLists.forEach(dropdownList => {
//     initDropdownList(dropdownList);
//   });
// };

const once = (fn) => {
  let called = false;
  return (...args) => {
    if(!called) {
      called = true;
      fn(...args);
    }
  };
};

const revealInitialContent = once(() => {
  const content = htmx.find('#content');
  const spinner = document.getElementById('spinner');
  
  // reveal content after swap
  content.classList.remove('preload');

  // kill spinner logic
  clearTimeout(spinnerTimeout);
  if (spinnerShown && spinner) {
    spinner.remove();
  }
});