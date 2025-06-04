// ==UserScript==
// @name         TheMovieDB Toast
// @namespace    https://github.com/Tetrax-10
// @version      1.0
// @description  Displays toast notifications on TheMovieDB
// @author       Tetrax-10
// @icon         https://www.themoviedb.org/favicon.ico
// @match        *://*.themoviedb.org/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

;(async () => {
    // Inject CSS for this userscript
    try {
        GM_addStyle(`
#toast-container {
    position: fixed;
    bottom: 30px;
    width: 100%;
    display: flex;
    justify-content: center;
    pointer-events: none;
    z-index: 9999;
}

.toast {
    background-color: #333;
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 15px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    animation: fadeInOut 5s forwards;
    max-width: 80vw;
    white-space: pre-wrap;
    word-wrap: break-word;
    text-align: center;
    pointer-events: all;
}

@keyframes fadeInOut {
    0% {
        opacity: 0;
        transform: translateY(20px);
    }
    10%,
    90% {
        opacity: 1;
        transform: translateY(0);
    }
    100% {
        opacity: 0;
        transform: translateY(20px);
    }
}
`)
    } catch (e) {
        console.error("❌ [Toast] Failed to inject CSS:", e)
    }

    // Ensure our namespace exists on the unsafeWindow
    unsafeWindow.TmdbAdvScp = unsafeWindow.TmdbAdvScp || {}

    /**
     * Display a toast notification with the given message.
     * Clears any existing toast and shows the new one for 5 seconds.
     * @param {string} message - The text/html to display inside the toast.
     */
    unsafeWindow.TmdbAdvScp.toast = (message) => {
        try {
            const container = document.getElementById("toast-container")
            if (!container) {
                console.error("❌ [Toast] Toast container not found")
                return
            }

            // Clear any existing toasts
            container.innerHTML = ""

            // Create the toast element
            const toast = document.createElement("div")
            toast.className = "toast"
            toast.innerHTML = message

            container.appendChild(toast)

            // Remove the toast after 5 seconds
            setTimeout(() => {
                try {
                    if (container.contains(toast)) {
                        container.removeChild(toast)
                    }
                } catch (removeErr) {
                    console.error("❌ [Toast] Error removing toast:", removeErr)
                }
            }, 5000)
        } catch (e) {
            console.error("❌ [Toast] Error displaying toast:", e)
        }
    }

    // Wait until the <body> exists before injecting the toast container
    while (!document?.body) {
        await new Promise((resolve) => setTimeout(resolve, 10))
    }

    // Create and append the toast container to the body
    try {
        const toastContainer = document.createElement("div")
        toastContainer.id = "toast-container"
        document.body.appendChild(toastContainer)
    } catch (e) {
        console.error("❌ [Toast] Failed to create or append toast container:", e)
    }
})()
