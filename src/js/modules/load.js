/* ---------------------------------------------------------------------------------------------------------------- */
/* ----- JSON data loaders – Provide Pokemon type relationship data by generation as well as special type exception data ----- */
import state from './globals.js';
import {
  exceptNames,
  moveByType,
  typeByMove,
} from './globals.js';

/**
 * Cache for generation type chart data, keyed by generation string. 
 * @type {Object}
 */
const generationDataCache = {};

/**
 * Cache for exception data. `null` until first loaded.
 * @type {Object|null} 
 */
let exceptionDataCache = null;

/**
 * Cache for search data, keyed by mode string.
 * @type {{offense: Object, defense: Object}}
 */
const searchDataCache = {
  offense: {},
  defense: {},
};

/**
 * Populates `moveByType` and `typeByMove` maps with move-type pairings loaded from exception data, enabling quick bidirectional lookups between move names and their types.
 *
 * @async
 * @returns {Promise<void>}
 */
const populateMoveMaps = async () => {
  state.exceptJSON = await loadExceptions();
  const exceptArr = state.exceptJSON.e;

  for(let i = 0; i < exceptArr.length; i++) {
    const entry = exceptArr[i];
    if(!entry.move) continue;

    const moveType = entry.move;
    const moveName = exceptNames[i];

    moveByType.set(moveType, moveName);
    typeByMove.set(moveName, moveType);
  }
};

/**
 * Loads type effectiveness data for a specified generation.
 * Checks localStorage for cached data before fetching from a JSON file.
 * 
 * @async
 * @param {string} gen - The generation identifier (e.g., "1", "2-5", "6+").
 * @returns {Promise<Object>} A promise that resolves to the generation data object.
 */
export const loadGenerationData = async (gen) => {
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
export const loadExceptions = async () => {
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

/**
 * Loads and caches the generation-specific search data for the given mode.
 *
 * @async
 * @param {string} mode - The current calculation mode.
 * @param {string} gen - The generation to load search data for.
 * @returns {Promise<Array>} A promise resolving to the search data array.
 */
export const loadSearchSlice = async (mode, gen) => {
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

// const flattenData = (nestedData) => nestedData.flat();

// Need to populate move maps asynchronously at top level
(async () => {
  await populateMoveMaps();
  // console.log("Move maps populated:", moveByType, typeByMove);
})();