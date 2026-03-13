package main

import "slices"

// Validate logical consistency of params
func hasParamConflict(validParams map[string]any, pageKey string) bool {
	gen := validParams["gen"]
	types := validParams["types"]
	move := validParams["move"]
	ability := validParams["ability"]
	tera := validParams["tera"]

	// default to gen 6+ if no gen query is given
	effectiveGen := "6plus"
	if gen != nil {
		effectiveGen = gen.(string)
	}

	// cover edge-cases where foundational logic is conflicting (type out of valid gen, trying to use types and tera)

	// validate types against gen before considering mode
	if types != nil {
		typeList := types.([]string)
		requiredGen := getMinGenForTypes(typeList, pageKey)

		if requiredGen == "invalid" {
			return true // stellar in def mode
		}

		if !isGenCompatible(effectiveGen, requiredGen) {
			return true
		}

		if gen == nil && requiredGen == "6plus" {
			validParams["gen"] = "6plus"
		}
	}

	if types != nil && tera != nil {
		return true
	}

	switch pageKey {
	case "offense":
		if types != nil {
			typeList := types.([]string)

			if len(typeList) > 1 {
				return true
			}
		}

		if move != nil {
			moveName := move.(string)
			if types != nil {
				return true // offensive moves select their own type
			}
			if !isOffensiveSpecialMove(moveName) {
				return true
			}
		}

		if ability != nil {
			abilityName := ability.(string)
			if !isOffensiveAbility(abilityName) {
				return true
			}
		}

		if tera != nil {
			return true
		}

	case "defense":
		if tera != nil { // default to 6plus like client-side, allowing tera param without needing gen
			if gen == nil {
				validParams["gen"] = "6plus"
			}

			if effectiveGen == "2-5" || effectiveGen == "1" {
				return true
			}
		}

		if move != nil {
			moveName := move.(string)
			if !isDefensiveSpecialMove(moveName) {
				return true
			}

			if types != nil {
				moveType := getMoveType(moveName)
				typeList := types.([]string)
				if slices.Contains(typeList, moveType) {
					return true
				}
			}
		}

		if ability != nil {
			abilityName := ability.(string)
			if !isDefensiveAbility(abilityName) {
				return true
			}
		}

	default: // pageKey == "more"
		if types != nil || move != nil || ability != nil || tera != nil {
			return true // only "gen" is a valid parameter
		}
	}

	return false
}

func isOffensiveSpecialMove(moveName string) bool {
	offensiveMoves := map[string]bool{
		"flying-press":    true,
		"freeze-dry":      true,
		"thousand-arrows": true,
	}
	return offensiveMoves[moveName]
}

func isDefensiveSpecialMove(moveName string) bool {
	defensiveMoves := map[string]bool{
		"forests-curse":  true,
		"trick-or-treat": true,
	}
	return defensiveMoves[moveName]
}

func isOffensiveAbility(abilityName string) bool {
	offensiveAbilities := map[string]bool{
		"flash-fire-atk":   true,
		"scrappy":          true,
		"tinted-lens":      true,
		"water-bubble-atk": true,
	}
	return offensiveAbilities[abilityName]
}

func isDefensiveAbility(abilityName string) bool {
	defensiveAbilities := map[string]bool{
		"flash-fire-def":   true,
		"levitate":         true,
		"lightning-rod":    true,
		"thick-fat":        true,
		"volt-absorb":      true,
		"water-absorb":     true,
		"wonder-guard":     true,
		"dry-skin":         true,
		"filter":           true,
		"heatproof":        true,
		"motor-drive":      true,
		"storm-drain":      true,
		"sap-sipper":       true,
		"delta-stream":     true,
		"fluffy":           true,
		"water-bubble-def": true,
		"earth-eater":      true,
		"purifying-salt":   true,
		"tera-shell":       true,
		"well-baked-body":  true,
	}
	return defensiveAbilities[abilityName]
}

func getMoveType(moveName string) string {
	moveTypes := map[string]string{
		"flying-press":    "fighting",
		"freeze-dry":      "ice",
		"thousand-arrows": "ground",
		"forests-curse":   "grass",
		"trick-or-treat":  "ghost",
	}
	return moveTypes[moveName]
}

func getMinGenForTypes(types []string, mode string) string {
	hasFairy := false
	hasDarkOrSteel := false
	hasStellar := false

	for _, t := range types {
		if t == "fairy" {
			hasFairy = true
		}
		if t == "dark" || t == "steel" {
			hasDarkOrSteel = true
		}
		if t == "stellar" {
			hasStellar = true
		}
	}

	if hasStellar && mode != "offense" {
		return "invalid"
	}

	if hasFairy || hasStellar {
		return "6plus"
	}

	if hasDarkOrSteel {
		return "2-5"
	}

	return ""
}

func isGenCompatible(actualGen string, requiredGen string) bool {
	if requiredGen == "invalid" {
		return false
	}
	if requiredGen == "" {
		return true
	}

	genOrder := map[string]int{"1": 1, "2-5": 2, "6plus": 3}
	return genOrder[actualGen] >= genOrder[requiredGen]
}
