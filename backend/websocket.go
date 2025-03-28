package main

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all connections for simplicity in this example
		// TODO: Implement proper origin checking in production
		return true
	},
}

// Hub maintains the set of active clients and broadcasts messages.
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan *LogEntry // Channel for logs to be broadcasted
	register   chan *Client   // Channel for new clients
	unregister chan *Client   // Channel for clients leaving

	mu sync.Mutex // Protects the clients map
}

// Client is a middleman between the websocket connection and the hub.
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan *LogEntry // Buffered channel of outbound messages
}

func newHub() *Hub {
	return &Hub{
		broadcast:  make(chan *LogEntry),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
	}
}

// Run starts the hub's event loop.
func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Println("Client registered")
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				log.Println("Client unregistered")
			}
			h.mu.Unlock()
		case logEntry := <-h.broadcast:
			h.mu.Lock()
			for client := range h.clients {
				select {
				case client.send <- logEntry:
					// Message queued for client
				default:
					// Drop message if client's buffer is full
					log.Printf("Client buffer full, dropping message for client: %v", client.conn.RemoteAddr())
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.Unlock()
		}
	}
}

// writePump pumps messages from the hub to the websocket connection.
func (c *Client) writePump() {
	defer func() {
		c.conn.Close()
	}()
	for {
		message, ok := <-c.send
		if !ok {
			// The hub closed the channel.
			c.conn.WriteMessage(websocket.CloseMessage, []byte{})
			return
		}

		err := c.conn.WriteJSON(message)
		if err != nil {
			log.Printf("Error writing JSON to client %v: %v", c.conn.RemoteAddr(), err)
			// Assume client disconnected if write fails
			return // This will trigger the readPump defer to unregister
		}
	}
}

// readPump pumps messages from the websocket connection to the hub.
// For this app, we mostly just care about detecting closes.
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	// Configure read limits if necessary
	// c.conn.SetReadLimit(maxMessageSize)
	// c.conn.SetReadDeadline(time.Now().Add(pongWait))
	// c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

	for {
		// Read message (we don't expect client messages, but need to read to detect close)
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Error reading from client %v: %v", c.conn.RemoteAddr(), err)
			} else {
				log.Printf("Client %v disconnected", c.conn.RemoteAddr())
			}
			break // Exit loop on error (usually close)
		}
		// Ignore any messages received from client
	}
}

// serveWs handles websocket requests from the peer.
func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Failed to upgrade connection:", err)
		return
	}
	log.Println("WebSocket connection established:", conn.RemoteAddr())

	client := &Client{hub: hub, conn: conn, send: make(chan *LogEntry, 256)} // Buffered channel
	client.hub.register <- client

	// Allow collection of memory referenced by the caller by doing all work in new goroutines.
	go client.writePump()
	go client.readPump()
}
