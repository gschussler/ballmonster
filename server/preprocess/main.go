package main

import (
	"html/template"
	"log"
	"net/http"
	"path/filepath"
)

func handler(tmpl *template.Template, basePath string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		data, err := BuildTemplateData(r, tmpl, basePath)
		if err != nil {
			if err == http.ErrNotSupported {
				http.NotFound(w, r)
			} else {
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				log.Printf("Error building template data: %v", err)
			}
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if err := tmpl.Execute(w, data); err != nil {
			http.Error(w, "Template execution error", http.StatusInternalServerError)
			log.Printf("Template error: %v", err)
		}
	}
}

func main() {
	basePath := "/usr/share/nginx/html"

	tmplPath := filepath.Join(basePath, "index.html.tmpl")
	tmpl, err := template.ParseFiles(tmplPath)
	if err != nil {
		log.Fatalf("Failed to parse template: %v", err)
	}

	http.HandleFunc("/", handler(tmpl, basePath))

	port := ":8787"
	log.Printf("Preprocessor listening on %s", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatal(err)
	}
}
