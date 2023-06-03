// Display a wind model in a container

let WindModels = {};
let windModelCountries = null;

function WindModel(container, r, kiosk) {

    let windModelState = {};
    const windColorMapMax = 30.0; // knots
    const windColorMapSteps = 512; // Smooth gradient
    const frameTime = 1000;
    const firstFrameTime = 3000;
    const modelCheckInterval = 60 * 1000;

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
	    s.currentFrame = (s.currentFrame + 1) % s.region.latest.forecasts;
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
	label += " +" + ((h < 10) ? "0" : "") + h + ((m < 10) ? "0" : "") + m;
	label += " valid " + frameState.valid.format("m/d ");
	label += '<span class="wmForecastHour">' + frameState.valid.format("HH:MM") + "</span> " + frameState.valid.format("Z");
	label += "<br>Barbs: 10m Wind, Color: Gusts";
	if (!kiosk) {
	    //label += `<br>${r.latest.forecasts} hours - 'b'ack, 'f'orward`;
	    label += "<br>'b'ack, 'f'orward, &lt;space&gt; fullscreen";
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
	const frameState = s.frameStates[fh];
	const elapsed =  now - task.startTime;
	const sinceStart = now - s.startTime;
	frameState.renderState = "renderComplete";
	//frameState.image = evt.data.image;
	frameState.imageData = evt.data.imageData;
	frameState.ref = new Date(evt.data.ref * 1000);
	frameState.valid = new Date(evt.data.valid * 1000);
	updateRenderState(s);
	
	console.log(`Render ${fh} completed in ${(elapsed/1000.0).toFixed(2)} sinceStart ${(sinceStart/1000.0).toFixed(2)} current frame: ${s.currentFrame}`);
	if (s.currentFrame == fh) {
	    updateFrame(s);
	}
    }

    function renderStart(s, fh) {
	const frameState = s.frameStates[fh];
	frameState.startTime = Date.now();
	
	const task = {};
	task.frameState = frameState;
	task.msg = {};
	task.msg.type = "raster-gust";
	task.msg.width = s.canvasWidth;
	task.msg.height = s.canvasHeight;
	task.msg.region = s.region;
	task.msg.forecastHour = fh;
	task.msg.map = windModelCountries;
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
	    s.frameStates = new Array(s.region.latest.forecastHours);
	    for (let f = 0; f < parseInt(s.region.latest.forecasts); f++) {
		s.frameStates[f] = {"renderState": "renderWaiting"};
	    }
	    updateRenderState(s);
	    for (let fh = 0; fh < s.region.latest.forecasts; fh++) {
		renderStart(s, fh);
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
	    .classed("wmCanvas", true)
	s.label = d3.select(s.id)
	    .append('div')
	    .attr('id', container + "-label")
	    .classed('wmLabel', true)
	s.renderStatus = d3.select(s.id)
	    .append('div')
	    .attr('id', container + "-renderStatus")
	    .classed('wmRenderStatus', true)
	    .html('Render Status')
	let sliderWrapper = d3.select(s.id)
	    .append('div')
	    .attr('id', container + "-sliderWrapper")
	    .classed('wmSliderWrapper', true)
	s.slider = sliderWrapper
	    .append("input")
	    .attr('id', container + '-slider')
	    .classed('wmSlider', true)
	    .attr('type', 'range')
	    .attr('min', 0)
	    .attr('max', 100)
	    .attr('value', 0)

	// "world-110m.json" is lower-res - faster, but not enough detail to recognize features
	// "countries-10m.json is high-res";
	//const worldMap = await fetchMap("data/lib/world-110m.json");
	if (windModelCountries == null) {
	    const worldMap = await fetchMap("lib/countries-10m.json");
	    windModelCountries = topojson.feature(worldMap, worldMap.objects.countries);
	}

	s.slider.node().value = 0;
	s.slider.node().oninput = function() {
	    s.currentFrame = Math.round((this.value * (s.region.latest.forecasts-1))/100.0);
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
	
	//const forwardKey = "ArrowLeft";
	//const backKey = "ArrowRight";

	const forwardKey = "f";
	const backKey = "b";
	const spaceKey = " ";
	
	let inkeypress = false;
	let isFullScreen = false;

	d3.select(s.id).attr("tabindex", 0);
	document.getElementById(container)
	    .addEventListener("keypress", async function onEvent(event) {
	    if (!inkeypress) {
		inkeypress = true;
		if (event.key === forwardKey) {
		    if (s.currentFrame < s.region.latest.forecasts - 1) {
			s.currentFrame++;
			await updateFrame(s);
		    }
		} else if (event.key === backKey) {
		    if (s.currentFrame > 0) {
			s.currentFrame--;
			await updateFrame(s);
		    }
		} else if (event.key === spaceKey) {
		    const elem = document.getElementById(s.container);
		    if (!document.fullscreenElement) {
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
		s.slider.node().value = (s.currentFrame * 100.0) / (s.region.latest.forecasts-1);
		inkeypress = false;
	    }
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
