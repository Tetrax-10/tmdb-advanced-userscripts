import os
import requests
import warnings
import logging
import json
import asyncio
import shutil

from concurrent.futures import ThreadPoolExecutor, as_completed
from glob import glob
from collections import OrderedDict

# Disable imagededup's warnings and logging to keep output clean
warnings.filterwarnings("ignore")
logging.disable(logging.CRITICAL)

# Paths for temporary downloads and cache
script_path = os.path.dirname(os.path.abspath(__file__))
temp_downloads_path = os.path.join(script_path, "temp_downloads")
cache_path = os.path.join(script_path, "fdi_cache")

# This will be set based on incoming data ("poster", "profile", "backdrop", or "logo")
image_type = None


def get_file_size(file_path):
    """
    Return the size of a file in bytes, or 0 if it doesn't exist.
    """
    try:
        if os.path.exists(file_path):
            return os.path.getsize(file_path)
    except Exception as e:
        print(f"❌ Error getting size for {file_path}: {e}")
    return 0


def get_folder_size(folder):
    """
    Recursively compute the total size of all files in a folder.
    """
    total_size = 0
    try:
        for dirpath, dirnames, filenames in os.walk(folder):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                # Only add size if it's a file
                if os.path.isfile(fp):
                    total_size += get_file_size(fp)
    except Exception as e:
        print(f"❌ Error computing folder size for {folder}: {e}")
    return total_size


def move_downloads_to_cache_folder():
    """
    Move all files from temp_downloads_path to cache_path, then remove temp_downloads_path.
    """
    # Ensure cache directory exists
    try:
        os.makedirs(cache_path, exist_ok=True)
    except Exception as e:
        print(f"❌ Failed to create cache folder {cache_path}: {e}")
        return

    # If there is no temp download folder, skip
    if not os.path.exists(temp_downloads_path):
        print("ℹ️ Temp download folder doesn't exist, skipped moving to cache folder")
        return

    # Move each file from temp_downloads_path to cache_path
    for src_file_path in glob(os.path.join(temp_downloads_path, "*")):
        dst_file_path = os.path.join(cache_path, os.path.basename(src_file_path))
        try:
            shutil.move(src_file_path, dst_file_path)
        except Exception as e:
            print(f"❌ Failed to move image to cache folder {src_file_path}: {e}")

    # Remove the temp download folder
    try:
        shutil.rmtree(temp_downloads_path, ignore_errors=True)
    except Exception as e:
        print(f"❌ Failed to remove temp download folder {temp_downloads_path}: {e}")


def download_image(image_name):
    """
    Download a single image by name. If it's already cached, copy it instead of re-downloading.
    Returns a tuple (success: bool, image_name: str).
    """
    # Ensure the temporary download directory exists
    try:
        os.makedirs(temp_downloads_path, exist_ok=True)
    except Exception as e:
        print(f"❌ Failed to create temp download folder {temp_downloads_path}: {e}")
        return False, image_name

    # Paths for potential file locations
    file_path = os.path.join(temp_downloads_path, image_name)
    file_cache_path = os.path.join(cache_path, image_name)

    # If it's already in cache, copy it to temp and skip actual download
    if os.path.exists(file_cache_path):
        print(f"ℹ️ Cached image available for {image_name}")
        try:
            shutil.copy(file_cache_path, file_path)
            return True, image_name
        except Exception as e:
            print(f"❌ Failed to copy cached image {image_name}: {e}")
            return False, image_name

    # Choose appropriate resolution based on image_type
    res = "w500"
    if image_type in ("poster", "profile"):
        res = "w342"
    elif image_type == "backdrop":
        res = "w780"
    # Construct the TMDB image URL
    url = f"https://image.tmdb.org/t/p/{res}/{image_name}"

    try:
        response = requests.get(url, stream=True, timeout=10)
        # Raise an HTTPError if the response was unsuccessful (4xx or 5xx)
        response.raise_for_status()

        # Write the file in chunks to avoid high memory usage
        with open(file_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        print(f"✅ Downloaded: {image_name}")
        return True, image_name

    except requests.RequestException as e:
        # Catch network-related errors (timeouts, connection errors, etc.)
        print(f"❌ Download failed (network issue): {image_name} ({e})")
    except Exception as e:
        # Catch any other unexpected errors during file write
        print(f"❌ Download failed: {image_name} ({e})")
    return False, image_name


def download_images_concurrently(images):
    """
    Download a list of image filenames in parallel using a ThreadPoolExecutor.
    Returns a list of filenames that were successfully downloaded, preserving input order.
    """
    successful_set = set()
    print(f"⏳ Downloading {len(images)} images...\n")

    try:
        with ThreadPoolExecutor(max_workers=10) as executor:
            # Submit all download tasks
            future_to_name = {executor.submit(download_image, fname): fname for fname in images}

            # As each task completes, collect successes
            for future in as_completed(future_to_name):
                try:
                    success, fname = future.result()
                    if success:
                        successful_set.add(fname)
                except Exception as e:
                    # If a thread raised an unexpected exception, log it
                    print(f"❌ Unexpected error downloading {future_to_name[future]}: {e}")

    except Exception as e:
        print(f"❌ Error setting up concurrent downloads: {e}")

    # Preserve the original order of images for those that succeeded
    ordered_successful_list = [fname for fname in images if fname in successful_set]
    print(f"\nℹ️ Downloaded {len(successful_set)} images out of {len(images)} requested\n")
    return ordered_successful_list


def group_duplicate_images(duplicates):
    """
    Given a dict mapping each image to a list of its duplicates, build connected groups.
    Returns a list of groups (each group is a list of filenames), where multi-image groups
    come first, followed by singletons.
    """
    adjacency = {}
    # Build undirected adjacency list
    for img, duplicate_images in duplicates.items():
        adjacency.setdefault(img, set())
        for other in duplicate_images:
            adjacency.setdefault(other, set())
            adjacency[img].add(other)
            adjacency[other].add(img)

    visited = set()
    groups = []

    def dfs(node, comp):
        visited.add(node)
        comp.append(node)
        for nbr in adjacency.get(node, []):
            if nbr not in visited:
                dfs(nbr, comp)

    # Find all connected components
    for node in adjacency:
        if node not in visited:
            comp = []
            dfs(node, comp)
            groups.append(comp)

    # Separate multi-image groups from single-image groups
    multi = [grp for grp in groups if len(grp) > 1]
    singles = [grp for grp in groups if len(grp) == 1]

    return multi + singles


def sort_dict_based_on_list(dict_to_sort, reference_list):
    """
    Given a dictionary and a reference order (list), produce a new dict containing only
    keys present in reference_list, in that same order.
    """
    sorted_dict = OrderedDict()
    for fname in reference_list:
        if fname in dict_to_sort:
            sorted_dict[fname] = dict_to_sort[fname]
    return dict(sorted_dict)


def flatten_list_group(nested_list):
    """
    Flatten a list of lists into a single list.
    """
    return [image for sublist in nested_list for image in sublist]


def extract_duplicates_from_groups(data):
    """
    From a list of groups (each a list of filenames), return a flat list of filenames
    that are in multi-image groups (i.e., actually have duplicates).
    """
    return [item for group in data if len(group) > 1 for item in group]


# If the cache grows beyond 50 MB, clear it on module load
try:
    if get_folder_size(cache_path) > 50 * 1024 * 1024:
        shutil.rmtree(cache_path, ignore_errors=True)
except Exception as e:
    print(f"❌ Error while clearing cache folder {cache_path}: {e}")


def find_dups(min_similarity_threshold=0.85):
    """
    Identify duplicate images in temp_downloads_path using either Perceptual hashing (PHash) for logos
    or Convolutional Neural Network (CNN) for other image types. Returns a mapping {image: [list of duplicates]}.
    """
    # Ensure threshold is a float
    try:
        min_similarity_threshold = float(min_similarity_threshold)
    except Exception as e:
        print(f"❌ Invalid similarity threshold '{min_similarity_threshold}': {e}")
        # Fallback to default
        min_similarity_threshold = 0.85

    from imagededup.methods import CNN, PHash

    use_phash_for = "logo"

    if image_type in use_phash_for:
        # For logos, use PHash (binary hashes) and convert similarity threshold to Hamming distance
        try:
            phasher = PHash(verbose=False)
            # Convert similarity threshold to max Hamming distance (0 to 64)
            max_distance_threshold = int((1 - min_similarity_threshold) * 64)
            print(f"🤖 Identifying duplicates using PHash (max distance threshold: {max_distance_threshold}) / (mst: {min_similarity_threshold})...\n")
            return phasher.find_duplicates(image_dir=temp_downloads_path, max_distance_threshold=max_distance_threshold)
        except Exception as e:
            print(f"❌ Error in PHash duplicate detection: {e}")
            return {}
    else:
        # For all other image types, use CNN embeddings with cosine similarity
        try:
            cnn_encoder = CNN(verbose=False)
            print(f"🤖 Identifying duplicates using CNN (min similarity threshold: {min_similarity_threshold:.2f})...\n")
            return cnn_encoder.find_duplicates(image_dir=temp_downloads_path, min_similarity_threshold=min_similarity_threshold)
        except Exception as e:
            print(f"❌ Error in CNN duplicate detection: {e}")
            return {}


async def find_duplicate_images(data, websocket):
    """
    Main entry point for handling 'find_duplicate_images' action from client.
    Downloads images, identifies duplicates, and sends the result back over WebSocket.
    """
    print("🫡 Client requested to find duplicate images\n")

    # Safely extract expected fields from incoming data
    try:
        global image_type
        image_type = data.get("imageType", "")
        images_list = data.get("images", [])
        min_similarity = data.get("minSimilarityThreshold", 0.85)
    except KeyError as e:
        print(f"❌ Missing required field in data: {e}")
        return
    except Exception as e:
        print(f"❌ Unexpected error parsing data: {e}")
        return

    async def display_toast(message):
        """
        Send a 'toast' notification (simple message) to the client over the WebSocket.
        """
        try:
            await websocket.send(json.dumps({"action": "toast", "data": message}))
        except Exception as e:
            print(f"❌ Failed to send toast message '{message}': {e}")

    # Notify client that downloads are starting
    await display_toast("📥 Fetching images...")

    # Download all requested images concurrently
    downloaded_images = []
    try:
        downloaded_images = download_images_concurrently(images_list)
    except Exception as e:
        print(f"❌ Error during image download: {e}")
        return

    # Notify client that duplicate detection is starting
    await display_toast("🤖 Identifying duplicates...")

    # Run the duplicate-finding in a thread to avoid blocking the event loop
    try:
        duplicates_map = await asyncio.to_thread(find_dups, min_similarity)
    except Exception as e:
        print(f"❌ Error during duplicate detection: {e}")
        return

    # Sort the duplicates mapping according to download order
    sorted_duplicates_map = sort_dict_based_on_list(duplicates_map, downloaded_images)

    # Group images that are transitively duplicates of each other
    duplicate_images_grouped = group_duplicate_images(sorted_duplicates_map)

    # Flatten the grouped images for easier handling
    sorted_images = flatten_list_group(duplicate_images_grouped)

    # Extract a flat list of images that actually have duplicates
    duplicate_images = extract_duplicates_from_groups(duplicate_images_grouped)

    # Prepare the response payload
    result_payload = {"action": "find_duplicate_images_result", "data": {"duplicate_images_grouped": duplicate_images_grouped, "sorted_images": sorted_images, "duplicate_images": duplicate_images}}

    # Send the result back to the client
    try:
        await websocket.send(json.dumps(result_payload))
    except Exception as e:
        print(f"❌ Failed to send duplicate images result: {e}")

    # Move the downloaded files into the cache folder for future reuse
    move_downloads_to_cache_folder()

    print(f"✅ {'No ' if len(duplicate_images) == 0 else ''}Duplicate images found, result sent to client\n")
