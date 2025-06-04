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

    // Client's version
    const CLIENT_VERSION = 1

    // Create a namespace, which will be exposed to window object after version checking
    const TmdbAdvScp = {
        toast: null,
        version: CLIENT_VERSION,
        socketState: false,
        socket: null,
    }

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
     * Helper function to show a toast message if the toast handler is defined.
     * @param {string} message - The text to display in the toast.
     */
    async function toast(message) {
        while (!document.getElementById("toast-container")) {
            await new Promise((resolve) => setTimeout(resolve, 100))
        }

        // No matter the version checking result, make toast function available
        TmdbAdvScp.toast = TmdbAdvScp.toast || window.TmdbAdvScp?.toast

        try {
            if (typeof TmdbAdvScp.toast === "function") {
                TmdbAdvScp.toast(message)
            }
        } catch (e) {
            console.error("❌ [Client] Error calling toast function:", e)
        }
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
            if (response.action === "toast") {
                // Display a toast message in the page if a toast function is provided
                try {
                    toast(response.data)
                } catch (e) {
                    console.error("❌ [Client] Error executing toast function:", e)
                }
            } else if (response.action === "version_result") {
                // Version checking
                if (CLIENT_VERSION === parseInt(response.data)) {
                    // Expose the TmdbAdvScp namespace to the window object
                    window.TmdbAdvScp = window.TmdbAdvScp || {}
                    window.TmdbAdvScp = { ...TmdbAdvScp, ...window.TmdbAdvScp } // don't change the merging order
                } else if (CLIENT_VERSION > parseInt(response.data)) {
                    toast(
                        "⚠️ Server update available.<a href='https://github.com/Tetrax-10/tmdb-advanced-userscripts/archive/refs/heads/main.zip' style='color:#01b3e4;' target='_blank'> Click me to download update</a>."
                    )
                } else if (CLIENT_VERSION < parseInt(response.data)) {
                    toast(
                        "⚠️ Userscripts update available.<a href='https://github.com/Tetrax-10/tmdb-advanced-userscripts?tab=readme-ov-file#-update-guide' style='color:#01b3e4;' target='_blank'> Click me to open the update guide</a>."
                    )
                } else {
                    toast(
                        "❌ Couldn't determine the server's version.<a href='https://github.com/Tetrax-10/tmdb-advanced-userscripts/issues' style='color:#dc3545;' target='_blank'> Please open an issue on GitHub</a>."
                    )
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
                    // Request server to send its version
                    TmdbAdvScp.socket.send("version_request")
                    break
                default:
                    // Log unexpected non-JSON messages
                    console.warn("⚠️ [Client] Received unexpected message:", rawData)
            }
        }
    })
})()
