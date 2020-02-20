import {Slideshow} from './Slideshow'


(function(){

	/*New slideshow with slideshow id as slideshow and image metadata specified in images.json*/
	let slideshow = new Slideshow("slideshow", "imageList.json");            

	/*Preload images */
	  slideshow.preload();
	
	  slideshow.start(0);                       //Call start to begin sideshow when images are loaded.
	   
}());