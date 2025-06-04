// ==UserScript==
// @name         TheMovieDB Find Duplicate Images
// @namespace    https://github.com/Tetrax-10
// @version      1.0
// @description  Handles client side logic for finding duplicate images
// @author       Tetrax-10
// @icon         https://www.themoviedb.org/favicon.ico
// @match        *://*.themoviedb.org/tv/*/images/backdrops*
// @match        *://*.themoviedb.org/tv/*/images/posters*
// @match        *://*.themoviedb.org/movie/*/images/backdrops*
// @match        *://*.themoviedb.org/movie/*/images/posters*
// @match        *://*.themoviedb.org/movie/*/images/logos*
// @match        *://*.themoviedb.org/person/*/images/profiles*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

;(async () => {
    /*
     * Wait until the WebSocket client is connected and the document body is available.
     * This ensures we don't try to interact with the page or socket before they're ready.
     */
    while (!(unsafeWindow.TmdbAdvScp?.socketState && document?.body)) {
        await new Promise((resolve) => setTimeout(resolve, 100))
    }

    const TmdbAdvScp = unsafeWindow.TmdbAdvScp
    let isPageSorted = false // Tracks whether the page has been resorted to highlight duplicates
    let imageType = null // Will be set based on the URL path
    const originalSortOrder = [] // Store original order to reset later if needed

    // Determine the type of images on the current page based on URL path
    if (document.location.pathname.includes("/images/backdrops")) {
        imageType = "backdrop"
    } else if (document.location.pathname.includes("/images/posters")) {
        imageType = "poster"
    } else if (document.location.pathname.includes("/images/logos")) {
        imageType = "logo"
    } else if (document.location.pathname.includes("/images/profiles")) {
        imageType = "profile"
    } else {
        console.error(`❌ [Find Duplicate Images] Unsupported image type: ${imageType}`)
    }

    // Default similarity threshold
    let minSimilarityThreshold = imageType === "profile" ? 0.95 : 0.85

    /*
     * Helper function to show a toast message if the toast handler is defined.
     * @param {string} message - The text to display in the toast.
     */
    function toast(message) {
        try {
            if (typeof TmdbAdvScp.toast === "function") {
                TmdbAdvScp.toast(message)
            }
        } catch (e) {
            console.error("❌ [Find Duplicate Images] Error calling toast function:", e)
        }
    }

    /*
     * Collect all image filenames visible in the ul.images list.
     * Builds a list of unique filenames and preserves the original order if not in sorted mode.
     * @returns {string[]} Array of image filenames (e.g., 'abcd.jpg').
     */
    function getAllImagesFromCurrentPage() {
        const images = []

        // If this is a not sorted page, clear the original order
        if (!isPageSorted) {
            originalSortOrder.length = 0
        }

        document.querySelectorAll("ul.images li").forEach((li) => {
            try {
                // Each <li> should contain an anchor with class 'picture' or 'image'
                const imageItem = li.querySelector("a.picture, a.image") || null
                const imageUrl = imageItem?.href || null

                // If we have a valid image URL, extract the filename
                if (imageUrl) {
                    const imageName = imageUrl.split("/").pop() || null
                    if (imageName && !images.includes(imageName)) {
                        images.push(imageName)
                        // If not in sorted page, keep track of the original order
                        if (!isPageSorted) {
                            originalSortOrder.push(imageName)
                        }
                    }
                }
            } catch (e) {
                console.error("❌ [Find Duplicate Images] Error parsing image element:", e)
            }
        })

        return images
    }

    /*
     * Reorder the DOM elements in ul.images to match the sortedImages order.
     * Highlight items in duplicateImages by adding a CSS class.
     * @param {string[]} sortedImages - Filenames in the order they should appear.
     * @param {string[]} duplicateImages - Filenames that are duplicates.
     */
    function sortImageElements(sortedImages, duplicateImages) {
        const ul = document.querySelector("ul.images")
        if (!ul) {
            console.error("❌ [Find Duplicate Images] ul.images element not found")
            return
        }

        // Convert live HTMLCollection to array for sorting
        const items = Array.from(ul.children)

        // Map each filename to its desired index
        const orderMap = new Map(sortedImages.map((name, index) => [name, index]))

        // Sort the <li> items based on their filenames' indices
        items.sort((a, b) => {
            try {
                const hrefA = a.querySelector("a.picture, a.image")?.getAttribute("href") || ""
                const hrefB = b.querySelector("a.picture, a.image")?.getAttribute("href") || ""
                const fileNameA = hrefA.split("/").pop()
                const fileNameB = hrefB.split("/").pop()

                const indexA = orderMap.has(fileNameA) ? orderMap.get(fileNameA) : Infinity
                const indexB = orderMap.has(fileNameB) ? orderMap.get(fileNameB) : Infinity
                return indexA - indexB
            } catch (e) {
                console.error("❌ [Find Duplicate Images] Error comparing items during sort:", e)
                return 0
            }
        })

        // Remove existing items from the list
        items.forEach((item) => {
            try {
                ul.removeChild(item)
            } catch (e) {
                console.error("❌ [Find Duplicate Images] Error removing item from ul.images:", e)
            }
        })

        // Re-insert items in sorted order, marking duplicates in red
        items.forEach((item) => {
            try {
                const link = item.querySelector("a.picture, a.image")
                const imageName = link?.getAttribute("href")?.split("/").pop()
                const infoDiv = item.querySelector("div.info")

                if (infoDiv) {
                    infoDiv.classList.remove("find-dups-red-card")
                    if (duplicateImages?.includes(imageName)) {
                        infoDiv.classList.add("find-dups-red-card")
                    }
                }

                ul.appendChild(item)
            } catch (e) {
                console.error("❌ [Find Duplicate Images] Error re-inserting sorted item:", e)
            }
        })

        // Mark that we've sorted the page
        isPageSorted = true
    }

    /*
     * Handle incoming WebSocket messages for duplicate image results.
     * Expects JSON with { action: "find_duplicate_images_result", data: { ... } }.
     */
    TmdbAdvScp.socket.addEventListener("message", (event) => {
        try {
            const jsonData = JSON.parse(event.data)

            // Process only the find_duplicate_images_result action
            if (jsonData.action === "find_duplicate_images_result") {
                console.log("ℹ️ [Find Duplicate Images] Response from server:", jsonData.data)

                const duplicateImages = jsonData.data.duplicate_images || []
                // If duplicates found, reorder elements
                if (duplicateImages.length) {
                    toast(`✅ Found ${duplicateImages.length} duplicate images`)
                    sortImageElements(jsonData.data.sorted_images, duplicateImages)
                } else {
                    toast("✅ No duplicate images found")
                    if (isPageSorted) {
                        // If we had previously highlighted duplicates, reset to original order and color
                        sortImageElements(originalSortOrder, [])
                        isPageSorted = false
                    }
                }
            }
        } catch (e) {
            // Likely a non-JSON message; ignore
        }
    })

    /*
     * Send a 'find_duplicate_images' request to the server with necessary data.
     * If already sorted, reset to original order first.
     */
    function findDuplicateImages() {
        if (!TmdbAdvScp.socketState) {
            toast("❌ Server is offline, please restart server and refresh")
            console.error("❌ [Find Duplicate Images] Socket state is false, Server is offline")
            return
        }

        // If we're already displaying duplicates, reset to original state
        if (isPageSorted) {
            sortImageElements(originalSortOrder, [])
            isPageSorted = false
        }

        // Gather all image filenames from the current page
        const images = getAllImagesFromCurrentPage()
        if (!images.length) {
            console.error("❌ [Find Duplicate Images] Could'nt extract any images from the page")
            return
        }

        // Build and send the request payload
        try {
            TmdbAdvScp.socket.send(
                JSON.stringify({
                    action: "find_duplicate_images",
                    data: {
                        images,
                        imageType,
                        minSimilarityThreshold,
                    },
                })
            )
        } catch (e) {
            console.error("❌ Error sending find_duplicate_images request:", e)
            toast("❌ Failed to send request to server")
        }
    }

    /////////////////////////////////////// UI ///////////////////////////////////////

    // Add CSS styles for this userscript
    GM_addStyle(`
/* red image cards */
section.inner_content ul.images li.card div.info.find-dups-red-card {
    background-color: #ef9a9a;
}
html[data-darkreader-scheme] section.inner_content ul.images li.card div.info.find-dups-red-card {
    background-color: #691111;
}

/* TMDB section header */
section.inner_content section.header {
    align-items: center;
    }
/* Container for the "Find Duplicate Images" controls */
.find-dups-container {
    margin-left: auto;
    display: flex;
    gap: 40px;
}

/* Style for the "Find Duplicate Images" button */
.find-dups-button {
    border: 2px solid #cfcfcf;
    color: #cfcfcf;
    font-weight: 700;
    font-size: 1em;
    border-radius: 20px;
    padding: 6px 20px;
    text-transform: uppercase;
    background: transparent;
    cursor: pointer;
}
.find-dups-button:hover {
    background-color: #000;
    color: #fff;
}

/* Wrapper for the slider control */
.find-dups-slider-wrapper {
    display: flex;
    align-items: center;
    gap: 15px;
}

/* Control box around slider and numeric input */
.find-dups-slider-control {
    display: flex;
    align-items: center;
    border: 2px solid #cfcfcf;
    border-radius: 20px;
    overflow: hidden;
    background: transparent;
}

/* Buttons to step slider value */
.find-dups-step-btn {
    background: transparent;
    color: #cfcfcf;
    border: none;
    padding: 4px 12px;
    font-size: 18px;
    font-weight: bold;
    cursor: pointer;
    user-select: none;
}
.find-dups-step-btn:active {
    background-color: rgba(255, 255, 255, 0.1);
}

/* Numeric input for slider value */
.find-dups-slider-value-box {
    background: transparent;
    color: #cfcfcf;
    border: none;
    text-align: center;
    width: 40px;
    font-size: 18px;
    font-weight: bold;
    appearance: textfield;
}
.find-dups-slider-value-box::-webkit-inner-spin-button,
.find-dups-slider-value-box::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

/* Range input (slider) */
#find-dups-slider {
    width: 200px;
    height: 6px;
    border-radius: 4px;
    background: #888;
    outline: none;
    transition: background 0.3s ease;
}
#find-dups-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    background: #fff;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
#find-dups-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: #fff;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
`)

    /*
     * Create and return a container DIV for the slider + button UI.
     */
    function createContainer() {
        const container = document.createElement("div")
        container.className = "find-dups-container"
        return container
    }

    /*
     * Create and return the slider control (with minus/plus buttons and numeric input).
     * Sets up event listeners to keep slider and input in sync, and to update minSimilarityThreshold.
     */
    function createSlider() {
        const sliderWrapper = document.createElement("div")
        sliderWrapper.className = "find-dups-slider-wrapper"

        // Control box for minus button, numeric input, plus button
        const control = document.createElement("div")
        control.className = "find-dups-slider-control"
        control.title = "Similarity Threshold 1 – 100"

        const minusBtn = document.createElement("button")
        minusBtn.className = "find-dups-step-btn"
        minusBtn.textContent = "−"

        const inputBox = document.createElement("input")
        inputBox.type = "number"
        inputBox.min = "1"
        inputBox.max = "100"
        inputBox.step = "1"
        inputBox.value = minSimilarityThreshold * 100
        inputBox.className = "find-dups-slider-value-box"
        inputBox.id = "slider-value-input"

        const plusBtn = document.createElement("button")
        plusBtn.className = "find-dups-step-btn"
        plusBtn.textContent = "+"

        control.appendChild(minusBtn)
        control.appendChild(inputBox)
        control.appendChild(plusBtn)

        // Range slider for threshold selection
        const slider = document.createElement("input")
        slider.type = "range"
        slider.id = "find-dups-slider"
        slider.min = "1"
        slider.max = "100"
        slider.step = "1"
        slider.value = minSimilarityThreshold * 100
        slider.title = "Similarity Threshold 1 – 100"

        // Sync numeric input → slider, validate numeric input
        inputBox.addEventListener("input", () => {
            try {
                const raw = inputBox.value.trim()
                if (!/^\d+$/.test(raw)) {
                    // Not a valid integer, reset to previous threshold
                    const fallback = Math.round(minSimilarityThreshold * 100)
                    inputBox.value = fallback
                    slider.value = fallback
                    return
                }

                let val = parseInt(raw, 10)
                val = Math.min(Math.max(val, 1), 100)
                inputBox.value = val
                slider.value = val
                minSimilarityThreshold = (val / 100).toFixed(2)
            } catch (e) {
                console.error("❌ [Find Duplicate Images] Error handling slider input:", e)
            }
        })

        // Sync slider → numeric input
        slider.addEventListener("input", () => {
            try {
                const val = parseInt(slider.value, 10)
                inputBox.value = val
                minSimilarityThreshold = (val / 100).toFixed(2)
            } catch (e) {
                console.error("❌ [Find Duplicate Images] Error handling slider change:", e)
            }
        })

        // Decrement button
        minusBtn.addEventListener("click", () => {
            try {
                let val = parseInt(inputBox.value, 10) - 1
                val = Math.max(val, 1)
                inputBox.value = val
                slider.value = val
                minSimilarityThreshold = (val / 100).toFixed(2)
            } catch (e) {
                console.error("❌ [Find Duplicate Images] Error decrementing slider value:", e)
            }
        })

        // Increment button
        plusBtn.addEventListener("click", () => {
            try {
                let val = parseInt(inputBox.value, 10) + 1
                val = Math.min(val, 100)
                inputBox.value = val
                slider.value = val
                minSimilarityThreshold = (val / 100).toFixed(2)
            } catch (e) {
                console.error("❌ [Find Duplicate Images] Error incrementing slider value:", e)
            }
        })

        sliderWrapper.appendChild(control)
        sliderWrapper.appendChild(slider)
        return sliderWrapper
    }

    /*
     * Create and return the "Find Duplicates" button.
     * Adds a click listener that checks for images and triggers the findDuplicateImages function.
     */
    function createButton() {
        const button = document.createElement("button")
        button.className = "find-dups-button"
        button.textContent = "Find Duplicates"

        button.addEventListener("click", (e) => {
            e.preventDefault()
            try {
                // If no image list is present, alert the user
                if (document.querySelector("ul.images li")?.id === "no_results") {
                    toast("❌ No images found on this page.")
                    return
                }
                findDuplicateImages()
            } catch (err) {
                console.error("❌ [Find Duplicate Images] Error in Find Duplicate Images button click:", err)
            }
        })

        return button
    }

    /*
     * Inject the slider and button UI into TheMovieDB page header.
     * Waits until the target header section is in the DOM before inserting.
     */
    async function injectUI() {
        // Wait until the page header element is available
        while (!document.querySelector("section.inner_content section.header")) {
            await new Promise((resolve) => setTimeout(resolve, 100))
        }

        const targetLocation = document.querySelector("section.inner_content section.header")
        if (!targetLocation) {
            console.error("❌ [Find Duplicate Images] Target header not found")
            return
        }

        try {
            const container = createContainer()
            const sliderWrapper = createSlider()
            const button = createButton()

            container.appendChild(sliderWrapper)
            container.appendChild(button)
            targetLocation.appendChild(container)
        } catch (e) {
            console.error("❌ [Find Duplicate Images] Error injecting UI elements:", e)
        }
    }

    // Kick off the UI injection
    injectUI()
})()
