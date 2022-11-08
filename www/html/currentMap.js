let curentsMap = null;

function initializeCurrentMap(config) {
    let currentsTimeSource = null;
    let currentsContainer = null;

    let layers = [];
    config.layers.forEach(l => {
	let source = null;
	if (l.type == "XYZ") {
	    source = new ol.source.XYZ({
		url: l.url,
		attributions: l.attributions,
	    });
	} else if (l.type == "WMS") {
	    source = new ol.source.TileWMS({
		url: l.url,
		attributions: l.attributions,
		params: l.params,
	    });
	    if ('timeSource' in l) {
		currentsTimeSource = source;
	    }
	} else if (l.type == "Stamen") {
	    source = new ol.source.Stamen({ layer: l.layer });
	}
	newLayer = new ol.layer.Tile({
	    source: source
	});
	layers.push(newLayer);
    });
    
    let map = new ol.Map({
        target: config.container,
	layers: layers,
    });

    currentsMap = map;

    currentsContainer = config.container;

    map.setView(
	new ol.View({
	    center: ol.proj.fromLonLat(config.center),
	    zoom: config.zoom,
	})
    );

    let currentsDate = new Date();
    const oneHour = 60 * 60 * 1000;
    const timeStep = oneHour; // Forecasts are every hour
    const startDate = new Date();
    const stopDate = new Date();
    
    function thisHour() {
	return Math.round(Date.now() / oneHour) * oneHour;
    }

    let animationId = null;

    startDate.setTime(thisHour() - (1 * oneHour));
    stopDate.setTime(thisHour() + (config.hours * oneHour));
    currentsDate.setTime(thisHour());

    function setTime() {
	currentsDate.setTime(currentsDate.getTime() + timeStep);
	if (currentsDate > stopDate) {
	    currentsDate.setTime(startDate.getTime());
	}
	currentsTimeSource.updateParams({"TIME": currentsDate.toISOString()});
	const h = currentsDate.getHours();
	const hours = ((h < 10) ? "0" : "") + h;
	const m = currentsDate.getMinutes();
	const minutes = ((m < 10) ? "0" : "") + m;
	const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][currentsDate.getDay()];
	document.getElementById(config.label).innerHTML =
	    `Current Forecast on ${day} @ ${hours}:${minutes}`;
    }

    function startStop() {
	const visible = (document.visibilityState === 'visible');
	const c = document.querySelector("#" + currentsContainer);
	const rect = c.getBoundingClientRect();
	
	if ((animationId != null) && (!visible || (rect.width == 0) || (rect.height == 0))) {
	    window.clearInterval(animationId);
	    animationId = null;
	    console.log("currents stop animation");
	}
	if ((animationId == null) && visible && (rect.width != 0) && (rect.height != 0)) {
	    animationId = window.setInterval(setTime, config.frameInterval);
	    console.log("currents start animation");
	    currentsMap.updateSize();
	}
    }
    
    function onchange (evt) {
	let v = "visible", h = "hidden";
	let evtMap = { focus:v, focusin:v, pageshow:v, blur:h, focusout:h, pagehide:h };

	evt = evt || window.event;
	if (evt.type in evtMap) {
	    console.log("currents visibilitychange: " + evtMap[evt.type])
	} else {
	    console.log(`currents visibilitychange: ${(this.hidden) ? "in" : ""}visible`);
	    startStop();
	}
    }
    
    //document.querySelector("#" + config.container).addEventListener("visibilitychange", onchange);
    document.addEventListener("visibilitychange", onchange);
    
    new ResizeObserver((entries) => {
	entries.forEach(e => {
	    console.log("currents ResizeObserver event for: " + e.target.id);
	    startStop();
	});
    }).observe(document.querySelector("#" + config.container));
}
