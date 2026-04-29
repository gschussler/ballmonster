// Mux in place of NGINX web server
package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"

	"strings"
)

var (
	clients   = make(map[chan struct{}]struct{})
	clientsMu sync.Mutex
)

func addClient(ch chan struct{}) {
	clientsMu.Lock()
	clients[ch] = struct{}{}
	clientsMu.Unlock()
}

func removeClient(ch chan struct{}) {
	clientsMu.Lock()
	delete(clients, ch)
	clientsMu.Unlock()
}

func notifyClients() {
	clientsMu.Lock()
	for ch := range clients {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
	clientsMu.Unlock()
}

func reloadHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ch := make(chan struct{}, 1)
	addClient(ch)
	defer removeClient(ch)

	for {
		select {
		case <-ch:
			fmt.Fprintf(w, "event: reload\ndata: {}\n\n")
			w.(http.Flusher).Flush()
		case <-r.Context().Done():
			return
		}
	}
}

func watchDist() {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		panic(err)
	}

	watcher.Add("../../dist")

	go func() {
		for {
			select {
			case _, ok := <-watcher.Events:
				if !ok {
					return
				}
				notifyClients()
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				_ = err
			}
		}
	}()
}

const reloadScript = `<script>
	new EventSource("/__reload").addEventListener("reload", () => location.reload());
</script>`

func injectReloadScript(proxy *httputil.ReverseProxy) *httputil.ReverseProxy {
	proxy.ModifyResponse = func(r *http.Response) error {
		if r.Header.Get("Content-Type") != "text/html; charset=utf-8" {
			return nil
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			return err
		}
		r.Body.Close()

		modified := strings.Replace(string(body), "</body>", reloadScript+"</body>", 1)
		r.Body = io.NopCloser(strings.NewReader(modified))
		r.ContentLength = int64(len(modified))
		return nil
	}
	return proxy
}

func main() {
	target, _ := url.Parse("http://127.0.0.1:8787")
	proxy := httputil.NewSingleHostReverseProxy(target)
	injectReloadScript(proxy)

	watchDist()

	mux := http.NewServeMux()

	mux.HandleFunc("/__reload", reloadHandler)

	for _, route := range []string{"/offense", "/defense", "/more"} {
		mux.Handle(route, proxy)
	}

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			proxy.ServeHTTP(w, r)
			return
		}
		http.FileServer(http.Dir("../../dist")).ServeHTTP(w, r)
	})

	port := ":8080"
	go func() {
		time.Sleep(1 * time.Second)
		fmt.Println("=======")
		fmt.Printf("Local server listening at http://localhost%s\n", port)
		fmt.Println("Press Ctrl-C to stop.")
		fmt.Println("=======")
	}()

	if err := http.ListenAndServe(port, mux); err != nil {
		log.Fatal(err)
	}
}
