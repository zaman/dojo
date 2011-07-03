define(["dojo", "../gesture"], function(dojo, gesture){
// module:
//		dojo/gesture/tap
// summary:
//		This module provides tap gesture event handlers
//		- dojo.gesture.tap -> to fire 'tap' event
//		- dojo.gesture.tap.hold -> to fire 'tap.hold' event
//		- dojo.gesture.tap.doubletap -> to fire 'tap.doubletap' event
// example:
//		A. Used with dojo.connect()
//		|	dojo.connect(node, dojo.gesture.tap, function(e){});
//		|	dojo.connect(node, dojo.gesture.tap.hold, function(e){});
//		|	dojo.connect(node, dojo.gesture.tap.doubletap, function(e){});		
//
//		B. Used with dojo.on
//		|	define(["dojo/on", "dojo/gesture/tap"], function(on, tap){
//		|		on(node, tap, function(e){});
//		|		on(node, tap.hold, function(e){});
//		|		on(node, tap.doubletap, function(e){});
//
//		C. Used with dojo.gesture.tap.* directly
//		|	dojo.gesture.tap(node, function(e){});
//		|	dojo.gesture.tap.hold(node, function(e){});
//		|	dojo.gesture.tap.doubletap(node, function(e){});
//
//		Though there is always a default singleton gesture instance if required e.g. require("dojo.gesture.tap")
//		It's possible to create a new one with different parameters to overwrite it
//		|	var myTap = new dojo.gesture.tap.Tap({holdThreshold: 300});
//		|	dojo.gesture.register(myTap);
//		|	dojo.connect(node, myTap, function(e){});
//		|	dojo.connect(node, myTap.hold, function(e){});
//		|	dojo.connect(node, myTap.doubletap, function(e){});

function clearTimer(timer){
	clearTimeout(timer);
	delete timer;
}

var clz = dojo.declare(null, {
	
	holdThreshold: 500,
	
	doubleTapTimeout: 250,
	
	tapRadius: 8,
	
	defaultEvent: 'tap',
	
	subEvents: ["hold", "doubletap"],
	
	constructor: function(args){
		dojo.mixin(this, args);
	},
	press: function(data, e){
		var target = e.currentTarget;
		this._initTap(data, e);
		clearTimer(data.tapTimeOut);
		data.tapTimeOut = setTimeout(dojo.hitch(this, function(){
			if(this._isTap(data, e)){
				gesture.fire(target, 'tap.hold');
			}
			clearTimer(data.tapTimeOut);
			data.tapContext.t = 0;
			data.tapContext.c = 0;
		}), this.holdThreshold);
	},
	release: function(data, e){
		switch(data.tapContext.c){
		case 1: 
			gesture.fire(e.currentTarget, 'tap');
			break;
		case 2:
			gesture.fire(e.currentTarget, 'tap.doubletap');
			break;
		}
		clearTimer(data.tapTimeOut);
	},
	_initTap: function(data, e){
		if(!data.tapContext){
			data.tapContext = {x: 0, y: 0, t: 0, c: 0};
		}
		var ct = new Date().getTime();
		if(ct - data.tapContext.t <= this.doubleTapTimeout){
			data.tapContext.c++;
		}else{
			data.tapContext.c = 1;
			data.tapContext.x = e.screenX;
			data.tapContext.y = e.screenY;
		}
		data.tapContext.t = ct;
	},
	_isTap: function(data, e){
		var dx = Math.abs(data.tapContext.x - e.screenX);
		var dy = Math.abs(data.tapContext.y - e.screenY);
		return dx <= this.tapRadius && dy <= this.tapRadius;
	},
	destroy: function(){}
});

//register a default singleton Tap instance
dojo.gesture.tap = new clz();

dojo.gesture.tap.Tap = clz;

gesture.register(dojo.gesture.tap);

return dojo.gesture.tap;

});