
// GIS sources

const gisRenderId = null;
const gisContainerMap = {};

class GIS {

    constructor(config) {

	function startStop(container) {
	    const visible = (document.visibilityState === 'visible');
	    const c = document.querySelector("#" + container);
	    const bb = c.getBoundingClientRect();
	    const w = bb.width;
	    const h = bb.height;
	    
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

		// Kludge for 4k displays
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

	    if (!visible || (w == 0) || (h == 0)) {
		// console.log(`gis startStop ${container} invisible ${visible} ${w} x ${h} update ${state.updateId}`);
		if (state.updateId != null) {
		    clearInterval(state.updateId);
		    state.updateId = null;
		    console.log(`gis startStop ${container} stop update timer`);
		}
	    } else {
		// console.log(`gis startStop ${container} visible ${visible} ${w} x ${h} update ${state.updateId}`);
		if (state.updateId == null) {
		    state.updateId = setInterval(update, config.updateFrequency, state);
		    console.log(`gis startStop ${container} update timer ${state.updateId}`);
		}
		update(state);
	    }
	}

	function onVisibilityChange (evt) {
	    let v = "visible", h = "hidden";
	    let evtMap = { focus:v, focusin:v, pageshow:v, blur:h, focusout:h, pagehide:h };
	    
	    evt = evt || window.event;
	    console.log(`gis visibilitychange target ${evt.target}`);
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
	    
	    if ((typeof state.lastFrameRelease !== 'undefined') && (state.lastFrameRelease != null)) {
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
	    label.innerHTML = "GOES Composite " + labelDate.format("dddd") + " @" + labelDate.format("HH:MM");
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
		if ("cache_defeat" in l && (l.cache_defeat != 0)) {
		    const source = l.layer.getSource();
		    if (("type" in source) && ((source.type == "TileWMS") || (source.type == "ArcGISRest"))) {
			let params = source.getParams();
			params.t = Math.floor((Date.now()/1000) / l.cache_defeat) * l.cache_defeat;
			console.log(`gis ${source.type} Update t ${params.t} ${l.url}`);
			source.updateParams(params);
			//source.tileCache.expireCache({});
			//source.tileCache.clear();
		    } else {
			console.log(`gis (${source.type}) Update ${l.url}`);
		    }
		    source.refresh();
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
	    console.log("gis adding layer " + JSON.stringify(l));
	    if (l.type == "XYZ") {
		const options = {};
		// XYZ() doesn't take a 'params' argument so if there are parameters like the token
		// for ESRI basemaps or t=??? to defeat the cache we use a custom fetch function.
		// There has to be a better way.
		const customFetch = ('cache_defeat' in l && (l.cache_defeat != 0)) || ('params' in l);
		if  (customFetch) {
		    // We stash the base URL in the source object
		    // The tileUrlFunction is called only when this.url and this.urls aren't set
		    options.tileUrlFunction = function(tileCoord, pixelRatio, projection){
			// tileCoord is representing the location of a tile in a tile grid (z, x, y)
			let z = tileCoord[0].toString();
			let x = tileCoord[1].toString();
			let y = tileCoord[2].toString();

			let url = this.baseUrl;
			url = url.replace('{z}', z);
			url = url.replace('{x}', x);
			url = url.replace('{y}', y);

			if ('params' in l) {
			    for (p in l.params) {
				url += `?${p}=${l.params.p}`;
			    }
			}
			if ("cache_defeat" in l && (l.cache_defeat != 0)) {
			    url += '?t=' + Math.floor((Date.now()/1000) / l.cache_defeat) * l.cache_defeat;
			}
			// console.log("gis XYZ layer XYZ url: " + url);
			return url;
		    }
		} else {
		    options.url = l.url + "/tile/{z}/{y}/{x}";
		}
		if ('attributions' in l) {
		    options.attributions = l.attributions;
		};
		if ('projection' in l) {
		    options.projection = ol.proj.get(l.projection);
		}
		source = new ol.source.XYZ(options);
		source.type = "XYZ";
		if (customFetch) {
		    // Stash the url in the source object for use by the tileUrlFunction()
		    source.baseUrl = l.url + "/tile/{z}/{y}/{x}";
		}
	    } else if (l.type == "WMS") {
		if ("cache_defeat" in l && (l.cache_defeat != 0)) {
		    if (!("params" in l)) {
			l.params = {};
		    }
		    l.params.t = Math.floor((Date.now()/1000) / l.cache_defeat) * l.cache_defeat;
		}
		let args = {
		    url: l.url,
		    attributions: l.attributions,
		    params: l.params,
		};
		if ('projection' in l) {
		    args.projection = ol.proj.get(l.projection);
		}
		source = new ol.source.TileWMS(args);
		if ("cache_defeat" in l && (l.cache_defeat != 0)) {
		    source.type = "TileWMS";
		}
	    } else if (l.type == "ArcGISRest") {
		let args = {
		    url: l.url,
		    attributions: l.attributions,
		    params: l.params,
		};
		if ('projection' in l) {
		    args.projection = ol.proj.get(l.projection);
		}
		// Ratio defaults to 1.5 causing XYZ layers to not line up properly due to
		// implementation issues on older systems. Ratio=1.0 is less efficient when
		// panning / zooming.
		args.ratio = 1.0;
		source = new ol.source.ImageArcGISRest(args);
		if ("cache_defeat" in l && (l.cache_defeat != 0)) {
		    source.type = "ArcGISRest";
		}
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
	//document.getElementById(container).addEventListener("visibilitychange", onchange);
	document.addEventListener("visibilitychange", onVisibilityChange);

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

GIS.prototype.initializeFeatures = function(spec) {
    var style = new ol.style.Style({
	text: new ol.style.Text({
	    /*
            font: '15px Calibri,sans-serif',
            fill: new ol.style.Fill({ color: '#000' }),
            stroke: new ol.style.Stroke({
		color: '#fff', width: 2
            }),
            offsetY: 0,
	    */
            //font: '1.2vw "Courier New", Courier, monospace, bold',
	    // Using a px font allows the image to be panned & zoomed on phones w/o the text shrinking
            font: '22px "Lucida Console", "Courier New", Courier, monospace, bold',
	    textAlign: 'left',
            fill: new ol.style.Fill({ color: '#008' }),
            stroke: new ol.style.Stroke({
		color: [255, 255, 255, 1],
		width: 4,
            }),
	    backgroundFill: new ol.style.Fill({
		color: [255, 255, 255, 0.25],
	    }),
	    padding: [2, 2, 2, 2],
            offsetY: 0,
	})
    });
    var vectorLayer = new ol.layer.Vector({
	target: "points",
	source: new ol.source.Vector(),
	style: function (feature) {
            style.getText().setText(feature.get('text'));
            return style;
	}
    });

    function addFeature(lat, lng, txt, cssClass) {
	var source = vectorLayer.getSource();
	var pointFeature = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.transform([parseFloat(lng), parseFloat(lat)], 'EPSG:4326', 'EPSG:3857')),
            text: txt,
	    className: cssClass,
	});
	source.addFeature(pointFeature);
	return pointFeature;
    }

    const features = {};
    for (let i in spec.points) {
	const p = spec.points[i];
	features[p.id] = addFeature(p.lat, p.lon, p.txt, spec.cssClass + "-" + p.id);
    }

    this.map.addLayer(vectorLayer);
    return(features);
}
