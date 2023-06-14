// Display a wind model in a container

let WindModels = {};
function WindModel(container, r, kiosk) {

    let windModelMap = null;
    let windModelState = {};
    const windColorMapMax = 30.0; // knots
    const windColorMapSteps = 512; // Smooth gradient
    const frameTime = 1000;
    const firstFrameTime = 3000;
    const modelCheckInterval = 60 * 1000;

    const fullscreenPath = 'M5,40L5,5L40,5M60,5L95,5L95,40M95,60L95,95L60,95M40,95L5,95L5,60';
    const unfullscreenPath = 'M5,40L40,40L40,5M60,5L60,40L95,40M95,60L60,60L60,95M40,95L40,60L5,60';

    function generateWindLookupTable(steps, max) {
	const windColorMap = d3.interpolateHslLong("#613CFF", "#FB4B39");

	function windColor(spd) {
	    return windColorMap(spd/windColorMapMax);
	}

	const lookup = new Uint8ClampedArray(steps*3);
	for (let step = 0; step < steps; step++) {
	    const pct =  (max * step) / steps;
	    const c = d3.color(windColor(pct));
	    //lookup[step] = [c.r, c.g, c.b];
	    lookup[(step*3) + 0] = c.r;
	    lookup[(step*3) + 1] = c.g;
	    lookup[(step*3) + 2] = c.b;
	}
	return lookup;
    }

    async function fetchLatest(region) {
	url = region.url + "/latest.json";
	const response = await fetch(url);
	const j = await response.json();
	if ((!("latest" in region)) ||
	    (j.mdate != region.latest.mdate) ||
	    (j.modelRun != region.latest.modelRun)) {
	    return j;
	}
	return null;
    }
    
    async function fetchMap(url) {
	let response = await fetch(url);
	let topojsonData = await response.json();
	return(topojsonData);
    }
	
    function serviceTimer(r) {
	const s = WindModels[r];
	if (d3.select(s.id).node().offsetParent == null) {
	    console.log(`wm ${s.id} is hidden`);
	} else if (document.visibilityState != "visible") {
	    console.log(`document is not visible`);
	} else {
	    s.currentFrame = (s.currentFrame + 1) % s.region.latest.forecasts.length;
	    updateFrame(s);
	}
	const timeout = (s.currentFrame == 0) ? firstFrameTime : frameTime;
	setTimeout(serviceTimer, timeout, r);
    }

    function labelForecast(el, r, frameState) {
	const diff = frameState.valid - frameState.ref;
	const h = Math.floor(diff / (60 * 60 * 1000));
	const m = Math.floor(diff / (60 * 1000)) % 60;
	let label = r.model + " ";
	label += frameState.ref.format("UTC:m/d HHMM") + "Z";
	label += " +" + ((h < 10) ? "0" : "") + h + ":" + ((m < 10) ? "0" : "") + m;
	label += " valid " + frameState.valid.format("m/d ");
	label += '<span class="wmForecastHour">' + frameState.valid.format("HH:MM") + "</span> " + frameState.valid.format("Z");
	label += "<br>Barbs: 10m Wind, Color: Gusts";
	if (!kiosk) {
	    label += "<br>&larr; Back, &rarr; Forward, &lt;space&gt; fullscreen";
	}
	el.html(label);
    }

    async function updateFrame(s) {
	frameState = s.frameStates[s.currentFrame];
	if (('image' in frameState) || ('imageData' in frameState)) {
	    //console.log(`Display frame ${s.currentFrame}`);
	    let context = s.canvas.node().getContext("2d");
	    if (context == null) {
		console.log(`windmodel ${s.r} no 2d context`);
		d3.select(s.id + "-canvas").remove();
		let canvas = d3.select(s.id)
		    .insert("canvas")
		    .attr("id", s.r + "-canvas")
		    .attr("width", s.canvasWidth)
		    .attr("height", s.canvasHeight)
		    .classed("wmCanvas", true);
		s.context = canvas.node().getContext("2d");
		context = s.context;
	    }
	    context.putImageData(frameState.imageData, 0, 0);
	    labelForecast(s.label, s.region, frameState);
	    updateTooltip(s);
	} else {
	    console.log(`Frame ${s.r} frame ${s.currentFrame} not yet rendered`);
	}
    }

    function updateRenderState(s) {
	let renderLabel =
	    'Status:' +
	    '<span class="wmComplete"> Complete<span>' +
	    '<span class="wmRendering"> Rendering<span>' +
	    '<span class="wmWaiting"> Waiting<span>';
	let rClass = "";
	let completeCount = 0;
	for (let f = 0; f < s.frameStates.length; f++) {
	    const rs = s.frameStates[f].renderState;
	    if (rs == "renderWaiting") {
		rClass = "wmWaiting";
	    } else if (rs == "renderRendering") {
		rClass = "wmRendering";
	    } else if (rs == "renderComplete") {
		rClass = "wmComplete";
		completeCount++;
	    } else {
		console.log(`Unknown state ${f} renderState ${rs}`);
	    }
	    if (!(f % 10)) {
		renderLabel += "<br>";
	    }
	    const pad = (f<10) ? "&nbsp;" : "";
	    renderLabel += `<span class="${rClass}"> ${pad}${f}</span>`;
	}
	if (completeCount == s.frameStates.length) {
	    renderLabel = "";
	    //renderLabel = "Render Complete";
	}
	s.renderStatus.html(renderLabel);
    }

    function taskStart(s) {
	if (s.workerFree == 0 || s.taskList.length == 0) {
	    return;
	}
	for (let w = 0; w < s.workerPool; w++) {
	    if (s.workers[w].task == null) {
		task = s.taskList.shift();
		task.startTime = Date.now();
		s.workers[w].task = task;
		s.workerFree--;
		task.frameState.renderState = "renderRendering";
		s.workers[w].worker.postMessage(task.msg);
		//console.log(`${s.r} worker ${w} started`);
		updateRenderState(s);
		return;
	    }
	}
	console.log("taskStart couldn't find free worker");
    }
	
    function taskAdd(s, task) {
	s.taskList.push(task);
	taskStart(s);
    }
	
    function taskComplete(s, w, evt) {
	task = s.workers[w].task;
	task.finish(s, evt, task);
	s.workers[w].task = null;
	s.workerFree++;
	//console.log(`Worker ${w} completed`);
	taskStart(s);
    }

    function renderComplete(s, evt, task) {
	now = Date.now();
	const fh = evt.data.forecastHour;
	const forecast = evt.data.forecast;
	const frameState = s.frameStates[forecast];
	const elapsed =  now - task.startTime;
	const sinceStart = now - s.startTime;
	frameState.renderState = "renderComplete";
	//frameState.image = evt.data.image;
	frameState.imageData = evt.data.imageData;
	frameState.ref = new Date(evt.data.ref * 1000);
	frameState.valid = new Date(evt.data.valid * 1000);
	frameState.windData = evt.data.windData;
	if (s.region.xy == undefined && evt.data.xy != undefined) {
	    s.region.xy = evt.data.xy;
	}
	if (s.region.ij == undefined && evt.data.ij != undefined) {
	    s.region.ij = evt.data.ij;
	}
	updateRenderState(s);
	
	console.log(`Render ${forecast} hour ${fh} completed in ${(elapsed/1000.0).toFixed(2)} sinceStart ${(sinceStart/1000.0).toFixed(2)} current frame: ${s.currentFrame}`);
	if (s.currentFrame == forecast) {
	    updateFrame(s);
	}
    }

    function renderStart(s, forecast) {
	const frameState = s.frameStates[forecast];
	frameState.startTime = Date.now();
	
	const task = {};
	task.frameState = frameState;
	task.msg = {};
	task.msg.type = "raster-gust";
	task.msg.width = s.canvasWidth;
	task.msg.height = s.canvasHeight;
	task.msg.region = s.region;
	task.msg.forecast = forecast;
	task.msg.forecastHour = s.region.latest.forecasts[forecast];
	task.msg.map = windModelMap;
	task.msg.windColorMap = {
	    'steps': windColorMapSteps,
	    'max': windColorMapMax,
	    'map': s.windColorLookup
	};
	task.finish = renderComplete;
	taskAdd(s, task);
	updateRenderState(s);
    }

    async function checkForNewModel(s) {
	let model = await fetchLatest(s.region);
	if (model != null) {
	    console.log(`New model fetched for ${s.r}`);
	    s.region.latest = model;
	    s.frameStates = new Array(s.region.latest.forecasts.length);
	    for (let f = 0; f < s.region.latest.forecasts.length; f++) {
		s.frameStates[f] = {"renderState": "renderWaiting"};
	    }
	    updateRenderState(s);
	    for (let f = 0; f < s.region.latest.forecasts.length; f++) {
		renderStart(s, f);
	    }
	}
    }

    const forwardKey = "ArrowRight";
    const backKey = "ArrowLeft";
    
    //const forwardKey = "f";
    //const backKey = "b";
    const spaceKey = " ";
    
    let inkeypress = false;
    let isFullScreen = false;

    function toggleFullscreen(s, evt) {
	if (!document.fullscreenElement) {
	    const elem = document.getElementById(s.container);
	    try {
		elem.requestFullscreen();
		isFullScreen = true;
	    } catch (e) {
		console.log("Full screen denied: " + e);
	    }
	} else {
	    document.exitFullscreen();
	    isFullScreen = false;
	}
    }
    
    async function keyEvent(s, event) {
	if (!inkeypress) {
	    inkeypress = true;
	    if (event.key === forwardKey) {
		if (s.currentFrame < s.region.latest.forecasts.length - 1) {
		    s.currentFrame++;
		    await updateFrame(s);
		}
	    } else if (event.key === backKey) {
		if (s.currentFrame > 0) {
		    s.currentFrame--;
		    await updateFrame(s);
		}
	    } else if (event.key === spaceKey) {
		toggleFullscreen(s, event)
	    }
	    s.slider.node().value = (s.currentFrame * 100.0) / (s.region.latest.forecasts.length-1);
	    inkeypress = false;
	}
    }

    function updateTooltip(s) {
	if (s.tooltipPos == null) {
	    return;
	}
	const cf = s.currentFrame;
	const frameState = s.frameStates[cf];
	if (frameState.renderState != "renderComplete") {
	    return;
	}
	const canvas = s.canvas.node();
	const cr = canvas.getBoundingClientRect();
	const ww = cr.width;
	const wh = cr.height;
	const cw = canvas.width;
	const ch = canvas.height;
	    
	let lX;
	let lY;
	[lX, lY] = s.tooltipPos;
	
	const x = Math.round(lX * cw / ww);
	const y = Math.round(lY * ch / wh);

	if (Number.isNaN(x) || Number.isNaN(y)) {
	    s.tooltip.classed("wmShow", false);
	} else {	
	    const wind = Math.round(frameState.windData.wind[y*cw + x]);
	    const gust = Math.round(frameState.windData.gust[y*cw + x]);
	    let dir = frameState.windData.dir[y*cw + x];
	
	    if (dir < 361) {
		let declinationUnit;
		if ('declination' in s.region) {
		    dir -= s.region.declination;
		    dir = (dir < 0) ? dir + 360 : dir;
		    dir = (dir > 360) ? dir - 360 : dir;
		    dir = (dir > 359.5) ? 0 : dir; // Special case to avoid "360"
		    declinationUnit = 'M';
		} else {
		    declinationUnit = 'T';
		}
		const windPad = (wind < 10) ? "&nbsp;" : "";
		const gustPad = (gust < 10) ? "&nbsp;" : "";
		const dirPad = ((dir < 100) ? "&nbsp;" : "") + ((dir < 10) ? "&nbsp;" : "");
		s.tooltip.html(`${dirPad}${Math.round(dir)}&deg;${declinationUnit}&nbsp;@&nbsp;${windPad}${wind}&nbsp;G&nbsp;${gustPad}${gust}&nbsp;kts`);
		
		const px = lX;
		const py = lY;
		s.tooltip.node().style.left = (px + 20) + 'px';
		s.tooltip.node().style.top = (py + 20) + 'px';
		s.tooltip.classed("wmShow", true);
	    } else {
		s.tooltip.classed("wmShow", false);
	    }
	}
    }
    
    async function init(container, r, kiosk) {
	WindModels[r] = new Object();
	const s = WindModels[r];
	s.container = container;
	s.id = "#" + container;
	s.r = r;
	s.region = wmRegions[r];
	s.region.xy = undefined;
	s.region.ij = undefined;
	s.config = {
	    canvasWidth: 1920,
	    canvasHeight: 1080,
	    workerPool: 3,
	}
	
	s.workerPool = s.config.workerPool;
	s.workers = new Array(s.workerPool);
	s.workerFree = s.workerPool;
	s.taskList = [];
	s.startTime = Date.now();
	s.currentFrame = -1;
	s.canvasWidth = s.config.canvasWidth;
	s.canvasHeight = s.config.canvasHeight;

	d3.select(s.id).selectAll("*").remove();
	s.canvas = d3.select(s.id)
	    .append("canvas")
	    .attr("id", container + "-canvas")
	    .attr("width", s.canvasWidth)
	    .attr("height", s.canvasHeight)
	    .classed("wmCanvas", true);
	s.label = d3.select(s.id)
	    .append('div')
	    .attr('id', container + "-label")
	    .classed('wmLabel', true);
	s.renderStatus = d3.select(s.id)
	    .append('div')
	    .attr('id', container + "-renderStatus")
	    .classed('wmRenderStatus', true)
	    .html('Render Status')
	if (!kiosk) {
	    s.fullscreen = d3.select(s.id)
		.append('svg')
		.attr('xmlns', 'http://www.w3.org/2000/svg')
		.attr('id', container + '-fullscreen')
		//.attr('width', '4em')
		//.attr('height', '4em')
		.classed('wmFullscreen', true)
		.classed('wmShow', true)
		.attr("viewBox", "0 0 100 100")
	    s.fullscreen
		.append('path')
		.attr('id', container + "-fullscreenPath")
		.attr("d", fullscreenPath)
	}
	let sliderWrapper = d3.select(s.id)
	    .append('div')
	    .attr('id', container + "-sliderWrapper")
	    .classed('wmSliderWrapper', true);
	s.slider = sliderWrapper
	    .append("input")
	    .attr('id', container + '-slider')
	    .classed('wmSlider', true)
	    .attr('type', 'range')
	    .attr('min', 0)
	    .attr('max', 100)
	    .attr('value', 0)
	    .attr("tabindex", "0");
	s.tooltip = d3.select(s.id)
	    .append('div')
	    .attr('id', container + '-tooltip')
	    .classed('wmTooltip', true);

	// "world-110m.json" is lower-res - faster, but not enough detail to recognize features
	// "countries-10m.json is high-res";
	//const worldMap = await fetchMap("data/lib/world-110m.json");
	if (windModelMap == null) {
	    let mapURL;
	    let mapFeature;
	    if ('maps' in s.region) {
		mapURL = s.region.maps[0].url;
		mapFeature = s.region.maps[0].feature;
	    } else {
		mapURL = "lib/countries-10m.json";
		mapFeature = 'countries';
	    }
	    const map = await fetchMap(mapURL);
	    features = topojson.feature(map, map.objects[mapFeature]);
	    //merged = topojson.merge(features, features.objects["COUNTYFP"]);
	    windModelMap = features;
	}

	s.slider.node().value = 0;
	s.slider.node().oninput = function() {
	    s.currentFrame = Math.round((this.value * (s.region.latest.forecasts.length-1))/100.0);
	    updateFrame(s);
	}
	if (!kiosk) {
	    sliderWrapper.classed("wmSlider-show", true);
	}

	// Start loading the worker code as early as possible - it can be large
	for (let w = 0; w < s.workerPool; w++) {
	    s.workers[w] = {};
	    s.workers[w].task = null;
	    s.workers[w].worker = new Worker("wmWorker.js");
	    s.workers[w].worker.addEventListener('message', evt => {
		taskComplete(s, w, evt);
	    });
	}

	s.windColorLookup = generateWindLookupTable(windColorMapSteps, windColorMapMax);
	
	d3.select(s.id).attr("tabindex", 0);
	let el = document.getElementById(container);
	el.addEventListener("mouseover", function() { el.focus(); });
	//el.addEventListener("keypress", keyEvent(event));
	el.addEventListener("keydown", evt => { keyEvent(s, evt) });

	s.fullscreen.node().addEventListener('click', (evt) => {
	    console.log("Toggle full screen click");
	    toggleFullscreen(s, evt);
	});
	
	s.canvas.node().addEventListener("mousemove", (evt) => {
	    s.tooltipPos = [evt.layerX, evt.layerY];
	    updateTooltip(s);
	});
	s.canvas.node().addEventListener("focusout", (evt) => {
	    s.tooltip.classed("wmShow", false);
	    s.tooltip.html("");
	    s.tooltipPos = null;
	});
	s.canvas.node().addEventListener("mouseleave", (evt) => {
	    s.tooltip.classed("wmShow", false);
	    s.tooltip.html("");
	    s.tooltipPos = null;
	});
	document.getElementById(s.container).addEventListener("fullscreenchange", (evt) => {
	    const path = (document.fullscreenElement) ? unfullscreenPath : fullscreenPath;
	    d3.select("#" + s.container + '-fullscreenPath')
		.attr("d", path);
	});

	await checkForNewModel(s);	
	setInterval(checkForNewModel, modelCheckInterval, s);

	if (kiosk) {
	    setTimeout(serviceTimer, firstFrameTime, r);
	} else {
	    s.currentFrame = 0;
	    updateFrame(s);
	}
    }

    init(container, r, kiosk);
}
