dojo.provide("demos.cropper.src");
dojo.require("demos.cropper.src.preview");
dojo.require("dojox.analytics.Urchin");
// dojo . require("dojox.image.Lightbox");

;(function(d, $){
	
	// if testing from pre-1.3, a provide dojo.create() implemenetation
	if(!d.create && d.version.minor < 3 && dojo.version.major == 1){
		
		d.create = function(t, a, r, p){
			var n = d.doc.createElement(t);
			if(a){ d.attr(n, a) }
			if(r){ d.place(n, r, p) }
			return n;
		};
		d.destroy = d._destroyElement;
		
	}
		
	d.addOnLoad(function(){
		
		var loadIndicator = dojo.byId("loader"),
			hide = dojo.fadeOut({ node: loadIndicator }),
			show = dojo.fadeIn({ node: loadIndicator })
		;
		
		// create a default instance of this:
		var preview = new image.Preview({
			imageReady: dojo.hitch(hide, "play"),
			hoverable:true
		}, "me");
		// or if no ref needed: $("#me").preview();
		
		// setup the clicking for the thumbnails
		$("#footing").onclick(function(e){
			e.preventDefault();
			
			// it's the link or the img
			var et = e.target,
				src = et.parentNode.href || et.href;
				
			if(src){
				
				show.play();
				// when we have a src to load, set both images
				preview.domNode.src = src;
				preview.image.src = src; 
				dojo.byId("titleText").innerHTML = preview.image.alt = et.alt;
			}
			
		});
		
		// just don't load Lightbox resource if you don't want this:
		if(dojox && dojox.image && dojox.image.Lightbox){
			var lb = new dojox.image.LightboxDialog(); lb.startup();
			dojo.connect(preview.preview, "onclick", function(e){
				lb.show({ 
					href: preview.image.src, 
					title:preview.title 
				});
			});
		}
		
		setTimeout(function(){
			// shortly after onLoad, track the page (prevent UI blocking)
			new dojox.analytics.Urchin({ acct: "UA-3572741-1" });	
		}, 1500);
		
		
	});
	
		
})(dojo, dojo.query);

