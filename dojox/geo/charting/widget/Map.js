// dojo.provide allows pages to use all of the types declared in this resource.
dojo.provide("dojox.geo.charting.widget.Map");

dojo.require("dojox.geo.charting.Map");
dojo.require("dijit._Widget");

dojo.declare("dojox.geo.charting.widget.Map", dijit._Widget, {
	// summary:
	//   A map viewer widget based on the dojox.geo.charting.Map component
	//
	// description:
	//   The `dojox.geo.charting.widget.Map` widget combines map display together with charting capabilities. 
	//   It encapsulates  an `dojox.geo.charting.Map` object on which most operations are delegated.
	//   Parameters can be passed as argument at construction time to specify map data file (json shape format)
	//   as well as charting data. 
	// 
	//   The parameters are :
	// 
	// * `shapeFile`: The name of the file containing map data.
	// * `dataStore`: the dataStore to fetch the charting data from
	// * `dataBindingAttribute`: property name of the dataStore items to use as value for charting
	// * `markerData`: tooltips to display for map features, handled as json style.
	// * `adjustMapCenterOnResize`: if true, the center of the map remains the same when resizing the widget   
	// * `adjustMapScaleOnResize`: if true, the map scale is adjusted to leave the visible portion of the map identical as much as possible 
	//
	// example:
	//    
	// |	var map = new dojox.geo.charting.widget.Map({
	// |		shapeFile : 'map.json',
	// |		adjustMapCenterOnresize : true,
	// |		adjustMapScaleOnresize : true,
	// |	});

	shapeFile : "",
	dataStore : null,
	dataBindingAttribute : "",
	dataBindingValueFunction: null,
	markerData : "",
	series : "",
	adjustMapCenterOnResize: false,
	adjustMapScaleOnResize: false,
	animateOnResize: false,
	onFeatureClick: null,
	onFeatureOver: null,
	enableMouseSupport: false,
	enableTouchSupport: false,
	enableMouseZoom: false,
	enableMousePan: false,
	showTooltips: false,
	enableFeatureZoom: true,
	colorAnimationDuration: 0,
	mouseClickThreshold: 2,
	_mouseInteractionSupport:null,
	_touchInteractionSupport:null,
	constructor : function(/* Object */options, /* HtmlNode */div){
		// summary: 
		//   Constructs a new Map widget
		this.map = null;
	},

	startup : function(){
		this.inherited(arguments);
		if (this.map) {
			this.map.fitToMapContents();
		}
		
	},

	postMixInProperties : function(){
		this.inherited(arguments);
	},

	create : function(/*Object?*/params, /*DomNode|String?*/srcNodeRef){
		this.inherited(arguments);
	},
	
	getInnerMap: function() {
		return this.map;
	},
	

	buildRendering : function(){
		// summary:
		//		Construct the UI for this widget, creates the underlying real dojox.geo.charting.Map object.		
		// tags:
		//		protected
		this.inherited(arguments);
		if (this.shapeFile && (this.shapeFile.length > 0)) {
			this.map = new dojox.geo.charting.Map(this.domNode, this.shapeFile);
			if (this.markerData && (this.markerData.length > 0))
				this.map.setMarkerData(this.markerData);
			
			if (this.dataStore) {
				if (this.dataBindingValueFunction) {
					this.map.setDataBindingValueFunction(this.dataBindingValueFunction);
				}
				this.map.setDataStore(this.dataStore,this.dataBindingAttribute);
			}
			
			if (this.series && (this.series.length > 0)) {
				this.map.setSeriesFile(this.series);
			}
			
			if (this.onFeatureClick) {
				this.map.onFeatureClick = this.onFeatureClick;
			}
			if (this.onFeatureOver) {
				this.map.onFeatureOver = this.onFeatureOver;
			}
			if (this.enableMouseSupport) {
				
				if (!dojox.geo.charting.MouseInteractionSupport) {
					throw Error("Can't find dojox.geo.charting.MouseInteractionSupport. Didn't you forget to dojo" + ".require() it?");
				}
				var options = {};
				options.enablePan = this.enableMousePan;
				options.enableZoom = this.enableMouseZoom;
				options.mouseClickThreshold = this.mouseClickThreshold;
				this._mouseInteractionSupport = new dojox.geo.charting.MouseInteractionSupport(this.map,options);
				this._mouseInteractionSupport.connect();
			}
			if (this.enableTouchSupport) {
				if (!dojox.geo.charting.TouchInteractionSupport) {
					throw Error("Can't find dojox.geo.charting.TouchInteractionSupport. Didn't you forget to dojo" + ".require() it?");
				}
				this._touchInteractionSupport = new dojox.geo.charting.TouchInteractionSupport(this.map,{});
				this._touchInteractionSupport.connect(); 
			}
			this.map.showTooltips = this.showTooltips;
			this.map.enableFeatureZoom = this.enableFeatureZoom;
			this.map.colorAnimationDuration = this.colorAnimationDuration;
			
			
		}
	},
	

	resize : function(b){
		//	summary:
		//		Resize the widget.
		//	description:
		//		Resize the domNode and the widget to the dimensions of a box of the following form:
		//			`{ l: 50, t: 200, w: 300: h: 150 }`
		//	box:
		//		If passed, denotes the new size of the widget.

		var box;
		switch (arguments.length) {
			case 0:
				// case 0, do not resize the div, just the surface
				break;
			case 1:
				// argument, override node box
				box = dojo.mixin({}, b);
				dojo.marginBox(this.domNode, box);
				break;
			case 2:
				// two argument, width, height
				box = {
					w : arguments[0],
					h : arguments[1]
				};
				dojo.marginBox(this.domNode, box);
				break;
		}
		
		if (this.map) {
			this.map.resize(this.adjustMapCenterOnResize,this.adjustMapScaleOnResize,this.animateOnResize);
		}
	}
});
