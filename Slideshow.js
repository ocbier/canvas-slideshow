/*  File contains all functions and objects required for canvas slide show. Handles events on the different slideshow 
 * control buttons which invoke the appropriate callback functions. This allows:
 *	 - autoplay toggle
 *   - direction reversal
 *   - manual advance and retreat
 *   - Different image transition effects
 *
 *  Image locations and captions are loaded from a JSON file using AJAX request. Images are then and are then preloaded 
 *  using Image objects. These images are displayed within the canvas. 
 */
 
 
 
/*IIFE to encapsulate variables */
(function() 
{
    /*****Slideshow settings *******/
	const defaultImageWidth = 640;
	const defaultImageHeight = 480;
	const playSpeed = 8000;                        //Slide show play speed in ms.
	const aspectRatio = 16/9;                        //Aspect ratio for images.
	const animationSpeed = 33;                       //Redraw rate for animations.
	const fadeStep = 0.008;	                         //Amount to fade after each redraw.
	const loadTimeout = 60000;                       //Timeout for image loading set to 60000ms or 1 minute.

	
	const imageLocationsResource = "imageList.json";//JSON file of objects containing of image file locations and captions.
	
	
	var images = new Array();                     //Array holding references to Image objects.
		
	var globalImageWidth = defaultImageWidth;     //Actual value for image width. Set to default initially
	var globalImageHeight = defaultImageWidth;    //Actual value to use for image height. Set to default initially.
	var interval = 0;                            //ID returned by setInterval() when a function is assigned.
	var imageCounter = 0;   					//current image index in array "images".
	
	
	var canvas;                                  //The canvas element for displaying slide show.
	var context;                                  //2D graphics context for canvas.
	var controls;                                //ControlElements for slideshow.
	
	
	
   /*Function used to draw the next slide. This is used to determine what effect (if any) should be applied
	  when advancing to next slide */ 
	var drawingFunction = function() {};         
		
			
		
	/* ctor for object representing a . Has attributes for DOM element of button and state of the button
	Also allows an optional callback to be assigned to the button.*/
	function ControlElement(elem, enabled, callback, eventName)
	{
		this.domElement = elem;
		/*Set isEnabled for of element to value of param enabled. True indicates button is available,
		while false indicates it is not. */
		this.isEnabled = enabled;
		/*Is action of button active ? Set to false initially*/
		this.state = false;
			
		/*Set button's associated action to be inactive initially by adding class "inactive" to DOM element. */
		this.domElement.classList.add("inactive");             
     
		/*Add button class based on original isEnabled value*/
		if (this.isEnabled)
			this.domElement.classList.add("enabled");    
		else 
			this.domElement.classList.add("disabled");
				
		/*Toggle state of element and return new state. Adds class "active" to element
		  if it is in active state, otherwise set class to "inactive"*/
		this.toggle = function()
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
		}
		
		/*Marks button as enabled or disabled and returns this value. Disabled is mutually exclusive with active state.*/
		this.toggleEnabled = function()
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
		this.setDomElement = function(buttonElement)
		{
			this.domElement = buttonElement;
		}
		
		/*Get the DOM element associated with this ControlElement */
		this.getDomElement = function()
		{
			return this.domElement;
		}
		
		/*Returns true if the action associated with this button is active, false otherwise */
		this.getState = function()
		{
			return this.state;
		}
		
		this.isActive = function()
		{
			return this.isEnabled;
		}
		
		this.addCallback = function(eventName, callback)
		{
			this.domElement.addEventListener(eventName, function(){
				callback(); 
			}, false);
		}
		
		/*If callback and eventName are specified, use setCallback to specify event listener
		  and callback for this ControlElement.*/
		if (callback && eventName)
		{
			this.addCallback(eventName, callback);
		}
		
	}
	
	
	/* ctor for object managing the button controls of slideshow. Composed of different ControlElement objects. 
	   Takes args for the ControlElement objects representing the buttons. Maintains the state of each button. Functions are 
	   provided for behaviour of each button, given its state. This is important for determining button
	   appearance, but is also used to aid in recording system state. 
	   @param controlsContainer object holding DOM elements for the slideshow controls 
	   @param playing indicates if slide show is playing initally
	 */
	function ControlsManager(controlsContainer)
	{
		this.playButton = controlsContainer.playButton;
		
		this.directionButton = controlsContainer.directionButton;
		this.randomButton = controlsContainer.randomButton;
		this.nextButton = controlsContainer.nextButton;
		this.previousButton = controlsContainer.previousButton;
		this.effectSelector = controlsContainer.effectSelector;
		
		/*Toggles the state of the play button. Signals change in appearance accordingly from
		  changing value attribute. Note that ControlElement object's toggle() method will also set 
		  class attribute to "enabled" or "disabled" when button state is changed. This is more of a generic
		  indicator of state.
		  
		  
		  Returns current state as true or false*/
		this.togglePlay = function()
		{
			//Change the state of the play button and then change text of DOM element based on returned current state.
			this.playButton.getDomElement().innerText = ( (this.playButton.toggle()) ? "Pause" : "Play");    
			
			var playing = this.isPlaying();
			var randomEnabled = (this.randomButton).isActive();
			var directionEnabled = (this.directionButton).isActive();
		
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
		this.toggleDirection = function()
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
		this.toggleRandom = function()
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
		
		/*Return true if play button is in true ("playing") state, false otherwise */
		this.isPlaying = function()
		{
			return this.playButton.getState();
		}
		
		/*Return true if random button is set to true state ("random" is active), false otherwise */
		this.isRandom = function()
		{
			return this.randomButton.getState();
		}
		
		/*Return true if reverse button is set to true ("reverse" is active), false otherwise */
		this.isReversed = function()
		{
			return this.directionButton.getState();
		}
	}
	
	
	
	/*Container for ControlElement elements which are passed to constructor of ControlsManager */
	ControlsManager.prototype.ControlsContainer = function()
	{
		this.playButton;
		this.directionButton;
		this.randomButton;
		this.nextButton;
		this.previousButton;
		this.effectSelector;
	}                                     
	
	/* Creates an XMLHttpRequest object to retrieve JSON data from a particular location. Assigns 
	   appropriate event listner for the the readstatechange event on this object and sets
	   calback. 
	   @param string indicating the location of the JSON data
	   @param callback function to assign to eventlistener for readystatechange event */
	function getJSONData(resource, callback)
	{
		try
		{
			var xhr = new XMLHttpRequest();                                   //Create request.
			
			//Assign event listener for readystatechange event and pass xhr object to callback.
			xhr.addEventListener("readystatechange",  
			function() {
					callback(xhr)
				}, false);        
				xhr.responseType = "json";                                        //Set response type to json.
				xhr.open("GET", resource, true);                                  //Open the GET request and specify resource.
				xhr.send(null);                                                   //Send request. 
			
		} catch(exception)
		{
			alert("Error. Request unsuccessful");
		}
	}
		
		
	/*Begins to load images as soon as request is received here */
	function preloadImages (request)
	{
		if (request.readyState === 4 && request.status === 200)
		{
			//Get the array of objects holding image source locations as JSON data.
			var imageLocationList = request.response;    
			imageLocationList.forEach(function(current)
			{
				//Push Image objects onto images, but set src first, and alt attributes first.
				var curImage = new Image();
				curImage.src = current.path;
				curImage.alt = current.caption;
				images.push(curImage);     
			});
					
		}
	}

 
	 /*Function to begin the slideshow and initialize all necessary objects and variables. Awaits load of first image before beginning slideshow. 
	   @param loadTimeoutCounter optional current timeout value for loading images*/
	function start(loadTimeoutCounter)
	{
		var timeoutCounter =  0;
		if ( (typeof loadTimeoutCounter) === 'undefined')
			timeoutCounter = 0;                  
          //Set timeoutCounter to 0 by default.
		else
			timeoutCounter = loadTimeoutCounter;
		
		
		//First check if images have been loaded.
		if (imagesLoaded())
		{
			fadeoutPreloader(1200);                                       //Fadeout the preloader cover for page in 1200ms.
			setTimeout(function(){
				canvas = document.getElementById("image-canvas"); 
				
			   //Calc dynamic width and height of canvas if it has been set in css. Also sets context to the graphics context for this canvas.
				resizeCanvas();                                                 
				window.addEventListener("resize", resizeCanvas, false);        //Add event listener to resize canvas dyamically if window resizes.
						
				drawingFunction = function(slide) {                                 //Set current drawing function.
				drawSlide( document.getElementById("imageCaption"), globalImageWidth, globalImageHeight, slide); 
				};
					
				imageCounter = -1;           //First set image counter to position before first image in array imageData.
				setupControls(true);       //Assign callbacks to buttons. Appropriate graphics context specified in arg context.
				drawNextSlide();           //Draw first slide immediately.
				 
				  /*Call togglePlay() to change state of play button, and call
				 resumeSlideShow() to continue the slideshow. Pass element with 
				  id imageCaption to specify where to draw the captions. */
				 controls.togglePlay();
				 resumeSlideShow( document.getElementById("imageCaption"));
			}, 600);
		}
		
		/*If timeout has not yet been reached, check if images have been loaded by calling start() again after 500ms */
		else if (timeoutCounter <  loadTimeout)
		{
				setTimeout(function(){                 //Pass current timeout value + 500 and call start() again.
		  		start(timeoutCounter + 500);
			}, 500);                                //Check every 500ms to see if images have finished loading.
				                    
		}
		else
		{
			
			alert("Unfortunately, slideshow could not be loaded. Refresh the page or try again later.");
		}
		
	}	
	
	
	/*Checks to see if images have been loaded and returns true if they have and false otherwise */
	function imagesLoaded()
	{
	    /*If array is null or empty, images have not yet been loaded fully */
		if (!images || images.length == 0)
			return false;
		
		/*If array is not empty, check if all images are loaded */
		for (let i = 0; i < images.length; ++i)
		{
			/*If any image is null == 0 == false, or has not been loaded completely, return false.*/
			if ( (!(images[i].complete && images[i] )) || ( (typeof images[i]) === 'undefined')  )
				return false;
		}
		
		return true;                         //If this point is reached, all images are loaded, so return true.
	}
		
	/*Fades out preloader in the specified duration */	
	function fadeoutPreloader(duration)
	{
	
		let slideshowElem = document.getElementById("slideshow");
		let preloader = document.getElementById("preloader");
		
		let preloaderInvisible = false;
		let slideshowVisible = false;
		
				
		if(slideshowElem.style.opacity < 1.0)
			slideshowElem.style.opacity = parseFloat(slideshowElem.style.opacity) + fadeStep;            //Increase opacity of slideshow until it reaches 1
		else
			slideshowVisible = true;

		if(preloader.style.opacity > 0.0)                         //Decrease opacity of preloader until it reaches 0
			preloader.style.opacity = parseFloat(preloader.style.opacity) - fadeStep;
		else
			preloaderInvisible = true;
			
	
		if (!(preloaderInvisible && slideshowVisible))
		{
			setTimeout(function() {
				fadeoutPreloader(duration)
			}, 1);
		}
		
		else
		{
			preloader.style.display = "none";
		}
	}
	
	function showPreloader()
	{
		document.getElementById("slideshow").style.opacity = 0.1;            //Set opacity of slideshow to 0.1;
		
		
		let preloader = document.createElement("div");
		preloader.id = "preloader";
		let preloaderState =  document.createElement("div");
		preloaderState.id = "preloader-state";
		preloader.appendChild(preloaderState);
		document.body.appendChild(preloader);
		
		preloader.style.opacity = 0.9;                                    //Set opacity of preloader to 0.9
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
	function resumeSlideShow( captionElement, reversed) 
	{ 
		clearInterval(interval);     //Make sure there is no function currently being called for this interval.
				
		/*Call appropriate function to advance slide show. The function to call
		  will depend on the current play direction which is determined by calling Control.isReversed().
		  The function is called each slideTime ms. */
		interval = setInterval(function() {
			  
			   //If slideshow isn't set to random. 
			   if (!(controls.isRandom()))
			   {
				   //If the play direction is not reversed, call drawNextSlide(). Otherwise call drawPreviousSlide().
					(!(controls.isReversed())) ? drawNextSlide() : drawPreviousSlide(); 
			   }
			   
			   //Otherwise, if we are in random mode, draw a random slide.
			   else
				   drawRandomSlide();
				   
			}, playSpeed);
	}
	
	
	
	/*Draws the next image in imageData and its associated caption using image alt attribute.
	  imageCounter will be incremented. Drawing is performed using current drawingFunction(),
		meaning any currently selected effects will be applied.*/
	function drawNextSlide()
	{ 
		nextCounter = imageCounter + 1;                                              //First increment.
		if (nextCounter >= images.length)                           //Reset position if last element in array is exceeded.
			nextCounter = 0;
				
		 drawingFunction(nextCounter);       //Call current drawing function to draw image to canvas Pass arg true to indicate forward.
		
	}	
	
	/*Similar functionality to drawNextSlide() 
	  Draws the previous image in imageData and its associated caption using image alt attribute.
	   Key difference is that imageCounter is decremented so that previous slide is drawn.
	 */
	 
	 function drawPreviousSlide()
	 {
		 var nextCounter = imageCounter - 1;
		 if (nextCounter < 0)                         //Then check if we are below index 0.
			 nextCounter = images.length - 1;        //If so, set to last index to wrap around.
		 
		 drawingFunction(nextCounter);                       //Pass arg of false to drawing function to indicate backward.
	  }
	 
	 /*Draws a random slide to the canvas using context. Uses Math.Random to determine an integer
	 between 0(inclusive) and images.length (exclusive).
	 Drawing is done using the current drawingFunction().*/
	 function drawRandomSlide()
	 {
		var nextCounter = Math.floor(images.length * Math.random());
		drawingFunction(nextCounter);
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
	 function drawSlide( captionElement, width, height, slide)
	 {
		imageCounter = slide;                                          //Assign value of slide to imageCounter.
		
		try{
				 
		     context.clearRect(0, 0, width, height);                        //Clear the canvas image area before drawing.
			 context.drawImage(images[imageCounter], 0, 0, width, height);
			 captionElement.innerHTML = images[imageCounter].alt;          //Draw the caption in captionElement in DOM. 
		 
		   } catch(ex)
		    {
				console.log("Could not draw image " + imageCounter + "to canvas because of exception: " + ex.toString());
		     }
	 }
	 
	
	
	
	
	
	/*Dynamically resizes canvas and images while maintaining aspect ratio. Uses computed style width value (if specified)
	  to determine correct width and height. Sets context to graphics context for this canvas.*/
	function resizeCanvas()
	{
		
		/*Use the computed style to set the actual width  (x coordinate range)
		  for canvas. This allows dynamic styling with css. */
		var computedWidth = window.getComputedStyle(canvas, null)["width"];
				
		//If style has been specified, change width and height of canvas and images from default.
		if (computedWidth)
		{
			globalImageWidth = canvas.width = parseInt(computedWidth);       //Set width of canvas and images to computed width.  
			//Set height of canvas and images, adjusting for aspect ratio by multiplying globalImageWidth by inverse of aspectRatio.
			globalImageHeight = canvas.height = Math.pow(aspectRatio, -1) * globalImageWidth;    
		}
				
		context = canvas.getContext("2d");                               //Get the new graphics context for appropriate coordinate space.
		context.clearRect(0, 0, globalImageWidth, globalImageHeight);    //Clear the canvas after resize to prevent image corruption.
		
	}	
	
	
	/*Adds event listners to all the buttons in the slide show and creates appropriate Controls element
      to manage slideshow controls. */
	function setupControls()
	{
		/*Get the DOM button elements */
		var playElem = document.getElementById("play-toggle");             //DOM input button for playing or pausing.
		var directionElem = document.getElementById("direction-toggle");   //DOM input button for changing direction.
		var randomElem = document.getElementById("random-toggle");        //DOM input button for randomization.
		var nextElem = document.getElementById("next");                  //DOM input button for next slide.
		var previousElem = document.getElementById("previous");          //DOM input button for previous slide.
		var selectorElem = document.getElementById("effects-selector");  //DOM input button selector for different effects.
		var captionElem = document.getElementById("imageCaption");      //DOM input button image caption.
		
		/*Create ControlElement elements and place them in ControlsContainer object. Specify 
		property for DOM element of each button and its state as args to 
		ControlElement ctor for each control button. Also specify callback and event which fires it.*/
		
		var container = Object.create(ControlsManager.prototype.ControlsContainer, {
			/*Button to play and pause slide show */
			playButton : {
				configurable: false,
				writable: true,
				enumerable: true,
				//Play active initially, so set second arg of ControlElement to true.
				value: new ControlElement(playElem, true, function() {
					playCallback( captionElem);
				}, "click")                                                                 
			}, 
			/*Button to change direction of slide show */
			directionButton : {
				configurable: false,
				writable: true,
				enumerable: true,
				//Not reversed initially.
				value: new ControlElement(directionElem, true, function() {
					directionCallback( captionElem);                                   
				}, "click")                                          
			},
			/*"Random" button to randomize slide show */
			randomButton : {
				configurable: false,
				writable: true,
				enumerable: true,
				//Not random initially.
				value: new ControlElement(randomElem, true, function() {                    
					randomCallback( captionElem);
				}, "click")                                         
			},  
			/*"Next" button to advance slide show */
			nextButton : {
				configurable: false,
				writable: true,
				enumerable: true,
				value: new ControlElement(nextElem, true, function() {
					nextCallback( captionElem);
				}, "click")                                         
			},
			/*"Previous" button for going back to previous slide.*/
			previousButton : {
				configurable: false,
				writable: true,
				enumerable: true,
				value: new ControlElement(previousElem, true, function() {
					previousCallback( captionElem);
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
				value: new ControlElement(selectorElem, true, function() {                 
					effectCallback( captionElem, selectorElem.value);
				}, "change")                                                //Unlick buttons, this callback fires on change.   
			}               
		});
		
		/*Set up controls for slideshow with the 3 buttons in DOM for play, direction, and random toggle actions
		  Also pass value indicating if slideshow is playing initally*/
		controls = new ControlsManager(container);	
	}
	
	/*Produces a fading transition from the current image on the canvas to the next image 
	@param captionElem DOM element in which to display image captions
	@param nextCounter The index in image array for the image to which to transition
	@param width Optional value for width of images to draw, which will be set to defaultWidth if null
	@param height Optional value for height of images to draw, which will be set to defaultHeight if null */
	function fadeTransition( captionElem, nextCounter, width, height)
	{
		var imgWidth = width;
		var imgHeight = height;
		//If no valid width is specified, use globalImageWidth
		if (typeof(imgWidth) === 'undefined' || width < 0)
			imgWidth = globalImageWidth;
		
		if (typeof(imgHeight) === 'undefined' || height < 0)
			imgHeight = globalImageHeight;
		
		clearInterval(interval);                                  //Clear interval before beginning animation.
		
		interval = setInterval(function() 
		{
			//If the global alpha is > 0.1, decrease by 0.1, then redraw image currently at imageCounter.
			if (context.globalAlpha >= 0.1)
			{
				drawSlide( captionElem, imgWidth, imgHeight, imageCounter);
				context.globalAlpha -= fadeStep;
			}
					
			/*Otherwise clear the interval, draw the next slide and assign a different function to 
			 slowly increase global alpha again. Redraw image after each increment*/
			else
			{		
				clearInterval(interval);
				imageCounter = nextCounter;                     //Set imageCounter to the nextCounter value.
							
				interval = setInterval(function()
				{
					//Draw new image and increment the global alpha value to increase opacity.
					if (context.globalAlpha < 1.0)
					{
						drawSlide( captionElem, imgWidth, imgHeight, imageCounter);
						context.globalAlpha += fadeStep;
						
					}
					/*When the global alpha value reaches 1.0, call clearInterval to stop
					calling function, since image has reached full opacity. */
					else
					{
						clearInterval(interval);
						if(controls.isPlaying())   //Call resumeSlideShow if slideshow is in "playing" mode
							resumeSlideShow( captionElem, controls.isReversed());
					}
						
				}, animationSpeed);
			}//End-else	
				
		}, animationSpeed);
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
	function horizontalTransition( captionElem, nextCounter, width, height)
	{
		clearInterval(interval);
		
		var imgWidth = width;
		var imgHeight = height;
		//If no valid width is specified, use globalImageWidth
		if (typeof(imgWidth) === 'undefined' || width < 0)
			imgWidth = globalImageWidth;
		
		if (typeof(imgHeight) === 'undefined' || height < 0)
			imgHeight = globalImageHeight;
		
		var offset = 0;                              //Current offset from canvas origin.              
		var increment = 3;                           //Amount by which to increment offset on each redraw.
		const speed = animationSpeed / increment;    //Calculate redraw rate.
		var forward = null;                          //Is movement forward or backwards?
		//Determine if direction is forward or backward? imageCounter < nextCounter ?
		( (imageCounter < nextCounter) ? (forward = true) : (forward = false) );
		
		
		const negImgWidth = imgWidth * -1;              //Calc negative image width only once.
		const limit = imgWidth + increment;           //Limit x coord for next slide to stop.
		
		context.save();                 //Save original context state.
				
		//Call setInterval to begin animation. Call function every animationSpeed ms.
		interval = setInterval(function() 
		{
			context.save();                                 //Save this state again.
			context.clearRect(0, 0, imgWidth, imgHeight);         //Clear canvas area before continuing with drawing.
			
			//Translate x coord of context by offset (- for forwards or + for backwards)
			( (forward) ? context.translate(-1 * offset, 0) : context.translate(offset, 0) );
			
			//draw slide one   <-- current slide at imageCounter
			context.drawImage(images[imageCounter], 0, 0, imgWidth, imgHeight);
			 
			/*Translate x coord of context to right (for forward) or left(for backward) by imageWidth 
			  Important to note here that translation is applied to current transformation matrix,
			  since context.restore() is not called before calling context.translate(). */
			( (forward) ? context.translate(imgWidth, 0) : context.translate(negImgWidth, 0) );
			
			//draw slide two but don't clear canvas   <-- slide at nextCounter		   
			context.drawImage(images[nextCounter], 0, 0, imgWidth, imgHeight); 
			offset += increment;                                 //Increase offset.
			
			context.restore();                              //Restore transformation matrix to initial state.
				
			/*clear interval to stop animation if offset > imgWidth, which means that (0, 0) in image 2 local
			 coordinates is now at canvas' original origin. */
			if (offset >= limit)
			{
				clearInterval(interval);
				
				imageCounter = nextCounter;                            //Set imageCounter to the index of the new slide.
				captionElem.innerHTML = images[imageCounter].alt;    //Draw the caption in captionElement in DOM.
				
				if(controls.isPlaying())                          //Call resumeSlideShow if slideshow is in "playing" mode
					resumeSlideShow( captionElem, controls.isReversed());
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
	function verticalTransition( captionElem, nextCounter, width, height)
	{
		clearInterval(interval);
		
		var imgWidth = width;
		var imgHeight = height;
		//If no valid width is specified, use globalImageWidth
		if (typeof(imgWidth) === 'undefined' || width < 0)
			imgWidth = globalImageWidth;
		
		if (typeof(imgHeight) === 'undefined' || height < 0)
			imgHeight = globalImageHeight;
				
		var offset = 0;                              //Current offset from canvas origin.              
		var increment = 3;                           //Amount by which to increment offset on each redraw.
		const speed = animationSpeed / increment;       //Calculate redraw rate.
		var forward = null;                           //Is movement forward or backwards?
				
		
		var negImgHeight = imgHeight * -1;             //Negative value of imgHeight
		const limit = imgHeight + increment;             //Y-axis Limit for where to stop drawing.
		
		
		//Determine if direction is forward or backward? imageCounter < nextCounter ?
		( (imageCounter < nextCounter) ? (forward = true) : (forward = false) );
		
		context.save();                 //Save original context state.
				
		//Call setInterval to begin animation. Call function every animationSpeed ms.
		interval = setInterval(function() 
		{
			context.save();                                 //Save this state again.
			context.clearRect(0, 0, imgWidth, imgHeight);         //Clear canvas area before continuing with drawing.
			
			//Translate y coord of context to push down on each redraw (for forwards) or up (for backward)
			( (forward) ? context.translate(0, offset) : context.translate(0, -1 * offset) );
			
			//draw slide one   <-- current slide at imageCounter
			context.drawImage(images[imageCounter], 0, 0, imgWidth, imgHeight);
			 
			/* Translate the y coordinate by the height of the image before drawing second slide.
			   Negative y direction for forward movement or positive y direction for backward movement. So this
				draws new image above the existing image for forward movement, or below it for backwards movement.*/
			( (forward) ? context.translate(0, negImgHeight) : context.translate(0, imgHeight) );
			
			//draw slide two but don't clear canvas   <-- slide at nextCounter		   
			context.drawImage(images[nextCounter], 0, 0, imgWidth, imgHeight); 
			offset += increment;                                 //Increase offset.
			
			context.restore();                              //Restore transformation matrix to initial state.
				
			/*The animation is halted if offset becomes > imgHeight since we now have (0, 0) in local
			  coordinates for image 2 at the original canvas origin  */
			if (offset >= limit - increment)
			{
				clearInterval(interval);
				
				imageCounter = nextCounter;                            //Set imageCounter to the index of the new slide.
				captionElem.innerHTML = images[imageCounter].alt;    //Draw the caption in captionElement in DOM.
				
				if(controls.isPlaying())                          //Call resumeSlideShow if slideshow is in "playing" mode
					resumeSlideShow( captionElem, controls.isReversed());
			}
		}, speed);
		
	}
		
	
	
	
	/*Callback for playing or pausing slideshow */
	function playCallback( captionElem)
	{
		var state = controls.togglePlay();             //Indicate change to state in the interface.
		
		if (!state)                                     //If slideshow is not marked as playing, stop play.
			clearInterval(interval);
		else                                             //Otherwise call resumeShow() to continue slideshow in correct direction. 
			resumeSlideShow(captionElem, controls.isReversed());
	}
	
	/* Callback for direction button. Simply call controls.toggleDirection to mark the
    	play direction as being inverted. Then stop the slideshow and clear the interval by calling
	   clearInterval(). Then play the slideshow in the new direction by calling resumeSlideShow().
	   This function will then play the slide show in the new direction.
	   
	   @param captionElem the DOM element in which to display image caption*/
	function directionCallback( captionElem)
	{ 
		var reversed = controls.toggleDirection();  
	    resumeSlideShow(captionElem, reversed);
	}
	
	
	
	/* Set callback for the randomization button. Sets the function called by setInterval() to
       a function which calculates imageCounter as a random integer between 0 (inclusive) and images.length
		exclusive). 
	    @param captionElem the DOM element in which to display image caption*/
	function randomCallback( captionElem)
	{
		//Toggle state of random button.
		var randomState = controls.toggleRandom();
		clearInterval(interval);       //Clear the current interval to stop current function used for slideshow.
			
		//Store the returned id in interval and assign function and speed.
		interval = setInterval(function() {
			if(randomState)                 //If the random button state toggles to true.
				drawRandomSlide();
				
			else                             //Otherwise continue slideshow sequentially in whatever order is set.
				resumeSlideShow( captionElem, controls.isReversed());
			
		}, playSpeed);
	}
	
	/*Set callback for next button. Does nothing if slideshow is not in sequential, non-random mode.
       Simply advances to next slide and stops automatic advance. 
	   @param captionElem the DOM element in which to display image caption*/
	function nextCallback( captionElem)
	{
		if (!(controls.isRandom()) )
		{
			clearInterval(interval);
			if (controls.isPlaying()) 
				controls.togglePlay();     //Mark slideshow as paused if it is currently playing. 
			drawNextSlide();
		}
	}
			
	/*Very similar to callback for next button.
	  Only difference is that drawPreviousSlide is called. 
	@param captionElem the DOM element in which to display image caption*/
	function previousCallback( captionElem)
	{
		if (!(controls.isRandom()) )
		{
			clearInterval(interval);
			if (controls.isPlaying()) 
				controls.togglePlay();     //Mark slideshow as paused if it is currently playing.             
			drawPreviousSlide();
		}
	}
	
	/*Callback for the effects select element. Assigns appropriate function using setInterval
	  in order to achieve effect. If the "None" option is selected, effects are cleared by
	  calling resumeSlideShow 
	  @param captionElem the DOM element in which to display image caption
	  @param option the option selected for effect to use for slide show*/
	function effectCallback( captionElem, option)
	{
		console.log(option);
		
		//Clear the effects by simply setting drawingFunction to drawSlide();
		if (option === "None")
		{
			drawingFunction = function(slide) {
				drawSlide( captionElem, width, height, slide);
			};
		}	
		
		/*Fade option is selected so use function which 
		 fades out each slide and transitions smoothly to next slide.
          So set drawingFunction to fadeTransition(). 
		  Next counter must be passed to drawing function, which indicates
		  image to which to which to transition.*/
		else if (option === "fade")
		{
			drawingFunction = function(nextCounter) {
				fadeTransition( captionElem, nextCounter);
			};
		}
		
		/*Slide-across option is selected. This means drawing function
		  should be set to horizontalTransition function().
		 */
		else if (option === "slide-across")
		{
			drawingFunction = function(nextCounter) {
				horizontalTransition(captionElem, nextCounter);
			};
		}
		
		/*Slide-vertically across option is selected. This means drawing function
		  should be set to horizontalTransition function().
		 */
		else if (option === "slide-vertically")
		{
			drawingFunction = function(nextCounter) {
				verticalTransition(captionElem, nextCounter);
			};
			
		}	
		
	}
	
		
	
	 /*Preload images by passing location of JSON file holding image locations and preloadImages function as callback
	   to getJSONData() */
	getJSONData(imageLocationsResource, preloadImages);
	
	/*On pageshow, call the start function to begin slideshow */
	window.addEventListener("pageshow", function() {
	    showPreloader();                //Show the preloader on page.
		start(0);                       //Call start to begin sideshow when images are loaded.
	}, false);
	
	
}());