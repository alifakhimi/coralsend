package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"

	"github.com/alifakhimi/mardjan/apps/server/internal/signal"
)

var addr = flag.String("addr", ":8080", "http service address")

// CORS middleware
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		next(w, r)
	}
}

func main() {
	flag.Parse()
	hub := signal.NewHub()
	go hub.Run()

	http.HandleFunc("/ws", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		signal.ServeWs(hub, w, r)
	}))

	http.HandleFunc("/health", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Mardjan Signal Server OK")
	}))

	fmt.Printf("Mardjan Signaling Server listening on %s\n", *addr)
	fmt.Printf("Server is accessible from all network interfaces (0.0.0.0)\n")
	err := http.ListenAndServe(*addr, nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
