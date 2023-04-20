// Definitions for the various GIS-based maps

const crossorigin='';
//const crossorigin = "anonymous";

// GIS adds a layer created in Javascript for the observation text boxes
const NOAAObservationsConfig = {
    container: "NOAAObservations",
    label: "NOAAObservationsLabel",
    center: [-122.43, 37.82], // San Francisco
    zoom: 12,
    updateFrequency: 1 * 60 * 1000,
    classRoot: "localObservation",
    layers: [
	{
	    //type: 'ArcGISRest',
	    type: 'XYZ',
	    url: 'https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer',
	},
    ],
}

const nationalRadarConfig = {
    container: "nationalRadar",
    label: "nationalRadarLabel",
    center: [-97.95, 38.91], // Longitude, latitude - Middle of Kansas,
    zoom: 5,
    updateFrequency: 1 * 60 * 1000, // GIS class hardcodes updates every 10 minutes but we'll poll once a minute
    layers: [
	{
	    type: 'ArcGISRest',
	    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer',
	},
	{
	    type: 'ArcGISRest',
	    url: 'https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity_time/ImageServer',
	    updateFrequency: 5 * 60 * 1000,
	},
    ],
}

const nationalRadar2Config = {
    container: "nationalRadar2",
    label: "nationalRadar2Label",
    center: [-97.95, 38.91], // Longitude, latitude - Middle of Kansas,
    zoom: 5,
    updateFrequency: 1 * 60 * 1000, // GIS class hardcodes updates every 10 minutes but we'll poll once a minute
    layers: [
	{
	    type: "ArcGISRest",
	    url: 'https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer',
	    params: {
		'CRS': '3857',
	    },
	},
	{
	    type: "ArcGISRest",
	    url: 'https://carto.nationalmap.gov/arcgis/rest/services/govunits/MapServer',
	    params: {
		'layers': 'show:21',
		'CRS': '3857',
	    },
	},
	{
	    type: 'ArcGISRest',
	    url: 'https://mapservices.weather.noaa.gov/eventdriven/rest/services/WWA/watch_warn_adv/MapServer',
	    updateFrequency: 30 * 60 * 1000,
	    params: {
		'CRS': '3857',
	    },
	    cssClass: "ol-semi-transparent",
	},
	{
	    type: 'ArcGISRest',
	    url: 'https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity_time/ImageServer',
	    params: {
		'CRS': '3857',
	    },
	    updateFrequency: 5 * 60 * 1000,
	},
	/*
	{
	    type: 'ArcGISRest',
	    url: 'https://ibasemaps-api.arcgis.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer',
	    params: {
		'TOKEN': esri_apikey,
	    }
	},
	*/
	/*
	{
	    type: 'WMS',
	    url: 'https://nowcoast.noaa.gov/geoserver/alerts/wms',
	    updateFrequency: 5 * 60 * 1000,
	    params: {
		'LAYERS': 'watches_warnings_advisories',
		'FORMAT': 'image/png',
		//'CRS': 'EPSG:3857',
	    },
	    cssClass: "ol-semi-transparent",
	},
	{
	    type: 'WMS',
	    url: 'https://nowcoast.noaa.gov/geoserver/weather_radar/wms',
	    updateFrequency: 5 * 60 * 1000,
	    params: {
		'LAYERS': 'base_reflectivity_mosaic',
		'FORMAT': 'image/png',
		'CRS': '3857',
	    },
	},
	*/
    ],
}

const localRadarConfig = {
    container: "localRadar",
    label: "localRadarLabel",
    center: [-122.43, 37.82], // San Francisco
    zoom: 7,
    updateFrequency: 1 * 60 * 1000, // GIS class hardcodes updates every 10 minutes but we'll poll once a minute
    layers: [
	{
	    type: 'XYZ',
	    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean_Basemap/MapServer',
	    updateFrequency: 15 * 60 * 1000,
	},
	{
	    type: "WMS",
	    url: 'https://nowcoast.noaa.gov/arcgis/services/nowcoast/wwa_meteoceanhydro_longduration_hazards_time/MapServer/WmsServer',
	    params: {
		//'LAYERS': '1,4,10,13,17,20,24,27,31,34,38,41,6,7,1,2',
		'LAYERS': '1,2,4,5,7,8,10,11,13,14,17,18,20,21,24,25,27,28,31,32,34,35,38,39,41,42',
		'FORMAT': 'image/png',
		crossOrigin: crossorigin,
	    },
	    service: 'wwa_meteoceanhydro_longduration_hazards_time',
	    timeStopLayers: '0,2,3,5,6,7,9,10,12,13,16,19,21,23,24,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42',
	    cssClass: "ol-semi-transparent",
	    updateFrequency: 10 * 60 * 1000,
	},
	{
	    type: "WMS",
	    url: 'https://nowcoast.noaa.gov/arcgis/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer/WmsServer',
	    params: {
		'LAYERS': '1',
		'FORMAT': 'image/png',
		// crossOrigin: crossorigin,
	    },
	    service: 'radar_meteo_imagery_nexrad_time',
	    updateFrequency: 2 * 60 * 1000,
	},
	{
	    type: "WMS",
	    url: 'https://nowcoast.noaa.gov/arcgis/services/nowcoast/wwa_meteoceanhydro_shortduration_hazards_watches_time/MapServer/WmsServer',
	    params: {
		'LAYERS': '0,1,2',
		'FORMAT': 'image/png',
		crossOrigin: crossorigin,
	    },
	    service: 'wwa_meteoceanhydro_shortduration_hazards_watches_time',
	    cssClass: "ol-semi-transparent",
	    updateFrequency: 10 * 60 * 1000,
	},
	{
	    type: "WMS",
	    url: 'https://nowcoast.noaa.gov/arcgis/services/nowcoast/wwa_meteoceanhydro_shortduration_hazards_warnings_time/MapServer/WmsServer',
	    params: {
		'LAYERS': '0,1,2,3,4,5,6,7',
		'FORMAT': 'image/png',
		crossOrigin: crossorigin,
	    },
	    service: 'wwa_meteoceanhydro_shortduration_hazards_warnings_time',
	    cssClass: "ol-semi-transparent",
	    updateFrequency: 10 * 60 * 1000,
	},
    ],
}

const cloudTopsConfig = {
    container: "cloudTops",
    label: "cloudTopsLabel",
    center: [-97.95, 38.91], // Longitude, latitude - Middle of Kansas
    zoom: 5,
    // timeSpan: -1 * 60 * 60 ,
    // timeInterval: 10 * 60,
    // time: null,
    // frameInterval: 2000,  // msec between frames
    // lastFrameHoldInterval: 5000,
    updateFrequency: 1 * 60 * 1000, // GIS class hardcodes updates every 10 minutes but we'll poll once a minute
    layers: [
	{
	    type: "XYZ",
	    url: 'https://earthlive.maptiles.arcgis.com/arcgis/rest/services/GOES/GOES31C/MapServer',
	    attributions: "",
	    updateFrequency: 5 * 60 * 1000,
	},
	{
	    type: "ArcGISRest",
	    url: 'https://carto.nationalmap.gov/arcgis/rest/services/govunits/MapServer',
	    attributions: "",
	    params: {
		'layers': 'show:21',
	    },
	},
    ],
}

// Not using the current map becuase it doesn't have enough temporal resolution - updates only hourly
const currentMapConfig = {
    container: "currentMap",
    label: "currentLabel",
    center: [-122.43, 37.82],
    zoom: 13,
    hours: 6,
    frameInterval: 2000,  // msec between frames
    layers: [
	{
	    type: 'XYZ',
	    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean_Basemap/MapServer/tile/{z}/{y}/{x}',
	    attributions: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri',
	},
	{
	    type: "WMS",
	    url: 'https://beta.marinenavigation.noaa.gov/geoserver/ofs/wms',
	    attributions: 'NOAA SFBOFS',
	    params: {
		'LAYERS': 'sfbofs_sfc_currents',
		'FORMAT': 'image/png',
	    },
	    timeSource: true,
	},
    ],
}

// https://nowcoast.noaa.gov/help/#!section=wms-layer-ids

const oldNationalRadarConfig = {
    container: "nationalRadar",
    label: "nationalRadarLabel",
    center: [-97.95, 38.91], // Longitude, latitude - Middle of Kansas,
    //center: [-122.43, 37.82], // San Francisco
    zoom: 4,
    //timeSpan: 1 * 60 * 60 * 1000,
    //frameInterval: 500,  // msec between frames
    //lastFrameHoldInterval: 5000,
    //firstTimeStop: 0,
    //lastTimeStop: 0,
    //timeStopLayers: '3',
    //timeStopService: "radar_meteo_imagery_nexrad_time",
    //timeStopUpdateInterval: 5 * 60 * 1000,
    updateFrequency: 1 * 60 * 1000, // GIS class hardcodes updates every 10 minutes but we'll poll once a minute
    layers: [
	{
	    type: 'XYZ',
	    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
	    attributions: 'Tiles © <a href="https://services.arcgisonline.com/ArcGIS/' + 'rest/services/World_Topo_Map/MapServer">ArcGIS</a>',
	    crossOrigin: "anonymous",
	},
	{
	    type: "XYZ",
	    url: 'https://nowcoast.noaa.gov/arcgis/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer/tile/{z}/{y}/{x}',
	    attributions: 'NOAA NEXRAD',
	    params: {
		'LAYERS': '1',
		'FORMAT': 'image/png',
	    },
	    //crossOrigin: "anonymous",
	    timeSource: true,
	    update: true,
	},
    ],
}

///////////////////////////////////////////////////////

// nowCoastElements using ArcGIS

// https://developers.arcgis.com/javascript/latest/api-reference/esri-Map.html#basemap
// basemap: "arcgis-topographic"
// basemap: "arcgis-oceans"
// basemap: "arcgis-light-gray"

// https://nowcoast.noaa.gov/help/#!section=rest-layer-ids
nowCoastElements = [
    {
	container: "nationalRadar-ArcGIS",
	timeStopService: "radar_meteo_imagery_nexrad_time",
	timeStopLayer: 3,
	timeStopUpdateInterval: 5 * 60 * 1000, // five minutes
	basemap: "arcgis-light-gray",
	interval: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
	layers: [
	    {
		service: "radar_meteo_imagery_nexrad_time",
		sublayers: [
		    //{ id: 1, },
		    //{ id: 2, },
		    { id: 3, },
		],
	    }
	],
	center: [-97.95, 38.91], // Longitude, latitude - Middle of Kansas,
	zoom: 4,
	iconClass: "radar-time-slider",
	playRate: 500,
	firstTimeStop: 0,
	lastTimeStop: 0,
    },
    /* The current graphic is only every three hours - useless for a 6hr tide cycle
       {
       container: "NowCOAST-SFBOFS",
       service: "guidance_model_coastalocean_sfbofs_time",
       sublayers: [
       { id: 1 },
       { id: 2 },
       { id: 3 },
       ],
       center: [-122.4300, 37.8450], // Longitude, latitude - San Francisco
       zoom: 11,  // Zoom level - 7 is ~appropriate for SF
       iconClass: "currents-time-slider",
       playRate: 2000,
       firstTimeStop: 0,
       lastTimeStop: 0,
       }
    */
];

// A bunch of layers that either didn't look good, didn't work well, or couldn't get to work at all.
const otherRandomLayersConfig = {
    container: "randomLayers",
    label: "randomLayersLabel",
    center: [-97.95, 38.91], // Longitude, latitude - Middle of Kansas,
    zoom: 5,
    updateFrequency: 1 * 60 * 1000, // GIS class hardcodes updates every 10 minutes but we'll poll once a minute
    layers: [
	{
	    // This would be a nice layer if oceans were transparent
	    type: 'ArcGISRest',
	    url: 'https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer',
	},
	{
	    // https://www.gebco.net/
	    // The GEBCO layer is pretty cool but is too saturated for background use. There is a grayscale version
	    // but it's under license.
	    type: 'WMS',
	    //url: 'https://tiles.arcgis.com/tiles/arcgis/rest/services/GEBCO_basemap_NCEI/MapServer',
	    url: 'https://www.gebco.net/data_and_products/gebco_web_services/web_map_service/mapserv?',
	    params: {
		'LAYERS': 'gebco_latest',
		'FORMAT': 'image/png',
	    },
	    attribution: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri',
	    //updateFrequency: 60 * 60 * 1000,
	},
	{
	    // Couldn't make this one work - I think we aren't passing the format parameter
	    type: 'XYZ',
	    url: 'https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer',
	    params: {
		//'LAYERS': '1,4,10,13,17,20,24,27,31,34,38,41,6,7,1,2',
		//'LAYERS': '1,2,4,5,7,8,10,11,13,14,17,18,20,21,24,25,27,28,31,32,34,35,38,39,41,42',
		'FORMAT': 'image/png',
		crossOrigin: crossorigin,
	    },
	},
	{
	    // NowCOAST layer of station observations. Too small to read.
	    type: "WMS",
	    wmsURL: 'https://nowcoast.noaa.gov/arcgis/services/nowcoast/obs_meteocean_insitu_sfc_time/MapServer/WmsServer',
	    wmsParams: {
		'LAYERS': '2,3,4,5,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,24,25,26,27,28,29,30,31,32,33',
		'FORMAT': 'image/png',
		crossOrigin: crossorigin,
	    },
	    service: 'obs_meteocean_insitu_sfc_time',
	    timeStopLayers: '0,1,2,3,4,5,6,7,8,9,10,11',
	},
	{
	    type: "WMS",
	    wmsURL: 'https://nowcoast.noaa.gov/arcgis/services/nowcoast/mapoverlays_political/MapServer/WmsServer',
	    wmsParams: {
		'LAYERS': '5,6,7,10',
		'FORMAT': 'image/png',
		crossOrigin: crossorigin,
	    },
	},
	{
	    type: "WMS",
	    wmsURL: 'https://nowcoast.noaa.gov/arcgis/services/nowcoast/forecast_meteoceanhydro_pts_zones_geolinks/MapServer/WmsServer',
	    wmsParams: {
		'LAYERS': '3,4,5,6',
		'FORMAT': 'image/png',
		crossOrigin: crossorigin,
	    },
	},
	{
	    type: 'ArcGISRest',
	    url: 'https://mapservices.weather.noaa.gov/eventdriven/rest/services/WWA/watch_warn_adv/MapServer',
	    attribution: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri',
	    updateFrequency: 30 * 60 * 1000,
	    cssClass: "ol-semi-transparent",
	},
	{
	    // NEXRAD Radar w/ a time argument
	    type: "WMS",
	    url: 'https://nowcoast.noaa.gov/arcgis/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer/WmsServer',
	    params: {
		'LAYERS': '1',
		'FORMAT': 'image/png',
		//crossOrigin: crossorigin,
	    },
	    service: 'radar_meteo_imagery_nexrad_time',
	    updateFrequency: 2 * 60 * 1000,
	},
	{
	    // This basemap is depricated in favor of the GEBCO map. It doesn't load reliably.
	    type: 'XYZ',
	    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean_Basemap/MapServer',
	    attribution: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri',
	    updateFrequency: 15 * 60 * 1000,
	},
	{
	    type: "WMS",
	    url: 'https://nowcoast.noaa.gov/arcgis/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer/WmsServer',
	    params: {
		'LAYERS': '1',
		'FORMAT': 'image/png',
		crossOrigin: crossorigin,
	    },
	    service: 'radar_meteo_imagery_nexrad_time',
	    updateFrequency: 2 * 60 * 1000,
	},
	// url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.{ext}', {
	// attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	// { type: "Stamen", layer:  'watercolor' },

	// url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
	// attributions: 'Tiles © <a href="https://services.arcgisonline.com/ArcGIS/' + 'rest/services/World_Topo_Map/MapServer">ArcGIS</a>',

	// Not sure why, but this base reflectivity has a different color scheme
	//url: 'https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity/MapServer',
	
	// url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean_Basemap/MapServer/tile/{z}/{y}/{x}',
	// attribution: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri',
	  
	// A Topographic basemap that has many feature labels
	// url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer',

	// NOAA NEXRAD overlay that can be used with a time-series
	// url: 'https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity/MapServer',
    ],
}
