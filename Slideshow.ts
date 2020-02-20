/*  File contains all classes required for canvas slide show. Handles events on the different slideshow 
 * control buttons which invoke the appropriate callback functions. This allows:
 *	 - Autoplay toggle
 *   - Direction reversal
 *   - Manual advance and retreat with buttons or touch gestures
 *   - Different image transition effects
 *   - Dynamic resizing and full screen
 *
 *  Image locations and captions are loaded from a JSON file using AJAX request. Images are then and are then preloaded 
 *  using Image objects. These images are displayed within the canvas. 
 */
 
 
export {Slideshow} 

class Slideshow
{
	/*****Slideshow settings *******/
	
	public static readonly defaultImageWidth : number = 640;
	public static readonly defaultImageHeight : number = 480;
	public static readonly playSpeed : number = 8000;                          //Slide show play speed in ms.
	public static readonly aspectRatio : number = 16/9;                        //Aspect ratio for images.
	public static readonly animationSpeed : number = 33;                       //Redraw rate for animations.
	public static readonly fadeStep : number = 0.008;	                         //Amount to fade after each redraw.
	public static readonly loadTimeout : number = 90000;                       //Timeout for image loading set to 90000ms or 1m 30s.

	public static readonly preloaderElemID : string = "preloader";
	
		
	images: HTMLImageElement[] = [];                                        //Array holding references to Image objects.
		 
	private globalImageWidth : number = Slideshow.defaultImageWidth;        //Actual value for image width. Set to default initially
	private globalImageHeight : number = Slideshow.defaultImageHeight;      //Actual value to use for image height. Set to default initially.
	private interval : number = 0;                                         //ID returned by setInterval() when a function is assigned.
	private imageCounter : number = 0;   					               //current image index in array "images".
	
	private imagesLocationResource: string;
	
	private canvas : any;                                                 //The canvas element for displaying slide show.
	private context : any;                                                //Get the new graphics context for appropriate coordinate space.
	private controls : ControlsManager | null = null;                    //ControlElements for slideshow.
	private captions : any;                                               //The captions element in which to display captions.

	private slideshowElemID: string;
		
	drawingFunction : any = function() {};
	

	constructor(slideshowElemID: string, imageDataJSONLoc: string) {
		this.slideshowElemID = slideshowElemID;

		this.imagesLocationResource = imageDataJSONLoc;
	}

	
	/*Preloads image data using preloadImages() as a callback to handle loaded image data. 
	 * Images are loaded from location specified imagesLocationResource.
	 */
	preload()
	{
		this.getJSONData((request: XMLHttpRequest, thisArg: Slideshow)=> {
			this.preloadImages(request, thisArg);
		});
	}



	/*Function to begin the slideshow and initialize all necessary objects and variables. 
	  Awaits load of first image before beginning slideshow. 
	  @param loadTimeoutCounter optional current timeout value for loading images*/
	start(loadTimeoutCounter : number, showPreloader: boolean = true)
	{
				
		 window.addEventListener("pageshow", ()=> {
				if (showPreloader === true)
					this.showPreloader();

				this.canvas = document.getElementById("image-canvas"); 
				this.captions = document.getElementById("imageCaption");
				this.context = this.canvas.getContext("2d");	
		 
			 });
			 

		 this.handleImageLoad(loadTimeoutCounter, showPreloader);

	 }	



	 private handleImageLoad(loadTimeoutCounter:number, showPreloader:boolean)
	 {
		let timeoutCounter =  0;
		   
		timeoutCounter = loadTimeoutCounter;
		   
		   
		//First check if images have been loaded.
		if (this.imagesLoaded())
		{
			this.fadeoutPreloader(1200);                                       //Fadeout the preloader cover for page in 1200ms.
			setTimeout(()=>{
									
			//Calc dynamic width and height of canvas if it has been set in css. Also sets context to the graphics context for this canvas.
			this.resizeCanvas();                                                 
												
			this.drawingFunction = (slide : any) => {                                 //Set current drawing function.
				this.drawSlide(this.captions , this.globalImageWidth, this.globalImageHeight, slide); 
			};
							
			this.imageCounter = -1;           //First set image counter to position before first image in array imageData.
			this.setupControls();            //Assign callbacks to buttons. Appropriate graphics context specified in arg context.
		
			this.drawNextSlide();           //Draw first slide immediately.
							
			/*Call togglePlay() to change state of play button, and call
			resumeSlideShow() to continue the slideshow. Pass element with 
			id imageCaption to specify where to draw the captions. */
			this.controls.togglePlay();
							
			this.resumeSlideShow();
							
			}, 600);
		}
				
		/*If timeout has not yet been reached, check if images have been loaded by calling loadImages() again after 500ms */
		else if (timeoutCounter <  Slideshow.loadTimeout)
		{
			setTimeout(()=>{                 //Pass current timeout value + 500 and call start() again.
				this.handleImageLoad(timeoutCounter + 500, showPreloader);
			}, 500);                                //Check every 500ms to see if images have finished loading.
		}

		else
		{
			alert("Unfortunately, slideshow could not be loaded. Refresh the page or try again later.");
		}






	 }




	 /*Shows the preloader which may be used while images are loaded, if desired */
	private showPreloader()
	{
		document.getElementById(this.slideshowElemID).style.opacity = String(0.1);            //Set opacity of slideshow to 0.1;
		
		
		let preloader = document.createElement("div");
		preloader.id = Slideshow.preloaderElemID;
		let preloaderState =  document.createElement("div");
		preloaderState.id = "preloader-state";
		preloader.appendChild(preloaderState);
		document.body.appendChild(preloader);
		
		preloader.style.opacity = String(0.9);                                    //Set opacity of preloader to 0.9
	}

	   
	   
	   /*Checks to see if images have been loaded and returns true if they have and false otherwise */
	   private imagesLoaded() : boolean
	   {
		   /*If array is null or empty, images have not yet been loaded fully */
		   if (!this.images || this.images.length == 0)
			   return false;
		   
		   /*If array is not empty, check if all images are loaded */
		   for (let i = 0; i < this.images.length; ++i)
		   {
			   /*If any image is null == 0 == false, or has not been loaded completely, return false.*/
			   if ( (!(this.images[i].complete && this.images[i] )) || ( (typeof this.images[i]) === 'undefined')  )
				   return false;
		   }
		   
		   return true;                         //If this point is reached, all images are loaded, so return true.
	   }





	/* Creates an XMLHttpRequest object to retrieve JSON data from a particular location. Assigns 
	   appropriate event listner for the the readstatechange event on this object and sets
	   calback. 
	   @param string resource indicating the location of the JSON data
	   @param function callback a callback to assign to eventlistener for readystatechange event */
	private getJSONData(callback : Function)
	{
		try
		{
			var xhr = new XMLHttpRequest();                                   //Create request.
			
			//Assign event listener for readystatechange event and pass xhr object to callback.
			xhr.addEventListener("readystatechange", ()=> {
					callback(xhr, this);
				}, false);        
				xhr.responseType = "json";                                        //Set response type to json.
				xhr.open("GET", this.imagesLocationResource, true);                                  //Open the GET request and specify resource.
				xhr.send(null);                                                   //Send request. 
			
		} catch(exception)
		{
			alert("Error. Request unsuccessful");
		}
	}
		
		
	/*Begins to load images as soon as request is received here */
	private preloadImages (request : XMLHttpRequest, thisArg: Slideshow)
	{
		if (request.readyState === 4 && request.status === 200)
		{
			console.log(thisArg);
			console.log(thisArg.slideshowElemID);

			//Get the array of objects holding image source locations as JSON data.
			var imageLocationList = request.response;    
			imageLocationList.forEach((current : any)=> {
				//Push Image objects onto images, but set src first, and alt attributes first.
				var curImage = new Image();
				curImage.src = current.path;
				curImage.alt = current.caption;

				thisArg.images.push(curImage);     
			});
					
		}
	}

 
	 
		


	/*Fades out preloader in the specified duration */	
	private fadeoutPreloader(duration: number)
	{
	
		let slideshowElem = document.getElementById(this.slideshowElemID);
		let preloader = document.getElementById(Slideshow.preloaderElemID);
		
		let opacity = Number();

		let preloaderInvisible = false;
		let slideshowVisible = false;
		
				
		if(Number(slideshowElem.style.opacity) < 1.0)
			slideshowElem.style.opacity = String(Number(slideshowElem.style.opacity) + Slideshow.fadeStep);            //Increase opacity of slideshow until it reaches 1
		else
			slideshowVisible = true;

		if(Number(preloader.style.opacity) > 0.0)                         //Decrease opacity of preloader until it reaches 0
			preloader.style.opacity = String(Number(preloader.style.opacity) - Slideshow.fadeStep);
		else
			preloaderInvisible = true;
			
	
		if (!(preloaderInvisible && slideshowVisible))
		{
			setTimeout(()=> {
				this.fadeoutPreloader(duration)
			}, 1);
		}
		
		else
		{
			preloader.style.display = "none";
		}
	}
	




	/*Begins to play the slide show at the current position. Uses setInterval() to call
	function drawNextSlide() which advances the slide show. This function shall be called
	at the interval specified by playSpeed. Pass reference to array "images" holding image data,
	context and current position to drawNextSlide().
	
	Assigns the ID returned by setInterval() to interval.
	
	@param context Graphics context for canvas
	@param captionElement DOM element in which to display caption
	@param reversed boolean indicating if play order is reversed.
	
	*/
	private resumeSlideShow() 
	{ 
		clearInterval(this.interval);     //Make sure there is no function currently being called for this interval.
				
		/*Call appropriate function to advance slide show. The function to call
		  will depend on the current play direction which is determined by calling Control.isReversed().
		  The function is called each slideTime ms. */
		this.interval = setInterval(()=> {
			  
			   //If slideshow isn't set to random. 
			   if (!(this.controls.isRandom()))
			   {
				   //If the play direction is not reversed, call drawNextSlide(). Otherwise call drawPreviousSlide().
					(!(this.controls.isReversed())) ? this.drawNextSlide() : this.drawPreviousSlide(); 
			   }
			   
			   //Otherwise, if we are in random mode, draw a random slide.
			   else
				   this.drawRandomSlide();
				   
			}, Slideshow.playSpeed);
	}
	
	
	
	/*Draws the next image in imageData and its associated caption using image alt attribute.
	  imageCounter will be incremented. Drawing is performed using current drawingFunction(),
		meaning any currently selected effects will be applied.*/
	private drawNextSlide()
	{ 
		let nextCounter = this.imageCounter + 1;    //First increment.
		if (nextCounter >= this.images.length)     //wrap around if last element in array is exceeded.
			nextCounter = 0;
				
		this.drawingFunction(nextCounter);       //Call current drawing function to draw image to canvas Pass arg true to indicate forward.
		
	}	
	
	/*Similar functionality to drawNextSlide() 
	  Draws the previous image in imageData and its associated caption using image alt attribute.
	   Key difference is that imageCounter is decremented so that previous slide is drawn.
	 */
	 
	private drawPreviousSlide()
	 {
		 let nextCounter = this.imageCounter - 1;

		 if (nextCounter < 0)                         //Then check if we are below index 0.
			 nextCounter = this.images.length - 1;        //If so, set to last index to wrap around.
		 
		 this.drawingFunction(nextCounter);               //Pass arg of false to drawing function to indicate backward.
	  }
	 

	 /*Draws a random slide to the canvas using context. Uses Math.Random to determine an integer
	 between 0(inclusive) and images.length (exclusive).
	 Drawing is done using the current drawingFunction().*/
	 private drawRandomSlide()
	 {
		let nextCounter = Math.floor(this.images.length * Math.random());
		this.drawingFunction(nextCounter);
	 }
	 
	 
	 /*Draws the correct image from array "images" to canvas given the specified 
	   context and the slide index. Sets imageCounter to slide value to mark
	   new slide.
	   The caption will be drawn to DOM element specified by parameter captionElement.
	   
	   Note that check is performed to ensure that slide has been loaded.
	   @param context The graphics context for canas
	   @param captionElemet DOM elem for caption
	   @param width The width of image to draw
	   @param height Height of image to draw
	   @param slide the position in image data array for image to draw  */
	 private drawSlide(captionElement: HTMLElement, width : number, height : number, slide : number)
	 {
		this.imageCounter = slide;                                                     //Assign value of slide to imageCounter.
		
		try{
				 
			 this.context.clearRect(0, 0, width, height);                        //Clear the canvas image area before drawing.
			 
			 console.log("Drawing " + this.images[this.imageCounter].src);

			 this.context.drawImage(this.images[this.imageCounter], 0, 0, width, height);
			 captionElement.innerHTML = this.images[this.imageCounter].alt;                  //Draw the caption in captionElement in DOM. 
		 
		   } catch(ex)
		    {
				console.log("Could not draw image " + this.imageCounter + "to canvas because of exception: " + ex.toString());
		     }
	 }
	 
	
	
	
	
	
	/*Dynamically resizes canvas and images while maintaining aspect ratio. Uses computed style width value (if specified)
	  to determine correct width and height. Sets context to graphics context for this canvas.*/
	private resizeCanvas(isFullscreen : boolean = false)
	{
		
		/*Use the computed style to set the actual width  (x coordinate range)
		  for canvas. This allows dynamic styling with css. */
		let computedWidth : string = window.getComputedStyle(this.canvas, null)["width"];
		let computedHeight : string = window.getComputedStyle(this.canvas, null)["height"];
		
		this.context = this.canvas.getContext("2d");          //Get the new 2D graphics context for appropriate coordinate space.


		/*Full screen case. Draw to entire screen */
		if (computedWidth && computedHeight && isFullscreen === true)
		{
			this.globalImageWidth = window.innerWidth;
			this.globalImageHeight = window.innerHeight;
		}

		

		//If style has been specified, change width and height of canvas and images from default.
		else if (computedWidth)
		{
			this.globalImageWidth = this.canvas.width = parseInt(computedWidth);       //Set width of canvas and images to computed width.  
			//Set height of canvas and images, adjusting for aspect ratio by multiplying globalImageWidth by inverse of aspectRatio.
			this.globalImageHeight = this.canvas.height = Math.pow(Slideshow.aspectRatio, -1) * this.globalImageWidth;    
		}
				
		
		this.context.clearRect(0, 0, this.globalImageWidth, this.globalImageHeight);    //Clear the canvas after resize to prevent image corruption.
		
	}	
	
	
	/*Adds event listners to all the buttons in the slide show and creates appropriate Controls element
      to manage slideshow controls. */
	private setupControls()
	{
		/*Get the DOM button elements */
		let playElem = document.getElementById("play-toggle");             //DOM input button for playing or pausing.
		let directionElem = document.getElementById("direction-toggle");   //DOM input button for changing direction.
		let randomElem = document.getElementById("random-toggle");        //DOM input button for randomization.
		let nextElem = document.getElementById("next");                  //DOM input button for next slide.
		let previousElem = document.getElementById("previous");          //DOM input button for previous slide.
		let selectorElem: any = document.getElementById("effects-selector");  //DOM input button selector for different effects.
		let captionElem = document.getElementById("imageCaption");      //DOM input button image caption.
		let fullScreenElem = document.getElementById("full-screen");
		

		this.setupTouchControls();                                           //Setup controls for touch (left and right swipe to navigate).

		this.setupKeyboardControls();

		this.setupViewChangeHandling();
		
		/*Button controls. Create ControlElement elements and place them in ControlsContainer object. Specify 
		property for DOM element of each button and its state as args to 
		ControlElement ctor for each control button. Also specify callback and event which fires it.*/
	    var container = Object.create(ControlsContainer, {
			/*Button to play and pause slide show */
			playButton : {
				configurable: false,
				writable: true,
				enumerable: true,
				//Play active initially, so set second arg of ControlElement to true.
				value: new ControlElement(playElem, true, ()=> {
					this.playCallback(); 
				}, "click")                                                                 
			}, 
			/*Button to change direction of slide show */
			directionButton : {
				configurable: false,
				writable: true,
				enumerable: true,
				//Not reversed initially.
				value: new ControlElement(directionElem, true, ()=>{
					this.directionCallback();
				}, "click")                                          
			},
			/*"Random" button to randomize slide show */
			randomButton : {
				configurable: false,
				writable: true,
				enumerable: true,
				//Not random initially.
				value: new ControlElement(randomElem, true, ()=> {
					this.randomCallback();
				}, "click")                                         
			},  
			/*"Next" button to advance slide show */
			nextButton : {
				configurable: false,
				writable: true,
				enumerable: true,
				value: new ControlElement(nextElem, true, ()=>{
					this.nextCallback();
				}, "click")                                         
			},
			/*"Previous" button for going back to previous slide.*/
			previousButton : {
				configurable: false,
				writable: true,
				enumerable: true,
				value: new ControlElement(previousElem, true, ()=>{
					this.previousCallback();
				}, "click")                                         
			},
						
			fullScreenButton : {
				configurable: false,
				writable: true,
				enumerable: true,
				value: new ControlElement(fullScreenElem, true, ()=>{
					this.fullScreenButtonCallback();
				}, "click")
			},

			/*The selector element for effects. Pass effectCallback() as callback for change event.
			  Callback takes arguments for the graphics context and the current option selected (value attribute)
			  of associated select element. Sets the appropriate drawing function to be used
			  throughout slideshow to produce desired effect.*/
			effectSelector : {
				configurable: false,
				writable: true,
				enumerable: true,
				value: new ControlElement(selectorElem, true, ()=> {                 
					this.effectCallback( this.captions, selectorElem.value);
				}, "change")                                                //Unlick buttons, this callback fires on change.   
			}               
		});
		
		/*Set up controls for slideshow with the buttons in DOM for play, direction, and random toggle actions
		  Also pass value indicating if slideshow is playing initally*/
		this.controls = new ControlsManager(container);	
	}


	private setupTouchControls()
	{
		const precision = 15;                         //Movement must be 15 or more pixels to count as a swipe.
		var startX = 0;
		
		/*Add event listeners for touch events for forward and backward swipe. 
		 Detect the touch start and touch event events and determine if we have swipe
		 from left to right or right to left.  */
		 this.canvas.addEventListener("touchstart", (ev : any) => {
			ev.preventDefault();
						
			startX = ev.changedTouches[0].clientX;           //The first touch point that became active with this touch start event.     
		
		});                                         


		this.canvas.addEventListener("touchend", (ev : any) => {
			ev.preventDefault();

			console.log("touchend");

			let endX = ev.changedTouches[0].clientX;         //Where touch point is removed (e.g. user removes finger).
			let difference = endX - startX;
						

			/*Movement is to the right so move forward */
			if (difference >= precision)
			{
				clearInterval(this.interval);
				if (this.controls.isPlaying()) 
					this.controls.togglePlay();                  //Mark slideshow as paused if it is currently playing. 

				this.drawNextSlide();
			}

			/*Movement is to the left so move backwards*/
			else if (difference <= precision * -1)
			{
				clearInterval(this.interval);
				if (this.controls.isPlaying()) 
					this.controls.togglePlay();     //Mark slideshow as paused if it is currently playing. 

				this.drawPreviousSlide();
			}

			/*Otherwise, there was no horizontal movement that is >= precision, so do nothing. */

		});  

	}

	private setupKeyboardControls()
	{
		/*Handle left and right arrow presses to advance slideshow*/
		document.addEventListener("keydown", (ev) => {
		
			if (ev.key === "ArrowLeft")
			{
				clearInterval(this.interval);
				if (this.controls.isPlaying()) 
					this.controls.togglePlay();     //Mark slideshow as paused if it is currently playing. 

				this.drawPreviousSlide();
			}

			else if (ev.key === "ArrowRight")
			{
				clearInterval(this.interval);
				if (this.controls.isPlaying()) 
					this.controls.togglePlay();     //Mark slideshow as paused if it is currently playing. 

				this.drawNextSlide();
			}
		});


	}



	
	/*Produces a fading transition from the current image on the canvas to the next image 
	@param captionElem DOM element in which to display image captions
	@param nextCounter The index in image array for the image to which to transition
	@param width Optional value for width of images to draw, which will be set to defaultWidth if null
	@param height Optional value for height of images to draw, which will be set to defaultHeight if null */
	private fadeTransition(captionElem: HTMLElement, nextCounter: number, width: number = -1, height: number = -1)
	{
		var imgWidth = width;
		var imgHeight = height;
		//If no valid width is specified, use globalImageWidth
		if (typeof(imgWidth) === 'undefined' || width < 0)
			imgWidth = this.globalImageWidth;
		
		if (typeof(imgHeight) === 'undefined' || height < 0)
			imgHeight = this.globalImageHeight;
		
		clearInterval(this.interval);                                  //Clear interval before beginning animation.
		
		this.interval = setInterval(()=> 
		{
			//If the global alpha is > 0.1, decrease by 0.1, then redraw image currently at imageCounter.
			if (this.context.globalAlpha >= 0.1)
			{
				this.drawSlide( captionElem, imgWidth, imgHeight, this.imageCounter);
				this.context.globalAlpha -= Slideshow.fadeStep;
			}
					
			/*Otherwise clear the interval, draw the next slide and assign a different function to 
			 slowly increase global alpha again. Redraw image after each increment*/
			else
			{		
				clearInterval(this.interval);
				this.imageCounter = nextCounter;                     //Set imageCounter to the nextCounter value.
							
				this.interval = setInterval(()=>
				{
					//Draw new image and increment the global alpha value to increase opacity.
					if (this.context.globalAlpha < 1.0)
					{
						this.drawSlide( captionElem, imgWidth, imgHeight, this.imageCounter);
						this.context.globalAlpha += Slideshow.fadeStep;
						
					}
					/*When the global alpha value reaches 1.0, call clearInterval to stop
					calling function, since image has reached full opacity. */
					else
					{
						clearInterval(this.interval);
						if(this.controls.isPlaying())   //Call resumeSlideShow if slideshow is in "playing" mode
							this.resumeSlideShow();
					}
						
				}, Slideshow.animationSpeed);
			}//End-else	
				
		}, Slideshow.animationSpeed);
	} //End-function fadeTransition
	
	
	
	/* Creates a horizontal sliding effect between slides. The overall approach here is to
	   slowly transform both the old slide and the new slide in the x-axis. Translation
	   is negative for forward movement in slideshow or positive for backwards movement.
	   This means that slides move from right to left for a forward advance direction, or
	   left to right for a backwards movement.
	  
	   Both slides redrawn in their new positions until the new slide is completely visible
	   within the canvas. 
	   @param captionElem DOM element in which to display image captions
	   @param nextCounter The index in image array for the image to which to transition
	   @param width Optional value for width of images to draw, which will be set to defaultWidth if null
	   @param height Optional value for height of images to draw, which will be set to defaultHeight if null */
	private horizontalTransition(captionElem : HTMLElement, nextCounter: number, width: number = -1, height: number = -1)
	{
		clearInterval(this.interval);
		
		var imgWidth = width;
		var imgHeight = height;
		//If no valid width is specified, use globalImageWidth
		if (typeof(imgWidth) === 'undefined' || width < 0)
			imgWidth = this.globalImageWidth;
		
		if (typeof(imgHeight) === 'undefined' || height < 0)
			imgHeight = this.globalImageHeight;
		
		var offset = 0;                              //Current offset from canvas origin.              
		var increment = 3;                           //Amount by which to increment offset on each redraw.
		let speed = Slideshow.animationSpeed / increment;    //Calculate redraw rate.
		
		let forward : boolean = this.imageCounter < nextCounter;
				
		
		const negImgWidth = imgWidth * -1;              //Calc negative image width only once.
		const limit = imgWidth + increment;           //Limit x coord for next slide to stop.
		
		this.context.save();                 //Save original context state.
				
		//Call setInterval to begin animation. Call function every animationSpeed ms.
		this.interval = setInterval(()=>
		{
			this.context.save();                                 //Save this state again.
			this.context.clearRect(0, 0, imgWidth, imgHeight);         //Clear canvas area before continuing with drawing.
			
			//Translate x coord of context by offset (- for forwards or + for backwards)
			( (forward) ? this.context.translate(-1 * offset, 0) : this.context.translate(offset, 0) );
			
			//draw slide one   <-- current slide at imageCounter
			this.context.drawImage(this.images[this.imageCounter], 0, 0, imgWidth, imgHeight);
			 
			/*Translate x coord of context to right (for forward) or left(for backward) by imageWidth 
			  Important to note here that translation is applied to current transformation matrix,
			  since context.restore() is not called before calling context.translate(). */
			( (forward) ? this.context.translate(imgWidth, 0) : this.context.translate(negImgWidth, 0) );
			
			//draw slide two but don't clear canvas   <-- slide at nextCounter		   
			this.context.drawImage(this.images[nextCounter], 0, 0, imgWidth, imgHeight); 
			offset += increment;                                 //Increase offset.
			
			this.context.restore();                              //Restore transformation matrix to initial state.
				
			/*clear interval to stop animation if offset > imgWidth, which means that (0, 0) in image 2 local
			 coordinates is now at canvas' original origin. */
			if (offset >= limit)
			{
				clearInterval(this.interval);
				
				this.imageCounter = nextCounter;                            //Set imageCounter to the index of the new slide.
				captionElem.innerHTML = this.images[this.imageCounter].alt;    //Draw the caption in captionElement in DOM.
				
				if(this.controls.isPlaying())                          //Call resumeSlideShow if slideshow is in "playing" mode
					this.resumeSlideShow();
			}
		}, speed);
	}
	
	
	/* Produces a vertical scrolling effect to transition between images.
	  Very similar approach to function horizontalTransition. The only significant
	  difference is that translations are applied in the y-axis, rather than in the x-axis.
		@param captionElem DOM element in which to display image captions
		@param nextCounter The index in image array for the image to which to transition
		@param width Optional value for width of images to draw, which will be set to defaultWidth if null
		@param height Optional value for height of images to draw, which will be set to defaultHeight if null */
	private verticalTransition(captionElem: HTMLElement, nextCounter: number, width: number = -1, height: number = -1)
	{
		clearInterval(this.interval);
		
		let imgWidth = width;
		let imgHeight = height;

		//If no valid width is specified, use globalImageWidth
		if (typeof(imgWidth) === 'undefined' || width < 0)
			imgWidth = this.globalImageWidth;
		
		if (typeof(imgHeight) === 'undefined' || height < 0)
			imgHeight = this.globalImageHeight;
				
		let offset = 0;                                             //Current offset from canvas origin.              
		let increment = 3;                                          //Amount by which to increment offset on each redraw.
		let speed = Slideshow.animationSpeed / increment;           //Calculate redraw interval.
		
		let forward : boolean = this.imageCounter < nextCounter     //Is movement forward or backwards?
        		
		let negImgHeight = imgHeight * -1;                          //Negative value of imgHeight
		const limit = imgHeight + increment;                       //Y-axis Limit for where to stop drawing.
		
				
		this.context.save();                                       //Save original context state.
				
		//Call setInterval to begin animation. Call function every animationSpeed ms.
		this.interval = setInterval(() =>
		{
			this.context.save();                                 //Save this state again.
			this.context.clearRect(0, 0, imgWidth, imgHeight);         //Clear canvas area before continuing with drawing.
			
			//Translate y coord of context to push down on each redraw (for forwards) or up (for backward)
			( (forward) ? this.context.translate(0, offset) : this.context.translate(0, -1 * offset) );
			
			//draw slide one   <-- current slide at imageCounter
			this.context.drawImage(this.images[this.imageCounter], 0, 0, imgWidth, imgHeight);
			 
			/* Translate the y coordinate by the height of the image before drawing second slide.
			   Negative y direction for forward movement or positive y direction for backward movement. So this
				draws new image above the existing image for forward movement, or below it for backwards movement.*/
			( (forward) ? this.context.translate(0, negImgHeight) : this.context.translate(0, imgHeight) );
			
			//draw slide two but don't clear canvas   <-- slide at nextCounter		   
			this.context.drawImage(this.images[nextCounter], 0, 0, imgWidth, imgHeight); 
			offset += increment;                                 //Increase offset.
			
			this.context.restore();                              //Restore transformation matrix to initial state.
				
			/*The animation is halted if offset becomes > imgHeight since we now have (0, 0) in local
			  coordinates for image 2 at the original canvas origin  */
			if (offset >= limit)
			{
				clearInterval(this.interval);
				
				this.imageCounter = nextCounter;                            //Set imageCounter to the index of the new slide.
				captionElem.innerHTML = this.images[this.imageCounter].alt;    //Draw the caption in captionElement in DOM.
				
				if(this.controls.isPlaying())                          //Call resumeSlideShow if slideshow is in "playing" mode
					this.resumeSlideShow();
			}
		}, speed);
		
	}
		
		
	
	/*Callback for playing or pausing slideshow */
	private playCallback()
	{
		var state = this.controls.togglePlay();             //Indicate change to state in the interface.
		
		if (!state)                                     //If slideshow is not marked as playing, stop play.
			clearInterval(this.interval);
		else                                             //Otherwise call resumeShow() to continue slideshow in correct direction. 
			this.resumeSlideShow();
	}
	

	/* Callback for direction button. Simply call controls.toggleDirection to mark the
    	play direction as being inverted. Then stop the slideshow and clear the interval by calling
	   clearInterval(). Then play the slideshow in the new direction by calling resumeSlideShow().
	   This function will then play the slide show in the new direction.
	   
    */
	private directionCallback()
	{ 
		let reversed = this.controls.toggleDirection();  
	    this.resumeSlideShow();
	}
	
	
	
	/* Set callback for the randomization button. Sets the function called by setInterval() to
       a function which calculates imageCounter as a random integer between 0 (inclusive) and images.length
		exclusive). 
	    @param captionElem the DOM element in which to display image caption*/
	private randomCallback()
	{
		//Toggle state of random button.
		var randomState = this.controls.toggleRandom();
		clearInterval(this.interval);       //Clear the current interval to stop current function used for slideshow.
			
		//Store the returned id in interval and assign function and speed.
		this.interval = setInterval(() => {
			if(randomState)                 //If the random button state toggles to true.
				this.drawRandomSlide();
				
			else                             //Otherwise continue slideshow sequentially in whatever order is set.
				this.resumeSlideShow();
			
		}, Slideshow.playSpeed);
	}
	

	/*Set callback for next button. Does nothing if slideshow is not in sequential, non-random mode.
       Simply advances to next slide and stops automatic advance. 
	   @param captionElem the DOM element in which to display image caption*/
	private nextCallback()
	{
		if (!(this.controls.isRandom()) )
		{
			clearInterval(this.interval);
			if (this.controls.isPlaying()) 
				this.controls.togglePlay();     //Mark slideshow as paused if it is currently playing. 
			this.drawNextSlide();
		}
	}
			
	/*Very similar to callback for next button.
	  Only difference is that drawPreviousSlide is called. 
	@param captionElem the DOM element in which to display image caption*/
	private previousCallback()
	{
		if (!(this.controls.isRandom()) )
		{
			clearInterval(this.interval);
			if (this.controls.isPlaying()) 
				this.controls.togglePlay();     //Mark slideshow as paused if it is currently playing.             
			this.drawPreviousSlide();
		}
	}


	private fullScreenButtonCallback()
	{
		let browserFullScreen = null;

			
		/*Determine which function the browser supports */
		browserFullScreen = this.canvas.requestFullscreen || 
		this.canvas.webkitRequestFullScreen || this.canvas.mozRequestFullScreen || this.canvas.msRequestFullscreen || null;
			
			if (browserFullScreen !== null)
			{
								
				browserFullScreen.call(this.canvas);             //Call the full screen method on the canvas element.
				
			}
		
	
	
	}

	/**
	 * Determine when we need to resize and redraw canvas. This includes handlers for full screen mode toggle
	 *  and for orientation change.
	 */
	private setupViewChangeHandling()
	{
		let viewChange = ()=> {
			   
				this.resizeCanvas(this.controls.isFullScreen());
				
				setTimeout(() => {
					this.drawSlide(this.captions, this.globalImageWidth, this.globalImageHeight, this.imageCounter);
				}, 500);                                   //Short delay before drawing next slide to avoid issues with drawing during resize.
				
				if (this.controls.isPlaying())
				{
					this.resumeSlideShow();
				}
		};


		this.canvas.addEventListener("fullscreenchange", () => {
		if (this.controls.isPlaying())
		{
			clearInterval(this.interval);                //Temporarily stop any auto play.
		}
			this.controls.toggleFullScreen();               //Change fullscreen button state.
			viewChange();
		});


		window.addEventListener("orientationchange", viewChange);    //On orientation change, resize canvas dynamically.

		window.addEventListener("resize", viewChange);               //Resize canvas dyamically if window resizes.


	}




	
	/*Callback for the effects select element. Assigns appropriate function using setInterval
	  in order to achieve effect. If the "None" option is selected, effects are cleared by
	  calling resumeSlideShow 
	  @param captionElem the DOM element in which to display image caption
	  @param option the option selected for effect to use for slide show*/
	  private effectCallback(captionElem: HTMLElement, option: string)
	{
		console.log(option);
		
		//Clear the effects by simply setting drawingFunction to drawSlide();
		if (option === "None")
		{
			this.drawingFunction = (slide: any)=> {
				this.drawSlide( captionElem, this.globalImageWidth, this.globalImageHeight, slide);
			};
		}	
		
		/*Fade option is selected so use function which 
		 fades out each slide and transitions smoothly to next slide.
          So set drawingFunction to fadeTransition(). 
		  Next counter must be passed to drawing function, which indicates
		  image to which to which to transition.*/
		else if (option === "fade")
		{
			this.drawingFunction = (nextCounter : number)=> {
				this.fadeTransition( captionElem, nextCounter);
			};
		}
		
		/*Slide-across option is selected. This means drawing function
		  should be set to horizontalTransition function().
		 */
		else if (option === "slide-across")
		{
			this.drawingFunction = (nextCounter : number)=> {
				this.horizontalTransition(captionElem, nextCounter);
			};
		}
		
		/*Slide-vertically across option is selected. This means drawing function
		  should be set to horizontalTransition function().
		 */
		else if (option === "slide-vertically")
		{
			this.drawingFunction = (nextCounter : number)=> {
				this.verticalTransition(captionElem, nextCounter);
			};
			
		}	
		
	}
	
}		
	
	 
	
	




	/* ctor for object representing a control button. Has attributes for DOM element of button and state of the button
	Also allows an optional callback to be assigned to the button.*/
	class ControlElement
	{

		domElement: any;

		/*True indicates button is available, while false indicates it is not. */
		isEnabled: boolean;
		
		/*Is action of button active ? Set to false initially*/
		state: boolean = false;



		constructor (elem: any, enabled: boolean, callback: any, eventName: string) {
			this.domElement = elem;
			this.isEnabled = enabled;

			/*Set button's associated action to be inactive initially by adding class "inactive" to DOM element. */
			this.domElement.classList.add("inactive"); 

			/*Add button class based on original isEnabled value*/
			if (this.isEnabled)
				this.domElement.classList.add("enabled"); 
			else 
				this.domElement.classList.add("disabled");


			/*If callback and eventName are specified, use setCallback to specify event listener
		     and callback for this ControlElement.*/
			if (callback && eventName)
			{
				this.addCallback(eventName, callback);
			}
		}
		
			
		            
     
		
				
		/*Toggle state of element and return new state. Adds class "active" to element
		  if it is in active state, otherwise set class to "inactive"*/
		toggle() : boolean
		{   
			/*If button is not enabled, then it cannot have a state of active or inactive, as the
			  associated cannot be toggled. So make sure disabled is mutually exclusive with active state.*/
			if (this.isEnabled)
			{
				if (this.state)
				{
					this.domElement.classList.replace("active", "inactive");   //Replace class "active" with "inactive"
					return this.state = false;
				}
				
				this.domElement.classList.replace("inactive", "active");     //Replace class "inactive" with "active"
				return this.state = true;
			}

			return false;
		}
		


		/*Marks button as enabled or disabled and returns this value. Disabled is mutually exclusive with active state.*/
		toggleEnabled(): boolean
		{
			if (this.isEnabled)
			{
				this.domElement.classList.replace("enabled", "disabled");
				if (this.getState())                                         //If state is active, set to inactive.
					this.toggle();
				
				return this.isEnabled = false;
			}
			
			/*Otherwise, if the button is not enabled, set class from disabled to enabled */
			this.domElement.classList.replace("disabled", "enabled");   
			return this.isEnabled = true;
		}
		

		/*Change DOM element associated with this ControlElement */
		setDomElement(buttonElement : HTMLElement)
		{
			this.domElement = buttonElement;
		}
		
		/*Get the DOM element associated with this ControlElement */
		getDomElement() : HTMLElement
		{
			return this.domElement;
		}
		
		/*Returns true if the action associated with this button is active, false otherwise */
		getState() : boolean
		{
			return this.state;
		}
		
		isActive() : boolean
		{
			return this.isEnabled;
		}
		
		addCallback(eventName : string, callback : any) : any
		{
			this.domElement.addEventListener(eventName, ()=>{
				callback(); 
			}, false);
		}
		
		
	}




	class ControlsManager
	{
		private playButton: ControlElement;
		private directionButton: ControlElement;
		private randomButton: ControlElement;
		private nextButton: ControlElement;
		private previousButton: ControlElement;
		private effectSelector: ControlElement;
		private fullScreenButton: ControlElement;


		/* ctor for object managing the button controls of slideshow. Composed of different ControlElement objects. 
			Takes args for the ControlElement objects representing the buttons. Maintains the state of each button. Functions are 
			provided for behaviour of each button, given its state. This is important for determining button
			appearance, but is also used to aid in recording system state. 
			@param controlsContainer object holding DOM elements for the slideshow controls 
			@param playing indicates if slide show is playing initally
	 	*/
		constructor(controlsContainer: ControlsContainer) {
			this.playButton = controlsContainer.playButton;
		
			this.directionButton = controlsContainer.directionButton;
			this.randomButton = controlsContainer.randomButton;
			this.nextButton = controlsContainer.nextButton;
			this.previousButton = controlsContainer.previousButton;
			this.effectSelector = controlsContainer.effectSelector;
			this.fullScreenButton = controlsContainer.fullScreenButton;

		}

		

		/*Toggles the state of the play button. Signals change in appearance accordingly from
		  changing value attribute. Note that ControlElement object's toggle() method will also set 
		  class attribute to "enabled" or "disabled" when button state is changed. This is more of a generic
		  indicator of state.
		  		  
		  Returns current state as true or false*/
		togglePlay() : boolean
		{
			//Change the state of the play button and then change text of DOM element based on returned current state.
			this.playButton.getDomElement().innerText = ( (this.playButton.toggle()) ? "Pause" : "Play");    
			
			let playing = this.isPlaying();
			let randomEnabled = (this.randomButton).isActive();
			let directionEnabled = (this.directionButton).isActive();
		
			/*Random button and direction button should be enabled if slide show is playing */
			if(playing)
			{
				if(!randomEnabled)
					this.randomButton.toggleEnabled();
				
				if (!directionEnabled)
					this.directionButton.toggleEnabled();
			}
			
			/*Make sure that if slide show is not playing, random button and direction buttons are disabled */
			else
			{
				if(randomEnabled)
					this.randomButton.toggleEnabled();
				
				if (directionEnabled)
					this.directionButton.toggleEnabled();
			}
				
			return playing;
		}
		
		/*Similar behaviour to togglePlay(). 
		  Toggle state of direction button and return new state. Set text of button
		  appropriately by modifying value attribute. Return new state of button*/
		toggleDirection() : boolean
		{
			//Remember button state false means order is forward. True means reversed.
			this.directionButton.getDomElement().innerText = ( (this.directionButton.toggle()) ? "Forward" : "Reverse");
			
			return this.isReversed();
		}
		
		/*Similar behaviour to togglePlay(). Toggle state of the random button and return new state.
		Set text of button appropriately by modifying value attribute of the DOM element. 
		Return new state of random button. 
		
		Also sets class value of next, previous, and reverse buttons. This allows style to be modified using css, if
		desired.*/
		toggleRandom() : boolean
		{
			var random = this.randomButton.toggle();
			//ControlElement state false means order is not random (in order), while true means order is random.
			this.randomButton.getDomElement().innerText = ( random ? "In Order" : "Randomize" );
								
			//Also toggle state of previous, next, and direction.
			this.previousButton.toggleEnabled();
			this.nextButton.toggleEnabled();
			this.directionButton.toggleEnabled();
			
			return random;
		}
		

		toggleFullScreen() : any
		{
			this.fullScreenButton.toggle();
		}


		/*Return true if play button is in true ("playing") state, false otherwise */
		isPlaying() : boolean
		{
			return this.playButton.getState();
		}
		
		/*Return true if random button is set to true state ("random" is active), false otherwise */
		isRandom() : boolean
		{
			return this.randomButton.getState();
		}
		
		/*Return true if reverse button is set to true ("reverse" is active), false otherwise */
		isReversed() : boolean
		{
			return this.directionButton.getState();
		}

		isFullScreen() : boolean
		{
			return this.fullScreenButton.getState();
		}

	}
	

		/*Container for ControlElement elements which are passed to constructor of ControlsManager */
		class ControlsContainer
		{
			/*Shorthand constructor to create and initialize properties simultaneously */
			constructor(public playButton : ControlElement,
				 public directionButton : ControlElement, 
				 public randomButton : ControlElement, 
				 public nextButton : ControlElement, 
				 public previousButton: ControlElement, 
				 public effectSelector: ControlElement, 
				 public fullScreenButton: ControlElement){	}

			
		} 
	
                              
	




