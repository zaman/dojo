dojo.provide("dijit.layout.ContentPane");

dojo.require("dijit._Widget");
dojo.require("dijit.layout._LayoutWidget");

dojo.require("dojo.parser");
dojo.require("dojo.string");
dojo.require("dojo.html");
dojo.requireLocalization("dijit", "loading");

dojo.declare(
	"dijit.layout.ContentPane",
	dijit._Widget,
{
	// summary:
	//		A widget that acts as a Container for other widgets, and includes a ajax interface
	// description:
	//		A widget that can be used as a standalone widget
	//		or as a baseclass for other widgets
	//		Handles replacement of document fragment using either external uri or javascript
	//		generated markup or DOM content, instantiating widgets within that content.
	//		Don't confuse it with an iframe, it only needs/wants document fragments.
	//		It's useful as a child of LayoutContainer, SplitContainer, or TabContainer.
	//		But note that those classes can contain any widget as a child.
	// example:
	//		Some quick samples:
	//		To change the innerHTML use .attr('content', '<b>new content</b>')
	//
	//		Or you can send it a NodeList, .attr('content', dojo.query('div [class=selected]', userSelection))
	//		please note that the nodes in NodeList will copied, not moved
	//
	//		To do a ajax update use .attr('href', url)

	// href: String
	//		The href of the content that displays now.
	//		Set this at construction if you want to load data externally when the
	//		pane is shown.	(Set preload=true to load it immediately.)
	//		Changing href after creation doesn't have any effect; use attr('href', ...);
	href: "",

/*=====
	// content: String
	//		The innerHTML of the ContentPane.
	//		Note that the initialization parameter / argument to attr("content", ...)
	//		can be a String, DomNode, Nodelist, or widget.
	content: "",
=====*/

	// extractContent: Boolean
	//	Extract visible content from inside of <body> .... </body>
	extractContent: false,

	// parseOnLoad: Boolean
	//	parse content and create the widgets, if any
	parseOnLoad:	true,

	// preventCache: Boolean
	//		Cache content retreived externally
	preventCache:	false,

	// preload: Boolean
	//	Force load of data even if pane is hidden.
	preload: false,

	// refreshOnShow: Boolean
	//		Refresh (re-download) content when pane goes from hidden to shown
	refreshOnShow: false,

	// loadingMessage: String
	//	Message that shows while downloading
	loadingMessage: "<span class='dijitContentPaneLoading'>${loadingState}</span>", 

	// errorMessage: String
	//	Message that shows if an error occurs
	errorMessage: "<span class='dijitContentPaneError'>${errorState}</span>", 

	// isLoaded: Boolean
	//		True if the ContentPane has data in it, either specified
	//		during initialization (via href or inline content), or set
	//		via attr('content', ...) / attr('href', ...)
	//
	//		False if it doesn't have any content, or if ContentPane is
	//		still in the process of downloading href.
	isLoaded: false,

	baseClass: "dijitContentPane",

	// doLayout: Boolean
	//		- false - don't adjust size of children
	//		- true - if there is a single visible child widget, set it's size to
	//				however big the ContentPane is
	doLayout: true,

	postMixInProperties: function(){
		this.inherited(arguments);
		var messages = dojo.i18n.getLocalization("dijit", "loading", this.lang);
		this.loadingMessage = dojo.string.substitute(this.loadingMessage, messages);
		this.errorMessage = dojo.string.substitute(this.errorMessage, messages);
	},

	buildRendering: function(){
		this.inherited(arguments);
		if(!this.containerNode){
			// make getDescendants() work
			this.containerNode = this.domNode;
		}
	},

	postCreate: function(){
		// remove the title attribute so it doesn't show up when i hover
		// over a node
		this.domNode.title = "";

		if (!dijit.hasWaiRole(this.domNode)){
			dijit.setWaiRole(this.domNode, "group");
		}

		dojo.addClass(this.domNode, this.baseClass);
		
		// Detect if we were initialized with data
		if(!this.href && this.srcNodeRef && this.srcNodeRef.innerHTML){
			this.isLoaded = true;
		}
	},

	startup: function(){
		if(this._started){ return; }
		if(this.doLayout != "false" && this.doLayout !== false){
			this._checkIfSingleChild();
			if(this._singleChild){
				this._singleChild.startup();
			}
		}
		this._loadCheck();
		this.inherited(arguments);
	},

	_checkIfSingleChild: function(){
		// summary:
		//		Test if we have exactly one visible widget as a child,
		//		and if so assume that we are a container for that widget,
		//		and should propogate startup() and resize() calls to it.
		//		Skips over things like data stores since they aren't visible.

		var childNodes = dojo.query(">", this.containerNode),
			childWidgetNodes = childNodes.filter(function(node){
				return dojo.hasAttr(node, "dojoType") || dojo.hasAttr(node, "widgetId");
			}),
			candidateWidgets = dojo.filter(childWidgetNodes.map(dijit.byNode), function(widget){
				return widget && widget.domNode && widget.resize;
			});

		if(
			// all child nodes are widgets
			childNodes.length == childWidgetNodes.length &&

			// all but one are invisible (like dojo.data)
			candidateWidgets.length == 1
		){
			this.isContainer = true;
			this._singleChild = candidateWidgets[0];
		}else{
			delete this.isContainer;
			delete this._singleChild;
		}
	},

	setHref: function(/*String|Uri*/ href){
		dojo.deprecated("dijit.layout.ContentPane.setHref() is deprecated.	Use attr('href', ...) instead.", "", "2.0");
		return this.attr("href", href);
	},
	_setHrefAttr: function(/*String|Uri*/ href){
		// summary:
		//		Hook so attr("href", ...) works.
		// description:
		//		Reset the (external defined) content of this pane and replace with new url
		//		Note: It delays the download until widget is shown if preload is false.
		//	href:
		//		url to the page you want to get, must be within the same domain as your mainpage

		// Cancel any in-flight requests (an attr('href') will cancel any in-flight attr('href', ...))
		this.cancel();

		this.href = href;

		// _setHrefAttr() is called during creation and by the user, after creation.
		// only in the second case do we actually load the URL; otherwise it's done in startup()
		if(this._created && (this.preload || this._isShown())){
			// we return result of refresh() here to avoid code dup. in dojox.layout.ContentPane
			return this.refresh();
		}else{
			// Set flag to indicate that href needs to be loaded the next time the
			// ContentPane is made visible
			this._hrefChanged = true;
		}
	},

	setContent: function(/*String|DomNode|Nodelist*/data){
		dojo.deprecated("dijit.layout.ContentPane.setContent() is deprecated.  Use attr('content', ...) instead.", "", "2.0");
		this.attr("content", data);
	},
	_setContentAttr: function(/*String|DomNode|Nodelist*/data){
		// summary:
		//		Hook to make attr("content", ...) work.
		//		Replaces old content with data content, include style classes from old content
		//	data:
		//		the new Content may be String, DomNode or NodeList
		//
		//		if data is a NodeList (or an array of nodes) nodes are copied
		//		so you can import nodes from another document implicitly

		// clear href so we can't run refresh and clear content
		// refresh should only work if we downloaded the content
		this.href = "";

		// Cancel any in-flight requests (an attr('content') will cancel any in-flight attr('href', ...))
		this.cancel();

		this._setContent(data || "");

		this._isDownloaded = false; // mark that content is from a attr('content') not an attr('href')
	},
	_getContentAttr: function(){
		// summary: hook to make attr("content") work
		return this.containerNode.innerHTML;
	},

	cancel: function(){
		// summary:
		//		Cancels a inflight download of content
		if(this._xhrDfd && (this._xhrDfd.fired == -1)){
			this._xhrDfd.cancel();
		}
		delete this._xhrDfd; // garbage collect
	},

	destroyRecursive: function(/*Boolean*/ preserveDom){
		// summary:
		//		Destroy the ContentPane and it's contents

		// if we have multiple controllers destroying us, bail after the first
		if(this._beingDestroyed){
			return;
		}
		this._beingDestroyed = true;
		this.inherited(arguments);
	},

	resize: function(size){
		dojo.marginBox(this.domNode, size);

		// Compute content box size in case we [later] need to size child
		// If either height or width wasn't specified by the user, then query node for it.
		// But note that setting the margin box and then immediately querying dimensions may return
		// inaccurate results, so try not to depend on it.
		var node = this.containerNode,
			mb = dojo.mixin(dojo.marginBox(node), size||{});

		var cb = this._contentBox = dijit.layout.marginBox2contentBox(node, mb);

		// If we have a single widget child then size it to fit snugly within my borders
		if(this._singleChild && this._singleChild.resize){
			// note: if widget has padding this._contentBox will have l and t set,
			// but don't pass them to resize() or it will doubly-offset the child
			this._singleChild.resize({w: cb.w, h: cb.h});
		}
	},

	_isShown: function(){
		// summary: returns true if the content is currently shown
		if("open" in this){
			return this.open;		// for TitlePane, etc.
		}else{
			var node = this.domNode;
			return (node.style.display != 'none')  && (node.style.visibility != 'hidden') && !dojo.hasClass(node, "dijitHidden");
		}
	},

	_loadCheck: function(){
		// summary:
		//		Call this to load href contents if necessary.
		// description:
		//		Call when !ContentPane has been made visible [from prior hidden state],
		//		or href has been changed, or on startup, etc.

		if(
			(this.href && !this._xhrDfd) &&		// if there's an href that isn't already being loaded
			(!this.isLoaded || this._hrefChanged || this.refreshOnShow) && 	// and we need a [re]load
			(this.preload || this._isShown())	// and now is the time to [re]load
		){
			delete this._hrefChanged;
			this.refresh();
		}
	},

	refresh: function(){
		// summary:
		//		[Re]download contents of href and display
		// description:
		//		1. cancels any currently in-flight requests
		//		2. posts "loading..." message
		//		3. sends XHR to download new data

		// cancel possible prior inflight request
		this.cancel();

		// display loading message
		this._setContent(this.onDownloadStart(), true);

		var self = this;
		var getArgs = {
			preventCache: (this.preventCache || this.refreshOnShow),
			url: this.href,
			handleAs: "text"
		};
		if(dojo.isObject(this.ioArgs)){
			dojo.mixin(getArgs, this.ioArgs);
		}

		var hand = this._xhrDfd = (this.ioMethod || dojo.xhrGet)(getArgs);

		hand.addCallback(function(html){
			try{
				self._isDownloaded = true;
				self._setContent(html, false);
				self.onDownloadEnd();
			}catch(err){
				self._onError('Content', err); // onContentError
			}
			delete self._xhrDfd;
			return html;
		});

		hand.addErrback(function(err){
			if(!hand.cancelled){
				// show error message in the pane
				self._onError('Download', err); // onDownloadError
			}
			delete self._xhrDfd;
			return err;
		});
	},

	_onLoadHandler: function(data){
		// summary:
		//		This is called whenever new content is being loaded
		this.isLoaded = true;
		try{
			this.onLoad(data);
		}catch(e){
			console.error('Error '+this.widgetId+' running custom onLoad code: ' + e.message);
		}
	},

	_onUnloadHandler: function(){
		// summary:
		//		This is called whenever the content is being unloaded
		this.isLoaded = false;
		try{
			this.onUnload();
		}catch(e){
			console.error('Error '+this.widgetId+' running custom onUnload code: ' + e.message);
		}
	},

	destroyDescendants: function(){
		// summary:
		//		Destroy all the widgets inside the ContentPane and empty containerNode

		// Make sure we call onUnload (but only when the ContentPane has real content)
		if(this.isLoaded){
			this._onUnloadHandler();
		}

		// Even if this.isLoaded == false there might still be a "Loading..." message
		// to erase, so continue...

		// For historical reasons we need to delete all widgets under this.containerNode,
		// even ones that the user has created manually.
		var setter = this._contentSetter;
		dojo.forEach(this.getDescendants(true), function(widget){
			if(widget.destroyRecursive){
				widget.destroyRecursive();
			}
		});
		if(setter){
			// Most of the widgets in setter.parseResults have already been destroyed, but
			// things like Menu that have been moved to <body> haven't yet
			dojo.forEach(setter.parseResults, function(widget){
				if(widget.destroyRecursive && widget.domNode && widget.domNode.parentNode == dojo.body()){
					widget.destroyRecursive();
				}
			});
			delete setter.parseResults;
		}
		
		// And then clear away all the DOM nodes
		dojo.html._emptyNode(this.containerNode);
	},

	_setContent: function(cont, isFakeContent){
		// summary: 
		//		Insert the content into the container node

		// first get rid of child widgets
		this.destroyDescendants();

		// dojo.html.set will take care of the rest of the details
		// we provide an overide for the error handling to ensure the widget gets the errors 
		// configure the setter instance with only the relevant widget instance properties
		// NOTE: unless we hook into attr, or provide property setters for each property, 
		// we need to re-configure the ContentSetter with each use
		var setter = this._contentSetter; 
		if(! (setter && setter instanceof dojo.html._ContentSetter)) {
			setter = this._contentSetter = new dojo.html._ContentSetter({
				node: this.containerNode,
				_onError: dojo.hitch(this, this._onError),
				onContentError: dojo.hitch(this, function(e){
					// fires if a domfault occurs when we are appending this.errorMessage
					// like for instance if domNode is a UL and we try append a DIV
					var errMess = this.onContentError(e);
					try{
						this.containerNode.innerHTML = errMess;
					}catch(e){
						console.error('Fatal '+this.id+' could not change content due to '+e.message, e);
					}
				})/*,
				_onError */
			});
		};

		var setterParams = dojo.mixin({
			cleanContent: this.cleanContent, 
			extractContent: this.extractContent, 
			parseContent: this.parseOnLoad 
		}, this._contentSetterParams || {});
		
		dojo.mixin(setter, setterParams); 

		setter.set( (dojo.isObject(cont) && cont.domNode) ? cont.domNode : cont );

		// setter params must be pulled afresh from the ContentPane each time
		delete this._contentSetterParams;
		
		if(!isFakeContent){
			if(this.doLayout != "false" && this.doLayout !== false){
				this._checkIfSingleChild();
				if(this._singleChild && this._singleChild.resize){
					this._singleChild.startup();
					var cb = this._contentBox || dojo.contentBox(this.containerNode);
					this._singleChild.resize({w: cb.w, h: cb.h});
				}
			}
			
			this._onLoadHandler(cont);
		}
	},

	_onError: function(type, err, consoleText){
		// shows user the string that is returned by on[type]Error
		// overide on[type]Error and return your own string to customize
		var errText = this['on' + type + 'Error'].call(this, err);
		if(consoleText){
			console.error(consoleText, err);
		}else if(errText){// a empty string won't change current content
			this._setContent(errText, true);
		}
	},

	_createSubWidgets: function(){
		// summary: scan my contents and create subwidgets
		try{
			dojo.parser.parse(this.containerNode, true);
		}catch(e){
			this._onError('Content', e, "Couldn't create widgets in "+this.id
				+(this.href ? " from "+this.href : ""));
		}
	},


	// EVENT's, should be overide-able
	onLoad: function(data){
		// summary:
		//		Event hook, is called after everything is loaded and widgetified
	},

	onUnload: function(){
		// summary:
		//		Event hook, is called before old content is cleared
	},

	onDownloadStart: function(){
		// summary:
		//		called before download starts
		//		the string returned by this function will be the html
		//		that tells the user we are loading something
		//		override with your own function if you want to change text
		return this.loadingMessage;
	},

	onContentError: function(/*Error*/ error){
		// summary:
		//		called on DOM faults, require fault etc in content
		//		default is to display errormessage inside pane
	},

	onDownloadError: function(/*Error*/ error){
		// summary:
		//		Called when download error occurs, default is to display
		//		errormessage inside pane. Overide function to change that.
		//		The string returned by this function will be the html
		//		that tells the user a error happend
		return this.errorMessage;
	},

	onDownloadEnd: function(){
		// summary:
		//		called when download is finished
	}
});
