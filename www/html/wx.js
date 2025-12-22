/* wx.js
 *
 * Bind together the pieces that make up the weather kiosk
 */

import { AIS } from "./ais.js";
import { nwsZoneInitialize, nwsZoneFetch } from "./NWSzones.js";
import { windInitialize, windPlotHistory, windStartStopHistory } from "./wind.js";
import { Gauge } from "./gauge.js";
import { GIS } from "./gis.js";
import { cloudTopsConfig, nationalRadarConfig, nationalRadar2Config, localRadarConfig, NOAAObservationsConfig, SSTConfig, SSTanomalyConfig, GlobalWindConfig, GlobalWaveConfig } from "./gisConfig.js";
import { WFForecast } from "./wfforecast.js";
import { NWSscrape } from "./NWSscrape.js";
import { fetchTidesAndCurrents } from "./tidesCurrents.js";
import { fetchTempestHistory, fetchTempestForecast, fetchTempestCurrent, plotTempestWindForecast, tempestCheck, initializeTempestStreams } from "./tempest.js";

const magnetic_declination = +13; // Actually 13.2 or so - should be in local_config.js?

let curScene = 0;
let curSceneTime;
let curProgram = 0;
let schedule;
let wfstfyc;
let wftinsley;

window.mode = "Carousel"; // Global variabl

const schedules = {
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
    "test": [
	{ "start": 0, "program": "Test" },
	{ "start": 30, "program": "Test" },
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
	{ "div": "nationalRadar2Scene", "label": "National Radar", "duration": 30 },
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
	//{ "div": "nationalRadarScene", "label": "National Radar", "duration": 30 },
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
	{ "div": "aisScene", "label": "AIS", "duration": 300 },
    ],
}

let scenes = [];

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

let localObsRadarStations = {};

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

/*
 * NOAA creates a set of small png charts from the SFBOFS.
 * We've tried using a GIS page with the current data, but it's not really worth
 * the effort since the time step is one hour - too coarse for a 6-hour tide cycle.
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

    /* 
    if (windsNeedRender) {
	plotTempestWindForecast("St. Francis Yacht Club");
    }
    */

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
    let program = schedule[curProgram].program
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

    // Fill in values in the "about" scene
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

    const localObsRadar = new GIS(NOAAObservationsConfig);
    //const nationalRadar = new GIS(nationalRadarConfig);
    const nationalRadar2 = new GIS(nationalRadar2Config);
    //const localRadar = new GIS(localRadarConfig);
    const cloudTops = new GIS(cloudTopsConfig);
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

    console.debug(`Initialize: AIS sources ${aisurls}`);
    const ais = new AIS(aisurls, 'aischart', [37.832, -122.435], 14.3);

    for (const el of document.querySelectorAll('.text-scene')) {
	const fn = el.getAttribute('w3-include-html');
	if (fn)
	    fetch(fn)
	    .then(response => response.text())
	    .then(text => el.innerHTML = text);
    }
}
