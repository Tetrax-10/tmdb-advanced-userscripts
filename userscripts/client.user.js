// ==UserScript==
// @name         TheMovieDB Advanced Scripts Client
// @namespace    https://github.com/Tetrax-10
// @version      1.0
// @description  Communicates with TheMovieDB Advanced Scripts server
// @author       Tetrax-10
// @icon         https://www.themoviedb.org/favicon.ico
// @match        *://*.themoviedb.org/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

;(() => {
    /*
     * WebSocket URL for the local server.
     * Change this if your server is running on a different host or port.
     */
    const WS_URL = "ws://localhost:8765"

    // Create a namespace on the window to store state and functions
    window.TmdbAdvScp = window.TmdbAdvScp || {}
    const TmdbAdvScp = window.TmdbAdvScp

    // Track whether the WebSocket is currently open
    TmdbAdvScp.socketState = false

    // Check if the browser supports WebSocket
    if (!("WebSocket" in window)) {
        console.error("❌ [Client] WebSocket is not supported by this browser. TheMovieDB Advanced Scripts Client will not work.")
        return
    }

    // Initialize the WebSocket connection
    try {
        TmdbAdvScp.socket = new WebSocket(WS_URL)
    } catch (e) {
        console.error(`❌ [Client] Failed to create WebSocket connection to ${WS_URL}:`, e)
        return
    }

    /*
     * Handle any errors that occur during the connection phase.
     * This will be called if the connection cannot be made.
     */
    TmdbAdvScp.socket.onerror = (error) => {
        console.error("❌ [Client] Can't connect to server. Please restart server and refresh", error)
    }

    /*
     * When the connection is successfully opened, update the state.
     */
    TmdbAdvScp.socket.addEventListener("open", () => {
        TmdbAdvScp.socketState = true
    })

    /*
     * When the connection closes, warn the user if it was open before.
     * Reset the state so we don't display multiple warnings.
     */
    TmdbAdvScp.socket.addEventListener("close", () => {
        if (TmdbAdvScp.socketState) {
            console.warn("⚠️ [Client] Lost connection to server! Please restart server and refresh")
            TmdbAdvScp.socketState = false
        }
    })

    /*
     * Listen for incoming messages from the server.
     * Messages can be JSON with an "action" field (e.g., "toast") or raw strings like "reload" or "connected".
     */
    TmdbAdvScp.socket.addEventListener("message", (event) => {
        const rawData = event.data

        try {
            // Attempt to parse the incoming data as JSON
            const response = JSON.parse(rawData)

            // Handle known JSON actions
            if (response.action === "toast" && typeof TmdbAdvScp.toast === "function") {
                // Display a toast message in the page if a toast function is provided
                try {
                    TmdbAdvScp.toast(response.data)
                } catch (e) {
                    console.error("❌ [Client] Error executing toast function:", e)
                }
            } else {
                // If the action is unrecognized, log a warning
                console.warn("⚠️ [Client] Unrecognized action received:", response.action)
            }
        } catch (e) {
            // If parsing fails, handle raw string commands
            switch (rawData) {
                case "reload":
                    // Instruct the client to reload the page
                    window.location.reload()
                    break
                case "connected":
                    // Initial handshake from server
                    console.log("✅ [Client] Connected to server")
                    break
                default:
                    // Log unexpected non-JSON messages
                    console.warn("⚠️ [Client] Received unexpected message:", rawData)
            }
        }
    })
})()
