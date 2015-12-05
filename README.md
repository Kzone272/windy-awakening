# Windy Awakening

## Kevin Haslett - 20468033

### CS488 Fall 2015 Final Project

#### Installation Instructions

First unzip the "website" folder

If you already have a web server running you can simply drop the entire "website" folder into your hosting folder and run it from there.
ex: place "website" into "htdocs" (if you're running apache)

If you don't currently have a web server running, don't worry you don't need one.  You can simply open the "index.html" file with your browser.  However there may be some additional steps to follow to get everything to run this way, depending on which browser you use.

#### Execution Instructions

Please use the latest version of either Google Chrome, or Firefox.  I have tested with Google Chrome and Firefox on Windows, as well as Chromium on the grahpics labs machines.  All have worked without problems as far as I can tell.

I tested this with Google Chrome on Windows most extensively, so if you can, please test it there.

If you are using **Firefox** on Windows, everything should work just fine out of the box.  Open the "index.html" file inside of the "website" folder and you're good to go.

If you are testing on **Google Chrome** or **Chromium** browser you will need to launch chrome with a special flag to allow for xhr requests to be made to and from "file://" urls.

First, close all open processes of Chrome.  If you don't close all open Chrome processes this won't work.

In **Google Chrome** on Windows, create a shortcut to Chrome on your desktop.

- Right Click -> Properties
- In the "Target" field, add the following flag to the current target, *after* the quotations:
- --allow-file-access-from-files
- It should now look something like this:
- "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --allow-file-access-from-files
- Now launch Chrome by clicking the shortcut.
- Everything is now complete, simply open the "index.html" file with Chrome

In **Chromium** on Ubuntu (graphics lab),

- Run the following command from the Terminal:
- chromium-browser --allow-file-access-from-files
- Everything is now complete, simply open the "index.html" file with Chrome

#### Operating Instructions

The controls are as follows (they are also listed on the webpage to remind you):

- Click the canvas to capture the mouse (this one is important)
- WASD to move the boat
- Mouse to rotate camera
- Scroll wheel to zoom camera
- Space to freeze day/night cycle
- Hold Q to reverse day/night cycle
- Hold E to advance day/night cycle

You will also notice a number of checkboxes and dropdown options for demonstration purposes.
You can enable/disable certain features with the checkboxes.
You can also view some alternate frame buffers by selecting different options under the "Testing Mode" dropdown.
All of these controls should be easily understood by their names, and by playing with them a bit.
Nothing you do is irreversible so don't worry.

#### Objectives

1. Texture Mapping
2. Cell Shading
3. Shadow Mapping
4. Bloom Shader
5. Gooch Lighting Model and Day/Night Cycle
6. Voronoi Diagrams
7. Edge Detection
8. Gaussian Blur and Threshold Mapping to Generate Final Water Texture
9. Island Terrain Generated Using Perlin Noise
10. Simple Sailing Physics