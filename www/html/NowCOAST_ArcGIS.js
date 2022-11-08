
// NOAA NowCOAST via ArcGIS. Seems to use quite a bit of CPU

let initializeNowCOAST_ArcGIS = null;

require(
    [
	"esri/config",
	"esri/Map",
	"esri/views/MapView",
	"esri/layers/FeatureLayer",
	"esri/layers/GraphicsLayer",
	"esri/layers/MapImageLayer",
	"esri/layers/support/LabelClass",
	"esri/widgets/TimeSlider",
    ],

    function(esriConfig, Map, MapView, FeatureLayer, GraphicsLayer, MapImageLayer, LabelClass, TimeSlider) {
	esriConfig.apiKey = esri_apikey;

	initializeNowCOAST_ArcGIS = function(config) {
	    let map = new Map({
		basemap: config.basemap,
	    });
	    config.map = map;
	    
	    let view = new MapView({
		container: config.container, // Div element
		map: map,
		center: config.center,
		zoom: config.zoom,
	    });
	    config.view = view;

	    config.layers.forEach(l => {
		let layer = new MapImageLayer({
		    url: `https://new.nowcoast.noaa.gov/arcgis/rest/services/nowcoast/${l.service}/MapServer`,
		    sublayers: l.sublayers,
		});
		map.add(layer);
	    });

	    if ("timeStopService" in config) {
		timeSlider = new TimeSlider({
		    container: "timeSliderDiv",
		    view: view,
		    mode: "instant",
		    //timeVisible: true,
		    loop: true,
		    playRate: config.playRate, // msec between animation steps in milliseconds
		    layout: "compact",
		    iconClass: config.iconClass,
		});
		config.timeSlider = timeSlider;
		
		updateTimeSlider(config);
		timeStopRefreshId = window.setInterval(updateTimeSlider(config), config.timeStopUpdateInterval);
		startStopOnVisible(document.querySelector("#" + config.container));

		timeSlider.watch("timeExtent", timeExtent => {
		    let id = config.container + "-titleText";
		    document.getElementById(id).innerHTML = formatDate(timeExtent.start, "short");
		    // console.log("NowCOAST time extent " + formatDate(timeExtent.start, "short") + " - " + formatDate(timeExtent.end), "short");
		});
	    }
	    
	    //d3.selectAll(".esri-attribution").remove();

	    // Don't update the map when it's not displayed - this code is incomplete; needs to fire on visibility changes
	    function startStopOnVisible(elem) {
		new IntersectionObserver((entries, observer) => {
		    entries.forEach(e => {
			const visible = e.isIntersecting;
			console.log(`Observe: ${e.target.id} is ${(visible) ? "" : "in"}visible (${e.intersectionRatio * 100}%)`);
			//console.log("Intersection event for " + e.target.id);
			//const visible = (e.intersectionRatio > 0);
			nowCoastElements.forEach(ncElement => {
			    if (ncElement.container == e.target.id) {
				if (visible) {
				    console.log("start timeSlider " + e.target.id);
				    ncElement.timeSlider.play();
				} else {
				    console.log("stop timeSlider " + e.target.id);
				    ncElement.timeSlider.stop();
				}
			    }
			});
		    });
		}).observe(elem);
	    };
	    
	    // Time Stop updates come from the NowCOAST Layer Info server which we poll looking for updates
	    function updateTimeSlider(config) {
		// Images for Radar are layer 3 - this shouldn't be so hardwired
		const timeStopURL = `https://new.nowcoast.noaa.gov/layerinfo?request=timestops&service=${config.timeStopService}&layers=${config.timeStopLayer}&format=json`;
		fetch(timeStopURL)
		    .then(response => response.json())
		    .then(json => {
			if ((json.layers[0].timeStops[0] != config.firstTimeStop) ||
			    (json.layers[0].timeStops[json.layers[0].timeStops.length-1] != config.lastTimeStop)) {

			    // The "then" code executes asynchronously (after the time stops are received)
			    // So all TimeSlider time config is here
			    config.firstTimeStop = json.layers[0].timeStops[0];
			    config.lastTimeStop = json.layers[0].timeStops[json.layers[0].timeStops.length-1];

			    intervalStart = Date.now() - config.interval;
			    timeStops = json.layers[0].timeStops.filter(ts => ts > intervalStart).map(
				function(t) { d = new Date(); d.setTime(t); return(d); }
			    );

			    let start = timeStops[0];
			    let end = timeStops[timeStops.length -1 ];
			    config.timeSlider.set({
				fullTimeExtent: { start: start, end: end, },
				timeExtent: { start: end, end: end, },
				stops: { dates: timeStops, },
			    });
			    console.log("New NowCOAST(ArcGIS) extent " + formatDate(start, "time") + " - " + formatDate(end, "time"))
			}
		    });
	    }

	}
    });
