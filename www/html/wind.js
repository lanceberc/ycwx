let windSocket = null;
let windSocketInitializing = false;
let windCallback = null;

function windError(e) {
    console.log("windMessage error");
}

function windClose(e) {
    console.log("windClose() websocket closed - sleeping for a minute");
    setTimeout(function() {
	console.log("windClose() trying to reopen websocket");
	windInitialize(null);
    }, 60 * 1000);
}

function windCheck() {
    if (windSocket.readyState != 1) {
	console.log("windCheck ready state: " + windSocket.readyState);
    }
}

function windOpen() {
    windSStartStopHistory();
}

function windMessage(json) {
    let wind;
    try {
	wind = JSON.parse(json.data);
    }
    catch (err) {
	console.log("windSocket json error " + err.message);
	return;
    }
    //console.log("windMessage() wind " + wind.avg + " gust " + wind.gust);
    windCallback(json.data);
}

function windInitialize(callback) {
    if (windURL == "") {
	/* XXX GROSS KLUDGE ALERT HACK - if the hostname starts with a digit assume it's on the local net
	 * and use a straight web socket (ws://) otherwise use a secure websocket (wss://)
	 */
	if ((location.hostname[0] >= "0") && (location.hostname[0] <= "9")) {
	    windURL = "ws://" + location.hostname + "/wind/";
	} else {
	    windURL = "wss://" + location.hostname + "/wind/";
	}
	console.log("Setting windURL to " + windURL);
    }
    if (windSocketInitializing == null) {
	windSocketInitializing = new Date().now;
    } else {
	let now = Date.now();
	if (now - windSocketInitializing < (60 * 1000)) {
	    console.log("windInitialize() in process");
	    return;
	}
	windSocketInitializing = new Date().now;
    }

    if (callback != null)
	windCallback = callback;
    
    console.log("windInitialize()");
    try {
	windSocket = new WebSocket(windURL);
    }
    catch(err) {
	console.log("windSocket open error " + err.message);
    }

    windSocket.addEventListener('error', windError);
    windSocket.addEventListener('close', windClose);
    windSocket.addEventListener('message', windMessage);
    windSocket.addEventListener('open', function(e) {
	console.log("windSocket() open");
	windSocket.send(JSON.stringify({"subscribe_wind": true}));
	windSocket.send(JSON.stringify({"subscribe_history": true}));
    });
}

let windRect = { width: 0, height: 0 };

function windPlotHistory(e, history) {
    let svg, x, y, start, end;
    let data;

    if (history == null) {
	console.log("windPlotHistory: null history");
	return;
    }

    start = new Date(history[0].ts * 1000);
    end = new Date(history[history.length-1].ts * 1000);

    d3.select("." + e).selectAll("*").remove();
    d3.select("." + e).remove();

    let pcr = d3.select("#" + e).node().parentNode.getBoundingClientRect();
    let cr = d3.select("#" + e).node().getBoundingClientRect();
    let labelcr = d3.select("#" + e + "-label").node().getBoundingClientRect();
    if ((cr.width == 0) && (cr.height == 0)) {
	return;
    }

    let width = windRect.width;
    let height = windRect.height;
    if (cr.width == currentRect.width) {
	console.log(`windPlotHistory width (${currentRect.width} x ${currentRect.height}) unchanged`);
    } else {
	width = cr.width;
	height = cr.height;
	height = pcr.height - labelcr.height;
	let aheight = width * (9.0 / 16.0); // 16:9 aspect ratio
	if ((aheight < height) || (pcr.height == labelcr.height)) {
	    height = aheight;
	}
	windRect.width = width;
	windRect.height = height;
    }
    console.log(`windPlotHistory ${cr.width} x ${cr.height} -> ${width} x ${height} parent ${pcr.width} x ${pcr.height} label ${labelcr.width} x ${labelcr.height}`);

    let margin = { left: vw(1.25), top: vh(0.5), right: vw(1), bottom: vh(3.00) };

    svg = d3.select("#" + e)
	.append("svg")
	.classed("wind-plot", true)
	.classed(e, true)
	.attr("viewBox",
	      -margin.left + " " +
	      -margin.top + " " +
	      (width + margin.left + margin.right) + " " +
	      (height + margin.top + margin.bottom))
	.attr("preserveAspectRatio", "none")
	.attr("width", width).attr("height", height)
	.append("g")
	.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    x = d3.scaleTime()
	.domain([start, end])
	.range([0, width]);

    y = d3.scaleLinear()
	.domain([0, 30])
	.range([height, 0]);

    // x-axis
    svg.append("g")
	.attr("transform", "translate(0," + height + ")")
	.classed("label", true)
	.call(d3.axisBottom(x));

    // y-axis
    svg.append("g")
	.classed("label", true)
	.call(d3.axisLeft(y)
	      .tickArguments([5]));

    // y-axis gridlines
    svg.append("g")			
	.attr("class", "grid")
	.call(d3.axisLeft(y)
	      .ticks([5])
	      .tickSize(-width)
	      .tickFormat("")
	     );
    
    // wind_avg
    svg.append("path")
	.datum(history)
	.classed("wind-plot-wind-avg", true)
	.attr("d", d3.area()
	      .x(function(d) { return x(d.ts * 1000) })
	      .y1(function(d) { return y(d.aws) })
	      .y0(function(d) { return y(0) })
	      .curve(d3.curveBasis)
	     );

    // wind_gust
    svg.append("path")
	.datum(history)
	.classed("wind-plot-wind-gust", true)
	.attr("d", d3.line()
	      .x(function(d) { return x(d.ts * 1000) })
	      .y(function(d) { return y(d.gust) })
	      .curve(d3.curveBasis)
	     );
}

function windStartStopHistory(e) {
    const cr = e.contentRect;
    if (windSocket == null) {
	return;
    }
    if (windSocket.readyState != 1) {
	console.log(`windStartStopHistory websocket not ready (${windSocket.readyState})`);
	return;
    }
    console.log(`wind element ${e.id} new size: ${cr.width} x ${cr.height}`);
    if ((cr.width == 0) || (cr.height == 0)) {
	windSocket.send(JSON.stringify({"subscribe_history": false}));
	console.log("windStartStopHistory: stop");
    } else {
	windSocket.send(JSON.stringify({"subscribe_history": true}));
	console.log("windStartStopHistory: start");
    }
}
