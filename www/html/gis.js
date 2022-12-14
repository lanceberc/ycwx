
// GIS sources

const gisRenderId = null;
const gisContainerMap = {};

class GIS {

    constructor(config) {

	function startStop(container) {
	    const visible = (document.visibilityState === 'visible');
	    const c = document.querySelector("#" + container);
	    const w = c.width;
	    const h = c.height;
	    
	    const state = gisContainerMap[container];
	    if ((state.animationId != null) && (!visible || (w == 0) || (h == 0))) {
		window.clearInterval(state.animationId);
		state.animationId = null;
		if (state.timeStopRefreshId != null) {
		    window.clearInterval(state.timeStopRefreshId);
		    state.timeStopRefreshId = null;
		}

		state.rendered = false;
		if ((gisRenderId == null) && (unrenderedCount() == 1)) {
		    gisRenderId = setInterval(render, 500);
		}
		console.log(`gis stop animation ${container}`);
	    }
	    
	    if ((state.animationId == null) && visible && (w != 0) && (h != 0)) {
		if (state.timeSource != null) {
		    state.animationId = window.setInterval(advanceTime, config.frameInterval, container);
		}
		state.rendered = true;

		const w = window.innerWidth;
		const h = window.innerHeight;

		let newZoom = state.config.zoom;
		if (w > 3000) {
		    newZoom = state.config.zoom + 1;
		}

		if (newZoom != state.zoom) {
		    state.zoom = newZoom;
		    map.setView(new ol.View({center: ol.proj.fromLonLat(state.config.center), zoom: newZoom}));
		    console.log(`gis startStop start ${container} zoom ${state.zoom}`);
		}
		
		if ((gisRenderId != null) && (unrenderedCount() == 0)) {
		    clearInterval(gisRenderId);
		    gisRenderId = null;
		}
		
		window.dispatchEvent(new Event('resize'));
	    }
	}

	function onchange (evt) {
	    let v = "visible", h = "hidden";
	    let evtMap = { focus:v, focusin:v, pageshow:v, blur:h, focusout:h, pagehide:h };
	    
	    evt = evt || window.event;
	    if (evt.type in evtMap) {
		console.log("gis visibilitychange: " + evtMap[evt.type])
	    } else {
		console.log(`gis visibilitychange: ${(document.hidden) ? "in" : ""}visible`);
		for (const c in gisContainerMap) {
		    startStop(c);
		}
	    }
	}

	function unrenderedCount() {
	    let count = 0;
	    for (const c in state) {
		count = count + ((state[c].rendered) ? 0: 1);
	    }
	    return(count);
	}

	function advanceTime(container) {
	    const state = gisContainerMap[container];
	    const interval = state.timeInterval;
	    const timeSpan = state.timeSpan;
	    const now = Math.floor((Date.now()/1000));
	    const start = now;
	    const end = now;
	    
	    if (state.lastFrameRelease != null) {
		if (Date.now() < state.lastFrameRelease) {
		    // console.log(`gis ${container} hold`);
		    return;
		}
		// console.log(`gis ${container} releasing`);
		state.lastFrameRelease = null;
		let start = parseInt(now / interval) * interval;
		let end = start;
		if (timeSpan < 0) {
		    start = start + timeSpan;
		} else {
		    end = start + timeSpan;
		}
		state.time = start;
		state.timeEnd = end;
	    } else {
		state.time = state.time + interval;
	    }
	    
	    if (state.time > state.timeEnd) {
		if ("lastFrameHoldInterval" in state) {
		    const d = new Date();
		    d.setTime(d.getTime() + state.lastFrameHoldInterval);
		    state.lastFrameRelease = d;
		    return;
		}
		
		let start = parseInt(now / interval) * interval;
		let end = start;
		if (timeSpan < 0) {
		    start = start + timeSpan;
		} else {
		    end = start + timeSpan;
		}
		state.time = start;
		state.timeEnd = end;
	    }
	    
	    state.timeSource.updateParams({
		time: state.time,
	    });

	    const labelDate = new Date();
	    labelDate.setTime(state.time * 1000);
	    const label = document.getElementById(state.label);
	    label.innerHTML = "GOES Composite " + labelDate.format("day") + " @" + labelDate.format("time");
	}
	
	// Called periodically when there are unrendered elements to see if they've become visible.
	// This is to work around OpenLayers not always rendering when an element starts hidden.
	function render() {
	    for (const c in state) {
		if (state[c].rendered == false) {
		    startStop(c);
		}
	    }
	}

	// https://gis.stackexchange.com/questions/111327/force-openlayers-to-not-use-browser-cache-for-tiles-refresh
	// This is a hack for defeating local caching; I'd like to have it use a layer-specific time instead of now
	// that updates periodically instead of every update request - but I haven't figured how to link 'this' to
	// the state params
	class TimeXYZ extends ol.source.XYZ {
	    getUrls() {
		const urls = [];
		ol.source.XYZ.prototype.getUrls(this).forEach(u => {
		    urls.push(u + '?time=' + parseInt(Math.floor(Date.now() / (10 * 60 * 1000)))); // kludge every 10 minutes
		});
		return(urls);
	    }
	    
	    getUrl() {
		const url = ol.source.XYZ.prototype.getUrl(this);
		return(url + '?time=' + parseInt(Math.floor(Date.now() / (10 * 60 * 1000)))); // kludge every 10 minutes
	    }
	};

	function update(state) {
	    state.config.layers.forEach(l => {
		if ("update" in l) {
		    l.layer.getSource().refresh();
		}
	    });
	}

	const container = config.container;
	gisContainerMap[container] = this;
	this.config = config;
	this.timeSource = null;
	this.timeSourceLayer = null;
	
	const layers = [];
	config.layers.forEach(l => {
	    let source = null;
	    console.log("cloudTops adding layer " + JSON.stringify(l));
	    if (l.type == "XYZ") {
		let options = {
		    attributions: l.attributions,
		};
		if ("params" in l) {
		    options.params = l.params;
		};
		if ("layers" in l) {
		    options.layers = l.layers;
		};
		if ("update" in l && l.update) {
		    // In order to avoid the browser cache we make the URL unique by adding a time field
		    // that increases every 10 minutes. To do so we stash the base URL in the source object
		    // and replace the object's tileUrlFunction. There has to be a better way.

		    // the tileUrlFunction is called only when this.url and this.urls aren't set
		    options.tileUrlFunction = function(tileCoord, pixelRatio, projection){
			// tileCoord is representing the location of a tile in a tile grid (z, x, y)
			let z = tileCoord[0].toString();
			let x = tileCoord[1].toString();
			let y = tileCoord[2].toString();

			let path = this.baseUrl;
			path = path.replace('{z}', z);
			path = path.replace('{x}', x);
			path = path.replace('{y}', y);
			path += '?t=' + Math.floor(Date.now() / (10 * 60 * 1000)); // Every 10 minutes
			// console.log("New XYZ path: " + path);
			return path;
		    }
		} else {
		    options.url = l.url + "/tile/{z}/{y}/{x}";
		}
		source = new ol.source.XYZ(options);
		source.baseUrl = l.url + "/tile/{z}/{y}/{x}";
	    } else if (l.type == "WMS") {
		source = new ol.source.TileWMS({
		    url: l.url,
		    attributions: l.attributions,
		    params: l.params,
		});
	    } else if (l.type == "ArcGISRest") {
		source = new ol.source.ImageArcGISRest({
		    url: l.url,
		    attributions: l.attributions,
		    params: l.params,
		});
	    } else if (l.type == "Stamen") {
		source = new ol.source.Stamen({ layer: l.layer });
	    }

	    if (("timeSource" in l) && l.timeSource) {
		this.timeSourceLayer = l;
		this.timeSource = source;
	    }
	    
	    const layerOptions = {
		source: source,
		//tileOptions: {crossOriginKeyword: 'anonymous'},
		//tileOptions: { crossOriginKeyword: null, },
	    };
	    
	    if ("cssClass" in l) {
		layerOptions.className = l.cssClass;
	    }

	    let layer = null;
	    if (l.type == "XYZ" || l.type == "WMS" || l.type == "Stamen") {
		 l.layer = new ol.layer.Tile(layerOptions);
	    }
	    if (l.type == "ArcGISRest") {
		l.layer = new ol.layer.Image(layerOptions);
	    }
	    l.source = source; // stash the source in the layer for updating time stops
	    layers.push(l.layer);
	});

	let map = new ol.Map({
	    target: container,
	    layers: layers,
	});
	this.map = map;
	this.rendered = false;
	this.zoom = config.zoom;
	console.log(`gis ${container} constructor zoom ${this.zoom}`);

	map.setView(
	    new ol.View({
		center: ol.proj.fromLonLat(config.center),
		zoom: config.zoom,
	    })
	);

	// Look for various events to render element and start/stop animation
	document.addEventListener("visibilitychange", onchange);

	new ResizeObserver((entries) => {
	    entries.forEach(e => {
		console.log("gis ResizeObserver event for: " + e.target.id);
		startStop(e.target.id);
		window.dispatchEvent(new Event('resize'));
	    });
	}).observe(document.getElementById(container));
	
	new IntersectionObserver((entries, observer) => {
	    entries.forEach(e => {
		const visible = e.isIntersecting;
		console.log(`gis IntersectionObserver: ${e.target.id} is ${(visible) ? "" : "in"}visible (${e.intersectionRatio * 100}%)`);
		startStop(e.target.id);
	    });
	}).observe(document.getElementById(container));

	if ("updateFrequency" in config) {
	    this.updateId = setInterval(update, config.updateFrequency, this);
	}
    }
}
