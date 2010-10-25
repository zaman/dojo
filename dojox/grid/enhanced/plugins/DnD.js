dojo.provide("dojox.grid.enhanced.plugins.DnD");

dojo.require("dojox.grid.enhanced._Plugin");
dojo.require("dojox.grid.enhanced.plugins.Selector");
dojo.require("dojox.grid.enhanced.plugins.Rearrange");
dojo.require("dojo.dnd.move");
dojo.require("dojo.dnd.Source");
dojo.require("dojox.widget.Toaster");

(function(){
var _devideToArrays = function(a){
		a.sort(function(v1, v2){
			return v1 - v2;
		});
		var arr = [[a[0]]];
		for(var i = 1, j = 0; i < a.length; ++i){
			if(a[i] == a[i-1] + 1){
				arr[j].push(a[i]);
			}else{
				arr[++j] = [a[i]];
			}
		}
		return arr; 
	},
	_joinToArray = function(arrays){
		var a = arrays[0];
		for(var i = 1; i < arrays.length; ++i){
			a = a.concat(arrays[i]);
		}
		return a;
	};
dojo.declare("dojox.grid.enhanced.plugins.DnD", dojox.grid.enhanced._Plugin, {
	// summary:
	//		Provide drag and drop for grid columns/rows/cells within grid and out of grid.
	//		The store of grid must implement dojo.data.api.Write.
	//		DnD selected columns:
	//			Support moving within grid, moving/copying out of grid to a non-grid DnD target.
	//		DnD selected rows:
	//			Support moving within grid, moving/copying out of grid to any DnD target.
	//		DnD selected cells (in rectangle shape only):
	//			Support moving/copying within grid, moving/copying out of grid to any DnD target.
	//		
	
	// name: String,
	//		plugin name;
	name: "dnd",
	
	_targetAnchorBorderWidth: 2, 
	_copyOnly: false,
	_config: {
		"row":{
			"within":true,
			"in":true,
			"out":true
		},
		"col":{
			"within":true,
			"in":true,
			"out":true
		},
		"cell":{
			"within":true,
			"in":true,
			"out":true
		}
	},
	constructor: function(grid, args){
		this.grid = grid;
		this._config = dojo.clone(this._config);
		args = dojo.isObject(args) ? args : {};
		this.setupConfig(args.dndConfig);
		this._copyOnly = !!args.copyOnly;
		
		//Get the plugins we are dependent on.
		this._mixinGrid();
		this.selector = grid.pluginMgr.getPlugin("selector");
		this.rearranger = grid.pluginMgr.getPlugin("rearrange");
		//TODO: waiting for a better plugin framework to pass args to dependent plugins.
		this.rearranger.setArgs(args);
		
		//Initialized the components we need.
		this._clear();
		this._elem = new dojox.grid.enhanced.plugins.GridDnDElement(this);
		this._source = new dojox.grid.enhanced.plugins.GridDnDSource(this._elem.node, {
			"grid": grid,
			"dndElem": this._elem,
			"dnd": this
		});
		this._container = dojo.query(".dojoxGridMasterView", this.grid.domNode)[0];
		this._initEvents();
		
		//Dragging unloaded rows out of grid is not supported!
		this._toaster = new dojox.widget.Toaster({
			positionDirection: "br-left",
			messageTopic: "warningMsg_" + grid.id
		});
		this._toaster.placeAt(dojo.body());
	},
	destroy: function(){
		this.inherited(arguments);
		this._clear();
		this._toaster.destroyRecursive();
		this._source.destroy();
		this._elem.destroy();
		this._container = null;
		this.grid = null;
		this.selector = null;
		this.rearranger = null;
		this._config = null;
	},
	_mixinGrid: function(){
		// summary:
		//		Provide APIs for grid.
		this.grid.setupDnDConfig = dojo.hitch(this, "setupConfig");
		this.grid.dndCopyOnly = dojo.hitch(this, "copyOnly");
	},
	setupConfig: function(config){
		// summary:
		//		Configure which DnD functionalities are needed.
		//		Combination of any item from type set ("row", "col", "cell") 
		//		and any item from mode set("within", "in", "out") is configurable.
		//		
		//		"row", "col", "cell" are straitforward, while the other 3 are explained below:
		//		"within": DnD within grid, that is, column/row reordering and cell moving/copying.
		//		"in": Whether allowed to accept rows/cells (currently not support columns) from another grid.
		//		"out": Whether allowed to drag out of grid, to another grid or even to any other DnD target.
		//		
		//		If not provided in the config, will use the default.
		//		When declared together, Mode set has higher priority than type set.
		// config: Object
		//		DnD configuration object.
		//		See the examples below.
		// example:
		//		The following code disables row DnD within grid, 
		//		but still can drag rows out of grid or drag rows from other gird.
		//	|	setUpConfig({
		//	|		"row": {
		//	|			"within": false
		//	|		}
		//	|	});
		//		
		//		The opposite way is also okay:
		//	|	setUpConfig({
		//	|		"within": {
		//	|			"row": false
		//	|		}
		//	|	});
		//		
		//		And if you'd like to disable/enable a whole set, here's a shortcut:
		//	|	setUpConfig({
		//	|		"cell", true,
		//	|		"out": false
		//	|	});
		//		
		//		Because mode has higher priority than type, the following will disable row dnd within grid:
		//	|	setUpConfig({
		//	|		"within", {
		//	|			"row": false;
		//	|		},
		//	|		"row", {
		//	|			"within": true
		//	|		}
		//	|	});
		if(config && dojo.isObject(config)){
			var firstLevel = ["row", "col", "cell"],
				secondLevel = ["within", "in", "out"],
				cfg = this._config;
			dojo.forEach(firstLevel, function(type){
				if(type in config){
					var t = config[type];
					if(t && dojo.isObject(t)){
						dojo.forEach(secondLevel, function(mode){
							if(mode in t){
								cfg[type][mode] = !!t[mode];
							}
						});
					}else{
						dojo.forEach(secondLevel, function(mode){
							cfg[type][mode] = !!t;
						});
					}	
				}
			});
			dojo.forEach(secondLevel, function(mode){
				if(mode in config){
					var m = config[mode];
					if(m && dojo.isObject(m)){
						dojo.forEach(firstLevel, function(type){
							if(type in m){
								cfg[type][mode] = !!m[type];
							}
						});
					}else{
						dojo.forEach(firstLevel, function(type){
							cfg[type][mode] = !!m;
						});
					}
				}
			});
		}
	},
	copyOnly: function(isCopyOnly){
		// summary:
		//		Setter/getter of this._copyOnly.
		if(typeof isCopyOnly == "undefined"){
			return this._copyOnly;
		}
		this._copyOnly = !!isCopyOnly;
	},
	_isOutOfGrid: function(evt){
		var gridPos = dojo.position(this.grid.domNode), x = evt.clientX, y = evt.clientY;
		return y < gridPos.y || y > gridPos.y + gridPos.h || 
			x < gridPos.x || x > gridPos.x + gridPos.w;
	},
	_initEvents: function(){
		var g = this.grid,
			s = this.selector,
			_this = this;
		this.connect(dojo.doc, "onmousemove", function(evt){
			if(_this._dndRegion && !_this._dnding && !_this._externalDnd){
				_this._dnding = true;
				_this._startDnd(evt);
			}else{
				if(_this._isMouseDown && !_this._dndRegion){
					delete _this._isMouseDown;
					_this._oldCursor = dojo.style(dojo.body(), "cursor");
					dojo.style(dojo.body(), "cursor", "not-allowed");
				}
				//TODO: should implement as mouseenter/mouseleave
				//But we have an avatar under mouse when dnd, and this will cause a lot of mouseenter in FF.
				var isOut = _this._isOutOfGrid(evt);
				if(!_this._alreadyOut && isOut){
					_this._alreadyOut = true;
					if(_this._dnding){
						_this._destroyDnDUI(true, false);
					}
					_this._moveEvent = evt;
					_this._source.onOutEvent();
				}else if(_this._alreadyOut && !isOut){
					_this._alreadyOut = false;
					if(_this._dnding){
						_this._createDnDUI(evt, true);
					}
					_this._moveEvent = evt;
					_this._source.onOverEvent();
				}
			}
		});
		this.connect(dojo.doc, "onmouseup", function(evt){
			if(!_this._extDnding && !_this._isSource){
				var isInner = _this._dnding && !_this._alreadyOut;
				if(isInner && _this._config[_this._dndRegion.type]["within"]){
					_this._rearrange();
				}
				_this._endDnd(isInner);
			}
			dojo.style(dojo.body(), "cursor", _this._oldCursor || "");
			delete _this._isMouseDown;
		});
		this.connect(g, "onCellMouseOver", function(evt){
			if(!_this._dnding && !s.isSelecting() && !evt.ctrlKey){
				_this._dndReady = s.isSelected("cell", evt.rowIndex, evt.cell.index);
				s.selectEnabled(!_this._dndReady);
			}
		});
		this.connect(g, "onHeaderCellMouseOver", function(evt){
			if(_this._dndReady){
				s.selectEnabled(true);
			}
		});
		this.connect(g, "onRowMouseOver", function(evt){
			if(_this._dndReady && !evt.cell){
				s.selectEnabled(true);
			}
		});
		this.connect(g, "onCellMouseDown", function(evt){
			if(!evt.ctrlKey && _this._dndReady){
				_this._dndRegion = _this._getDnDRegion(evt.rowIndex, evt.cell.index);
				_this._isMouseDown = true;
			}
		});
		this.connect(g, "onCellMouseUp", function(evt){
			if(!_this._dndReady && !s.isSelecting() && evt.cell){
				_this._dndReady = s.isSelected("cell", evt.rowIndex, evt.cell.index);
				s.selectEnabled(!_this._dndReady);
			}
		});
		this.connect(g, "onCellClick", function(evt){
			if(_this._dndReady && !evt.ctrlKey && !evt.shiftKey){
				s.select("cell", evt.rowIndex, evt.cell.index);
			}
		});
		g.focus.addArea({
			name: "dnd",
			onKeyDown: function(evt, isBubble){
				if(!isBubble && evt.keyCode == dojo.keys.CTRL){
					s.selectEnabled(true);
					_this._isCopy = true;
				}
			},
			onKeyUp: function(evt, isBubble){
				if(!isBubble && evt.keyCode == dojo.keys.CTRL){
					s.selectEnabled(!_this._dndReady);
					_this._isCopy = false;
				}
			}
		});
		g.focus.placeArea("dnd","above","content");
		g.focus.placeArea("dnd","above","header");
		g.focus.placeArea("dnd","above","rowHeader");
		
		this.connect(g, "onEndAutoScroll", function(isVertical, isForward, view, target, evt){
			if(_this._dnding){
				_this._markTargetAnchor(evt);
			}
		});
		this.connect(dojo.doc, "onkeydown", function(evt){
			if(evt.keyCode == dojo.keys.ESCAPE){
				_this._endDnd(false);
			}
		});
	},
	_clear: function(){
		this._dndRegion = null;
		this._target = null;
		this._moveEvent = null;
		this._targetAnchor = {};
		this._dnding = false;
		this._externalDnd = false;
		this._isSource = false;
		this._alreadyOut = false;
		this._extDnding = false;
	},
	_getDnDRegion: function(rowIndex, colIndex){
		var s = this.selector,
			selected = s._selected,
			flag = (!!selected.cell.length) | (!!selected.row.length << 1) | (!!selected.col.length << 2),
			type;
		switch(flag){
			case 1:
				type = "cell";
				if(!this._config[type]["within"] && !this._config[type]["out"]){
					return null;
				}
				var cells = this.grid.layout.cells,
					getCount = function(range){
						var hiddenColCnt = 0;
						for(var i = range.min.col; i <= range.max.col; ++i){
							if(cells[i].hidden){
								++hiddenColCnt;
							}
						}
						return (range.max.row - range.min.row + 1) * (range.max.col - range.min.col + 1 - hiddenColCnt);
					},
					inRange = function(item, range){
						return item.row >= range.min.row && item.row <= range.max.row && 
							item.col >= range.min.col && item.col <= range.max.col;
					},
					range = {
						max: {
							row: -1,
							col: -1
						},
						min: {
							row: Infinity,
							col: Infinity
						}
					};
				
				dojo.forEach(selected[type], function(item){
					if(item.row < range.min.row){
						range.min.row = item.row;
					}
					if(item.row > range.max.row){
						range.max.row = item.row;
					}
					if(item.col < range.min.col){
						range.min.col = item.col;
					}
					if(item.col > range.max.col){
						range.max.col = item.col;
					}
				});
				if(dojo.some(selected[type], function(item){
					return item.row == rowIndex && item.col == colIndex;
				})){
					if(getCount(range) == selected[type].length && dojo.every(selected[type], function(item){
						return inRange(item, range);
					})){
						return {
							"type": type,
							"selected": [range],
							"handle": {
								"row": rowIndex,
								"col": colIndex
							}
						};
					}
				}
				return null;
			case 2: case 4:
				type = flag == 2 ? "row" : "col";
				if(!this._config[type]["within"] && !this._config[type]["out"]){
					return null;
				}
				var res = s.getSelected(type);
				if(res.length){
					return {
						"type": type,
						"selected": _devideToArrays(res),
						"handle": flag == 2 ? rowIndex : colIndex
					};
				}
				return null;
		}
		return null;
	},
	_startDnd: function(evt){
		this._createDnDUI(evt);
	},
	_endDnd: function(destroySource){
		this._destroyDnDUI(false, destroySource);
		this._clear();
	},
	_createDnDUI: function(evt, isMovingIn){
		//By default the master view of grid do not have height, because the children in it are all positioned absolutely.
		//But we need it to contain avatars.
		var viewPos = dojo.position(this.grid.views.views[0].domNode);
		dojo.style(this._container, "height", viewPos.h + "px");
		try{
			//If moving in from out side, dnd source is already created.
			if(!isMovingIn){
				this._createSource(evt);
			}
			this._createMoveable(evt);
			this._oldCursor = dojo.style(dojo.body(), "cursor");
			dojo.style(dojo.body(), "cursor", "default");
		}catch(e){
			console.log("_createDnDUI:", e);
		}
	},
	_destroyDnDUI: function(isMovingOut, destroySource){
		try{
			if(destroySource){
				this._destroySource();
			}
			this._unmarkTargetAnchor();
			if(!isMovingOut){
				this._destroyMoveable();
			}
			dojo.style(dojo.body(), "cursor", this._oldCursor);
		}catch(e){
			console.log("_destroyDnDUI:", this.grid.id, e);
		}
	},
	_createSource: function(evt){
		this._elem.createDnDNodes(this._dndRegion);
		var m = dojo.dnd.manager();
		var oldMakeAvatar = m.makeAvatar;
		m._dndPlugin = this;
		m.makeAvatar = function(){
			var avatar = new dojox.grid.enhanced.plugins.GridDnDAvatar(m);
			delete m._dndPlugin;
			return avatar;
		};
		m.startDrag(this._source, this._elem.getDnDNodes(), evt.ctrlKey);
		m.makeAvatar = oldMakeAvatar;
		m.onMouseMove(evt);
	},
	_destroySource: function(){
		dojo.publish("/dnd/cancel");
		this._elem.destroyDnDNodes();	
	},
	_createMoveable: function(evt){
		if(!this._markTagetAnchorHandler){
			this._markTagetAnchorHandler = this.connect(dojo.doc, "onmousemove", "_markTargetAnchor");
		}
	},
	_destroyMoveable: function(){
		this.disconnect(this._markTagetAnchorHandler);
		delete this._markTagetAnchorHandler;
	},
	_calcColTargetAnchorPos: function(evt, containerPos){
		// summary:
		//		Calculate the position of the column DnD avatar
		var i, headPos, left, target, ex = evt.clientX,
			cells = this.grid.layout.cells,
			ltr = dojo._isBodyLtr(),
			headers = this._getVisibleHeaders();
		for(i = 0; i < headers.length; ++i){
			headPos = dojo.position(headers[i].node);
			if((i === 0 || ex >= headPos.x) && ex < headPos.x + headPos.w){
				left = headPos.x + (ltr ? 0 : headPos.w);
				break;
			}else if(i == headers.length - 1 && ex >= headPos.x + headPos.w){
				++i;
				left = headPos.x + (ltr ? headPos.w : 0);
				break;
			}
		}
		if(i < headers.length){
			target = headers[i].cell.index;
			if(this.selector.isSelected("col", target) && this.selector.isSelected("col", target - 1)){
				var ranges = this._dndRegion.selected;
				for(i = 0; i < ranges.length; ++i){
					if(dojo.indexOf(ranges[i], target) >= 0){
						target = ranges[i][0];
						headPos = dojo.position(cells[target].getHeaderNode());
						left = headPos.x + (ltr ? 0 : headPos.w);
						break;
					}
				}
			}
		}else{
			target = cells.length;
		}
		this._target = target;
		return left - containerPos.x;
	},
	_calcRowTargetAnchorPos: function(evt, containerPos){
		// summary:
		//		Calculate the position of the row DnD avatar
		var g = this.grid, top, i = 0,
			cells = g.layout.cells;
		while(cells[i].hidden){ ++i; }
		var cell = g.layout.cells[i],
			rowIndex = g.scroller.firstVisibleRow,
			nodePos = dojo.position(cell.getNode(rowIndex));
		while(nodePos.y + nodePos.h < evt.clientY){
			if(++rowIndex >= g.rowCount){
				break;
			}
			nodePos = dojo.position(cell.getNode(rowIndex));
		}
		if(rowIndex < g.rowCount){
			if(this.selector.isSelected("row", rowIndex) && this.selector.isSelected("row", rowIndex - 1)){
				var ranges = this._dndRegion.selected;
				for(i = 0; i < ranges.length; ++i){
					if(dojo.indexOf(ranges[i], rowIndex) >= 0){
						rowIndex = ranges[i][0];
						nodePos = dojo.position(cell.getNode(rowIndex));
						break;
					}
				}
			}
			top = nodePos.y;
		}else{
			top = nodePos.y + nodePos.h; 
		}
		this._target = rowIndex;
		return top - containerPos.y;
	},
	_calcCellTargetAnchorPos: function(evt, containerPos, targetAnchor){
		// summary:
		//		Calculate the position of the cell DnD avatar
		var s = this._dndRegion.selected[0],
			origin = this._dndRegion.handle,
			g = this.grid, ltr = dojo._isBodyLtr(),
			cells = g.layout.cells, headPos,
			minPos, maxPos, headers,
			height, width, left, top,
			minCol, maxCol, i,
			preSpan = origin.col - s.min.col,
			postSpan = s.max.col - origin.col,
			leftTopDiv, rightBottomDiv;
		if(!targetAnchor.childNodes.length){
			leftTopDiv = dojo.create("div", {
				"class": "dojoxGridCellBorderLeftTopDIV"
			}, targetAnchor);
			rightBottomDiv = dojo.create("div", {
				"class": "dojoxGridCellBorderRightBottomDIV"
			}, targetAnchor);
		}else{
			leftTopDiv = dojo.query(".dojoxGridCellBorderLeftTopDIV", targetAnchor)[0];
			rightBottomDiv = dojo.query(".dojoxGridCellBorderRightBottomDIV", targetAnchor)[0];
		}
		for(i = s.min.col + 1; i < origin.col; ++i){
			if(cells[i].hidden){
				--preSpan;
			}
		}
		for(i = origin.col + 1; i < s.max.col; ++i){
			if(cells[i].hidden){
				--postSpan;
			}
		}
		headers = this._getVisibleHeaders();
		//calc width
		for(i = preSpan; i < headers.length - postSpan; ++i){
			headPos = dojo.position(headers[i].node);
			if((evt.clientX >= headPos.x && evt.clientX < headPos.x + headPos.w) || //within in this column
				//prior to this column, but within range
				(i == preSpan && (ltr ? evt.clientX < headPos.x : evt.clientX >= headPos.x + headPos.w)) || 
				//post to this column, but within range
				(i == headers.length - postSpan - 1 && (ltr ? evt.clientX >= headPos.x + headPos.w : evt < headPos.x))){
					minCol = headers[i - preSpan];
					maxCol = headers[i + postSpan];
					minPos = dojo.position(minCol.node);
					maxPos = dojo.position(maxCol.node);
					minCol = minCol.cell.index;
					maxCol = maxCol.cell.index;
					left = ltr ? minPos.x : maxPos.x;
					width = ltr ? (maxPos.x + maxPos.w - minPos.x) : (minPos.x + minPos.w - maxPos.x);
					break;
			}
		}
		//calc height
		i = 0;
		while(cells[i].hidden){ ++i; }
		var cell = cells[i],
			rowIndex = g.scroller.firstVisibleRow,
			nodePos = dojo.position(cell.getNode(rowIndex));
		while(nodePos.y + nodePos.h < evt.clientY){
			if(++rowIndex < g.rowCount){
				nodePos = dojo.position(cell.getNode(rowIndex));
			}else{
				break;
			}
		}
		var minRow = rowIndex >= origin.row - s.min.row ? rowIndex - origin.row + s.min.row : 0;
		var maxRow = minRow + s.max.row - s.min.row;
		if(maxRow >= g.rowCount){
			maxRow = g.rowCount - 1;
			minRow = maxRow - s.max.row + s.min.row;
		}
		minPos = dojo.position(cell.getNode(minRow));
		maxPos = dojo.position(cell.getNode(maxRow));
		top = minPos.y;
		height = maxPos.y + maxPos.h - minPos.y;
		this._target = {
			"min":{
				"row": minRow,
				"col": minCol	
			},
			"max":{
				"row": maxRow,
				"col": maxCol
			}
		};
		var anchorBorderSize = (dojo.marginBox(leftTopDiv).w - dojo.contentBox(leftTopDiv).w) / 2;
		var leftTopCellPos = dojo.position(cells[minCol].getNode(minRow));
		dojo.style(leftTopDiv, {
			"width": (leftTopCellPos.w - anchorBorderSize) + "px",
			"height": (leftTopCellPos.h - anchorBorderSize) + "px"
		});
		var rightBottomCellPos = dojo.position(cells[maxCol].getNode(maxRow));
		dojo.style(rightBottomDiv, {
			"width": (rightBottomCellPos.w - anchorBorderSize) + "px",
			"height": (rightBottomCellPos.h - anchorBorderSize) + "px"
		});
		return {
			h: height,
			w: width,
			l: left - containerPos.x,
			t: top - containerPos.y
		};
	},
	_markTargetAnchor: function(evt){
		try{
		var t = this._dndRegion.type;
		if(this._alreadyOut || (this._dnding && !this._config[t]["within"]) || (this._extDnding && !this._config[t]["in"])){
			return;
		}
		var height, width, left, top,
			targetAnchor = this._targetAnchor[t] = this._targetAnchor[t] || dojo.create("div", {
				"class": (t == "cell") ? "dojoxGridCellBorderDIV" : "dojoxGridBorderDIV"
			}),
			pos = dojo.position(this._container);
		switch(t){
			case "col":
				height = pos.h;
				width = this._targetAnchorBorderWidth;
				left = this._calcColTargetAnchorPos(evt, pos);
				top = 0;
				break;
			case "row":
				height = this._targetAnchorBorderWidth;
				width = pos.w;
				left = 0;
				top = this._calcRowTargetAnchorPos(evt, pos);
				break;
			case "cell":
				var cellPos = this._calcCellTargetAnchorPos(evt, pos, targetAnchor);
				height = cellPos.h;
				width = cellPos.w;
				left = cellPos.l;
				top = cellPos.t;
		}
		if(typeof height == "number" && typeof width == "number" && typeof left == "number" && typeof top == "number"){
			dojo.style(targetAnchor, {
				"height": height + "px",
				"width": width + "px",
				"left": left + "px",
				"top": top + "px"
			});
			this._container.appendChild(targetAnchor);
		}else{
			this._target = null;
		}
		}catch(e){
			console.log("_markTargetAnchor",e);
		}
	},
	_unmarkTargetAnchor: function(){
		try{
			this._container.removeChild(this._targetAnchor[this._dndRegion.type]);
		}catch(e){
			//console.log("unmark:",e);
		}
	},
	_getVisibleHeaders: function(){
		return dojo.map(dojo.filter(this.grid.layout.cells, function(cell){
			return !cell.hidden;
		}), function(cell){
			return {
				"node": cell.getHeaderNode(),
				"cell": cell
			};
		});
	},
	_rearrange: function(){
		if(this._target === null){
			return;
		}
		var t = this._dndRegion.type;
		var ranges = this._dndRegion.selected;
		if(t === "cell"){
			this.rearranger[(this._isCopy || this._copyOnly) ? "copyCells" : "moveCells"](ranges[0], this._target);
		}else{
			this.rearranger[t == "col" ? "moveColumns" : "moveRows"](_joinToArray(ranges), this._target);
		}
		this._target = null;
	},
	onDraggingOver: function(sourcePlugin){
		if(!this._dnding && sourcePlugin){
			sourcePlugin._isSource = true;
			this._extDnding = true;
			if(!this._externalDnd){
				this._externalDnd = true;
				this._dndRegion = this._mapRegion(sourcePlugin.grid, sourcePlugin._dndRegion);
			}
			this._createDnDUI(this._moveEvent,true);
		}
	},
	_mapRegion: function(srcGrid, dndRegion){
		if(dndRegion.type === "cell"){
			var srcRange = dndRegion.selected[0];
			var cells = this.grid.layout.cells;
			var srcCells = srcGrid.layout.cells;
			var c, cnt = 0;
			for(c = srcRange.min.col; c <= srcRange.max.col; ++c){
				if(!srcCells[c].hidden){
					++cnt;
				}
			}
			for(c = 0; cnt > 0; ++c){
				if(!cells[c].hidden){
					--cnt;
				}
			}
			var region = dojo.clone(dndRegion);
			region.selected[0].min.col = 0;
			region.selected[0].max.col = c - 1;
			for(c = srcRange.min.col; c <= dndRegion.handle.col; ++c){
				if(!srcCells[c].hidden){
					++cnt;
				}
			}
			for(c = 0; cnt > 0; ++c){
				if(!cells[c].hidden){
					--cnt;
				}
			}
			region.handle.col = c;
		}
		return dndRegion;
	},
	onDraggingOut: function(sourcePlugin){
		if(this._externalDnd){
			this._extDnding = false;
			this._destroyDnDUI(true, false);
			if(sourcePlugin){
				sourcePlugin._isSource = false;
			}
		}
	},
	onDragIn: function(sourcePlugin, isCopy){
		var success = false;
		if(this._target !== null){
			var type = sourcePlugin._dndRegion.type;
			var ranges = sourcePlugin._dndRegion.selected;
			switch(type){
				case "cell":
					this.rearranger.changeCells(sourcePlugin.grid, ranges[0], this._target);
					break;
				case "row":
					var range = _joinToArray(ranges);
					this.rearranger.insertRows(sourcePlugin.grid, range, this._target);
					break;
			}
			success = true;
		}
		this._endDnd(true);
		sourcePlugin.onDragOut(success && !isCopy);
	},
	onDragOut: function(isMove){
		if(isMove && !this._copyOnly){
			var type = this._dndRegion.type;
			var ranges = this._dndRegion.selected;
			switch(type){
				case "cell":
					this.rearranger.clearCells(ranges[0]);
					break;
				case "row":
					this.rearranger.removeRows(_joinToArray(ranges));
					break;
			}
		}
		this._endDnd(true);
	},
	_canAccept: function(sourcePlugin){
		if(sourcePlugin){
			var srcRegion = sourcePlugin._dndRegion;
			var type = srcRegion.type;
			if(!this._config[type]["in"] || !sourcePlugin._config[type]["out"]){
				return false;
			}
			var g = this.grid;
			var ranges = srcRegion.selected;
			var colCnt = dojo.filter(g.layout.cells, function(cell){
				return !cell.hidden;
			}).length;
			var rowCnt = g.rowCount;
			var res = true;
			switch(type){
				case "cell":
					ranges = ranges[0];
					res = g.store.getFeatures()["dojo.data.api.Write"] && 
						(ranges.max.row - ranges.min.row) <= rowCnt && 
						dojo.filter(sourcePlugin.grid.layout.cells, function(cell){
							return cell.index >= ranges.min.col && cell.index <= ranges.max.col && !cell.hidden;
						}).length <= colCnt;
					//intentional drop through - don't break
				case "row":
					if(sourcePlugin._allDnDItemsLoaded()){
						return res;
					}else{
						dojo.publish("warningMsg_" + this.grid.id, [{
							message: "<div style='font-weight:bolder; color: red;'>Warning: <br />Can NOT drag unloaded rows out of grid!</div>", 
							type: "warning"
						}]);
						return false;
					}
			}
		}
		return false;
	},
	_allDnDItemsLoaded: function(){
		if(this._dndRegion){
			var type = this._dndRegion.type,
				ranges = this._dndRegion.selected,
				rows = [];
			switch(type){
				case "cell":
					for(var i = ranges[0].min.row, max = ranges[0].max.row; i <= max; ++i){
						rows.push(i);
					}
					break;
				case "row":
					rows = _joinToArray(ranges);
					break;
				default:
					return false;
			}
			var cache = this.grid._by_idx;
			return dojo.every(rows, function(rowIndex){
				return !!cache[rowIndex];
			});
		}
		return false;
	}
});
dojo.declare("dojox.grid.enhanced.plugins.GridDnDElement", null, {
	constructor: function(dndPlugin){
		this.plugin = dndPlugin;
		this.node = dojo.create("div");
		this._items = {};
	},
	destroy: function(){
		this.plugin = null;
		this.node = null;
		this._items = null;
	},
	createDnDNodes: function(dndRegion){
		this.destroyDnDNodes();
		var acceptType = ["grid/" + dndRegion.type + "s"];
		var itemNodeIdBase = this.plugin.grid.id + "_dndItem";
		dojo.forEach(dndRegion.selected, function(range, i){
			var id = itemNodeIdBase + i;
			this._items[id] = {
				"type": acceptType,
				"data": range,
				"dndPlugin": this.plugin
			};
			this.node.appendChild(dojo.create("div", {
				"id": id,
				"innerHTML": this._getInnerHTML(dndRegion.type, range)
			}));
		}, this);
	},
	getDnDNodes: function(){
		return dojo.map(this.node.childNodes, function(node){
			return node;
		});
	},
	destroyDnDNodes: function(){
		dojo.empty(this.node);
		this._items = {};
	},
	getItem: function(nodeId){
		return this._items[nodeId];
	},
	_getInnerHTML: function(type, range){
		switch(type){
			case "cell":
				if(range.min.col == range.max.col && range.min.row == range.max.row){
					return ["Cell (", range.min.col, " , ", range.min.row, ")"].join("");
				}else{
					return [
						"From Cell (",
						range.min.col," , ",range.min.row,
						") to Cell (",
						range.max.col," , ",range.max.row,
						")"
					].join('');
				}
				break;
			case "row": case "col":
				type = type == "row" ? "Row " : "Column ";
				if(range.length == 1){
					return type + range[0];
				}else{
					return ["From ", type, range[0], " to ", type, range[range.length - 1]].join('');
				}
		}
	}
});
dojo.declare("dojox.grid.enhanced.plugins.GridDnDSource",dojo.dnd.Source,{
	accept: ["grid/cells", "grid/rows", "grid/cols"],
	constructor: function(node, param){
		this.grid = param.grid;
		this.dndElem = param.dndElem;
		this.dndPlugin = param.dnd;
		this.sourcePlugin = null;
	},
	destroy: function(){
		this.inherited(arguments);
		this.grid = null;
		this.dndElem = null;
		this.dndPlugin = null;
		this.sourcePlugin = null;
	},
	getItem: function(nodeId){
		return this.dndElem.getItem(nodeId);
	},
	checkAcceptance: function(source, nodes){
		if(this != source && nodes[0]){
			var item = source.getItem(nodes[0].id);
			var type = item.type;
			for(var j = 0; j < type.length; ++j){
				if(type[j] in this.accept){
					if(this.dndPlugin._canAccept(item.dndPlugin)){
						this.sourcePlugin = item.dndPlugin;
					}else{
						return false;
					}
					break;
				}
			}
		}
		return this.inherited(arguments);
	},
	onDraggingOver: function(){
		this.dndPlugin.onDraggingOver(this.sourcePlugin);
	},
	onDraggingOut: function(){
		this.dndPlugin.onDraggingOut(this.sourcePlugin);
	},
	onDndDrop: function(source, nodes, copy, target){
		//this.inherited(arguments);
		this.onDndCancel();
		if(this != source && this == target){
			this.dndPlugin.onDragIn(this.sourcePlugin, copy);
		}
	}
});

dojo.declare("dojox.grid.enhanced.plugins.GridDnDAvatar", dojo.dnd.Avatar, {
	construct: function(){
		// summary:
		//		constructor function;
		//		it is separate so it can be (dynamically) overwritten in case of need
		this._itemType = this.manager._dndPlugin._dndRegion.type;
		this._itemCount = this._getItemCount();
			
		this.isA11y = dojo.hasClass(dojo.body(), "dijit_a11y");
		var a = dojo.create("table", {
				"border": "0",
				"cellspacing": "0",
				"class": "dojoxGridDndAvatar",
				"style": {
					position: "absolute",
					zIndex: "1999",
					margin: "0px"
				}
			}),
			source = this.manager.source,
			b = dojo.create("tbody", null, a),
			tr = dojo.create("tr", null, b),
			td = dojo.create("td", {
				"class": "dojoxGridDnDIcon"
			}, tr);
		if(this.isA11y){
			dojo.create("span", {
				"id" : "a11yIcon",
				"innerHTML" : this.manager.copy ? '+' : "<"
			}, td);
		}
		td = dojo.create("td", {
			"class" : "dojoxGridDnDItemIcon " + this._getGridDnDIconClass()
		}, tr);
		td = dojo.create("td", null, tr);
		dojo.create("span", {
			"class": "dojoxGridDnDItemCount",
			"innerHTML": source.generateText ? this._generateText() : ""
		}, td);
		// we have to set the opacity on IE only after the node is live
		dojo.style(tr, {
			"opacity": 0.9
		});
		this.node = a;
	},
	_getItemCount: function(){
		var selected = this.manager._dndPlugin._dndRegion.selected,
			count = 0;
		switch(this._itemType){
			case "cell":
				selected = selected[0];
				var cells = this.manager._dndPlugin.grid.layout.cells,
					colCount = selected.max.col - selected.min.col + 1,
					rowCount = selected.max.row - selected.min.row + 1;
				if(colCount > 1){
					for(var i = selected.min.col; i <= selected.max.col; ++i){
						if(cells[i].hidden){
							--colCount;
						}
					}
				}
				count = colCount * rowCount;
				break;
			case "row":
			case "col":
				count = _joinToArray(selected).length;
		}
		return count;
	},
	_getGridDnDIconClass: function(){
		return {
			"row": ["dojoxGridDnDIconRowSingle", "dojoxGridDnDIconRowMulti"],
			"col": ["dojoxGridDnDIconColSingle", "dojoxGridDnDIconColMulti"],
			"cell": ["dojoxGridDnDIconCellSingle", "dojoxGridDnDIconCellMulti"]
		}[this._itemType][this._itemCount == 1 ? 0 : 1];
	},
	_generateText: function(){
		// summary: 
		//		generates a proper text to reflect copying or moving of items
		return "(" + this._itemCount + ")";
	}
});

dojox.grid.EnhancedGrid.registerPlugin('dnd', dojox.grid.enhanced.plugins.DnD, {
	"dependency": ["selector", "rearrange"]
});
})();