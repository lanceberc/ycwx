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
    } else {
	console.log("Passed windURL " + windURL);
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
	windSocket.send(JSON.stringify({"subscribe_airmar_wind": true}));
	windSocket.send(JSON.stringify({"subscribe_airmar_history": true}));

	console.log("windInitialize localTempest " + typeof localTempest);

	if (typeof localTempest !== 'undefined') {
	    windSocket.send(JSON.stringify({"subscribe_tempest_wind": true}));
	    windSocket.send(JSON.stringify({"subscribe_tempest_history": true}));
	    console.log("windInitialize localTempest start");
	}
    });
}

let windHistoryRect = { width: 0, height: 0 };

function windPlotHistory(e, history, maxRange) {
    let svg, x, y, start, end;
    let data, id;

    if (history == null) {
	console.log("windPlotHistory: null history");
	return;
    }

    start = new Date(history[0].sec * 1000);
    end = new Date(history[history.length-1].sec * 1000);

    id = "#" + e;

    d3.select(id).selectAll("*").remove();
    //d3.select("." + e).remove();

    let node = d3.select(id).node();
    let parentNode = node.parentNode;
    let parent2Node = parentNode.parentNode;
    let cr = node.getBoundingClientRect();
    let pcr = parentNode.getBoundingClientRect();
    let p2cr = parent2Node.getBoundingClientRect();
    let labelcr = d3.select(id + "-label").node().getBoundingClientRect();
    if ((cr.width == 0) && (cr.height == 0)) {
	return;
    }

    console.log(`windPlotHistory ${id} node ${node.clientWidth} x ${node.clientHeight}`);
    console.log(`windPlotHistory ${id} pcr ${pcr.width} x ${pcr.height}`);

    //let newWidth = pcr.width;
    //let newHeight = pcr.height;
    let newWidth, newHeight;
    newWidth = (cr.width != 0) ? cr.width : pcr.right - pcr.left;
    newHeight = (cr.height != 0) ? cr.height : (pcr.bottom - pcr.top) - (labelcr.bottom - labelcr.top);

    let width = windHistoryRect.width;
    let height = windHistoryRect.height;
    if ((newWidth == width) && (newHeight == height)) {
	console.log(`windPlotHistory width (${windHistoryRect.width} x ${windHistoryRect.height}) unchanged`);
    } else {
	width = newWidth;
	height = newHeight;
	windHistoryRect.width = width;
	windHistoryRect.height = height;
    }
    console.log(`windPlotHistory ${id} ${cr.width} x ${cr.height} -> ${width} x ${height} parent ${pcr.width} x ${pcr.height} label ${labelcr.width} x ${labelcr.height}`);

    let margin;
    if (p2cr.height < p2cr.width) { // Portrait vs Landscape margins
	margin = { left: vw(1.25), top: vh(0.5), right: vw(0.0), bottom: vh(3.50) };
    } else {
	margin = { left: vw(3.00), top: vh(0.5), right: vw(0.0), bottom: vh(3.50) };
    }

    svg = d3.select(id)
	.append("svg")
	.classed("wind-plot", true)
	.classed(e, true)
	.attr("viewBox", -margin.left + " " + -margin.top + " " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
	.attr("preserveAspectRatio", "none")
	.attr("width", width - (margin.left + margin.right)).attr("height", height - (margin.top + margin.bottom))
	.append("g")
	.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    x = d3.scaleTime()
	.domain([start, end])
	.range([0, width]);

    y = d3.scaleLinear()
	.domain([0, maxRange])
	.range([height, 0]);

    // x-axis
    svg.append("g")
	.attr("transform", "translate(0," + height + ")")
	.classed("wind-axis-label", true)
	.call(d3.axisBottom(x));

    // y-axis
    svg.append("g")
	.classed("wind-axis-label", true)
	.classed("high-wind-label", (maxRange > 30) ? true : false)
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
	      .x(function(d) { return x(d.sec * 1000) })
	      .y1(function(d) { return y(d.speed) })
	      .y0(function(d) { return y(0) })
	      .curve(d3.curveBasis)
	     );

    // wind_gust
    svg.append("path")
	.datum(history)
	.classed("wind-plot-wind-gust", true)
	.attr("d", d3.line()
	      .x(function(d) { return x(d.sec * 1000) })
	      .y(function(d) { return y(d.gust) })
	      .curve(d3.curveBasis)
	     );
}

function windStartStopHistory(e) {
    const cr = e.target.getBoundingClientRect();;
    if (windSocket == null) {
	return;
    }
    if (windSocket.readyState != 1) {
	console.log(`windStartStopHistory websocket not ready (${windSocket.readyState})`);
	return;
    }
    console.log(`windStartStopHistory target.id ${e.target.id} new size: ${cr.width} x ${cr.height}`);
    if ((cr.width == 0) || (cr.height == 0)) {
	windSocket.send(JSON.stringify({"subscribe_airmar_history": false}));
	console.log("windStartStopHistory: airmar stop");
    } else {
	windSocket.send(JSON.stringify({"subscribe_airmar_history": true}));
	console.log("windStartStopHistory: airmar start");
    }

    //console.log("windStartStopHistory localTempest " + typeof localTempest);

    if (typeof localTempest !== 'undefined') {
	if ((cr.width == 0) || (cr.height == 0)) {
	    windSocket.send(JSON.stringify({"subscribe_tempest_wind": false}));
	    windSocket.send(JSON.stringify({"subscribe_tempest_history": false}));
	    console.log("windStartStopHistory: tempest stop");
	} else {
	    windSocket.send(JSON.stringify({"subscribe_tempest_wind": true}));
	    windSocket.send(JSON.stringify({"subscribe_tempest_history": true}));
	    console.log("windStartStopHistory: tempest start");
	}
    }
}
