dojo.provide("dijit._PaletteMixin");
dojo.require("dijit._CssStateMixin");

dojo.declare("dijit._PaletteMixin",
	[dijit._CssStateMixin],
	{
	// summary:
	//		A keyboard accessible palette, for picking a color/emoticon/etc.
	// description:
	//		A mixin for a grid showing various entities, so the user can pick a certain entity.

	// defaultTimeout: Number
	//		Number of milliseconds before a held key or button becomes typematic
	defaultTimeout: 500,

	// timeoutChangeRate: Number
	//		Fraction of time used to change the typematic timer between events
	//		1.0 means that each typematic event fires at defaultTimeout intervals
	//		< 1.0 means that each typematic event fires at an increasing faster rate
	timeoutChangeRate: 0.90,

	// value: String
	//		Currently selected color/emoticon/etc.
	value: null,
	
	// _selectedCell: [private] Integer
	//		Index of the currently selected cell. Initially, none selected
	_selectedCell: -1,

	// _currentFocus: [private] DomNode
	//		The currently focused cell (if the palette itself has focus), or otherwise
	//		the cell to be focused when the palette itself gets focus.
	//		Different from value, which represents the selected (i.e. clicked) cell.
/*=====
	_currentFocus: null,
=====*/

	// _xDim: [protected] Integer
	//		This is the number of cells horizontally across.
/*=====
	_xDim: null,
=====*/

	// _yDim: [protected] Integer
	//		This is the number of cells vertically down.
/*=====
	_yDim: null,
=====*/

	// tabIndex: String
	//		Widget tab index.
	tabIndex: "0",

	// cellClass: [protected] String
	//		CSS class applied to each cell in the palette
	cellClass: "dijitPaletteCell",

	// dyeClass: [protected] String
	//	 Name of javascript class for Object created for each cell of the palette.
	//	 dyeClass should implements dijit.Dye interface
	dyeClass: '',

	_preparePalette: function(choices, titles) {
		// summary:
		//		Subclass must call _preparePalette() from postCreate(), passing in the tooltip
		//		for each cell
		// choices: String[][]
		//		id's for each cell of the palette, used to create Dye JS object for each cell
		// titles: String[]
		//		Localized tooltip for each cell

		this._cells = [];
		var url = this._blankGif;
		
		var dyeClassObj = dojo.getObject(this.dyeClass);

		for(var row=0; row < choices.length; row++){
			var rowNode = dojo.create("tr", {tabIndex: "-1"}, this.gridNode);
			for(var col=0; col < choices[row].length; col++){
				var value = choices[row][col];
				if(value){
					var cellObject = new dyeClassObj(value);
					
					var cellNode = dojo.create("td", {
						"class": this.cellClass,
						tabIndex: "-1",
						title: titles[value]
					});

					// prepare cell inner structure
					cellObject.fillCell(cellNode, url);

					this.connect(cellNode, "ondijitclick", "_onCellClick");
					this._trackMouseState(cellNode, this.cellClass);

					dojo.place(cellNode, rowNode);

					cellNode.index = this._cells.length;

					// save cell info into _cells
					this._cells.push({node:cellNode, dye:cellObject});
				}
			}
		}
		this._xDim = choices[0].length;
		this._yDim = choices.length;

		// Now set all events
		// The palette itself is navigated to with the tab key on the keyboard
		// Keyboard navigation within the Palette is with the arrow keys
		// Spacebar selects the cell.
		// For the up key the index is changed by negative the x dimension.

		var keyIncrementMap = {
			UP_ARROW: -this._xDim,
			// The down key the index is increase by the x dimension.
			DOWN_ARROW: this._xDim,
			// Right and left move the index by 1.
			RIGHT_ARROW: 1,
			LEFT_ARROW: -1
		};
		for(var key in keyIncrementMap){
			this._connects.push(
				dijit.typematic.addKeyListener(
					this.domNode,
					{charOrCode:dojo.keys[key], ctrlKey:false, altKey:false, shiftKey:false},
					this,
					function(){
						var increment = keyIncrementMap[key];
						return function(count){ this._navigateByKey(increment, count); };
					}(),
					this.timeoutChangeRate,
					this.defaultTimeout
				)
			);
		}
	},

	postCreate: function(){
		this.inherited(arguments);
		// Set initial navigable node.   At any point in time there's exactly one
		// cell with tabIndex != -1.   If focus is inside the palette then
		// focus is on that cell.
		// TODO: if we set aria info (for the current value) on the palette itself then can we avoid
		// having to focus each individual cell?
		this._currentFocus = this._cells[0].node;
		dojo.attr(this._currentFocus, "tabIndex", this.tabIndex);
	},

	focus: function(){
		// summary:
		//		Focus this widget.  Puts focus on the most recently focused cell.

		// The cell already has tabIndex set, just need to set CSS and focus it
		dijit.focus(this._currentFocus);
	},

	_onBlur: function(){
		// summary:
		//		Handler for when the widget loses focus
		// tags:
		//		protected

		// Just to be the same as 1.3, when I am focused again go to first (0,0) cell rather than
		// currently focused node.
		dojo.attr(this._currentFocus, "tabIndex", "-1");
		this._currentFocus = this._cells[0].node;
		dojo.attr(this._currentFocus, "tabIndex", this.tabIndex);

		this.inherited(arguments);
	},

	_onCellClick: function(/*Event*/ evt){
		// summary:
		//		Handler for click, enter key & space key. Selects the cell.
		// evt:
		//		The event.
		// tags:
		//		private

		var target = evt.currentTarget;		
		var value = this._getDye(this._cells[target.index].node).getValue();
		this._setValueAttr(value, true);		
		dojo.stopEvent(evt);
	},

	_setCurrent: function(/*DomNode*/ node){
		// summary:
		//		Called to focus a cell.
		// description:
		//		Moves the tabIndex setting to the new cell.
		// tags:
		//		protected
		if("_currentFocus" in this){
			// Remove tabIndex on old cell
			dojo.attr(this._currentFocus, "tabIndex", "-1");
		}

		// Set tabIndex of new cell
		this._currentFocus = node;
		if(node){
			dojo.attr(node, "tabIndex", this.tabIndex);
		}
	},

	_setValueAttr: function(value, priorityChange){
	
		// summary:
		// 		This selects a cell. It triggers the onChange event.
		// value: String value of the cell to select
		// tags:
		//		protected
		// priorityChange:
		//		Optional parameter used to tell the select whether or not to fire
		//		onChange event.
		
		var dye=null;
		
		//if attr("value", null) is called, returns null and there's no cell with the thick border.
		if (value==null){
			this.value = null;
			if(this._selectedCell >= 0)
				dojo.removeClass(this._cells[this._selectedCell].node, "dijitPaletteCellSelected");
			this._selectedCell = -1;
		}			
		
		for(var i=0; i < this._cells.length; i++){
			if(value == this._getDye(this._cells[i].node).getValue()){
				if(this._selectedCell >= 0){
					dojo.removeClass(this._cells[this._selectedCell].node, "dijitPaletteCellSelected");
					dojo.removeClass(this._cells[this._selectedCell].node, "dijitPaletteCellHover");
				}
				this._selectedCell = i;
				dojo.addClass(this._cells[i].node, "dijitPaletteCellSelected");
				dye = this._getDye(this._cells[i].node);
			}
		}
		
		if(dye != null){
			this.value = dye.getValue();
			if(priorityChange || priorityChange === undefined){
				this.onChange(this.value = dye.getValue());
			}
		}
	},

	onChange: function(value){
		// summary:
		//		Callback when a cell is selected.
		// value: String
		//		Value corresponding to cell.
	},

	_navigateByKey: function(increment, typeCount){
		// summary:
		// 	  	This is the callback for typematic.
		// 		It changes the focus and the highlighed cell.
		// increment:
		// 		How much the key is navigated.
		// typeCount:
		//		How many times typematic has fired.
		// tags:
		//		private

		// typecount == -1 means the key is released.
		if(typeCount == -1){ return; }

		var newFocusIndex = this._currentFocus.index + increment;
		if(newFocusIndex < this._cells.length && newFocusIndex > -1){
			var focusNode = this._cells[newFocusIndex].node;
			this._setCurrent(focusNode);

			// Actually focus the node, for the benefit of screen readers.
			// Use setTimeout because IE doesn't like changing focus inside of an event handler
			setTimeout(dojo.hitch(dijit, "focus", focusNode), 0);
		}
	},

	_getDye: function(/*DomNode*/ cell){
		// summary:
		//		Get JS object for given cell DOMNode

		return this._cells[cell.index].dye;
	}
});

/*=====
dojo.declare("dijit.Dye",
	null,
	{
		// summary:
		//		Interface for the JS Object associated with a palette cell (i.e. DOMNode)

		constructor: function(alias){
			// summary:
			//		Initialize according to value or alias like "white"
			// alias: String
		},

		getValue: function(){
			// summary:
			//		Return "value" of cell; meaning of "value" varies by subclass.
			// description:
			//		For example color hex value, emoticon ascii value etc, entity hex value.
		},

		fillCell: function(cell, blankGif){
			// summary:
			//		Add cell DOMNode inner structure
			//	cell: DomNode
			//		The surrounding cell
			//	blankGif: String
			//		URL for blank cell image
		}
	}
);
=====*/