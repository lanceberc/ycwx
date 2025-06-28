import { AISwebsocket } from "./aisws.js";
import { BurgerMenuControl } from "./leaflet-burgermenu.js";

const circleRadius = 10; // Vessel circle radius in pixels
const vectorArrow = 80; // Arrowhead width in meters
const minOutlinePixels = 10; // outlines must be this long to be drawn (else circles)
const labelOffset = 15;
const labelLonOffset = 0.001; // To the right
const labelLatOffset = -0.001; // Down
const kts2m = 1852;
const m2ft = 3.2808399;
const vesselFastTimeout = 300 * 1000; // delete on-the-move vessels faster as they go out of range
const vesselSlowTimeout = 900 * 1000; // let stationary vessels linger longer
const AtoNTimeout = 3600 * 1000; // give AtoNs a long, long time
const vesselFastSpeed = 1.0; // cutoff between fast and slow timeouts in knots
const vesselVectorMin = 0.50; // draw predictor vectors for boats with COG faster than this (in knots)
const reapFreq = 30 * 1000; // How often to check if vessels haven't been heard from
const debugShape = false;
const debugLabel = false;
const debugVector = false;
const debugReap = false;

let aisDebugID = -1;
function newDebugID() {
    aisDebugID = aisDebugID + 1;
    return(`debug-${aisDebugID}`);
}

const fontSizes = {
    's': "1.0rem",
    'm': "1.5rem",
    'l': "2.0rem",
    'xl': "2.5rem",
}

/* This control puts the time of the last AIS reception callback onto the map */
L.Control.LatestTimestamp = L.Control.extend(
    {
	onAdd: function(map) {
	    return L.DomUtil.create("span", "timestamp-span");
	},
	onRemove: function(map) {
	}
    }
)

function changeCSSproperty(selector, size) {
    const now = new Date();
    const time = now.format("HH:MM");
    
    if (size in fontSizes) {
	// Look though document style sheets for the selector - .vessel-label-span lives in ais.css
	// This is causing some cross-origin errors that we catch
	for (let ss = 0; ss < document.styleSheets.length; ss++) {
	    try {
		const prop = [...document.styleSheets[ss].cssRules].find((r) => r.selectorText === selector,);
		if (prop)
		    prop.style.setProperty("font-size", fontSizes[size]);
	    }
	    catch({name, error}) {
		console.debug(`ais: ${time} error accessing styleSheet[${ss}] '${name}' '${error}'`);
	    }
	}
    }
}

// NOAA Maritime Chart layers:
//  0 - Information about the chart display
//  1 - Natural and man-made features, port features
//  2 - Depths, currents, etc
//  3 - Seabed, obstructions, pipelines
//  4 - Traffic routes
//  5 - Special areas
//  6 - Buoys, beacons, lights, fog signals, radar
//  7 - Services and small craft facilities
//  8 - Data quality
//  9 - Low accuracy
// 10 - Additional chart information
// 11 - Shallow water pattern
// 12 - Overscale warning

function NOAAChart() {
    return([
	L.tileLayer.wms(
	    'https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/NOAAChartDisplay/MapServer/exts/MaritimeChartService/WMSServer?',
	    {
		layers: [0,1,2,4,6],
		attribution: 'Basemap from <a href="https://www.noaa.gov">NOAA</a>'
	    }
	),
    ]);
}

// GEBCO Bathymetry Chart layers
//  0 - Polygon Features
//  1 - Line Features
//  2 - Point Features
function GEBCOFeatures() {
    return([
	L.tileLayer.wms(
	    'https://gis.ngdc.noaa.gov/arcgis/services/IHO/undersea_features/MapServer/WMSServer?',
	    {
		layers: [0,1,2],
		attribution: 'Basemap from <a href="https://www.gebco.net">GEBCO</a>/<a href="https://www.noaa.gov">NOAA</a>'
	    }
	),
    ]);
}

// https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer/tile
function ESRIOceanBase() {
    return([
	L.tileLayer(
	    'https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
	    {
		layers: [0],
		attribution: 'Basemap from <a href="https://www.esri.com">ESRI</a>'
	    }
	),
    ]);
}

function ESRITerrain() {
    return([
	L.tileLayer(
	    'http://services.arcgisonline.com/arcgis/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}',
	    {
		attribution: 'Basemap from <a href="https://www.esri.com">ESRI</a>'
	    }
	),
    ]);
}

function ESRILightGrey() {
    return([
	L.tileLayer(
	    'http://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
	    {
		attribution: 'Basemap from <a href="https://www.esri.com">ESRI</a>'
	    }
	),
    ]);
}

function OSMMapnik() {
    return([
	L.tileLayer(
	    'http://{s}.tile.osm.org/{z}/{x}/{y}.png',
	    {
		attribution: 'Basemap from <a href="https://www.osm.org">Open Street Map</a>'
	    }
	),
    ]);
}

function ESRINatGeo() {
    return([
	L.tileLayer(
	    'http://services.arcgisonline.com/arcgis/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
	    {
		attribution: 'Basemap from <a href="https://www.esri.com">ESRI</a>'
	    }
	),
    ]);
}

// https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/tile/8/96/37?blankTile=false
function USGSHydro() {
    return([
	L.tileLayer(
	    'https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/tile/{z}/{y}/{x}',
	    {
		attribution: 'USGS National Map: National Hydrography Dataset'
	    }
	),
    ]);
}

function StamenWaterColor() {
    return([
	L.tileLayer(
	    'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
	    {
		attribution: [
                    '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a>',
                    '&copy; <a href="https://stamen.com/" target="_blank">Stamen Design</a>',
                    '&copy; <a href="https://www.openstreetmap.org/about/" target="_blank">OpenStreetMap contributors</a>',
		],
	    },
	),
    ]);
}

function StamenTerrain() {
    return([
	L.tileLayer(
	    'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.jpg',
	    {
		attribution: [
                    '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a>',
                    '&copy; <a href="https://stamen.com/" target="_blank">Stamen Design</a>',
                    '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a>',
                    '&copy; <a href="https://www.openstreetmap.org/about/" target="_blank">OpenStreetMap contributors</a>',
		],
	    },
	),
    ]);
}


const basemapNicknames = ["chart", "hydro", "grey", "osm", "natgeo", "ocean", "watercolor", "terrain"];
const basemaps = {
    "chart": { "label": "Chart", "create": NOAAChart, "local": false },
    "ocean": { "label": "Ocean", "create": ESRIOceanBase, "local": false },
    //"terrain": { "label": "Terrain", "create": ESRITerrain },
    "grey": { "label": "Light Grey", "create": ESRILightGrey, "local": false },
    "osm": { "label": "Mapnik", "create": OSMMapnik, "local": false },
    "natgeo": { "label": "NatGeo", "create": ESRINatGeo, "local": false },
    "hydro": { "label": "Hydro", "create": USGSHydro, "local": false },
    "watercolor": { "label": "Watercolor", "create": StamenWaterColor, "local": true },
    "terrain": { "label": "Terrain", "create": StamenTerrain, "local": true },
}

function SetBasemap(element, ais, nickname) {
    if (!(nickname in basemaps)) return;
    for (const bm of ais.base) bm.remove();
    ais.base = basemaps[nickname].create();
    for (const bm of ais.base) bm.addTo(ais.map);
}

class AIS {
    constructor(urls, div, latlon, zoom) {
	const now = new Date();
	const time = now.format("HH:MM");

	const ais = this; // Isn't there a better way to get context into callbacks?
	
	this.vessels = {};
	this.started = false;
	this.lastReap = Date.now();
	this.base = [];

	this.div = div;
	this.map = L.map(div, { zoomDelta: 0.1, zoomSnap: 0 }).setView(latlon, zoom);

	let queryString = window.location.search;
	const urlParams = new URLSearchParams(queryString);
	const fontSize = urlParams.get('font');
	if (fontSize) changeCSSproperty(".vessel-label-span", fontSize);

	let bm  = urlParams.get('base');
	if (!(bm in basemaps)) bm = "chart";
	SetBasemap(null, ais, bm);

	L.control.scale({maxWidth: 200}).addTo(this.map);
	
	const vessels = this.vessels;
	this.map.on('zoomend', function (ev) {
	    //const now = new Date();
	    //const time = now.format("HH:MM");
	    //console.debug(`ais: ${time} Zoom end ` + this.map.getZoom());
	    for (let v in vessels) {
		vessels[v].drawVessel(false); // Zoom may cause vessel shape to change
		vessels[v].drawLabel(false); // Move label to keep static distance from icon
	    }
	});

	const hn = window.location.hostname;
	const ipv4Regex = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}$/;
	const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
	const local = (ipv4Regex.test(hn) || ipv6Regex.test(hn));
	const maps = [];

	for (const nickName of basemapNicknames) {
	    if (local || !basemaps[nickName].local) 
		maps.push({
		    title: basemaps[nickName].label,
		    onClick: (e) => { SetBasemap(e, ais, nickName); },
		});
	}
	
	this.burger = L.control.burgerMenu({
	    title: "Settings",
	    menuItems: [
		{
		    title: "Font Size",
		    menuItems: [
			{ title: "Extra Large", onClick: () => { changeCSSproperty(".vessel-label-span", "xl"); }, },
			{ title: "Large", onClick: () => { changeCSSproperty(".vessel-label-span", "l"); }, },
			{ title: "Medium", onClick: () => { changeCSSproperty(".vessel-label-span", "m"); }, },
			{ title: "Small", onClick: () => { changeCSSproperty(".vessel-label-span", "s"); }, },
		    ],
		},
		{
		    title: "Basemap",
		    menuItems: maps,
		}
	    ],
	}).addTo(this.map);

	this.tsControl = new L.Control.LatestTimestamp({position: 'bottomleft'}).addTo(this.map);

	this.ws = [];
	urls.forEach((u) => {
	    const ws = new AISwebsocket(this, u);
	    //ws.open(); // Let the resize observer open the websocket
	    this.ws.push(ws);
	});

	let chart = document.getElementById(div);
	this.ro = new ResizeObserver((e) => {
	    const now = new Date();
	    const time = now.format("HH:MM");
	    const height = chart.offsetHeight;
	    console.debug(`ais: ${time} ResizeObserver '${div}' height ${height}`);
	    ais.ws.forEach((ws) => {
		if (height == 0)
		    ws.close();
		else {
		    ws.open();
		    // do something to force a redraw?
		    setTimeout(function () {
			window.dispatchEvent(new Event("resize"));
		    }, 500);
		}
	    });
	});

	if (!(urlParams.get('aisbg') == "true")) {
	    document.addEventListener("visibilitychange", function() {
		ais.ws.forEach((ws) => {
		    if (document.hidden)
			ws.close();
		    else {
			ws.open();
			// do something to force a redraw?
			setTimeout(function () {
			    window.dispatchEvent(new Event("resize"));
			}, 500);
		    }
		});
	    });
	}

	this.ro.observe(chart);
    }

    // AIS data is sent to the web page via a websocket
    callback(s) {
	const now = new Date();
	const time = now.format("HH:MM");
	
	// console.log("ais: " + s);
	const j = JSON.parse(s);

	const e = this.tsControl.getContainer();
	if (e) {
	    const d = new Date(Date.now());
	    const ts = d.format("HH:MM:ss.L");
	    e.innerText = "Last AIS " + ts;
	}

	const mmsi = j.mmsi;
	let latlon = null;
	if (("lat" in j) && ("lon" in j)) latlon = [j.lat, j.lon];
    
	if (!(mmsi in this.vessels) && latlon) this.vessels[mmsi] = new Vessel(this, mmsi, latlon);

	const v = this.vessels[mmsi];

	// Detect if the shiptype or shipname have changed
	const retype = (("shiptype" in j) && (j.shiptype != v.shiptype)) || !v.cssClass;
	const newAtoN = ("aidType" in j) && !("aidType" in v);
	const shipname = (("shipname" in j) && (j.shipname != '')) ? j.shipname : ((!v.shipname)? mmsi.toString() : v.shipname);
	const relabel = (v.shipname != shipname);

	// Save updated fields in the vessel
	v.latlon = latlon;
	v.last = Date.now();
	if (relabel) {
	    if (debugLabel) console.debug(`ais: ${time} relabel ${v.mmsi} name '${v.shipname}' -> '${shipname}' ${v.debugID}`);
	    v.shipname = shipname;
	}
	const copyAttrs = ['shiptype', 'shiptypeText', 'destination', 'toBow', 'toStern', 'toPort', 'toStarboard', 'speed', 'course', 'heading', 'aidType'];
	for (let i in copyAttrs) {
	    const attr = copyAttrs[i];
	    if ((attr in j) && ((!attr in v) || (v[attr] != j[attr]))) {
		v[attr] = j[attr]; // only copy if the attr has changed
	    }
	}

	if (relabel || retype || newAtoN) {
	    const oldDebugID = v.debugID;
	    v.debugID = newDebugID();
	    if (debugLabel|debugShape|debugVector) console.debug(`ais: ${time} debugID ${v.mmsi} '${v.shipname}' ${oldDebugID} -> ${v.debugID}`);
	    if (!latlon) {
		console.log(`ais: ${time} debugID ${v.mmsi} '${v.shipname}' no latlon`);
	    }
	}
	
	if (retype || newAtoN) {
	    v.oldVesselTypeClass = v.cssVesselTypeClass;
	    v.cssVesselTypeClass = (v.shiptype in vesselTypeMap) ? `vessel-type-${vesselTypeMap[v.shiptype]}` : null;
	    if (newAtoN) v.cssVesselTypeClass = "vessel-AtoN";
	    if (!v.cssVesselTypeClass) v.cssVesselTypeClass = "vessel-type-unknown";
	    v.cssClass = v.cssVesselTypeClass + " " + v.debugID;
	    if (debugLabel|debugShape|debugVector) console.debug(`ais: ${time} retype ${v.mmsi} ${v.shipname} ${v.shiptype} '${v.cssClass}'`);
	}
    
	if ("speed" in j) v.speed = j.speed;
    
	if (latlon) {
	    v.drawVessel(retype||newAtoN); // new report so vessel has probably moved
	    v.drawLabel(relabel || retype || newAtoN); // redraw if the name or type have changed
	    v.drawVector(retype);
	    v.tooltip();
	}
	this.reap();
    }

    reap() {
	const ts = Date.now();
	const now = new Date();
	const time = now.format("HH:MM");

	if (ts - this.lastReap < reapFreq) return;
	this.lastReap = ts;
	
	for (const mmsi in this.vessels) {
	    let v = this.vessels[mmsi]
	    let timeout = vesselSlowTimeout;
	    if (v.speed > vesselFastSpeed) timeout = vesselFastTimeout;
	    if (mmsi > 990000000) timeout = AtoNTimeout;
	    if (now - v.last > timeout) {
		v.reap();
		v = null;
		delete this.vessels[mmsi];
	    }
	}
    }
}

// Put this function at the end of the script section because the quotes sometimes mess up text highlighting
function sanitizeString(input) {
    // Get rid of leading spaces and double spaces?
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;', /* "'" */
        '`': '&#96;'
    };
    return input.replace(/[&<>"'`]/g, function (match) {
        return map[match];
    });
}

/* The ship outline routine is from AIS-Catcher */
/* offset/move math is from Geodesy via AIS-Catcher */

// we calculate the lat/lon for 1m move in direction of heading
// underlying calculation uses an offset of 100m and then scales down to 1.
const cos100R = 0.9999999998770914; // cos(100m / R);
const sin100R = 1.567855942823164e-5; // sin(100m / R)
const rad = Math.PI / 180;
const radInv = 180 / Math.PI;

function calcOffset1M(coordinate, heading) {
    const lat = coordinate[0] * rad;
    const rheading = ((heading + 360) % 360) * rad;
    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);

    let sinLat2 = sinLat * cos100R + cosLat * sin100R * Math.cos(rheading);
    let lat2 = Math.asin(sinLat2);
    let deltaLon = Math.atan2(Math.sin(rheading) * sin100R * cosLat, cos100R - sinLat * sinLat2);
    
    return [(lat2 * radInv - coordinate[0]) / 100, (deltaLon * radInv) / 100];
}

function calcMove(coordinate, delta, distance) {
    return [coordinate[0] + delta[0] * distance, coordinate[1] + delta[1] * distance];
}

const vesselTypeMap = {
    6: "passenger",
    20: "cargo", /* Wing in Ground */
    21: "hazardous-cargo", /* WIG - Wing in Ground - Hazardous A */
    22: "hazardous-cargo", /* WIG - Wing in Ground - Hazardous B */
    23: "hazardous-cargo", /* WIG - Wing in Ground - Hazardous C */
    24: "hazardous-cargo", /* WIG - Wing in Ground - Hazardous D */
    30: "fishing",
    31: "towing",
    32: "towing", /* length exceeds 200m or breadth exceeds 25m */
    33: "dredging",
    34: "diving",
    35: "military",
    36: "sailing", /* */
    37: "pleasure",
    40: "high-speed", /* probably a ferry */
    41: "high-speed", /* Hazardous A */
    42: "high-speed", /* Hazardous B */
    43: "high-speed", /* Hazardous C */
    44: "high-speed", /* Hazardous D */
    50: "pilot",
    51: "SAR", /* Search and Rescue */
    52: "tug",
    53: "port-tender",
    54: "anti-pollution",
    55: "anti-pollution",
    55: "law-enforcement",
    57: "local",
    58: "medical",
    59: "non-combatant",
    60: "passenger",
    61: "passenger", /* Hazardous A */
    62: "passenger", /* Hazardous B */
    63: "passenger", /* Hazardous C */
    64: "passenger", /* Hazardous D */
    69: "passenger", /* superyacht? */
    70: "cargo",
    71: "hazardous-cargo", /* Hazardous A */
    72: "hazardous-cargo", /* Hazardous B */
    73: "hazardous-cargo", /* Hazardous C */
    74: "hazardous-cargo", /* Hazardous D */
    79: "cargo",
    80: "tanker",
    81: "tanker", /* Hazardous A */
    82: "tanker", /* Hazardous B */
    83: "tanker", /* Hazardous C */
    84: "tanker", /* Hazardous D */
    89: "tanker",
    90: "other",
    91: "other", /* Hazardous A */
    92: "other", /* Hazardous B */
    93: "other", /* Hazardous C */
    94: "other", /* Hazardous D */
    99: "other", /* other - but seen in SF Bay as ferry */
    8000: "passenger",
    8400: "tug",
};

class Vessel {
    constructor(ais, mmsi, latlon) {
	//console.log("ais: New vessel " + mmsi);
	this.ais = ais;
	this.mmsi = mmsi;
	this.latlon = latlon;
	this.shape = null;
	this.shipname = null;
	this.label = null;
	this.vector = [];
	this.first = Date.now();
	this.last = Date.now();
	this.shapeIsCircle = null;
	this.debugID = newDebugID();
	this.oldVesselTypeClass = null;
    }
    
    drawVessel(redraw) {
	const now = new Date();
	const time = now.format("HH:MM");
	const latlon = this.latlon;
	let iconClass = `${this.cssClass} ${this.debugID} vessel-outline`;
	let to_bow, to_stern, to_port, to_starboard;

	let heading = (("heading" in this) && (this.heading != 511)) ? this.heading : null;
	if (!heading && (this.course != null) && (this.speed > vesselVectorMin)) heading = this.course;

	let isCircle = !heading;
	isCircle = isCircle || !(("toBow" in this) && ("toStern" in this) && ("toPort" in this) && ("toStarboard" in this));
	if (!isCircle) {
	    to_bow = this.toBow;
	    to_stern = this.toStern;
	    to_port = this.toPort;
	    to_starboard = this.toStarboard;
	}
	isCircle = isCircle || (to_bow == null || to_stern == null || to_port == null || to_starboard == null);
	isCircle = isCircle || (to_bow == 0 || to_stern == 0 || to_port == 0 || to_starboard == 0);
	
	const circleCenter = this.ais.map.latLngToContainerPoint(this.latlon);
	let circleEdge = new L.point();
	circleEdge.x = circleCenter.x + circleRadius;
	circleEdge.y = circleCenter.y;
	const circleEdgeLatLon = this.ais.map.containerPointToLatLng(circleEdge);
	const circleDistance = this.ais.map.distance(this.latlon, circleEdgeLatLon);
	
	/* Draw when outline is longer than circle diameter */
	isCircle = isCircle || ((to_bow + to_stern) < circleDistance * 2)

	const changeShape = isCircle != this.shapeIsCircle;

	// Discard/create objects only when necessary
	if (redraw || changeShape) {
	    if (this.shape) {
		this.ais.map.removeLayer(this.shape);
		//this.shape.remove();
		//delete this.shape;
		this.shape = null;
	    }
	}

	if (isCircle) {
	    if (!this.shape) {
		if (debugShape) console.debug(`ais: ${time} circle ${this.shipname} ${this.debugID}`);
		this.shape = L.circle(this.latlon, {className: iconClass, radius: circleDistance});
		this.ais.map.addLayer(this.shape);
	    } else {
		this.shape.setRadius(circleDistance);
		this.shape.setLatLng(this.latlon);
	    }
	} else {
	    // approximate - use the lat/lon offsets per meter from latlon - good enough for short distances
	    const deltaBow = calcOffset1M(this.latlon, heading % 360);
	    const deltaStarboard = calcOffset1M(this.latlon, (heading + 90) % 360);

	    const bow = calcMove(this.latlon, deltaBow, to_bow);
	    const stern = calcMove(this.latlon, deltaBow, -to_stern);

	    const A = calcMove(stern, deltaStarboard, to_starboard);
	    const B = calcMove(stern, deltaStarboard, -to_port);
	    const C = calcMove(B, deltaBow, 0.8 * (to_bow + to_stern));
	    const Dmid = calcMove(C, deltaStarboard, 0.5 * (to_starboard + to_port));
	    const D = calcMove(Dmid, deltaBow, 0.2 * (to_bow + to_stern));
	    const E = calcMove(C, deltaStarboard, to_starboard + to_port);

	    if (!this.shape) {
		if (debugShape) console.debug(`ais: ${time} shape ${this.shipname} ${this.debugID}`);
		this.shape = L.polygon([A, B, C, D, E], {className: iconClass});
		this.ais.map.addLayer(this.shape);
	    } else {
		this.shape.setLatLngs([A, B, C, D, E]);
	    }
	} 

	this.shapeIsCircle = isCircle;
    }

    drawLabel(redraw) {
	const now = new Date();
	const time = now.format("HH:MM");

	if (!this.shipname) return;
	
	const bounds = this.shape.getBounds();
	const labelPoint = this.ais.map.latLngToContainerPoint(bounds._northEast);
	labelPoint.x += labelOffset;
	const labellatlon = this.ais.map.containerPointToLatLng(labelPoint);
	
	if (!this.label) {
	    if (this.shipname != this.labelString) this.labelString = sanitizeString(this.shipname);
	    if (debugLabel) console.debug(`ais: ${time} label ${this.mmsi} ${this.shipname} ${this.debugID}`);
	    const icon = L.divIcon({className: this.cssClass, html: `<span class="vessel-label-span ${this.debugID}">${this.labelString}</span>`});
	    this.label = L.marker(labellatlon, {icon: icon}).bindTooltip('', {className: `vessel-tooltip ${this.debugID}`});
	    this.ais.map.addLayer(this.label);
	    this.label.mmsi = this.mmsi;
	    this.label.debugID = this.debugID;
	    this.label.on('click', function(e) {
		const mmsi = e.target.mmsi;
		const url = 'https://www.vesselfinder.com/vessels/details/' + mmsi;
		//const url = 'https://www.marinetraffic.com/en/ais/details/ships/mmsi:' + mmsi;
		const urlTargetWindow ='_vessel' + mmsi;
		window.open(url, urlTargetWindow);
	    });
	} else {
	    if (redraw) {
		// Deleting / recreating the label was leaving turds so reuse existing label
		if (debugLabel) console.debug(`ais: ${time} label redraw ${this.mmsi} ${this.shipname} ${this.label.debugID} -> ${this.debugID}`);
		this.label.debugID = this.debugID;
		this.labelString = sanitizeString(this.shipname);
		const el = this.label.getElement();
		el.firstChild.innerText = this.labelString;
		if (this.oldVesselTypeClass) {
		    if (debugLabel) console.debug(`ais: ${time} label redraw ${this.mmsi} ${this.shipname} del ${this.oldVesselTypeClass}`);
		    el.classList.remove(this.oldVesselTypeClass);
		}
		el.classList.add(this.cssVesselTypeClass);
		if (debugLabel) console.debug(`ais: ${time} label redraw ${this.mmsi} ${this.shipname} add ${this.cssVesselTypeClass}`);
	    }
	    this.label.setLatLng(labellatlon);
	}
    }

    // Draw a 6 minute vector with ticks every minute (and a longer tick at 3 minutes)
    drawVector(redraw) {
	const now = new Date();
	const time = now.format("HH:MM");
	if (redraw || !this.latlon || !("speed" in this) || !("course" in this) || (this.speed < vesselVectorMin)) {

	    if (this.vector.length > 0) {
		let reason = "";
		if (redraw) reason += "[redraw]";
		if (!this.latlon) reason += "[no latlon]";
		if (!("speed" in this)) reason += "[no speed]";
		if (!("course" in this)) reason += "[no course]";
		if (("speed" in this) && (this.speed < vesselVectorMin)) reason += `[${this.speed} < ${vesselVectorMin}]`;
		if (debugVector) console.debug(`ais: ${time} delete vector ${this.shipname} length: ${this.vector.length} reason: ${reason}`);
	    }
	    
	    while (this.vector.length > 0) {
		let v = this.vector.pop()
		this.ais.map.removeLayer(v);
		v.remove();
		//delete v;
	    }
	    if (!this.latlon || !("speed" in this) || !("course" in this) || (this.speed < vesselVectorMin)) {
		return;
	    }
	}

	if (debugVector && !this.vector) {
	    const now = new Date();
	    const time = now.format("HH:MM");
	    console.debug(`ais: ${time} add vector to ${this.shipname} redraw: ${redraw} speed: ${this.speed}`);
	}

	// Motion vectors have 8 segments - the vector, 5 ticks, and 2 arrowheads
        const dir = (this.course != 360.0) ? this.course : ((this.heading != 511) ? this.heading : this.course);
        const meters = this.speed * (kts2m / 10); // 1/10th of an hour is a six minute vector

	// approximate - use the lat/lon offsets per meter from latlon - good enough for short distances
	const deltaForward = calcOffset1M(this.latlon, dir % 360);
	const deltaPerpendicular = calcOffset1M(this.latlon, (dir + 90) % 360);

	const head = calcMove(this.latlon, deltaForward, meters);

	const reuse = (this.vector.length != 0);

	// Check that existing vectors have 8 segments
	if (reuse && (this.vector.length != 8)) if (debugVector) console.debug(`ais: ${time} ${this.shipname} vector length ${this.vector.length}`)

	if (reuse) {
	    this.vector[0].setLatLngs([this.latlon, head]);
	} else {
	    if (debugVector) console.debug(`ais: ${time} vector ${this.shipname} ${this.debugID}`);
	    this.vector.push(L.polyline([this.latlon, head], {className: `${this.cssClass} ${this.debugID} vessel-vector`}).addTo(this.ais.map));
	}

	// Draw ticks w/ 3-minute tick twice as long
	for (let tick = 1; tick < 6; tick++) {
	    const tickLength = (tick == 3) ? vectorArrow / 2 : vectorArrow / 4;
	    const dist = (meters * tick) / 6.0;
	    const mid = calcMove(this.latlon, deltaForward, dist);
	    const t1 = calcMove(mid, deltaPerpendicular, tickLength);
	    const t2 = calcMove(mid, deltaPerpendicular, -tickLength);
	    if (reuse) {
		this.vector[tick].setLatLngs([t1, t2]);
	    } else {
		this.vector.push(L.polyline([t1, t2], {className: this.cssClass + " vessel-vector-tick"}).addTo(this.ais.map));
	    }
	}

	const tickLength = vectorArrow / 2;
	const dist = meters - vectorArrow; // back of arrowhead is arrowhead width back from end of vector
	const mid = calcMove(this.latlon, deltaForward, dist);
	const left = calcMove(mid, deltaPerpendicular, tickLength);
	const right = calcMove(mid, deltaPerpendicular, -tickLength);
	if (reuse) {
	    this.vector[6].setLatLngs([head, left]);
	    this.vector[7].setLatLngs([head, right]);
	} else {
	    this.vector.push(L.polyline([head, left], {className: this.cssClass + " vessel-vector"}).addTo(this.ais.map));
	    this.vector.push(L.polyline([head, right], {className: this.cssClass + " vessel-vector"}).addTo(this.ais.map));
	}
    }

    tooltip() {
	const AtoN = ("aidType" in this);
	let s = this.labelString;
	const hasSpeed = ("speed" in this);
	const hasCourse = ("course" in this);
	if (!AtoN && (hasSpeed || hasCourse)) {
	    s += "<br>"
	    if (hasCourse) s += `${this.course.toFixed(0)}&deg;`;
	    if (hasSpeed && hasCourse) s += " @ ";
	    if (hasSpeed) s += `${this.speed.toFixed(1)}kts`;
	}

	if (!AtoN && "heading" in this) s += "<br>Hdg " + this.heading;
	if (!AtoN && "shiptype" in this) s += "<br>Type " + this.shiptype;
	if (AtoN) s += "<br>AtoN " + this.aidType;
	if ("shiptypeText" in this) s += "<br>" + this.shiptypeText;
	if (("toBow" in this) && ("toStern" in this) && ("toPort" in this) && ("toStarboard" in this)) {
	    const length = (this.toBow + this.toStern) * m2ft;
	    const beam = (this.toPort + this.toStarboard) * m2ft;
	    if (length != 0) s += "<br>Length " + length.toFixed(0) + "ft";
	    if (beam != 0) s += "<br>Beam " + beam.toFixed(0) + "ft";
	    //s += "<br>B " + this.toBow + " S " + this.toStern + " P " + this.toPort + " S " + this.toStarboard;
	}
	if (("destination" in this) && (this.destination != '')) s += "<br>Dest " + sanitizeString(this.destination);
	s += '<br>MMSI ' + this.mmsi;
	
	const d = new Date(this.last);
	const ts = d.format("HH:MM:ss");
	s += "<br>Last " + ts;

	this.label.setTooltipContent(s);
    }

    reap() {
	const now = new Date();
	const time = now.format("HH:MM");
	
	console.debug(`ais: ${time} reap ${this.mmsi} '${this.shipname}' ${this.debugID} (` + parseInt((now - this.last) / 1000) + `) ${this.speed}kts`);
	//if (debugReap||debugVector) console.debug(`ais: ${time} reap vector ${this.mmsi} ${this.shipname} length: ${this.vector.length}`);
	while (this.vector.length > 0) {
	    let l = this.vector.pop();
	    this.ais.map.removeLayer(l);
	    l.remove();
	}

	if (this.label) {
	    const tt = this.label.getTooltip();
	    if ( tt != null) {
		this.label.unbindTooltip();
		
	    }
	    const el = this.label.getElement()
	    if (debugReap||debugLabel) {
		const cl = el.classList;
		console.debug(`ais: ${time} label reap ${this.mmsi} ${this.shipname} ${this.label.debugID} -> ${this.debugID} '${cl}' '${el.firstChild.innerText}'`);
		//el.remove();
	    }
	    el.firstChild.remove(); // deletes label span and text
	    /*
	    const m = this.ais.map;
	    const l = this.label;
	    setTimeout(() => { m.removeLayer(l);} );
	    */
	    if (!this.ais.map.hasLayer(this.label)) console.error(`ais: ${time} reap turd ${this.mmsi} ${this.shipname} ${this.label.debugID}`);
	    this.ais.map.removeLayer(this.label);
	    //delete this.label;
	    this.label = null;
	}
	//if (debugReap||debugShape) console.debug(`ais: ${time} reap shape${this.mmsi} ${this.shipname} length: ${this.vector.length}`);
	if (this.shape) {
	    this.ais.map.removeLayer(this.shape);
	    //this.shape.remove();
	    //delete this.shape;
	    this.shape = null;
	}
    }
}

export { AIS };
