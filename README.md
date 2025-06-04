# TMDb Advanced Userscripts

A collection of advanced userscripts for [themoviedb.org](https://www.themoviedb.org/) — useful for both casual users and moderators.

## 🖼️ Find Duplicate Images

Tired of going through hundreds of posters, backdrops, logos, or profile images to find duplicates? This tool makes it easy.

https://github.com/user-attachments/assets/73802022-4221-4896-ab35-68532bc1e32f

## 🛠️ Installation Guide

### 1. Install Python

Download and install Python from [python.org](https://www.python.org/downloads/).

### 2. Download this Project

-   [Click here to download](https://github.com/Tetrax-10/tmdb-advanced-userscripts/archive/refs/heads/main.zip)
-   Extract the ZIP file.

### 3. Setup Files

-   Copy the `tmdb.cmd` file (from the extracted folder) anywhere you like — this will be your launcher.
-   Copy the entire `tmdb-advanced-userscripts` folder to `C:\` (so scripts folder is available in `C:\tmdb-advanced-userscripts\scripts`).

### 4. Install PyTorch (Pick One)

Open a terminal in the `C:\tmdb-advanced-userscripts` folder and run:

**For NVIDIA GPU users:**

Make sure your GPU driver is version 520.61 or newer (for CUDA 11.8). Install PyTorch with:

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
```

💡 _Not sure what CUDA your GPU supports? Check [this list](https://en.wikipedia.org/wiki/CUDA#GPUs_supported) or ask ChatGPT._

Check if PyTorch installed with CUDA correctly, by running:

```bash
python -c "import torch; print(torch.cuda.is_available())"
```

It should output `True`, if its `False` try installing a different version of CUDA or you can just install `CPU-only` version 👇 (slower computation).

**For non-NVIDIA or Mac users (CPU-only):**

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

### 5. Install Dependencies

```bash
pip install -r requirements.txt
```

💡 _For Mac Users: The above process is similar, but note that the Windows path and `tmdb.cmd` won't work for you. Instead, navigate to `tmdb-advanced-userscripts/scripts` and run `python server.py`._

### 6. Install Userscripts

Click and install the following userscripts (you’ll need a userscript manager like [Tampermonkey](https://www.tampermonkey.net/)):

-   [client.user.js](https://raw.githubusercontent.com/Tetrax-10/tmdb-advanced-userscripts/refs/heads/main/userscripts/client.user.js)
-   [findDuplicateImages.user.js](https://raw.githubusercontent.com/Tetrax-10/tmdb-advanced-userscripts/refs/heads/main/userscripts/findDuplicateImages.user.js)
-   [toast.user.js](https://raw.githubusercontent.com/Tetrax-10/tmdb-advanced-userscripts/refs/heads/main/userscripts/toast.user.js)

---

## ✅ How to Use

1. Double-click `tmdb.cmd` to start the server.
2. Go to any image page on TMDb (posters, backdrops, etc.).
3. Click the **Find Duplicates** button that appears.
4. Use the slider to adjust the **Similarity Threshold**:

    - Default value is set for each image type, which already works best
    - 100 = exact matches only
    - 75–95 = recommended for best balance
    - Lower values may detect more but less accurate

---

## 📥 Update Guide

-   [Click here to download](https://github.com/Tetrax-10/tmdb-advanced-userscripts/archive/refs/heads/main.zip) the latest source code.
-   Replace your `tmdb-advanced-userscripts` with the new one.

💡 _If you get any error after the update, do [Step 5: Install Dependencies](#5-install-dependencies)._

## 💬 Support

Need help or found a bug?

-   Create an issue [here](https://github.com/Tetrax-10/tmdb-advanced-userscripts/issues)
-   Or message me on Discord: [@tetrax10](https://discord.com/users/1040249560418750536)
