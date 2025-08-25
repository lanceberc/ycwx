import { AIS } from "./ais.js";
import { nwsZoneInitialize, nwsZoneFetch } from "./NWSzones.js";

const magnetic_declination = +13; // Actually 13.2 or so

const recent_history_hours = 6;

let curScene = 0;
let curSceneTime;
let curProgram = 0;
let schedule;

window.mode = "Carousel";

const schedules = {
    "test": [
	{ "start": 0, "program": "Test" },
	{ "start": 30, "program": "Test" },
    ],
    "production": [
	{ "start": 0, "program": "Local" },
	{ "start": 6, "program": "Images" },
	{ "start": 12, "program": "Time Lapse" },
	{ "start": 18, "program": "Local" },
	{ "start": 24, "program": "Images" },
	{ "start": 30, "program": "Local" },
	{ "start": 36, "program": "Images" },
	{ "start": 42, "program": "Time Lapse" },
	{ "start": 48, "program": "Local" },
	{ "start": 54, "program": "Images" },
    ],
    "interactive": [
	{ "start": 0, "program": "All" },
	{ "start": 30, "program": "All" },
    ],
    "rbbs": [
	{ "start": 0, "program": "RBBS" },
	{ "start": 28, "program": "RBBS" },
    ],
};

const programs = {
    "Local": [ // 6:00
	{ "div": "", "label": "Local", "duration": 0 },
	{ "div": "localWind", "label": "Wind", "duration": 30 },
	{ "div": "aisScene", "label": "AIS", "duration": 30 },
	{ "div": "NOAAObservationsScene", "label": "Observations", "duration": 45 },
	{ "div": "sfTides", "label": "Tides & Currents", "duration": 45 },
	{ "div": "WeatherFlowStFYCScene", "label": "City Forecast", "duration": 40 },
	{ "div": "ZoneForecasts", "label": "NWS Forecasts", "duration": 60 },
	//{ "div": "KarlHRRRScene", "label": "18h HRRR", "duration": 40 },
	//{ "div": "KarlNAMScene", "label": "48h NAM", "duration": 40 },
	{ "div": "", "label": "Images", "duration": 0 },
	{ "div": "pacificSurfaceAnalysis", "label": "Surface Analysis", "duration": 30 },
	{ "div": "overlay-WestCoast", "label": "West Coast", "duration": 30 },
	{ "div": "overlay-BayDelta", "label": "Bay/Delta", "duration": 30 },
	{ "div": "", "label": "Time Lapse", "duration": 0 },
	{ "div": "video-BayDelta", "label": "- 6h Time Lapse", "duration": 50 },
    ],
    "Images": [ // 6:00
	{ "div": "", "label": "Local", "duration": 0 },
	{ "div": "localWind", "label": "Wind", "duration": 30 },
	{ "div": "aisScene", "label": "AIS", "duration": 30 },
	{ "div": "NOAAObservationsScene", "label": "Observations", "duration": 20 },
	{ "div": "sfTides", "label": "Tide & Current", "duration": 30 },
	{ "div": "WeatherFlowStFYCScene", "label": "City Forecast", "duration": 30 },
	{ "div": "ZoneForecasts", "label": "NWS Forecasts", "duration": 60 },
	//{ "div": "KarlHRRRScene", "label": "18h HRRR", "duration": 40 },
	{ "div": "", "label": "Images", "duration": 0 },
	{ "div": "pacificSurfaceAnalysis", "label": "Surface Chart", "duration": 15 },
	{ "div": "goes-PACUS", "label": "GOES PACUS", "duration": 20 },
	{ "div": "overlay-NorthPacific", "label": "North Pacific", "duration": 20 },
	//{ "div": "overlay-WestCoast", "label": "West Coast", "duration": 20 },
	//{ "div": "overlay-BayDelta", "label": "Bay/Delta", "duration": 20 },
	{ "div": "", "label": "National", "duration": 0 },
	{ "div": "cloudTopsScene", "label": "IR Cloud Tops", "duration": 25 },
	{ "div": "nationalRadarScene", "label": "National Radar", "duration": 30 },
	{ "div": "", "label": "Pacific", "duration": 0 },
	{ "div": "SSTScene", "label": "SST", "duration": 20 },
	{ "div": "SSTanomalyScene", "label": "SST Anomaly", "duration": 30 },
    ],
    "Time Lapse": [ // 6:00
	{ "div": "", "label": "Local", "duration": 0 },
	{ "div": "localWind", "label": "Wind", "duration": 30 },
	{ "div": "aisScene", "label": "AIS", "duration": 30 },
	{ "div": "NOAAObservationsScene", "label": "Observations", "duration": 45 },
	{ "div": "sfTides", "label": "Tide & Current", "duration": 45 },
	{ "div": "WeatherFlowStFYCScene", "label": "City Forecast", "duration": 30 },
	//{ "div": "KarlHRRRScene", "label": "18h HRRR", "duration": 40 },
	{ "div": "", "label": "Time Lapse", "duration": 0 },
	{ "div": "video-Pacific", "label": "7d North Pacific", "duration": 60},
	{ "div": "video-WestCoast", "label": "24h West Coast", "duration": 60},
	{ "div": "video-BayDelta", "label": "6h Bay/Delta", "duration": 60 },
    ],
    "RBBS": [ // 4:00
	{ "div": "", "label": "Conditions", "duration": 0 },
	{ "div": "localWind", "label": "Wind", "duration": 30 },
	{ "div": "NOAAObservationsScene", "label": "Observations", "duration": 30 },
	{ "div": "sfTides", "label": "Tide & Current", "duration": 30 },
	{ "div": "", "label": "Forecasts", "duration": 0 },
	{ "div": "WeatherFlowStFYCScene", "label": "City Forecast", "duration": 30 },
	{ "div": "ZoneForecasts", "label": "NWS Forecasts", "duration": 60 },
	{ "div": "", "label": "Images", "duration": 0 },
	{ "div": "overlay-BayDelta", "label": "Bay/Delta", "duration": 30 },
	{ "div": "video-BayDelta", "label": "6h Bay/Delta", "duration": 30 },
    ],
    "All": [
	{ "div": "", "label": "Local", "duration": 0 },
	{ "div": "localWind", "label": "Wind", "duration": 30 },
	/*{ "div": "sfLocalObservations", "label": "Observations", "duration": 15 }, */
	{ "div": "NOAAObservationsScene", "label": "Observations", "duration": 15 },
	{ "div": "sfTides", "label": "Tide & Current", "duration": 15 },
	/* { "div": "currentMapScene", "label": "SFBay Currents", "duration": 30 }, */
	//{ "div": "KarlHRRRScene", "label": "18h HRRR", "duration": 40 },
	//{ "div": "KarlNAMScene", "label": "48h NAM", "duration": 40 },
	{ "div": "ZoneForecasts", "label": "NWS Forecasts", "duration": 40 },
	{ "div": "WeatherFlowStFYCScene", "label": "City Forecast", "duration": 30 },
	{ "div": "WeatherFlowTinsleyScene", "label": "Tinsley Forecast", "duration": 30 },
	{ "div": "aisScene", "label": "AIS", "duration": 30 },
	{ "div": "", "label": "Images", "duration": 0 },
	{ "div": "pacificSurfaceAnalysis", "label": "Surface Analysis", "duration": 10 },
	{ "div": "goes-PACUS", "label": "GOES PACUS", "duration": 10 },
	{ "div": "overlay-NorthPacific", "label": "North Pacific", "duration": 10 },
	{ "div": "overlay-WestCoast", "label": "West Coast", "duration": 5 },
	{ "div": "overlay-BayDelta", "label": "Bay/Delta", "duration": 5 },
	{ "div": "", "label": "Time Lapse", "duration": 0 },
	{ "div": "video-Pacific", "label": "7d North Pacific", "duration": 30},
	{ "div": "video-WestCoast", "label": "24h West Coast", "duration": 30},
	{ "div": "video-BayDelta", "label": "6h Bay/Delta", "duration": 30 },
	// { "div": "purpleAir", "label": "StFYC Air Quality", "duration": 30 },
	{ "div": "", "label": "National", "duration": 0 },
	/*{ "div": "nationalRadarScene", "label": "National Radar", "duration": 30 },*/
	{ "div": "nationalRadar2Scene", "label": "National Radar", "duration": 30 },
	{ "div": "cloudTopsScene", "label": "IR Cloud Tops", "duration": 30 },
	{ "div": "", "label": "North Pacific", "duration": 0 },
	{ "div": "SSTScene", "label": "SST", "duration": 30 },
	{ "div": "SSTanomalyScene", "label": "SST Anomaly", "duration": 30 },
	{ "div": "GlobalWindScene", "label": "Wind", "duration": 30 },
	{ "div": "GlobalWaveScene", "label": "Waves", "duration": 30 },
	{ "div": "", "label": "Meta", "duration": 0 },
	{ "div": "linksScene", "label": "Links", "duration": 30 },
	{ "div": "aboutScene", "label": "About", "duration": 30 },
    ],
    "Test": [
	{ "div": "sfTides", "label": "Tide & Current", "duration": 300 },
	{ "div": "sfLocalObservations", "label": "Local Obs", "duration": 30 },
    ],
}

let scenes = [];

// Conversion routines for Tempest defaults - only the forecast API converts units, the others return defaults
function c2f(d) { return ((parseFloat(d) * (9.0/5.0)) + 32.0); }
function mb2mb(d) { return(parseFloat(d)); }
function m2kts(d) { return(parseFloat(d) * 1.94384); }
function t2m(d) { return(parseFloat(d) + magnetic_declination); }

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

// Tempest forecasts are implemented at objects
let wfstfyc;
let wftinsley;

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
function fetchTempestHistory(station) {
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
function fetchTempestForecast(station) {
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
function fetchTempestCurrent(station) {
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

function plotTempestWindForecast(station) {
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

let tidesRO = new ResizeObserver(elements => {
    plotTides();
});

let currentsRO = new ResizeObserver(elements => {
    plotCurrents();
});

let windRO = new ResizeObserver(elements => {
    windPlotHistory("wind-history-recent", windHistory, (highWindMode == true) ? 50 : 30);
    windStartStopHistory(elements[0]);
    plotTempestWindForecast("St. Francis Yacht Club");
});

let anemometer = null;
let highWindMode = false;
let highWindTime = false;
let highWindCurScene = null;

// defined in local_config.js
// let highWindThreshhold = 25;
// let highWindDuration = 60 * 1000; // One minute

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

function tempestCheck() {
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

function initializeTempestStreams() {
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

var windHistory = null;

function stfycWindCallback(json) {
    const wind = JSON.parse(json);
    //console.log("wind update " + wind);
    if (wind.event == "airmar_update") {
	const speed_avg = wind.speed_avg.toFixed(1);
	const gust = wind.gust.toFixed(1);
	const dir = wind.dir.toFixed(0);
	const dir_avg = wind.dir_avg.toFixed(0);
	anemometer.update(1, speed_avg);
	anemometer.update(0, gust);
	if (gust > highWindThreshhold) {
	    if (highWindMode == false) {
		highWindCurScene = curScene;
		d3.selectAll(".wx-scene").classed("show", false);
		d3.selectAll("#localWind").classed("show", true);
	    }
	    highWindMode = true;
	    highWindTime = Date.now();
	} else {
	    if (highWindMode && (Date.now() > highWindTime + highWindDuration)) {
		highWindMode = false;
		// Resume regular programming
		initializeScene(highWindCurScene);
	    }
	}
	d3.selectAll(".wind-span-stfyc").html(speed_avg);
	d3.selectAll(".gust-span-stfyc").html(gust);
	d3.selectAll(".direction-span-stfyc").html(dir);
	d3.selectAll(".direction-avg-span-stfyc").html(dir_avg);
    }
    if (wind.event == "airmar_history") {
	windHistory = wind.history;
	windPlotHistory("wind-history-recent", windHistory, (highWindMode == true) ? 50 : 30);
	d3.selectAll(".baro-span-stfyc").html(wind.baro.toFixed(0));
	console.log("Setting .temp-span-stfyc to " + wind.temp);
	d3.selectAll(".temp-span-stfyc").html(wind.temp);
    }

    if (wind.event == "tempest_update") {
	const speed_avg = wind.speed_avg.toFixed(1);
	const gust = wind.gust.toFixed(1);
	const dir = wind.dir.toFixed(0);
	const dir_avg = wind.dir_avg.toFixed(0);
	if (typeof tempest_anemometer !== 'undefined') {
	    tempest_anemometer.update(1, speed_avg);
	    tempest_anemometer.update(0, gust);
	}
	d3.selectAll(".tempest-wind-span-stfyc").html(speed_avg);
	d3.selectAll(".tempest-gust-span-stfyc").html(gust);
	d3.selectAll(".tempest-awa-span-stfyc").html(dir);
	d3.selectAll(".tempest-awa-avg-span-stfyc").html(dir_avg);
    }

    if (wind.event == "tempest_history") {
	d3.selectAll(".tempest-baro-span-stfyc").html(wind.baro.toFixed(0));
	d3.selectAll(".tempest-temperature-span-stfyc").html((wind.temp * (9.0 /5.0) + 32.0).toFixed(1));
	/*
	  windHistory = wind.history;
	  windPlotHistory("tempest-wind-history-recent", windHistory);
	*/
    }
}

const NWSscrapeSites = [
    {
	//"url": "https://tgftp.nws.noaa.gov/data/raw/sx/sxus86.kmtr.omr.mtr.txt",
	"url": "./data/nwsZones/observations.txt",
	"stations": {
	    "FTPC1": { "nickName": "Ft Point",           "lat": 37.807, "lon": -122.500, "realLat": 37.80669, "realLon": -122.46500},
	    "PXOC1": { "nickName": "SF Pier 1",          "lat": 37.800, "lon": -122.420, "realLat": 37.79800 , "realLon": -122.39297},
	    //"AISC1": { "nickName": "Pt Blunt",           "lat": 37.860, "lon": -122.440, "realLat": 37.85312, "realLon": -122.41912}, // Not reporting
	    //"GGBC1": { "nickName": "Midspan",            "lat": 37.830, "lon": -122.560, "realLat": 37.81975, "realLon": -122.47904}, // Not reporting
	    "PPXC1": { "nickName": "Pt Potrero",         "lat": 37.906, "lon": -122.365, "realLat": 37.90581, "realLon": -122.36503},
	    //"CF131": { "nickName": "I5 near Tinsley",    "lat": 37.906, "lon": -122.240, "realLat": 38.04637, "realLon": -121.36868},
	    "KOAK":  { "nickName": "OAK",                "lat": 37.730, "lon": -122.240, "realLat": 37.7178, "realLon": -122.23294},
	    //"KSJC":  { "nickName": "San Jose Airport",   "lat": 37.730, "lon": -122.330, "realLat": 37.35917, "realLon": -121.92417}, // Not in page
	    "KSFO":  { "nickName": "SFO",                "lat": 37.730, "lon": -122.420, "realLat": 37.61961, "realLon": -122.36558},
	    "KHAF":  { "nickName": "HMB Airport",        "lat": 37.730, "lon": -122.500, "realLat": 37.5136, "realLon": -122.4996},
	    "46013": { "nickName": "46013 Bodega Bay",   "lat": 37.880, "lon": -122.650, "realLat": 38.20000, "realLon": -123.30000},
	    "46026": { "nickName": "46026 SF Buoy",      "lat": 37.800, "lon": -122.650, "realLat": 37.80000, "realLon": -122.80000},
	    "46012": { "nickName": "46012 HMB Buoy",     "lat": 37.750, "lon": -122.650, "realLat": 37.356, "realLon": -122.881},
	    //"FNDC1": "Farallon Is", // (not reporting)
	    "TIBC1": { "nickName": "Tiburon Pier",       "lat": 37.892, "lon": -122.500, "realLat": 37.892, "realLon": -122.447,}
	},
    },
];

function scrapeCallback(observations) {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() / 60; // getTimeZoneOffset() is in minutes
    const Declination = -13; // KLUDGE - doesn't handle a large geographic area or somewhere not San Francisco - should be in local config
    
    for (const [station, o] of Object.entries(observations)) {
	let t = '';
	//t += station;
	t += o.nickName;
	let time = o.gmt - tzOffset;
	time += (time < 0) ? 24 : ((time > 24) ? -24 : 0);
	t += '\nTime:  ' + ((time < 10)? '0' : '') + time + "00";
	t += (!("airPressure" in o)) ? "" : '\nPress: ' + o.airPressure + "mb";
	t += (!("airTemp" in o)) ? "" : '\nTemp:  ' + o.airTemp + "\xB0F";
	if ("calm" in o) {
	    t += '\nWDir:  ' + "CALM";
	    t += '\nWSpd:  ' + "CALM";
	} else {
	    if ("windDir" in o) {
		t += '\nWDir:  ' + Math.round(o.windDir + Declination + 360) % 360 + "\xB0M";
	    }
	    if ("windSpeed" in o) {
		t += '\nWSpd:  ' + o.windSpeed;
		if ("windGust" in o) {
		    t += 'G' + o.windGust;
		}
		t += "kts";
	    }
	}
	t += (!("waterTemp" in o))  ? "" : '\nWTemp: ' + o.waterTemp + "\xB0F";
	t += (!("waveHeight" in o)) ? "" : '\nWHght: ' + o.waveHeight + "ft";
	t += (!("wavePeriod" in o)) ? "" : '\nWPer:  ' + o.wavePeriod + "s";
	
	console.log(`NWsscrape update station ${station}`);
	//d3.select("#NWS-" + station).html(t);
	localObsRadarStations[station].set('text', t);
    }
}

let localObsRadarStations = {};

// Tempest stations are a bit flakey - if the Tempest is down, use NOAA data
const tempestValidTimespan = 60 * 60; /* secs a tempest observation is valid - after that use NOAA */
const backupFields = [
    { "stid": "FTPC1", "tempest": "St. Francis Yacht Club", "tempestField": "temp", "localField": "temp", "precision": 1 },
    // Fort Point and Pier 1 don't have baromoters - there's probably a better choice than the buoy
    { "stid": "46026", "tempest": "St. Francis Yacht Club", "tempestField": "tempest-baro", "localField": "pressure", "precision": 0 },
];


const noaaTideStation = "9414290";
const minTide = -1.5;
const maxTide = 6.5;
let tideData = null;

let tideRect = { "width": 0, "height": 0};

function plotTides() {
    if (tideData == null) {
	return;
    }
    const tides = tideData.tides;
    const hilo = tideData.hilo;

    const element = "tide-forecast-" + noaaTideStation;
    // The closer width & height are to the actual size, the better off we are
    let pcr = d3.select("#" + element).node().parentNode.getBoundingClientRect();
    let cr = d3.select("#" + element).node().getBoundingClientRect();
    let labelcr = d3.select("#" + element + "-label").node().getBoundingClientRect();
    if ((cr.width == 0) && (cr.height == 0)) {
	return;
    }
    let width = tideRect.width;
    let height = tideRect.height;
    if (cr.width == tideRect.width) {
	console.log(`plotTides width (${tideRect.width} x ${tideRect.height}) unchanged`);
    } else {
	width = cr.width;
	height = cr.height;
	height = pcr.height - labelcr.height;
	let aheight = width * (9.0 / 16.0); // 16:9 aspect ratio
	if ((aheight < height) || (pcr.height == labelcr.height)) {
	    height = aheight;
	}
	tideRect.width = width;
	tideRect.height = height;
    }
    console.log(`plotTides ${cr.width} x ${cr.height} -> ${width} x ${height} parent ${pcr.width} x ${pcr.height} label ${labelcr.width} x ${labelcr.height}`);

    let margin = { left: vw(1.25), top: vh(0.5), right: vw(1), bottom: vh(3.00) };

    let X = tides.map(function(d) { return(Date.parse(d.t)) });
    let Y = tides.map(function(d) { return(d.v) });
    let data = X.map(function(e, i) {
	return [e, Y[i]];
    });
    const start = X[0];
    const end = X[X.length-1];

    d3.select("." + element).selectAll("*").remove();
    d3.select("." + element).remove();
    let svg = d3.select("#" + element)
	.append("svg")
	.classed("tide-svg", true)
	.classed(element, true)
	.attr("viewBox",
	      -margin.left + " " +
	      -margin.top + " " +
	      (width + margin.left + margin.right) + " " +
	      (height + margin.top + margin.bottom))
	.attr("preserveAspectRatio", "none")
	.attr("width", width).attr("height", height)
	.append("g")
	.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    const x = d3.scaleTime()
	.domain([new Date(start), new Date(end)])
	.range([0, width]);

    const y = d3.scaleLinear()
	.domain([minTide, maxTide])
	.range([height, 0]);

    // x-axis
    svg.append("g")
	.attr("transform", "translate(0," + height + ")")
	.classed("tide-plot-x-axis", true)
	.call(d3.axisBottom(x));

    // y-axis
    svg.append("g")
	.classed("tide-plot-y-axis", true)
	.call(d3.axisLeft(y)
	      .tickArguments([parseInt((maxTide - minTide) - 1)]));

    // y-axis gridlines
    svg.append("g")			
	.classed("tide-plot-grid", true)
	.call(d3.axisLeft(y)
	      .tickSize(-width)
	      .tickFormat("")
	      .ticks([parseInt((maxTide - minTide) - 1)])
	     );
    
    // Tide height
    svg.append("path")
	.datum(data)
	.classed("tide-plot-tide", true)
	.attr("d", d3.area()
	      .x(function(d) { return x(d[0]) })
	      .y1(function(d) { return y(d[1]) })
	      .y0(function(d) { return y(minTide) })
	      .curve(d3.curveBasis)
	     );

    // Highs & Lows
    const hl = [];
    for (const i in hilo) {
	const item = hilo[i];
	const t = (new Date(item.t)).getTime();
	if ((t > start) && (t < end)) {
	    hl.push(t);
	}
    }
    svg.append("g")			
	.classed("tide-plot-grid", true)
	.call(d3.axisBottom(x)
	      .tickSize(height)
	      .tickFormat("")
	      .tickValues(hl)
	     );

    // Now
    const now = Date.now();
    svg.append("path")
	.datum([[now, minTide], [now, maxTide]])
	.classed("tide-plot-now", true)
	.attr("d", d3.line()
	      .x(function(d) { return x(d[0]) })
	      .y(function(d) { return y(d[1]) })
	     );

    X = hilo.map(function(d) { return(Date.parse(d.t)); });
    Y = hilo.map(function(d) { return(d.v); });
    data = [];
    for (const i in X) {
	if ((X[i] > start) && (X[i] < end)) {
	    let label = (parseFloat(hilo[i].v).toFixed(1) + "ft @" + hilo[i].t.slice(11));
	    data.push([X[i], parseFloat(Y[i]), label, hilo[i].type]);
	}
    }

    // Keep the labels on the chart during extreme tide events
    function labelClamp(y) {
	const labelMax = maxTide - 0.5;
	const labelMin = minTide + 0.8;
	if (y > labelMax) {
	    return(labelMax);
	}
	if (y < labelMin) {
	    return(labelMin);
	}
	return(y);
    }
    
    // High/Low Labels
    svg.append("g")
	.classed("tide-plot-label-group", true)
	.selectAll('text')
	.data(data)
	.enter()
	.append("g")
	.attr("opacity", 1)
	.classed("tide-plot-label", true)
	.classed("events-label", true)
	.attr("transform", function(d, i) {
	    return("translate(" + x(d[0]) + ", " + y(labelClamp(d[1])) + ")")
	})
	.append('text')
	.classed("tide-plot-label-item", true)
	.classed("events-text", true)
	.attr("text-anchor", "middle")
	.attr("dx", 0)
	.attr("dy", function(d, i) { return(d[3] == "H" ? "-0.45em" : "1.3em") } )
	.text(function(d, i) { return(d[2]); });

    d3.selectAll(".tide-plot-label-item").each(function(e, i) {
	let label = d3.select(this);
	let parent = this.parentNode;
	let bbox = label.node().getBBox();
	d3.select(parent).insert("rect", ":first-child")
	    .attr("x", function(d, i){return bbox.x})
	    .attr("y", function(d, i){return bbox.y})
	    .attr("dx", 0)
	    .attr("dy", function(d,i) { return(data[i][3] == "H" ? "-0.4em" : "1.3em") } )
	    .attr("width", function(d){return bbox.width})
	    .attr("height", function(d){return bbox.height})
	    .classed("tide-plot-label-background", true);
    });
}

const days = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

const noaaCurrentStation = "SFB1203_18";
const minCurrent = -4.5;
const maxCurrent = 4.5;

let currentRect = { "width": 0, "height": 0};

function plotCurrents() {
    if (tideData == null) {
	return;
    }
    
    const current_data = tideData.current_points;
    const current_events = tideData.current_info.events; // See what I did there?

    const t = new Date();
    let year = t.getFullYear().toString();
    let month = (t.getMonth() < 9 ? "0" : "") + (t.getMonth()+1).toString();
    let date = (t.getDate() < 10 ? "0" : "") + t.getDate().toString();
    const start_string = `${year}-${month}-${date} 00:00`;
    const start = new Date(start_string);

    t.setTime(t.getTime() + (2 * 24 * 60 * 60 * 1000));
    year = t.getFullYear().toString();
    month = (t.getMonth() < 9 ? "0" : "") + (t.getMonth()+1).toString();
    date = (t.getDate() < 10 ? "0" : "") + t.getDate().toString();
    const end_string = `${year}-${month}-${date} 00:00`;
    const end = new Date(end_string);

    const plot_events = [];
    current_events.forEach(function(e, i) {
	if ((e.e == "Max Flood") || (e.e == "Max Ebb")) {
	    plot_events.push(e);
	}
    });

    let element = ".current-events-table-" + noaaCurrentStation;
    d3.selectAll(element).remove();

    let today = current_events[0].t.slice(0,10);

    let current_tables = [{},{}];
    for (let i in [0, 1]) {
	let t0 = new Date(today + " 00:00");
	let t = new Date();
	const oneDay = (i * 24 * 60 * 60 * 1000);
	t.setTime(t0.getTime() + oneDay);
	year = t.getFullYear().toString();
	month = (t.getMonth() < 9 ? "0" : "") + (t.getMonth()+1).toString();
	date = (t.getDate() < 10 ? "0" : "") + t.getDate().toString();
	const head_string = days[t.getDay()] + `, ${year}-${month}-${date}`;

	let table = d3.select("#current-events-content-" + noaaCurrentStation).append("div")
	    .classed("current-events-table", true)
	    .classed("current-events-table-" + noaaCurrentStation, true)
	    .classed("events-text", true);

	let header = table.append("div")
	    .classed("current-events-table-header", true)
	header.append("div")
	    .classed("current-events-table-cell", true)
	    .html(head_string);
	
	let body = table.append("dev")
	    .classed("current-events-table-body", true)
	current_tables[i].body = body;
    }
    
    current_events.forEach(function(e) {
	const d = e.t.slice(0,10);
	const i = (d == today) ? 0 : 1;

	const v = (e.e.search("Slack") == -1) ? e.e : "Slack";
	const water = (e.e.search("Slack") != -1) || (e.e.search("Max") != -1);
	let row = current_tables[i].body.append("div")
	    .classed("current-events-table-row", true)
	row.append("div")
	    .classed("current-events-table-cell", true)
	    .classed("current-events-table-water", water)
	    .classed("current-events-table-astral", !water)
	    .html(e.t.slice(10));
	row.append("div")
	    .classed("current-events-table-cell", true)
	    .classed("current-events-table-water", water)
	    .classed("current-events-table-astral", !water)
	    .html(v);
    });

    element = "current-forecast-" + noaaCurrentStation;
    let pcr = d3.select("#" + element).node().parentNode.getBoundingClientRect();
    let cr = d3.select("#" + element).node().getBoundingClientRect();
    let labelcr = d3.select("#" + element + "-label").node().getBoundingClientRect();
    if ((cr.width == 0) && (cr.height == 0)) {
	return;
    }

    let width = currentRect.width;
    let height = currentRect.height;
    if (cr.width == currentRect.width) {
	console.log(`plotCurrents width (${currentRect.width} x ${currentRect.height}) unchanged`);
    } else {
	width = cr.width;
	height = cr.height;
	height = pcr.height - labelcr.height;
	let aheight = width * (9.0 / 16.0); // 16:9 aspect ratio
	if ((aheight < height) || (pcr.height == labelcr.height)) {
	    height = aheight;
	}
	currentRect.width = width;
	currentRect.height = height;
    }
    console.log(`plotCurrents ${cr.width} x ${cr.height} -> ${width} x ${height} parent ${pcr.width} x ${pcr.height} label ${labelcr.width} x ${labelcr.height}`);
    
    let margin = { left: vw(1.25), top: vh(0.5), right: vw(1), bottom: vh(3.00) };
    let X = current_data.map(function(d) { return(Date.parse(d[0])) });
    let Y = current_data.map(function(d) { return(d[1]) });
    let data = X.map(function(e, i) {
	return [e, Y[i]];
    });

    d3.select("#" + element).selectAll("*").remove();
    //d3.select("." + element).remove();
    let svg = d3.select("#" + element)
	.append("svg")
	.classed("tide-svg", true)
	.classed(element, true)
	.attr("viewBox",
	      -margin.left + " " +
	      -margin.top + " " +
	      (width + margin.left + margin.right) + " " +
	      (height + margin.top + margin.bottom))
	.attr("preserveAspectRatio", "none")
	.attr("width", width).attr("height", height)
	.append("g")
	.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    const x = d3.scaleTime()
	.domain([start, end])
	.range([0, width]);

    const y = d3.scaleLinear()
	.domain([minCurrent, maxCurrent])
	.range([height, 0]);

    // x-axis
    svg.append("g")
	.attr("transform", "translate(0," + height + ")")
	.classed("tide-plot-x-axis", true)
	.call(d3.axisBottom(x));

    // y-axis
    svg.append("g")
	.classed("tide-plot-y-axis", true)
	.call(d3.axisLeft(y)
	      .tickArguments([parseInt((maxCurrent - minCurrent) - 1)]));

    // y-axis gridlines
    svg.append("g")			
	.classed("tide-plot-grid", true)
	.call(d3.axisLeft(y)
	      .tickSize(-width)
	      .tickFormat("")
	      .ticks([parseInt((maxCurrent - minCurrent) - 1)])
	     );
    
    // Current speed
    svg.append("path")
	.datum(data)
	.classed("tide-plot-tide", true)
	.attr("d", d3.area()
	      .x(function(d) { return x(d[0]) })
	      .y1(function(d) { return y(d[1]) })
	      .y0(function(d) { return y(0) })
	      .curve(d3.curveBasis)
	     );

    // Max flow & slack grid lines
    const event_times = [];
    for (const i in plot_events) {
	const item = plot_events[i];
	const t = new Date(item.t);
	if ((t > start) && (t < end)) {
	    event_times.push(t);
	}
    }
    svg.append("g")			
	.classed("tide-plot-grid", true)
	.call(d3.axisBottom(x)
	      .tickSize(height)
	      .tickFormat("")
	      .tickValues(event_times)
	     );

    // Max flow & slack labels
    X = plot_events.map(function(d) { return(Date.parse(d.t)); });
    Y = plot_events.map(function(d) { return(d.v); });
    data = [];
    for (const i in X) {
	if ((X[i] > start) && (X[i] < end)) {
	    let label = (parseFloat(plot_events[i].v).toFixed(1) + "kt @" + plot_events[i].t.slice(11));
	    data.push([X[i], parseFloat(Y[i]), label, plot_events[i].e]);
	}
    }
    
    // Now
    const now = Date.now();
    svg.append("path")
	.datum([[now, minCurrent], [now, maxCurrent]])
	.classed("tide-plot-now", true)
	.attr("d", d3.line()
	      .x(function(d) { return x(d[0]) })
	      .y(function(d) { return y(d[1]) })
	     );

    // Labels are drawn over Now line
    svg.append("g")
	.classed("tide-plot-label-group", true)
	.selectAll('text')
	.data(data)
	.enter()
	.append("g")
	.attr("opacity", 1)
	.classed("tide-plot-label", true)
	.classed("events-text", true)
	.attr("transform", function(d, i) {
	    return("translate(" + x(d[0]) + ", " + y(d[1]) + ")")
	})
	.append('text')
	.classed("current-plot-label-item", true)
	.classed("events-text", true)
	.attr("text-anchor", "middle")
	.attr("dx", 0)
	.attr("dy", function(d, i) { return(d[3] == "Max Flood" ? "-0.45em" : "1.3em") } )
	.text(function(d, i) { return(d[2]); });

    d3.selectAll(".current-plot-label-item").each(function(e, i) {
	let label = d3.select(this);
	let parent = this.parentNode;
	let bbox = label.node().getBBox();
	d3.select(parent).insert("rect", ":first-child")
	    .attr("x", function(d, i){return bbox.x})
	    .attr("y", function(d, i){return bbox.y})
	    .attr("dx", 0)
	    .attr("dy", function(d,i) { return(data[i][3] == "Max Flood" ? "-0.4em" : "1.3em") } )
	    .attr("width", function(d){return bbox.width})
	    .attr("height", function(d){return bbox.height})
	    .classed("current-plot-label-background", true);
    });
}

function fetchTidesAndCurrents() {
    const url = "data/NOAA/tides.json";
    d3.json(url)
	.then(
	    function(json) {  tideData = json; plotTides(); plotCurrents(); },
	    function(error) { console.log("Couldn't fetch tides from url: " + url) }
	);
}

/* The NOAA web server's CORS setting prevents using the data directly in a web page.
   const noaaTideURL = 'https://tidesandcurrents.noaa.gov/api/datagetter?station=&begin_date=&end_date=&applications=StFYC&product=predictions&datum=MLLW&units=english&time_zone=lst_ldt&format=json';

   function fetchTidesAndCurrents() {
   t = new Date();
   let year = t.getFullYear().toString();
   let month = (t.getMonth() < 9 ? "0" : "") + (t.getMonth()+1).toString();
   let date = (t.getDate() < 10 ? "0" : "") + t.getDate().toString();
   const hour = t.getHours();
   const minute = t.getMinutes();
   const begin_date = year + month + date;
   t.setTime(t.getTime() + (24 * 60 * 60 * 1000));
   year = t.getFullYear().toString();
   month = (t.getMonth() < 9 ? "0" : "") + (t.getMonth()+1).toString();
   date = (t.getDate() < 10 ? "0" : "") + t.getDate().toString();
   const end_date =  year + month + date;
   
   let url = noaaTideURL.replace("station=", "station=" + noaaTideStation)
   url = url.replace("begin_date=", "begin_date=" + begin_date)
   url = url.replace("end_date=", "end_date=" + end_date);
   let tides = "";
   let currents = "";
   
   d3.json(url)
   .then(
   function(json) { tides = json },
   function(error) { console.log("Couldn't fetch tides from url: " + url) }
   );
   url = url + "&interval=hilo";
   d3.json(url)
   .then(
   function(json) { currents = json },
   function(error) { console.log("Couldn't fetch currents from url: " + url) }
   );
   graphTidesAndCurrents(tides, currents);
   }
*/

function setCurrentChartURL() {
    // Advance one hour from now and construct forecast URL
    t = new Date()
    t.setTime(Date.now() + (60 * 60 * 1000))
    // https://cdn.tidesandcurrents.noaa.gov/ofs/sfbofs/wwwgraphics/SFBOFS_entrance_cu_fore_202206080100.png
    const year = t.getFullYear();
    const month = t.getMonth();
    const date = t.getDate();
    const hour = t.getHours();
    const minute = t.getMinutes();

    ts = year;
    ts += (month < 10) ? "0" + (month+1) : (month+1);
    ts += (date < 10) ? "0" + date : date;
    ts += (hour < 10) ? "0" + hour : hour;
    ts += "00"
    
    url = "https://cdn.tidesandcurrents.noaa.gov/ofs/sfbofs/wwwgraphics/SFBOFS_entrance_cu_fore_" + ts + ".png";
    d3.select("#sfCurrentChart").attr("src", url).attr("sfCurrentChart-data-hour", hour).attr("sfCurrentChart-data-minute", minute);;
}

function updateImg(e) {
    let url = d3.select(e).attr("src");
    let q = url.lastIndexOf("?");
    const now = Date.now();
    if (q == -1) {
	url += "?" + now;
    } else {
	url = url.substr(0, q+1) + now;
    }
    //console.log("updateImage new url: " + url);
    d3.select(e).attr("src", url);
}

// https://web.dev/lazy-loading-video/
const lazyVideoObserver = new IntersectionObserver(function(entries, observer) {
    entries.forEach(function(video) {
	if (video.isIntersecting) {
	    for (let source in video.target.children) {
		const videoSource = video.target.children[source];
		if (typeof videoSource.tagName === "string" && videoSource.tagName === "SOURCE") {
		    videoSource.setAttribute("src", videoSource.dataset.src);
		    videoSource.removeAttribute("data-src");
		}
	    }

	    console.log("lazyVideoObserver start " + video.target.id);
	    video.target.classList.remove("lazy");
	    lazyVideoObserver.unobserve(video.target);
	    video.target.load();
	    video.target.play();
	}
    });
});

function initializeVideoLazyLoad() {
    const lazyVideos = [].slice.call(document.querySelectorAll(".wx-video.lazy"));
    lazyVideos.forEach(function(lazyVideo) {
	lazyVideoObserver.observe(lazyVideo);
    });
}

function updateVideo(e) {
    if (e == null) {
	return;
    }

    for (let source in e.children) {
	const videoSource = e.children[source];
	if (typeof videoSource.tagName === "string" && videoSource.tagName === "SOURCE") {
	    let src = videoSource.src;

	    if (src == null || src == "") {
		//console.log("updateVideo video not loaded");
		return;
	    }

	    let url = src.substring(0, src.lastIndexOf("/")) + "/latest.json?" + Date.now();
	    console.log("updateVideo fetch src '" + src + "' url " + url);
	    d3.json(url)
		.then(
		    function(json) {
			if (videoSource.src.substr(src.lastIndexOf("/")+1) != json.fn.substr(json.fn.lastIndexOf("/")+1)) {
			    e.pause();
			    console.log("updateVideo " + videoSource.src + " -> " + json.fn);
			    videoSource.setAttribute("data-src", json.fn);
			    videoSource.removeAttribute("src");
			    e.classList.add("lazy");
			    lazyVideoObserver.observe(e);
			    return;
			}
			// console.log("updateVideo no change " + src);
			return;
		    },
		    function(error) {
			console.log("updateVideo couldn't fetch video filename latest " + url);
			return;
		    }
		    
		);
	    return;
	}
    }
    console.log("updateVideo no src found");
}

let sceneMenuIsPopped = false;
function handleScenePullDownClick(e) {
    if (sceneMenuIsPopped) {
	d3.select(".wx-sidebar")
	    .classed(".zpop", false)
	    .attr("style", "display: none");
	sceneMenuIsPopped = false;
    } else {
	d3.select(".wx-sidebar")
	    .classed(".zpop", true)
	    .attr("style", "display: block");
	sceneMenuIsPopped = true;
    }
}

let lastSec = -1;
let lastMinute = -1;
function dispatch() {
    const now = new Date();
    const time = Math.floor(now.getTime() / 1000);
    if (time == lastSec) {
	return;
    }
    lastSec = time;

    if (window.mode == "Carousel") {
	rotateScene(); // Called once per second
    }

    if (windsNeedRender) {
	plotTempestWindForecast("St. Francis Yacht Club");
    }

    const minutes = Math.floor(time/60);
    if (minutes == lastMinute) {
	return;
    }

    // Everything here and below executes once per minute

    const hour = now.getHours();
    const minute = now.getMinutes();
    console.log(`Dispatch: h ${hour} m ${minute} t ${time/60} l ${lastMinute}`);

    lastMinute = minutes;

    // Its a new minute so update the local and GMT clock fields
    const u = now.toUTCString();
    d3.select("#time-UTC").html( u.slice(17,22) + "UTC");
    const l = now.toTimeString();
    const ts = l.slice(0, 5);
    const tz = l.slice(l.indexOf("(") + 1, l.indexOf(")") - 2);
    d3.select("#time-local").html( ts + (l.includes("Daylight") ? "PDT" : "PST")); // Kludgey - assumes were in Pacific Time Zone

    if (window.mode == "Carousel") {
	rotateProgram();
    }

    tempestCheck(); // Have WebSockets closed?

    // Check the video .json files each minute to see if there is a new render
    d3.selectAll(".wx-video").each(function() { updateVideo(this) });

    // Using WebSocket now?
    //fetchTempestCurrent("St. Francis Yacht Club");
    //fetchTempestCurrent("Tinsley Island");

    // Every 5 minutes - Skew it so its not right on the hour
    if (!((minute+1) % 5)) {
	console.log("dispatch 5: " + now);
	d3.selectAll(".wx-image.update5").each(function() { updateImg(this) });
	fetchTempestHistory("St. Francis Yacht Club");
	fetchTidesAndCurrents();
    }

    // Every 10 minutes - Skew it so it's not right on the hour
    if (!((minute+4) % 10)) {
	// Doesn't happen very often
	nwsZoneFetch();
    }

    if (minute > 30) {
	// Change current chart once per hour after half-past.
	/*
	  if (hour != d3.select("#sfCurrentChart").attr("sfCurrentChart-data-hour")) {
	  //setCurrentChartURL();
	  }
	*/
    }

    if (!((minute + 3) % 60)) {
	fetchTempestForecast("St. Francis Yacht Club");
    }
}

let wastedSize = 0;

function initializeScene(newScene) {
    const now = new Date();
    const time = Math.floor(now.getTime() / 1000);

    curScene = newScene;
    
    d3.selectAll(".wx-scene").classed("show", false);
    while (scenes[curScene].duration == 0) { // Skip scenes with 0 duration
	curScene = (curScene + 1) % scenes.length;
    }

    let list = d3.select("#scene-list").property("children");
    for (let i = 0; i < list.length; i++) {
	d3.select(list[i]).classed("bg-active", (i==curScene) ? true : false);
    }
    
    d3.select("#" + scenes[curScene].div).classed("show", true);

    curSceneTime = time;
    console.log(`initializeScene program: ${schedule[curProgram].program} scene: ${scenes[curScene].div} time left: ${(curSceneTime + scenes[curScene].duration) - time}`);
}

function rotateScene() {
    if (scenes.length == 0) {
	console.log("rotateScene called before scenes initialized");
	return;
    }
    
    const now = new Date();
    const time = Math.floor(now.getTime() / 1000);

    if (time < (curSceneTime + scenes[curScene].duration)) {
	return;
    }

    curScene = (curScene + 1) % scenes.length;

    if (highWindMode) {
	// squirrel away curScene - is this needed? can resume from curScene?
	highWindCurScene = curScene;
	return;
    }
    
    initializeScene(curScene);
}

function initializeProgram(p) {
    curProgram = p;
    program = schedule[curProgram].program
    console.log("Rotate Program to " + program);
    scenes = programs[program];
    curSceneTime = 0;
    curScene = scenes.length - 1;

    // Create scene list
    d3.select("#program").html(program);
    const list = d3.select("#scene-list");
    list.selectAll("*").remove();
    scenes.forEach(function(sc,i) {
	let b = list.append("div")
	    .attr('id', "scene-index-" + i)
	    .html(sc.label);
	if (sc.div == "") {
	    b.classed('scene-not-button', true);
	} else {
	    b.classed('scene-button', true).attr('tabindex', "0");
	}
    });
}

function rotateProgram() {
    const now = new Date();
    const m = now.getMinutes();

    let curStart = schedule[curProgram]["start"];
    let nextProgram = (curProgram+1) % schedule.length;
    let nextStart = schedule[nextProgram]["start"];
    let newProgram = curProgram;
    console.log(`rotateProgram: -${m} curProgram ${curProgram} curStart ${curStart} nextProgram ${nextProgram} nextStart ${nextStart}`);
    while (((m < curStart) && (m >= nextStart)) ||          // Time wrapped to next hour
	   ((nextStart >= curStart) && (m >= nextStart))) { // Not wrapping
	console.log(`rotateProgram: +${m} curProgram ${curProgram} curStart ${curStart} nextProgram ${nextProgram} nextStart ${nextStart}`);
	newProgram = nextProgram;
	curStart = nextStart;
	nextProgram = (newProgram+1) % schedule.length;
	nextStart = schedule[nextProgram]["start"];
    }

    if (newProgram != curProgram) {
	initializeProgram(newProgram);
    }
}

function setCarouselMode(m) {
    console.log("setCarouselMode to " + m);
    if (m == "Carousel") {
	window.mode = "Carousel";
      	d3.select("#mode-button")
	    .html("Auto");
	d3.selectAll("#scene-list>div")
	    .classed("active-scene", false)
	    .on('click', null);
    } else {
	window.mode = "Interactive";
      	d3.select("#mode-button")
	    .html("Interactive");
	d3.selectAll("#scene-list>div:not(.scene-not-button)")
	    .classed("active-scene", true)
	    .on('click', handleSceneClick);
    }
}

function handleSceneClick(e) {
    const id = e.target.id;
    const indexStart = id.lastIndexOf('-')+1;
    const index = parseInt(id.slice(indexStart));
    initializeScene(index);
}

function handleModeButton() {
    if (window.mode == "Carousel") {
	setCarouselMode("Interactive");
    } else {
	setCarouselMode("Carousel");
    }
}

function visibilityChange() {
    if (!document.hidden) {
	anemometer.render();
	//windPlotHistory("wind-history-recent", windHistory);
	plotTempestWindForecast("St. Francis Yacht Club");
	//plotTides();
	//plotCurrents();
    }
}

export function initialize() {
    console.log("Initializing wx page");

    let href = window.location.href;
    let queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    for (const [key, value] of urlParams) {
	console.debug(`Initialize: query '${key}' = '${value}'`)
    }

    d3.select(".highWindThreshhold").html(highWindThreshhold);
    d3.select(".highWindDuration").html(Math.floor(highWindDuration/1000));

    let k = urlParams.get('kiosk');
    let s = urlParams.get('schedule');
    if (k == null) {
	console.log("interactive mode");
	if (!(s in schedules)) s = "interactive";
	schedule = schedules[s];
	initializeProgram(0);
	d3.select("#mode-button")
	    .attr("style", "display: inline-grid")
	    .on('click', handleModeButton);
	setCarouselMode("Interactive");
	curScene = scenes.length - 1;
	rotateScene();
    } else {
	console.log("Kiosk mode");
	if (!(s in schedules)) s = "production";
	schedule = schedules[s];
	initializeProgram(0);
	setCarouselMode("Carousel");
	curScene = scenes.length - 1;
	d3.select("#site-url").style("display", "block");
	rotateScene();
    }

    nwsZoneInitialize([ "PZZ530", "PZZ545", "PZZ531" ], [ "KMTR"]);

    // Catch resize events for anemometer graphs because I'm too lame to get the svgs to scale
    windRO.observe(document.querySelector("#localWind"));

    tidesRO.observe(document.querySelector(".tides-graph"));
    currentsRO.observe(document.querySelector(".currents-graph"));

    anemometer = new Gauge('anemometer-stfyc', {
	classRoot: "anemometer-stfyc",
	maxValue: 30, // in knots
	arcColorFn: d3.interpolateHslLong("#613CFF", "#FB4B39"), // nice blue & red hues, gradient centers on green
	arcSegments: 512, // make dial a smooth rainbow
	arcMajorTicks: 5,
	arcLabelFormat: d3.format('d'),
	pointers: [
	    { pointerWidthPercent: 0.15, pointerHeadLengthPercent: 0.9, pointerTailPercent: 0.04, transitionMs: 1000, val: 0, },
	    { pointerWidthPercent: 0.10, pointerHeadLengthPercent: 0.9, pointerTailPercent: 0.02, transitionMs: 1000, val: 0, },
	],
    });

    // Use WebSocket for current? Tempest web service is flakey, so use all ways to get data
    fetchTempestCurrent("St. Francis Yacht Club");
    fetchTempestCurrent("Tinsley Island");
    fetchTempestHistory("St. Francis Yacht Club");
    fetchTempestForecast("St. Francis Yacht Club");

    initializeTempestStreams();

    wfstfyc = new WFForecast("wf-stfyc", "74155", "stfyc");
    wftinsley = new WFForecast("wf-tinsley", "42921", "tinsley");

    let windURL = "";
    if (typeof local_windURL !== 'undefined') {
	windURL = local_windURL;
    }
    windInitialize(windURL, stfycWindCallback);

    fetchTidesAndCurrents();

    // OpenLayers frames
    // initializeCurrentMap(currentMapConfig);
    /*
      initializeNowCOAST(nationalRadarConfig);
      initializeNowCOAST(localRadarConfig);
    */

    d3.interval(dispatch, 1 * 1000);
    document.addEventListener("visibilitychange", visibilityChange);

    const cloudTops = new GIS(cloudTopsConfig);
    const nationalRadar = new GIS(nationalRadarConfig);
    const nationalRadar2 = new GIS(nationalRadar2Config);
    const localRadar = new GIS(localRadarConfig);
    const localObsRadar = new GIS(NOAAObservationsConfig);
    const sst = new GIS(SSTConfig);
    const sstanomaly = new GIS(SSTanomalyConfig);
    const globalwind = new GIS(GlobalWindConfig);
    const globalwave = new GIS(GlobalWaveConfig);
    
    // Set up the spec to overlay the observations on the radar / hazards map
    const spec = {};
    spec.points = [];
    
    for (const [id, c] of Object.entries(NWSscrapeSites[0].stations)) {
	spec.points.push({"id": id, "lat": c.lat, "lon": c.lon, "txt": id});
    }
    localObsRadarStations = localObsRadar.initializeFeatures(spec);

    const scrape = new NWSscrape(NWSscrapeSites, scrapeCallback);
    
    initializeVideoLazyLoad();

    d3.selectAll("#scene-pull-down-enable")
	.on('click', handleScenePullDownClick);

    let aisurls = ["/ais/"];
    const aissources = urlParams.get('aissources'); // Kludge for testing
    
    if (aissources == 'all') {
	aisurls = ['wss://wx.stfyc-wx.com/ais/', 'wss://sdr.stfyc-wx.com/ais/'];
    }

    console.debug(`Setting AIS sources to ${aisurls}`);
    const ais = new AIS(aisurls, 'aischart', [37.832, -122.435], 14.3);
}
