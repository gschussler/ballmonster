// Process access requests passed by NGINX in order to define and serve initial site state based on URL.
//! Change `MaxEntries` property of all paramWhiteList keys (excluding `gen`) to 6 upon adding team-mode/moveset-mode

package main

import (
	"encoding/json"
	"html/template"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// values to populate index.html template for initial page load
type TemplateData struct {
	Page     string        // "offense", "defense", or "more"
	Fragment template.HTML // HTML content of the relevant fragment
	State    template.JS   // JSON-encoded initial state for client JS
}

// map URL path to Page key
var pageMap = map[string]string{
	"/":        "offense",
	"/offense": "offense",
	"/defense": "defense",
	"/more":    "more",
}

// rules for query params
type ParamRules struct {
	AllowedValues  map[string]bool
	MaxCount       int // max values per entry
	MaxEntries     int // max repeated params (e.g. 6 pokemon in team mode)
	CommaSeparated bool
}

var paramWhitelist = map[string]ParamRules{
	"gen": {
		AllowedValues: map[string]bool{"1": true, "2-5": true, "6plus": true},
		MaxCount:      1,
		MaxEntries:    1,
	},
	"types": {
		AllowedValues: map[string]bool{
			"normal": true, "fire": true, "water": true, "electric": true,
			"grass": true, "ice": true, "fighting": true, "poison": true,
			"ground": true, "flying": true, "psychic": true, "bug": true,
			"rock": true, "ghost": true, "dragon": true, "dark": true,
			"steel": true, "fairy": true, "stellar": true,
		},
		MaxCount:       2,
		MaxEntries:     1, // 1 for now, increase to 6 for team-mode
		CommaSeparated: true,
	},
	"move": {
		AllowedValues: map[string]bool{"flying-press": true, "freeze-dry": true, "thousand-arrows": true, "forests-curse": true, "trick-or-treat": true},
		MaxCount:      1,
		MaxEntries:    1,
	},
	"ability": {
		AllowedValues: map[string]bool{
			"flash-fire-atk": true, "scrappy": true, "tinted-lens": true, "water-bubble-atk": true, "flash-fire-def": true, "levitate": true, "lightning-rod": true, "thick-fat": true, "volt-absorb": true, "water-absorb": true, "wonder-guard": true, "dry-skin": true, "filter": true, "heatproof": true, "motor-drive": true, "storm-drain": true, "sap-sipper": true, "delta-stream": true, "fluffy": true, "water-bubble-def": true, "earth-eater": true, "purifying-salt": true, "tera-shell": true, "well-baked-body": true,
		},
		MaxCount:   1,
		MaxEntries: 1,
	},
	"tera": {
		AllowedValues: map[string]bool{
			"normal": true, "fire": true, "water": true, "electric": true,
			"grass": true, "ice": true, "fighting": true, "poison": true,
			"ground": true, "flying": true, "psychic": true, "bug": true,
			"rock": true, "ghost": true, "dragon": true, "dark": true,
			"steel": true, "fairy": true,
		},
		MaxCount:   1,
		MaxEntries: 1,
	},
}

// validate path/query params and return template data
func BuildTemplateData(r *http.Request, tmpl *template.Template, basePath string) (*TemplateData, error) {
	// validate path and select fragment
	pageKey, ok := pageMap[r.URL.Path]
	if !ok {
		return nil, http.ErrNotSupported
	}

	// load the corresponding HTML fragment
	fragmentPath := filepath.Join(basePath, "pages", pageKey+".html")
	fragmentBytes, err := os.ReadFile(fragmentPath)
	if err != nil {
		return nil, err
	}

	validParams := make(map[string]interface{})

	for key, rules := range paramWhitelist {
		queryVals := r.URL.Query()[key]
		if len(queryVals) == 0 {
			continue
		}

		if len(queryVals) > rules.MaxEntries {
			queryVals = queryVals[:rules.MaxEntries]
		}

		if rules.CommaSeparated {
			var allEntries [][]string

			for _, entry := range queryVals {
				values := strings.Split(entry, ",")
				cleanVals := []string{}

				for _, v := range values {
					v = strings.TrimSpace(v)
					if rules.AllowedValues[v] && len(cleanVals) < rules.MaxCount {
						cleanVals = append(cleanVals, v)
					}
				}

				if len(cleanVals) > 0 {
					allEntries = append(allEntries, cleanVals)
				}
			}

			if len(allEntries) > 0 {
				if rules.MaxEntries == 1 {
					validParams[key] = allEntries[0]
				} else {
					validParams[key] = allEntries
				}
			}
		} else {
			val := strings.TrimSpace(queryVals[0])
			if rules.AllowedValues[val] {
				validParams[key] = val
			}
		}
	}

	// construct INIT_STATE
	// validParams may return `nil` if no value provided
	stateObj := map[string]interface{}{
		"mode":    pageKey,
		"gen":     validParams["gen"],
		"types":   validParams["types"],
		"move":    validParams["move"],
		"ability": validParams["ability"],
		"tera":    validParams["tera"],
	}

	stateJSON, err := json.Marshal(stateObj)
	if err != nil {
		return nil, err
	}

	data := &TemplateData{
		Page:     pageKey,
		Fragment: template.HTML(fragmentBytes),
		State:    template.JS(stateJSON),
	}

	return data, nil
}
