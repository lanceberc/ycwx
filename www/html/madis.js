import { BurgerMenuControl } from "./leaflet-burgermenu.js";

const circleRadius = 10; // Vessel circle radius in pixels
const circleDistance = 100; // Radius in meters
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

function K2F(k) {
    return (((k - 273.15) * (9.0/5.0)) + 32.0);
}

function MPH2KTS(k) {
    return(k/1.151);
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

function changeLabelFontSize(size) {
    if (size in fontSizes) {
	document.documentElement.style.setProperty("--madis-label-font-size", fontSizes[size]);
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

function SetBasemap(element, madis, nickname) {
    if (!(nickname in basemaps)) return;
    for (const bm of madis.base) bm.remove();
    madis.base = basemaps[nickname].create();
    for (const bm of madis.base) bm.addTo(madis.map);
}

const interestingVars = ["V-FF", "V-FFGUST", "V-DD", "V-T", "V-TD", "V-RH" ];
const interestingLabels = ["WSpd", "Gust", "Dir", "Temp", "DewP", "RelH"];

let stations = {}

class MADIS {
    constructor(urls, div, latlon, zoom) {
	const now = new Date();
	const time = now.format("HH:MM");

	const madis = this; // Isn't there a better way to get context into callbacks?
	
	this.stations = {};
	this.started = false;
	this.lastReap = Date.now();
	this.base = [];

	this.div = div;
	this.map = L.map(div, { zoomDelta: 0.1, zoomSnap: 0 }).setView(latlon, zoom);

	let queryString = window.location.search;
	const urlParams = new URLSearchParams(queryString);
	const fontSize = fontSizes[urlParams.get('madisfont')];
	if (fontSize) changeLabelFontSize(fontSize);

	let bm  = urlParams.get('madischart');
	if (!(bm in basemaps)) bm = "chart";
	SetBasemap(null, madis, bm);

	L.control.scale({maxWidth: 200}).addTo(this.map);
	
	const stations = this.stations;

	/*
	this.map.on('zoomend', function (ev) {
	    for (let station in stations) {
		stations[station].drawStation(false); // Zoom may cause vessel shape to change
		stations[station].drawLabel(false); // Move label to keep static distance from icon
	    }
	});
	*/

	const hn = window.location.hostname;
	const ipv4Regex = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}$/;
	const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
	const local = (ipv4Regex.test(hn) || ipv6Regex.test(hn));
	const maps = [];

	for (const nickName of basemapNicknames) {
	    if (local || !basemaps[nickName].local) 
		maps.push({
		    title: basemaps[nickName].label,
		    onClick: (e) => { SetBasemap(e, madis, nickName); },
		});
	}
	
	this.burger = L.control.burgerMenu({
	    title: "Settings",
	    menuItems: [
		{
		    title: "Font Size",
		    menuItems: [
			{ title: "Extra Large", onClick: () => { changeLabelFontSize("xl"); }, },
			{ title: "Large", onClick: () => { changeLabelFontSize("l"); }, },
			{ title: "Medium", onClick: () => { changeLabelFontSize("m"); }, },
			{ title: "Small", onClick: () => { changeLabelFontSize("s"); }, },
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
	let chart = document.getElementById(div);

	urls.forEach((u) => {
	    fetch(u)
		.then(response => response.json())
		.then(result => {
		    this.callback(result)
		})
	});
	
	/* No websocket to close when the window isn't drawn
	urls.forEach((u) => {
	    const ws = new AISwebsocket(this, u);
	    //ws.open(); // Let the resize observer open the websocket
	    this.ws.push(ws);
	});

	
	this.ro = new ResizeObserver((e) => {
	    const now = new Date();
	    const time = now.format("HH:MM");
	    const height = chart.offsetHeight;
	    console.debug(`madis: ${time} ResizeObserver '${div}' height ${height}`);
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
        */
    }

    callback(j) {
	const now = new Date();
	const time = now.format("HH:MM");

	let iconClass = `station-outline`;

	/*
	// console.log("ais: " + s);
	const j = JSON.parse(raw);
	*/

	const e = this.tsControl.getContainer();
	if (e) {
	    const d = new Date(Date.now());
	    const ts = d.format("HH:MM:ss.L");
	    e.innerText = "Data Fetched at " + ts;
	}

	const stations = this.stations;

	for (const id in j) {
	    let latlon = null;
	    if (("lat" in j[id]) && ("lon" in j[id])) {
		latlon = [j[id].lat, j[id].lon];
	    } else {
		continue;
	    }

	    if (!(id in stations)) {
		stations[id] = {}
	    }
	    const station = stations[id];
	    station.id = id;
	    station.latlon = latlon;
	    station.state = j[id];
	    
	    const shape = L.circle(latlon, {className: iconClass, radius: circleDistance} );
	    this.map.addLayer(shape);

	    const bounds = shape.getBounds();
	    const labelPoint = this.map.latLngToContainerPoint(bounds._northEast);
	    labelPoint.x += labelOffset;
	    const labellatlon = this.map.containerPointToLatLng(labelPoint);

	    const icon = L.divIcon({className: this.cssClass, html: `<span class="station-label-span">${station.id}</span>`});
	    const label = L.marker(labellatlon, {icon: icon}).bindTooltip('', {className: `vessel-tooltip ${this.debugID}`});
	    this.map.addLayer(label);

	    let s = id;

	    for (const v in interestingVars) {
		const vv = interestingVars[v];
		if (vv in j[id]) {
		    if ((vv == 'V-TD') || (vv == 'V-T')) {
			const f = K2F(parseFloat(j[id][vv]));
			s += `<br>${interestingLabels[v]} ${f.toFixed(1)}&deg;F`;
		    } else if (vv == 'V-RH') {
			const f = parseFloat(j[id][vv]);
			s += `<br>${interestingLabels[v]} ${f.toFixed(0)}%`;
		    } else if (vv == 'V-DD') {
			const f = parseFloat(j[id][vv]);
			s += `<br>${interestingLabels[v]} ${f.toFixed(0)}&deg;T`;
		    } else if ((vv == 'V-FF') || (vv == 'V-FFGUST')) {
			const f = MPH2KTS(parseFloat(j[id][vv]));
			s += `<br>${interestingLabels[v]} ${f.toFixed(1)}kts`;
		    } else {
			s += `<br>${interestingLabels[v]} ${j[id][vv]}`;
		    }
		}
	    }

	    const t = j[id]['obstime'];
	    const year = parseInt(t.substr(0,4));
	    const month = parseInt(t.substr(4,2)) - 1;
	    const day = parseInt(t.substr(6,2));
	    const hour = parseInt(t.substr(9,2));
	    const minute = parseInt(t.substr(11,2));
	    const d = new Date(Date.UTC(year, month, day, hour, minute));
	    const dd = d.format("mm/dd HH:MM Z");
	    s += `<br>${dd}`;
	    
	    label.setTooltipContent(s);
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

export { MADIS };
