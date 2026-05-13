/* ----- GLOBAL VARIABLES – Application state and structures used in many contexts across read/write operations ----- */

/**
 * Tracks currently selected Pokémon types.
 * Defaults to "normal" type.
 * @type {Set<string>}
 */
export const selectedTypes = new Set([]);

/**
 * Tracks currently selected exceptions.
 * Defaults to none.
 * @type {Set<string>}
 */
export const exceptions = new Set([]);

/**
 * List of all Pokémon type names.
 * @constant {string[]}
 */
export const typeNames = [
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
export const typeMap = Object.fromEntries(typeNames.map((name, index) => [name, index]));

/**
 * List of all offensive and defensive exceptions.
 * @constant {string[]}
 */
export const exceptNames = [
  // Offense exceptions (Gen-ascending)
  "flash-fire-atk", "scrappy", "tinted-lens", "flying-press", "freeze-dry", "thousand-arrows", "water-bubble-atk",
  // Defense exceptions (Gen-ascending)
  "flash-fire-def", "levitate", "lightning-rod", "thick-fat", "volt-absorb", "water-absorb", "wonder-guard", "dry-skin", "filter", "heatproof", "motor-drive", "storm-drain", "sap-sipper", "delta-stream", "fluffy", "water-bubble-def", "earth-eater", "purifying-salt", "tera-shell", "well-baked-body", "forests-curse", "trick-or-treat"
];

/**
 * Maps special offensive moves to their source Pokémon types.
 * @constant {Object<string, string>}
 */
export const oMoveType = {
  "flying-press": "fighting",
  "freeze-dry": "ice",
  "thousand-arrows": "ground"
};

/**
 * Maps target Pokémon types to special moves.
 * @constant {Object<string, string>}
 */
export const dTypeMove = {
  "grass": "forests-curse",
  "ghost": "trick-or-treat"
};

/**
 * Precomputed Map for fast type-to-move lookups.
 * @constant {Map<string, string>}
 */
export const moveByType = new Map();

/**
 * Precomputed Map for fast move-to-type lookups.
 * @constant {Map<string, string>}
 */
export const typeByMove = new Map();

/**
 * Maps generation labels to the number of Pokémon types available in that generation.
 * @constant {Object<string, number>}
 */
export const genTypeCounts = {
  "1": 15,
  "2-5": 17,
  "6+": 19,
};

/**
 * Maps type effectiveness multipliers to sets of Pokémon types.
 * Populated dynamically by monotype relationship calculations (`getEffectiveness` operations).
 * @type {Map<string, Set<string>>}
 */
export const effectMults = new Map();

/**
 * Stores effectiveness results to prevent redundant calculations.
 * @type {Map<string, Set<string>>}
 */
export const effectCache = new Map();

class ListNode {
  constructor(mult) {
    this.mult = mult;
    this.next = null;
  }
}

export class LinkedList {
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
};

/**
 * Global application state object for preserving in-memory state across JS modules.
 * 
 * @type {Object}
 * @property {string} mode - The current calculation mode.
 * @property {string|null} prevMode  - The previous calculation mode. Used to detect mode switches.
 * @property {string} gen - The currently selected Pokémon generation (e.g. "6+").
 * @property {boolean} genChange - Whether the generation has changed in page navigation.
 * @property {boolean} clearCache - Whether cached type/matchup data should be invalidated on the next calculation.
 * @property {Object|undefined} genJSON - The loaded JSON data for the current generation.
 * @property {Object|undefined} exceptJSON - The loaded JSON data for generation-specific type exceptions.
 * @property {HTMLElement|null} lastPrimarySelected - The last primary type selected by the user.
 * @property {HTMLElement|null} lastSecondarySelected - The last secondary type selected by the user.
 * @property {HTMLElement|null} lastMoveSelected - The last move selected by the user.
 * @property {HTMLElement|null} lastSecondaryDisabled - The last secondary type button that was disabled.
 * @property {HTMLElement|null} lastMoveDisabled - The last move that was disabled.
 * @property {string} oAbility - The currently selected offensive ability.
 * @property {string} dAbility - The currently selected defensive ability.
 * @property {boolean} teraResult - Whether the current result reflects a Tera type calculation.
 * @property {string} summary - Key used to track a summary dropdown's open/closed state.
 * @property {LinkedList} multOrder - Ordered list tracking the sequence of multipliers applied in the current calculation.
 */
const state = {
  mode: document.getElementById('content').getAttribute("data-mode") || "offense",
  prevMode: null,
  gen: localStorage.getItem("selectedGen") || "6+",
  genChange: false,
  clearCache: true,
  genJSON: undefined,
  exceptJSON: undefined,
  lastPrimarySelected: null,
  lastSecondarySelected: null,
  lastMoveSelected: null,
  lastSecondaryDisabled: null,
  lastMoveDisabled: null,
  oAbility: "",
  dAbility: "",
  teraResult: false,
  summary: 'summaryDropdownState',
  multOrder: new LinkedList()
};

export default state;