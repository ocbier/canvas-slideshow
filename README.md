# canvas-slideshow

**A canvas slideshow supporting various features.**


**************************************************************************************************************
1. Features:
**************************************************************************************************************
- Auto advance 
- Manual advance
- Randomization
- Transition effects
    - Slide horizontally 
    - Slide vertically
    - Fade out/fade in

**************************************************************************************************************
2. Technical Design:
**************************************************************************************************************
The client requests JSON image URLs and captions. This is stored in a JSON file on the server. Then,
the client preloads images to ensure slides are displayed in a timely manner.

Images are drawn in the canvas rendering area. Each time a new image must be displayed, the rendering area
is redrawn using the data for that image. By default, the next image is determined by incrementing (if forward)
or decrementing (if backward) the image counter. However, this value is randomized if random mode is on.

Sliding effects are achieved by translating image data in the x or y axis for both the current image and the
next image to be displayed, depending on the selected effect and the advance direction.

Finally, the fade effect is achieved by slowly reducing the opacity of the current image and increasing
the opacity of the next image until it reaches 100%.



