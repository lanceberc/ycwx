
const recent_history_hours = 6;

// Conversion routines for Tempest defaults - only the forecast API converts units, the others return defaults
function c2f(d) { return ((parseFloat(d) * (9.0/5.0)) + 32.0); } // celcius to farenheit
function mb2mb(d) { return(parseFloat(d)); } // millibars
function m2kts(d) { return(parseFloat(d) * 1.94384); } // meters/second to knots
function t2m(d) { return(parseFloat(d) + magnetic_declination); } // true to magnetic

// Convenience functions for scaling elements to the window size
function vh(v) {
    const h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    return (v * h) / 100;
}

function vw(v) {
    const w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    return (v * w) / 100;
}

function vmin(v) { return Math.min(vh(v), vw(v)); }
function vmax(v) { return Math.max(vh(v), vw(v)); }

const tempestFieldMap = {
    //Don't use the Tempest for anything except Tinsley temperature now that the Airmar works and seems to be more accurate
    "temperature": { "field": "air_temperature", "convert": c2f, "precision": 1 },
    //"pressure": {"field": "sea_level_pressure", "convert": mb2mb, "precision": 0 },
    //"wind": { "field": "wind_avg", "convert": m2kts, "precision": 1 },
    //"gust": { "field": "wind_gust", "convert": m2kts, "precision": 0 },
    //"direction": {"field": "wind_direction", "convert": t2m, "precision": 0 },
};

const tempestStations = {
    "St. Francis Yacht Club": {
	"nickname": "stfyc",
	"station_id": "74155",
	"device_id": "198898",
	"lat": "37.80737",
	"lon": "-122.44625",
	"observations" : {},
	"json": "",
	"forecast": "",
	"lastTime": 0,
    },
    "Tinsley Island": {
	"nickname": "tinsley",
	"station_id": "42921",
	"device_id": "131674",
	"lat": "38.03598",
	"lon": "-121.49423",
	"observations" : {},
	"json": "",
	"lastTime": 0,
    },
}

const tempestDeviceMap = {
    "198898": "St. Francis Yacht Club",
    "131674": "Tinsley Island",
}

const tempestStationMap = {
    "74155": "St. Francis Yacht Club",
    "42921": "Tinsley Island",
}

const tempestHistoryURL=`https://swd.weatherflow.com/swd/rest/observations?api_key=&device_id=&bucket=b&time_start=&time_end=&_=`;

export function fetchTempestHistory(station) {
    const ts_now = Math.floor(Date.now()/1000)
    let url = tempestHistoryURL.replace("&device_id=", "&device_id=" + tempestStations[station].device_id);
    url = url.replace("api_key=", "api_key=" + weatherFlow_apikey);
    url = url.replace("&time_start=", "&time_start=" + (ts_now - 6*60*60));
    url = url.replace("&time_end=", "&time_end=" + ts_now);
    url = url.replace("&_=", "&_=" + ts_now);
    console.log("Fetching history URL: " + url);
    d3.json(url)
	.then(
	    function(json) {
		tempestStations[station].history_json = json;
		tempestStations[station].observations = json.obs;
		//plotTempestWindHistory(station);
	    },
	    function(error) {
		console.log("Couldn't fetch Tempest data from url: " + url);
	    }
	);
}

const tempestForecastURL="https://swd.weatherflow.com/swd/rest/better_forecast?api_key=&build=44&station_id=&lat=38.03598&lon=-121.49423&units_temp=f&units_wind=kts&units_pressure=mb&units_distance=mi&units_precip=in&units_other=imperial&units_direction=mph&_=";

export function fetchTempestForecast(station) {
    const nonce = Date.now()
    let url = tempestForecastURL.replace("station_id=", "station_id=" + tempestStations[station].station_id)
    url = url.replace("api_key=", "api_key=" + weatherFlow_apikey);
    url = url.replace("&_=", "&_=" + nonce)
    d3.json(url)
	.then(
	    function(json) {
		tempestStations[station].forecast_json = json;
		tempestStations[station].forecast = json.current_conditions;
		if ("forecast" in tempestStations[json.location_name]) {
		    plotTempestWindForecast(json.location_name);
		}
	    },
	    function(error) {
		console.log("Couldn't fetch Tempest data from url: " + url);
	    }
	);
}

const tempestCurrentURL="https://swd.weatherflow.com/swd/rest/observations/location?api_key=&build=44&location_id=&_=";

export function fetchTempestCurrent(station) {
    const nonce = Date.now()
    let url = tempestCurrentURL.replace("location_id=", "location_id=" + tempestStations[station].station_id)
    url = url.replace("api_key=", "api_key=" + weatherFlow_apikey);
    url = url.replace("&_=", "&_=" + nonce)
    console.log("fetchTempestCurrent " + station);
    d3.json(url)
	.then(
	    function(json) {
		console.log("fetchTempestCurrent " + station + " response");
		if (json.obs.length > 0) {
		    const obs = json.obs[0];
		    let ts = new Date(obs.timestamp * 1000)
		    console.log("Tempest " + station + " observation message dated " + ts);
		    tempestStations[station].current = obs;
		    tempestStations[station].lastTime = obs.timestamp;
		    for (const [field, f] of Object.entries(tempestFieldMap)) {
			if (f.field in obs) {
			    let val = f.convert(obs[f.field]).toFixed(f.precision);
			    console.log("fetchTempestCurrent setting " + "." + field + "-span-" + tempestStations[station].nickname + " to " + val);
			    d3.selectAll("." + field + "-span-" + tempestStations[station].nickname).html(val);
			    // Kludge - update the anemometer gust value
			    /* Wind now cumes from Race Deck anemometer
			       if (tempestStations[station].nickname == "stfyc" && field == "gust") {
			       console.log("fetchTempestCurrent " + station + " update gust " + val);
			       anemometer.update(0, val);
			       }
			    */
			}
		    }
		}
	    })
	.catch(error => {
	    console.log("Couldn't fetch Tempest data from url: " + url);
	});
}

function plotTempestWindHistory(station) {
    let svg, x, y, start, end;
    let data;

    if ((!("history_json" in tempestStations[station])) || (!("obs" in tempestStations[station].history_json))) {
	return;
    }
    const obs = tempestStations[station].history_json["obs"];
    if (obs == null) {
	console.log("plotTempestWindHistory(): no observations for " + station);
	return;
    }

    data = [];
    start = obs[0][0];
    end = obs[obs.length-1][0];
    extent = end - start;
    max_extent = (recent_history_hours * 60 * 60)
    if (extent > max_extent) {
	start = end - max_extent;
    }

    obs.forEach(function(e, i) {
	if ((e[0] >= start) && (e[0] <= end)) {
	    data.push([new Date(e[0] * 1000), e[2], e[3]]);
	}
    });

    start = new Date(start * 1000);
    end = new Date(end * 1000);

    d3.select(".wind-history-recent").selectAll("*").remove();
    d3.select(".wind-history-recent").remove();

    // The closer width & height are to the actual size, the better off we are
    cr = d3.select("#wind-history-recent").node().getBoundingClientRect();
    let width = 640;
    let height = 360;
    if ((cr.width > 0) && (cr.height > 0)) { // Values can be zero because it's a flex and nothing may have been rendered in row
	width = cr.width;
	height = cr.height - 20; // Kludge - space for title
    }
    let margin = { left: vw(1.25), top: vh(0.5), right: vw(1), bottom: vh(3.00) };

    svg = d3.select("#wind-history-recent")
	.append("svg")
	.classed("wind-plot", true)
	.classed("wind-history-recent", true)
	.attr("viewBox",
	      -margin.left + " " +
	      -margin.top + " " +
	      (width + margin.left + margin.right) + " " +
	      (height + margin.top + margin.bottom))
	.attr("preserveAspectRatio", "none")
    //.attr("width", width).attr("height", height)
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
	.datum(data)
	.classed("wind-plot-wind-avg", true)
	.attr("d", d3.area()
	      .x(function(d) { return x(d[0]) })
	      .y1(function(d) { return y(d[1]) })
	      .y0(function(d) { return y(0) })
	      .curve(d3.curveBasis)
	     );

    // wind_gust
    svg.append("path")
	.datum(data)
	.classed("wind-plot-wind-gust", true)
	.attr("d", d3.line()
	      .x(function(d) { return x(d[0]) })
	      .y(function(d) { return y(d[2]) })
	      .curve(d3.curveBasis)
	     );
}

let wind24Rect = { "width": 0, "height": 0 };
let wind120Rect = { "width": 0, "height": 0 };
let windsNeedRender = false;

export function plotTempestWindForecast(station) {
    let svg, x, y, start, end;
    let X, Y1, Y2;
    const now = Date.now()

    if (!("forecast_json" in tempestStations[station])) {
	windsNeedRender = false;
	return;
    }

    let data = [];
    const forecast = tempestStations[station].forecast_json["forecast"]["hourly"];
    forecast.map((d, i) => {
	const ts = d.time * 1000;
	if (ts >= now) {
	    data.push([new Date(ts), d.wind_avg, d.wind_gust]);
	}
    });
    
    let element = "wind-forecast120"
    let id = "#" + element;
    d3.select(id).selectAll("*").remove();

    const node = d3.select(id).node();
    const parentNode = node.parentNode;
    const parent2Node = parentNode.parentNode;
    const cr = node.getBoundingClientRect();
    const pcr = parentNode.getBoundingClientRect();
    const p2cr = parent2Node.getBoundingClientRect();
    const labelcr = d3.select("#" + element + "-label").node().getBoundingClientRect();
    if ((cr.width == 0) && (cr.height == 0)) {
	return;
    }

    let newWidth, newHeight;
    newWidth = (cr.width != 0) ? cr.width : pcr.right - pcr.left;
    newHeight = (cr.height != 0) ? cr.height : (pcr.bottom - pcr.top) - (labelcr.bottom - labelcr.top);
    
    let width = wind120Rect.width;
    let height = wind120Rect.height;
    if ((newWidth == width) && (newHeight == height)) {
	console.log(`plotTempestForecast wind120 width (${width} x ${height}) unchanged`);
    } else {
	width = newWidth;
	height = newHeight;
	wind120Rect.width = width;
	wind120Rect.height = height;
    }
    console.log(`plotTempestForecast wind120 ${cr.width} x ${cr.height} -> ${width} x ${height} parent ${pcr.width} x ${pcr.height} label ${labelcr.width} x ${labelcr.height}`);

    let margin;
    if (p2cr.height < p2cr.width) {
	margin = { left: vw(1.25), top: vh(0.5), right: vw(0.0), bottom: vh(3.50) };
    } else {
	margin = { left: vw(3.00), top: vh(0.5), right: vw(0.0), bottom: vh(3.50) };
    }

    svg = d3.select("#wind-forecast120")
	.append("svg")
	.classed("wind-plot", true)
	.classed("wind-forecast120", true)
	.attr("viewBox", -margin.left + " " + -margin.top + " " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
	.attr("preserveAspectRatio", "none")
	.attr("width", width - (margin.left + margin.right)).attr("height", height - (margin.top + margin.bottom))
	.append("g")
	.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    start = new Date(now);
    end = new Date(now + (120 * 60 * 60 * 1000));
    
    x = d3.scaleTime()
	.domain([start, end])
	.range([0, width]);
    
    y = d3.scaleLinear()
	.domain([0, 30])
	.range([height, 0]);

    // x-axis
    svg.append("g")
	.attr("transform", "translate(0," + height + ")")
	.classed("wind-axis-label", true)
	.call(d3.axisBottom(x));

    // y-axis
    svg.append("g")
	.classed("wind-axis-label", true)
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
	.datum(data)
	.classed("wind-plot-wind-avg", true)
	.attr("d", d3.area()
	      .x(function(d) { return x(d[0]) })
	      .y1(function(d) { return y(d[1]) })
	      .y0(function(d) { return y(0) })
	      .curve(d3.curveBasis)
	     );

    // wind_gust
    svg.append("path")
	.datum(data)
	.classed("wind-plot-wind-gust", true)
	.attr("d", d3.area()
	      .x(function(d) { return x(d[0]) })
	      .y1(function(d) { return y(d[2]) })
	      .y0(function(d) { return y(0) })
	      .curve(d3.curveBasis)
	     );
};

let tempestSocket = null;
let tempestSocketInitializing = false;

function tempestError(e) {
    console.log("tempestMessage error ");
}

function tempestClose(e) {
    console.log("tempestClose() websocket closed - sleeping");
    setTimeout(function() {
	console.log("tempestClose() trying to reopen websocket");
	initializeTempestStreams();
    }, 60 * 1000); // try again in a minute
}

export function tempestCheck() {
    if (tempestSocket.readyState != 1) {
	console.log("tempestCheck() ready state: " + tempestSocket.readyState);
    }

    if (tempestSocket.readyState == 3) {
	initializeTempestStreams();
    }
}

// https://weatherflow.github.io/Tempest/api/ws.html
const obs_stMap = {
    //"wind": 2,
    //"gust": 3,
    "direction": 4,
    "temp": 7,
}

// Tempest stations are a bit flakey - if the Tempest is down, use NOAA data
const tempestValidTimespan = 60 * 60; /* secs a tempest observation is valid - after that use NOAA */
const backupFields = [
    { "stid": "FTPC1", "tempest": "St. Francis Yacht Club", "tempestField": "temp", "localField": "temp", "precision": 1 },
    // Fort Point and Pier 1 don't have baromoters - there's probably a better choice than the buoy
    { "stid": "46026", "tempest": "St. Francis Yacht Club", "tempestField": "tempest-baro", "localField": "pressure", "precision": 0 },
];

function tempestMessage(raw) {
    const message = JSON.parse(raw.data);
    // console.log("tempestMessage type " + message.type + " msg " + raw.data);
    if (message.type == "obs_st") {
	//console.log("tempestMessage type " + message.type + " msg " + raw.data);
	let ts = message.obs[0][0];
	let device_id = message.device_id;
	let station = tempestStations[tempestDeviceMap[device_id]];
	let nickname = station.nickname;
	// console.log("tempestMessage (" + nickname + ") type " + message.type + " msg " + raw.data);
	station.lastTime = ts;
	const now = Math.floor(Date.now() / 1000);
	if (now < ts + tempestValidTimespan) {
	    for (const [f, i] of Object.entries(obs_stMap)) {
		if (f in tempestFieldMap) {
		    const fm = tempestFieldMap[f];
		    const val = fm.convert(message.obs[0][i]).toFixed(fm.precision);
		    console.log("tempestMessage Setting " + "." + f + "-span-" + nickname + " to " + val);
		    d3.selectAll("." + f + "-span-" + nickname).html(val);
		    /*
		      if (nickname == "stfyc" && f == "gust") { // Kludge
		      anemometer.update(0, val);
		      }
		    */
		}
	    }
	} else {
	    const nts = new Date(ts * 1000);
	    console.log("Tempest " + nickname + " stale obs_st message dated " + nts);
	}
    } else if (message.type == "rapid_wind") {
	let device_id = message.device_id;
	let station = tempestStations[tempestDeviceMap[device_id]];
	let nickname = station.nickname;
	/*
	  let fm = tempestFieldMap["wind"];
	  let wind = fm.convert(message.ob[1]).toFixed(fm.precision);

	  if (nickname == "stfyc") { // Kludge
	  //d3.selectAll(".stfyc-anemometer-value-1").each(function(e, i) { this.value = wind; d3.select(this).on('change')(this); } );
	  anemometer.update(1, wind);
	  }
	*/
	if ("direction" in tempestFieldMap) {
	    fm = tempestFieldMap["direction"];
	    let direction = fm.convert(message.ob[2]).toFixed(fm.precision);
	    //d3.selectAll(".wind-span-" + nickname).html(wind);
	    d3.selectAll(".tempest-direction-span-" + nickname).html(direction);
	}
    } else if (message.type == "connection_opened") {
    } else {
	console.log("tempestMessage unknown message type: " + message.type);
    }
}

export function initializeTempestStreams() {
    if (tempestSocketInitializing == null) {
	tempestSocketInitializing = new Date().now;
    } else {
	let now = Date.now();
	if (now - tempestSocketInitializing < (60 * 1000)) {
	    console.log("initializeTempestStreams() in process");
	    return;
	}
	tempestSocketInitializing = new Date().now;
    }
    
    console.log("initializeTempestStreams()");
    const url = "wss://swd.weatherflow.com/swd/data?api_key=&app=web".replace("api_key=", "api_key=" + weatherFlow_apikey);
    tempestSocket = new WebSocket(url);
    tempestSocket.addEventListener('onerror', tempestError);
    tempestSocket.addEventListener('onclose', tempestClose);
    tempestSocket.addEventListener('message', tempestMessage);
    tempestSocket.addEventListener('open', function(e) {
	// Request StFYC events + rapid_wind
	let device_id = tempestStations["St. Francis Yacht Club"].device_id;
	let station_id = tempestStations["St. Francis Yacht Club"].station_id;
	tempestSocket.send(JSON.stringify({"type": "listen_start", "device_id": device_id}));
	tempestSocket.send(JSON.stringify({"type": "listen_rapid_start", "device_id": device_id}));
	tempestSocket.send(JSON.stringify({"type": "listen_start_events", "station_id": station_id}));
	// Request Tinsley events for tempurature
	station_id = tempestStations["Tinsley Island"].station_id;
	device_id = tempestStations["Tinsley Island"].device_id;
	tempestSocket.send(JSON.stringify({"type": "listen_start", "device_id": device_id}));
	tempestSocket.send(JSON.stringify({"type": "listen_rapid_start", "device_id": device_id}));
	tempestSocket.send(JSON.stringify({"type": "listen_start_events", "station_id": station_id}));
    });
}
