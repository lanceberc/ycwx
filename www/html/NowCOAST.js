
// NOAA NowCOAST via WMS tile services
//
// NOAA NowCOAST services need special handling because they have "time stops" (discreet times when
// layers are valid) are fetched by polling the NowCOAST service.
//
// This module assumes that one layer (such as the national radar mosaic) is the master time source
// and the other layers move in time with it by using their most recent valid time stop as the source
// is advanced. So as threatening weather moves forward in time the associated warning areas move with
// it, even if their respective time stops aren't exactly synchronized.
//
// This module could be augmented by implementing code that pops up the list of warnings active for
// a given mouse selection (among many possible improvements)

// A global for some variables to aid debugging
let nowCOAST = {};
nowCOAST.unrendered = [];
nowCOAST.c = {};

function initializeNowCOAST(config) {
    container = config.container;
    nowCOAST.unrendered.push(container);
    nowCOAST.c[container] = {};
    nowCOAST.c[container].config = config;
    nowCOAST.c[container].timeStopSource = null;
    nowCOAST.c[container].timeStopIndex = null;
    nowCOAST.c[container].animationId = null;
    nowCOAST.c[container].timeStopRefreshId = null;
    nowCOAST.c[container].lastFrameRelease = null;

    let layers = [];
    config.layers.forEach(l => {
	let source = null;
	if (l.type == "XYZ") {
	    source = new ol.source.XYZ({
		url: l.wmsURL,
		attributions: l.attributions,
	    });
	} else if (l.type == "WMS") {
	    source = new ol.source.TileWMS({
		url: l.wmsURL,
		attributions: l.attributions,
		params: l.wmsParams,
	    });
	} else if (l.type == "Stamen") {
	    source = new ol.source.Stamen({ layer: l.layer });
	}
	if ('timeSource' in l) {
	    nowCOAST.c[container].timeStopSource = l;
	}
	const layerOptions = {
	    source: source,
	    //tileOptions: {crossOriginKeyword: 'anonymous'},
	    //tileOptions: { crossOriginKeyword: null, },
	};
	if ("cssClass" in l) {
	    layerOptions.className = l.cssClass;
	}
	
	layers.push( new ol.layer.Tile(layerOptions) );
	l.source = source; // stash the source in the layer for updating time stops
    });

    let map = new ol.Map({
	target: container,
	layers: layers,
    });

    map.setView(
	new ol.View({
	    center: ol.proj.fromLonLat(config.center),
	    zoom: config.zoom,
	})
    );

    // Fetch initial time stops
    if (nowCOAST.c[container].timeStopSource != null) {
	updateTimeStops(container);
    }

    function mergeTimeStops(layers, start) {
	// Concat all the layers, sort, then filter so there are only unique values (indexOf is the first occurance)
	let ts = [];
	layers.forEach(l => {
	    ts = ts.concat(l.timeStops);
	});
	return( ts.sort().filter((v, i, a) => ((v > start) && (a.indexOf(v) === i))) );
    }

    // Time Stop updates come from the nowCOAST Layer Info server which we poll looking for updates
    function updateTimeStops(container) {
	config = nowCOAST.c[container].config;
	config.layers.filter(l => "timeStopLayers" in l).forEach(layer => {
	    console.log(`nowCOAST ${container} update time stops layer ${layer.service}`);
	    const timeStopURL = `https://new.nowcoast.noaa.gov/layerinfo?request=timestops&service=${layer.service}&layers=${layer.timeStopLayers}&format=json`;
	    fetch(timeStopURL)
		.then(response => response.json())
		.then(json => {
		    //console.log(`nowCOAST ${container} ${layer.service} .then()`);
		    intervalStart = Date.now() - config.timeSpan;
		    layer.timeStops = mergeTimeStops(json.layers, intervalStart).map(function(ts) { d = new Date(); d.setTime(ts); return(d); });
		    //console.log(`nowCOAST ${container} ${layer.service} update merged into ${layer.timeStops.length} time stops`);
		    if (layer.timeStops.length == 0) {
			console.log(`nowCOAST ${container} ${layer.service} has no time stops`);
			// give this layer the last time in the source's valid sequence - may not be necessary
			/*
			if (timeStops in nowCOAST[container].timeStopSource) {
			    const tss = nowCOAST[container].timeStopSource.timeStops;
			    const tssl = tss.length;
			    if (tssl > 0) {
				layer.timeStops = [ tss[tssl] ];
			    }
			}
			*/
		    } else {
			console.log(`nowCOAST ${container} ${layer.service} update ${layer.timeStops.length} timeStops ${layer.timeStops[0].format("time")} - ${layer.timeStops[layer.timeStops.length-1].format("time")}`);
		    
			// this is the source that we use when advancing the time shown
			if ("timeSource" in layer) {
			    // Is this the first time stop response for this layer?
			    console.log(`nowCOAST ${container} ${layer.service} enabling time stops`);
			    if (nowCOAST.c[container].timeStopIndex == null) {
				nowCOAST.c[container].timeStopIndex = 0;
			    }
			    
			    // Reset to first time stop if new set has less members than old one and we were near the end
			    if (nowCOAST.c[container].timeStopIndex >= layer.timeStops.length) {
				nowCOAST.c[container].timeStopIndex = 0;
			    }
			}
		    }
		})
		.catch(e => { console.log(`nowCOAST updateTimeStops failed ${timeStopURL}, ${layer.service}: ${e}`);});
	});
    }

    function advanceTime(container) {
	const config = nowCOAST.c[container].config;
	if (nowCOAST.c[container].lastFrameRelease != null) {
	    if (Date.now() < nowCOAST.c[container].lastFrameRelease) {
		// console.log(`nowCOAST ${container} hold`);
		return;
	    }
	    // console.log(`nowCOAST ${container} releasing`);
	    nowCOAST.c[container].lastFrameRelease = null;
	}
	
	if (nowCOAST.c[container].timeStopIndex != null) {
	    nowCOAST.c[container].timeStopIndex = nowCOAST.c[container].timeStopIndex + 1;
	    // This is convoluted - we move the index back to zero but don't update the sources
	    // We'll pause until after the frame release time with the check above
	    if (nowCOAST.c[container].timeStopIndex >= nowCOAST.c[container].timeStopSource.timeStops.length) {
		nowCOAST.c[container].timeStopIndex = 0;
		if ((nowCOAST.c[container].lastFrameRelease == null) && (config.lastFrameHoldInterval > 0)) {
		    nowCOAST.c[container].lastFrameRelease = Date.now() + config.lastFrameHoldInterval;
		    //console.log(`nowCOAST ${container} advanceTime pause`);
		    return;
		}
	    }
	    
	    // New display time
	    timeStop = nowCOAST.c[container].timeStopSource.timeStops[nowCOAST.c[container].timeStopIndex];
	    // console.log(`nowCOAST ${container} advancing time to ${timeStop.format("time")}`);
	    
	    // Loop through all the layers and advance the time to its time stop at or before the current time
	    nowCOAST.c[container].config.layers.filter(layer => ("timeStops" in layer) && (layer.timeStops.length > 0)).forEach(l => {
		let ts = l.timeStops[0];
		l.timeStops.forEach(e => { ts = (e <= timeStop) ? e : ts });
		// console.log(`nowCOAST ${container} advancing ${l.service} to ${ts.format("time")}`);
		l.source.updateParams({"TIME": ts.toISOString()});
	    });
	
	    document.getElementById(nowCOAST.c[container].config.label).innerHTML =
		`Watches, Warnings, and Radar ${timeStop.format("day")} @ ${timeStop.format("time")}`;
	}
    }

    function startStop(container) {
	const visible = (document.visibilityState === 'visible');
	const c = document.querySelector("#" + container);
	const w = c.width;
	const h = c.height;
	
	if ((nowCOAST.c[container].animationId != null) && (!visible || (w == 0) || (h == 0))) {
	    window.clearInterval(nowCOAST.c[container].animationId);
	    nowCOAST.c[container].animationId = null;
	    if (nowCOAST.c[container].timeStopRefreshId != null) {
		window.clearInterval(nowCOAST.c[container].timeStopRefreshId);
		nowCOAST.c[container].timeStopRefreshId = null;
	    }

	    function cUnrendered() {
		nowCOAST.unrendered.forEach(c => { if (c == container) {return true;}});
		return false;
	    }

	    if (cUnrendered()) {
		console.log(`nowCOAST add ${container} to render list`);
		nowCOAST.unrendered.push(container);
		if (nowCOAST.unrendered.length = 1) {
		    nowCOAST.renderId = setInterval(nowCOASTrender, 500);
		}
	    }
	    console.log(`nowCOAST stop animation ${container}`);
	}
	
	if ((nowCOAST.c[container].animationId == null) && visible && (w != 0) && (h != 0)) {
	    nowCOAST.c[container].animationId = window.setInterval(advanceTime, config.frameInterval, container);
	    if (nowCOAST.c[container].timeStopSource != null) {
		console.log(`nowCOAST start animation ${container}`);
		nowCOAST.c[container].timeStopRefreshId =
		    window.setInterval(updateTimeStops(container), config.timeStopUpdateInterval);
	    }
	    window.dispatchEvent(new Event('resize'));
	}
    }
    
    function onchange (evt) {
	let v = "visible", h = "hidden";
	let evtMap = { focus:v, focusin:v, pageshow:v, blur:h, focusout:h, pagehide:h };

	evt = evt || window.event;
	if (evt.type in evtMap) {
	    console.log("nowCOAST visibilitychange: " + evtMap[evt.type])
	} else {
	    console.log(`nowCOAST visibilitychange: ${(document.hidden) ? "in" : ""}visible`);
	    for (c in nowCOAST.c) {
		startStop(c);
	    }
	}
    }

    function nowCOASTrender() {
	let stillUnrendered = [];
	nowCOAST.unrendered.forEach(container => {
	    const e = document.getElementById(container);
	    const ole = e.querySelector(".ol-viewport");
	    let cr = null;
	    if (ole != null) {
		cr = ole.getClientRects();
	    }
	    if ((ole != null) && (cr.length != 0) && (cr[0].width != 0) && (cr[0].height != 0)) {
		console.log("nowCOAST fire resize for " + container);
		window.dispatchEvent(new Event('resize'));
	    } else {
		stillUnrendered.push(container);
	    }
	});
	
	nowCOAST.unrendered = stillUnrendered;
	if (stillUnrendered.length == 0) {
	    console.log("nowCOAST last container rendered");
	    clearInterval(nowCOAST.renderId);
	    nowCOAST.renderId = null;
	}
    }

    // If this is the only unrendered element start a timer looking for exposure/resize
    if (nowCOAST.unrendered.length == 1) {
	nowCOAST.renderId = setInterval(nowCOASTrender, 500);
    }
    
    //document.querySelector("#" + config.container).addEventListener("visibilitychange", onchange);
    document.addEventListener("visibilitychange", onchange);

    new ResizeObserver((entries) => {
	entries.forEach(e => {
	    console.log("nowCOAST ResizeObserver event for: " + e.target.id);
	    startStop(e.target.id);
	    window.dispatchEvent(new Event('resize'));
	});
    }).observe(document.querySelector("#" + config.container));
}
