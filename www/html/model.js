const defaultRegion = "Karl";

const canvasWidth = 1920;
const canvasHeight = 1080;

const workerPool = 3;
const workers = new Array(workerPool);
let workerFree = workerPool;

let taskList = [];

let FrolicPOIs = [
    [[-70.18427870562236, 42.05093402527463], "P-Town"], 
    [[-70.84860937285697, 42.504957565847356], "Maddie's"],
    [[-70.88723233058325, 42.308564563497484], "DC"],
    [[-70.71962014138819, 42.17108658058799], "Outrage"],
    [[-70.09484728259218, 41.27730095253148], "Beaver"],
    [[-70.75808862867945, 41.705222754203675], "Frolic"],
];

let LISPOIs = [
    [[-72.29081369267838, 41.00186132994774], "JF"],
    [[-71.85633528630541, 41.071127609155965], "Montauk"],
    [[-71.58444983223976, 41.16647189471115], "Block Is"],
    [[-73.74422738230533, 40.924705893752716], "Larchmont"],
    [[-72.01047707254705, 41.26614152603119], "FIYC"],
    [[-73.98162631307552, 40.755685841842265], "NYYC"],
    [[-71.326342917958, 41.47371051380736], "NYYC"],
];

const regions = {
    "Karl": {
	'model': 'HRRR',
	//'proj4': '+proj=lcc +lat_0=38.5 +lon_0=262.5 +lat_1=38.5 +lat_2=38.5 +x_0=0 +y_0=0 +a=6371229 +b=6371229 +no_defs',
	'url': 'data/NOAA/HRRR/Karl',
	'dpParams': {
	    'rotate': [0, 0],
	    'center': [-122.60, 37.75],
	    'scale': 40000
	},
	"POIs": [
	    [[-123.7360, 38.9530], "Pt Arena"],
	    //# [[-123.0239, 37.9951], "Pt Reyes"], // Ends up under title label
	    [[-122.7125, 38.4382], "Santa Rosa"],
	    //#[[-122.4535, 37.8083], "Anita Rk"],
	    [[-122.4466, 37.8073], "StFYC", "red"],
	    //#[[-122.3855, 37.7817], "Pier 40"],
	    //#[[-122.4935, 37.7247], "Harding Pk"],
	    //#[[-122.5056, 37.7351], "Zoo"],
	    //#[[-122.3914, 37.9036], "Richmond"],
	    [[-122.4545, 38.1608], "Sears Pt"],
	    [[-122.4333, 37.9632], "E Brother"],
	    //#[[-122.2257, 38.0606], "Carquinez Br"],
	    [[-122.1232, 38.0405], "Benicia Br"],
	    [[-122.2578, 37.8720], "Campanile"],
	    //#[[-122.3306, 37.7971], "Estuary"],
	    [[-122.4994, 37.4923], "Mavericks"],
	    [[-122.3862, 37.6163], "SFO"],
	    [[-122.2133, 37.7124], "OAK"],
	    [[-121.9236, 37.3644], "SJC"],
	    //#[[-122.4273, 37.5288], "Montera Mt"],
	    [[-122.1058, 38.3995], "Mt Vaca"],
	    [[-122.5963, 37.9235], "Mt Tam"],
	    [[-121.9141, 37.8815], "Mt Diablo"],
	    [[-121.6427, 37.3419], "Mt Hamilton"],
	    [[-121.8989, 37.1605], "Mt Umunhum"],
	    [[-123.0016, 37.6989], "SE Farallon"],
	    //[[-122.4830, 37.5026], "Pillar Pt"],
	    //#[[-121.2932, 37.9548], "Stockton"],
	    [[-121.4941, 38.0370], "Tinsley", "red"],
	    [[-121.4936, 38.5766], "Sacramento"],
	    [[-120.9973, 37.2537], "Gustine"],
	    [[-120.4863, 37.3025], "Merced"],
	    [[-119.7893, 36.7362], "Fresno"],
	    [[-121.5686, 37.0068], "Gilroy"],
	    [[-121.3272, 36.4289], "Soledad"],
	    [[-122.0019, 36.9606], "Santa Cruz"],
	    [[-121.9345, 36.6376], "Pt Pinos"],
	    [[-122.1058, 38.3995], "Mt Vaca"],
	    //#[[-121.9521, 38.3732], "Vacaville"],
	    //#[[-119.7605, 39.0105], "North Sails Minden"],
	],
    },
    "KarlNAM": {
	'model': 'NAM',
	//'proj4': '+proj=lcc +lat_0=38.5 +lon_0=262.5 +lat_1=38.5 +lat_2=38.5 +x_0=0 +y_0=0 +a=6371229 +b=6371229 +no_defs',
	'url': 'data/NOAA/NAM/NorCal-NAM',
	'dpParams': {
	    'rotate': [0, 0],
	    'center': [-122.60, 37.75],
	    'scale': 40000
	},
	"POIs": [
	    [[-123.7360, 38.9530], "Pt Arena"],
	    //# [[-123.0239, 37.9951], "Pt Reyes"], // Ends up under title label
	    [[-122.7125, 38.4382], "Santa Rosa"],
	    //#[[-122.4535, 37.8083], "Anita Rk"],
	    [[-122.4466, 37.8073], "StFYC", "red"],
	    //#[[-122.3855, 37.7817], "Pier 40"],
	    //#[[-122.4935, 37.7247], "Harding Pk"],
	    //#[[-122.5056, 37.7351], "Zoo"],
	    //#[[-122.3914, 37.9036], "Richmond"],
	    [[-122.4545, 38.1608], "Sears Pt"],
	    [[-122.4333, 37.9632], "E Brother"],
	    //#[[-122.2257, 38.0606], "Carquinez Br"],
	    [[-122.1232, 38.0405], "Benicia Br"],
	    [[-122.2578, 37.8720], "Campanile"],
	    //#[[-122.3306, 37.7971], "Estuary"],
	    [[-122.4994, 37.4923], "Mavericks"],
	    [[-122.3862, 37.6163], "SFO"],
	    [[-122.2133, 37.7124], "OAK"],
	    [[-121.9236, 37.3644], "SJC"],
	    //#[[-122.4273, 37.5288], "Montera Mt"],
	    [[-122.1058, 38.3995], "Mt Vaca"],
	    [[-122.5963, 37.9235], "Mt Tam"],
	    [[-121.9141, 37.8815], "Mt Diablo"],
	    [[-121.6427, 37.3419], "Mt Hamilton"],
	    [[-121.8989, 37.1605], "Mt Umunhum"],
	    [[-123.0016, 37.6989], "SE Farallon"],
	    //[[-122.4830, 37.5026], "Pillar Pt"],
	    //#[[-121.2932, 37.9548], "Stockton"],
	    [[-121.4941, 38.0370], "Tinsley", "red"],
	    [[-121.4936, 38.5766], "Sacramento"],
	    [[-120.9973, 37.2537], "Gustine"],
	    [[-120.4863, 37.3025], "Merced"],
	    [[-119.7893, 36.7362], "Fresno"],
	    [[-121.5686, 37.0068], "Gilroy"],
	    [[-121.3272, 36.4289], "Soledad"],
	    [[-122.0019, 36.9606], "Santa Cruz"],
	    [[-121.9345, 36.6376], "Pt Pinos"],
	    [[-122.1058, 38.3995], "Mt Vaca"],
	    //#[[-121.9521, 38.3732], "Vacaville"],
	    //#[[-119.7605, 39.0105], "North Sails Minden"],
	],
    },
    "Eddy": {
	'model': 'HRRR',
	//'proj4': '+proj=lcc +lat_0=38.5 +lon_0=262.5 +lat_1=38.5 +lat_2=38.5 +x_0=0 +y_0=0 +a=6371229 +b=6371229 +no_defs',
	'url': 'data/NOAA/HRRR/Eddy',
	'dpParams': {
	    'rotate': [0, 0],
	    'center': [-118.8,33.5],
	    'scale': 22000
	},
	'POIs': [
	    //[[-120.4532, 34.4424], "Pt Conception"],
	    [[-117.5416, 34.9923], "4 Corners"],
	    [[-118.5278, 34.3786], "Santa Clarita"],
	    [[-119.7019, 34.4213], "Santa Barbara"],
	    [[-120.3764, 34.0384], "San Miguel"],
	    [[-120.1110, 33.9651], "Santa Rosa"],
	    [[-119.7701, 34.0327], "Santa Cruz"],
	    //[[-119.6842, 34.0194], "Prisoner's Harbor"],
	    [[-119.3863, 34.0021], "Anacapa"],
	    [[-118.8066, 34.0011], "Pt Dume"],
	    [[-119.5083, 33.6640], "6400ft deep"],
	    [[-118.6051, 33.4783], "West End"],
	    [[-118.4483, 33.9774], "MDR"],
	    //[[-118.4086, 33.9435], "LAX"],
	    [[-117.8842, 33.6042], "Balboa"],
	    [[-118.4008, 33.8491], "King Harbor"],
	    [[-119.0365, 33.4754], "Sta Barbara Is"],
	    [[-118.3267, 33.3447], "Avalon"],
	    [[-117.6466, 34.2881], "Mt Baldy"],
	    [[-119.5052, 33.2437], "San Nicolas"],
	    [[-118.2401, 34.0734], "Chavez Ravine"],
	    [[-118.0572, 34.2258], "Mt Wilson"],
	    [[-116.8246, 34.0984], "San Gorgonio"],
	    [[-116.6791, 33.8142], "San Jacinto"],
	    [[-116.5467, 33.8445], "Palm Springs"],
	    [[-118.4115, 33.7441], "Pt Vicente"],
	    [[-118.4835, 32.8876], "San Clemente"],
	    [[-117.2409, 32.6653], "Pt Loma"],
	    [[-119.1363, 32.7053], "Tanner Bank"],
	    [[-119.1229, 32.4435], "Bishop Rock"],
	],
    },
    "EddyNAM": {
	'model': 'NAM',
	'url': 'data/NOAA/NAM/CA-NAM',
	'dpParams': {
	    'rotate': [0, 0],
	    'center': [-118.8,33.5],
	    'scale': 22000
	},
	'POIs': [
	    //[[-120.4532, 34.4424], "Pt Conception"],
	    [[-117.5416, 34.9923], "4 Corners"],
	    [[-118.5278, 34.3786], "Santa Clarita"],
	    [[-119.7019, 34.4213], "Santa Barbara"],
	    [[-120.3764, 34.0384], "San Miguel"],
	    [[-120.1110, 33.9651], "Santa Rosa"],
	    [[-119.7701, 34.0327], "Santa Cruz"],
	    //[[-119.6842, 34.0194], "Prisoner's Harbor"],
	    [[-119.3863, 34.0021], "Anacapa"],
	    [[-118.8066, 34.0011], "Pt Dume"],
	    [[-119.5083, 33.6640], "6400ft deep"],
	    [[-118.6051, 33.4783], "West End"],
	    [[-118.4483, 33.9774], "MDR"],
	    //[[-118.4086, 33.9435], "LAX"],
	    [[-117.8842, 33.6042], "Balboa"],
	    [[-118.4008, 33.8491], "King Harbor"],
	    [[-119.0365, 33.4754], "Sta Barbara Is"],
	    [[-118.3267, 33.3447], "Avalon"],
	    [[-117.6466, 34.2881], "Mt Baldy"],
	    [[-119.5052, 33.2437], "San Nicolas"],
	    [[-118.2401, 34.0734], "Chavez Ravine"],
	    [[-118.0572, 34.2258], "Mt Wilson"],
	    [[-116.8246, 34.0984], "San Gorgonio"],
	    [[-116.6791, 33.8142], "San Jacinto"],
	    [[-116.5467, 33.8445], "Palm Springs"],
	    [[-118.4115, 33.7441], "Pt Vicente"],
	    [[-118.4835, 32.8876], "San Clemente"],
	    [[-117.2409, 32.6653], "Pt Loma"],
	    [[-119.1363, 32.7053], "Tanner Bank"],
	    [[-119.1229, 32.4435], "Bishop Rock"],
	],
    },
    "CentralCoast": {
	'model': 'NAM',
	'url': 'data/NOAA/NAM/CA-NAM',
	'dpParams': {
	    'rotate': [0, 0],
	    //'center': [-123.0,37.0],
	    'center': [-122.0,35.25],
	    'scale': 8500
	},
	'POIs': [
	    [[-123.7360, 38.9530], "Pt Arena"],
	    [[-122.1058, 38.3995], "Mt Vaca"],
	    [[-122.5963, 37.9235], "Mt Tam"],
	    [[-121.9141, 37.8815], "Mt Diablo"],
	    [[-121.6427, 37.3419], "Mt Hamilton"],
	    [[-121.8989, 37.1605], "Mt Umunhum"],
	    [[-123.0016, 37.6989], "SE Farallon"],
	    [[-122.4466, 37.8073], "StFYC", "red"],
	    [[-122.0019, 36.9606], "Santa Cruz"],
	    [[-121.9345, 36.6376], "Pt Pinos"],
	    [[-120.4532, 34.4424], "Pt Conception"],
	    [[-118.0572, 34.2258], "Mt Wilson"],
	    [[-116.8246, 34.0984], "San Gorgonio"],
	    [[-116.6791, 33.8142], "San Jacinto"],
	    //[[-119.3863, 34.0021], "Anacapa"],
	    [[-118.8066, 34.0011], "Pt Dume"],
	    //[[-119.7019, 34.4213], "Santa Barbara"],
	    [[-120.3764, 34.0384], "San Miguel"],
	    //[[-120.1110, 33.9651], "Santa Rosa"],
	    //[[-119.7701, 34.0327], "Santa Cruz"],
	    [[-117.8842, 33.6042], "Balboa"],
	    [[-118.4008, 33.8491], "King Harbor"],
	    [[-119.0365, 33.4754], "Sta Barbara"],
	    [[-118.3267, 33.3447], "Avalon"],
	    [[-117.6466, 34.2881], "Mt Baldy"],
	    [[-119.5052, 33.2437], "San Nicolas"],
	    [[-118.4835, 32.8876], "San Clemente"],
	    [[-117.2409, 32.6653], "Pt Loma"],
	    [[-119.1363, 32.7053], "Tanner Bank"],
	    [[-119.1229, 32.4435], "Bishop Rock"],
	],
    },
    "norcal": {
	'model': 'NAM',
	'url': 'data/NOAA/NAM/NorCal-NAM',
	'dpParams': {
	    'rotate': [0, 0],
	    'center': [-122.0,37.25],
	    'scale': 30000
	},
	'POIs': [
	    [[-123.7360, 38.9530], "Pt Arena"],
	    [[-122.1058, 38.3995], "Mt Vaca"],
	    [[-122.5963, 37.9235], "Mt Tam"],
	    [[-121.9141, 37.8815], "Mt Diablo"],
	    [[-121.6427, 37.3419], "Mt Hamilton"],
	    [[-121.8989, 37.1605], "Mt Umunhum"],
	    [[-123.0016, 37.6989], "SE Farallon"],
	    [[-122.4466, 37.8073], "StFYC", "red"],
	    [[-122.4994, 37.4923], "Mavericks"],
	    [[-122.3862, 37.6163], "SFO"],
	    [[-122.2133, 37.7124], "OAK"],
	    [[-121.9236, 37.3644], "SJC"],
	    [[-121.4941, 38.0370], "Tinsley", "red"],
	    [[-121.4936, 38.5766], "Sacramento"],
	    [[-122.2779, 37.0946], "Waddell Creek"],
	    [[-122.0019, 36.9606], "Santa Cruz", "red"],
	    [[-121.5686, 37.0068], "Gilroy"],
	    [[-121.8898, 36.6020], "MPYC", "red"],
	    //[[-121.9345, 36.6376], "Pt Pinos"],
	],
    },
    "LIS": {
	'model': 'HRRR',
	//'proj4': '+proj=lcc +lat_0=38.5 +lon_0=262.5 +lat_1=38.5 +lat_2=38.5 +x_0=0 +y_0=0 +a=6371229 +b=6371229 +no_defs',
	'url': 'data/NOAA/HRRR/NYBOS',
	'dpParams': {
	    'rotate': [0, 0],
	    'center': [-72.5, 41.00],
	    //'center': [-72.30, 40.84],
	    'scale': 35000
	},
	"POIs": LISPOIs,
    },
    "LISNAM": {
	'model': 'NAM',
	//'proj4': '+proj=lcc +lat_0=38.5 +lon_0=262.5 +lat_1=38.5 +lat_2=38.5 +x_0=0 +y_0=0 +a=6371229 +b=6371229 +no_defs',
	'url': 'data/NOAA/NAM/NYBOS-NAM',
	'dpParams': {
	    'rotate': [0, 0],
	    'center': [-72.5, 41.00],
	    //'center': [-72.30, 40.84],
	    'scale': 35000
	},
	"POIs": LISPOIs,
    },
    "Frolic": {
	'model': 'HRRR',
	//'proj4': '+proj=lcc +lat_0=38.5 +lon_0=262.5 +lat_1=38.5 +lat_2=38.5 +x_0=0 +y_0=0 +a=6371229 +b=6371229 +no_defs',
	'url': 'data/NOAA/HRRR/NYBOS',
	'dpParams': {
	    'rotate': [0, 0],
	    'center': [-71.66, 41.74],
	    //'center': [-72.30, 40.84],
	    'scale': 25000
	},
	"POIs": LISPOIs.concat(FrolicPOIs),
    },
    "FrolicNAM": {
	'model': 'NAM',
	//'proj4': '+proj=lcc +lat_0=38.5 +lon_0=262.5 +lat_1=38.5 +lat_2=38.5 +x_0=0 +y_0=0 +a=6371229 +b=6371229 +no_defs',
	'url': 'data/NOAA/NAM/NYBOS-NAM',
	'dpParams': {
	    'rotate': [0, 0],
	    'center': [-71.66, 41.74],
	    //'center': [-72.30, 40.84],
	    'scale': 25000
	},
	"POIs": LISPOIs.concat(FrolicPOIs),
    },
    "NYBOS": {
	'model': 'HRRR',
	//'proj4': '+proj=lcc +lat_0=38.5 +lon_0=262.5 +lat_1=38.5 +lat_2=38.5 +x_0=0 +y_0=0 +a=6371229 +b=6371229 +no_defs',
	'url': 'data/NOAA/HRRR/NYBOS',
	'dpParams': {
	    'rotate': [0, 0],
	    'center': [-72.5, 41.1],
	    //'scale': 40000
	    'scale': 15000
	},
	"POIs": [
	],
    },
}      

/*
  Catalina Eddy

  Upper Left  (-2222020.257, -142806.237) (121d59'27.36"W, 34d32'40.14"N)
  Lower Left  (-2222020.257, -493806.237) (121d 1'27.65"W, 31d30'31.03"N)
  Upper Right (-1730020.257, -142806.237) (116d44'44.92"W, 35d35' 3.99"N)
  Lower Right (-1730020.257, -493806.237) (115d58'22.80"W, 32d30'12.44"N)
  Center      (-1976020.257, -318306.237) (118d56'30.95"W, 33d33'51.11"N)
*/

const windColorMap = d3.interpolateHslLong("#613CFF", "#FB4B39");
const windColorMapMax = 30.0; // knots
const windColorMapSteps = 512; // Smooth gradient

function windColor(spd) {
    return windColorMap(spd/windColorMapMax);
}

function generateWindLookup(steps, max) {
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
    region.latest = j;
}

async function fetchMap(url) {
    let response = await fetch(url);
    let topojsonData = await response.json();
    return(topojsonData);
}

const frameTime = 5000;

async function main() {
    const startTime = Date.now();
    let canvas;
    let region = regions[defaultRegion];
    let href = window.location.href;
    const kiosk = (href.indexOf("?kiosk") != -1) ? true : false;
    let currentFrame = -1;
    let displayedFrame = -1;
    let renderingFrame = 0;

    for (const r in regions) {
	if (href.indexOf("?"+r) != -1) {
	    region = regions[r];
	    console.log(`Region: ${r}`);
	}
    }
    await fetchLatest(region);
    const states = new Array(region.forecastHours);
    for (let f = 0; f < parseInt(region.latest.forecasts); f++) {
	states[f] = {"renderState": "renderWaiting"};
    }
    
    for (let w = 0; w < workerPool; w++) {
	workers[w] = {};
	workers[w].task = null;
	workers[w].worker = new Worker("modelworker.js");
	workers[w].worker.addEventListener('message', evt => {
	    taskComplete(w, evt);
	});
    }

    // Start loading the worker code as early as possible - some is large
    
    windColorLookup = generateWindLookup(windColorMapSteps, windColorMapMax);
    
    /*
      const forwardKey = "ArrowLeft";
      const backKey = "ArrowRight";
    */
    const forwardKey = "f";
    const backKey = "b";
    const spaceKey = " ";

    let inkeypress = false;
    let isFullScreen = false;
    document.addEventListener("keypress", async function onEvent(event) {
	if (!inkeypress) {
	    inkeypress = true;
	    if (event.key === forwardKey) {
		if (currentFrame < region.latest.forecasts - 1) {
		    currentFrame++;
		    await updateFrame();
		}
	    } else if (event.key === backKey) {
		if (currentFrame > 0) {
		    currentFrame--;
		    await updateFrame();
		}
	    } else if (event.key === spaceKey) {
		const elem = document.getElementById("wrapper");
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
	    slider.value = (currentFrame * 100.0) / (region.latest.forecasts-1);
	    inkeypress = false;
	}
    });

    function drawTopo(region, countries) {
	let svg = d3.select("#topoWrapper").append("svg").attr("width", canvasWidth + "px").attr("height", canvasHeight + "px");
	const dpParams = region.dpParams;
	dp = d3.geoMercator()
	    .rotate(dpParams.rotate)
	    .center(dpParams.center)
	    .scale(dpParams.scale)
	    .translate([canvasWidth/2, canvasHeight/2]);
	
	const path = d3.geoPath()
	      .projection(dp);
	svg.insert("path", ".map")
	    .datum(countries)
	    .classed("topoPath", true)
	    .attr("d", path)
    }

    function drawPOIs(region, pois) {
	let svg = d3.select("#poiWrapper").append("svg").attr("width", canvasWidth + "px").attr("height", canvasHeight + "px");
	const dpParams = region.dpParams;
	dp = d3.geoMercator()
	    .rotate(dpParams.rotate)
	    .center(dpParams.center)
	    .scale(dpParams.scale)
	    .translate([canvasWidth/2, canvasHeight/2]);
	w = canvasWidth;
	h = canvasHeight;
	const radius = 4;

	for (const poi of region.POIs) {
	    const lonLat = poi[0];
	    const text = poi[1];
	    const color = (poi.length > 2) ? poi[2] : "#ffffff";
	    [dx, dy] = dp(lonLat);
	    let px = Math.round(dx);
	    let py = Math.round(dy);

	    if ((px >= 0 && (px < w)) && ((py >= 0) && (py <= h))) {
		svg.append("circle")
		    .classed("poi", true)
		    .attr("cx", px)
		    .attr("cy", py)
		    .attr("r", radius)
		const t = svg.append("text")
		      .classed("poiLabel", true)
		      .attr("x", px + (radius/2) + 8)
		      .attr("y", py+8)
		      .text(text);
		const bbox = t.node().getBBox();
		svg.append("rect")
		    .attr("x", bbox.x)
		    .attr("y", bbox.y)
		    .attr("width", bbox.width)
		    .attr("height", bbox.height)
		    .style("fill", "#808080a0");
		svg.append("text")
		    .classed("poiLabel", true)
		    .attr("x", px + (radius/2) + 8)
		    .attr("y", py+8)
		    .text(text);
	    }
	}
    }

    function serviceTimer() {
	currentFrame = (currentFrame + 1) % region.latest.forecasts;
	updateFrame();
    }

    function labelForecast(el, r, state) {
	label = r.model + " ";
	label += state.ref.format("UTC:m/d HHMM") + "Z";
	label += " valid " + state.valid.format("m/d ");
	label += '<span class="forecastHour">' + state.valid.format("HH:MM") + "</span> " + state.valid.format("Z");
	label += "<br>Barbs: 10m Wind, Color: Gusts";
	if (!kiosk) {
	    //label += `<br>${r.latest.forecasts} hours - 'b'ack, 'f'orward`;
	    label += "<br>'b'ack, 'f'orward, &lt;space&gt; fullscreen";
	}
	el.html(label);
    }

    async function updateFrame() {
	state = states[currentFrame];
	if ('image' in state || 'imageData' in state) {
	    //console.log(`Display frame ${currentFrame}`);
	    let context = canvas.node().getContext("2d");
	    if (context == null) {
		d3.select("#windCanvas").remove();
		canvas = d3.select("#modelGusts").append("canvas")
		    .attr("id", "windCanvas")
		    .attr("width", canvasWidth)
		    .attr("height", canvasHeight)
		    .classed("modelGusts", true);
		context = canvas.node().getContext("2d");
	    }
	    context.putImageData(state.imageData, 0, 0);
	    labelForecast(d3.select("#modelLabel"), region, state);

	    displayedFrame = currentFrame;
	} else {
	    console.log(`Frame ${currentFrame} not yet rendered`);
	}
    }

    console.log(`Kiosk mode: ${kiosk}`);
    d3.select("#windCanvas").remove();
    canvas = d3.select("#modelGusts").append("canvas")
	.attr("id", "windCanvas")
	.attr("width", canvasWidth)
	.attr("height", canvasHeight)
	.classed("modelGusts", true);

    function updateRenderState() {
	let renderLabel =
	    '<span class="renderStatus">Status:' +
	    '<span class="renderStatus renderComplete"> Complete<span>' +
	    '<span class="renderStatus renderRendering"> Rendering<span>' +
	    '<span class="renderStatus renderWaiting"> Waiting<span>';
	let rClass = "";
	let completeCount = 0;
	for (let f = 0; f < states.length; f++) {
	    const rs = states[f].renderState;
	    if (rs == "renderWaiting") {
		rClass = "renderWaiting";
	    } else if (rs == "renderRendering") {
		rClass = "renderRendering";
	    } else if (rs == "renderComplete") {
		rClass = "renderComplete";
		completeCount++;
	    } else {
		console.log(`Unknown state ${f} renderState ${rs}`);
	    }
	    if (!(f % 10)) {
		renderLabel += "<br>";
	    }
	    const pad = (f<10) ? "&nbsp;" : "";
	    renderLabel += `<span class="renderStatus ${rClass}"> ${pad}${f}</span>`;
	}
	if (completeCount == states.length) {
	    renderLabel = "";
	    //renderLabel = "Render Complete";
	}
	d3.select("#status").html(renderLabel);
    }

    function taskStart() {
	if (workerFree == 0 || taskList.length == 0) {
	    return;
	}
	for (let w = 0; w < workerPool; w++) {
	    if (workers[w].task == null) {
		task = taskList.shift();
		task.startTime = Date.now();
		workers[w].task = task;
		workerFree--;
		task.state.renderState = "renderRendering";
		workers[w].worker.postMessage(task.msg);
		//console.log(`Worker ${w} started`);
		updateRenderState();
		return;
	    }
	}
	console.log("taskStart couldn't find free worker");
    }
    
    function taskAdd(task) {
	taskList.push(task);
	taskStart();
    }
    
    function taskComplete(w, evt) {
	task = workers[w].task;
	task.finish(evt, task);
	workers[w].task = null;
	workerFree++;
	//console.log(`Worker ${w} completed`);
	taskStart();
    }

    function renderComplete(evt, task) {
	now = Date.now();
	const fh = evt.data.forecastHour;
	const state = states[fh];
	const elapsed =  now - task.startTime;
	const sinceStart = now - startTime;
	state.renderState = "renderComplete";
	state.image = evt.data.image;
	state.imageData = evt.data.imageData;
	state.ref = new Date(evt.data.ref * 1000);
	state.valid = new Date(evt.data.valid * 1000);
	updateRenderState();
	
	console.log(`Render ${fh} completed in ${(elapsed/1000.0).toFixed(2)} sinceStart ${(sinceStart/1000.0).toFixed(2)} current frame: ${currentFrame}`);
	if (currentFrame == fh) {
	    updateFrame();
	}
    }

    function renderStart(fh) {
	const state = states[fh];
	state.startTime = Date.now();

	const task = {};
	task.state = state;
	task.msg = {};
	task.msg.type = "raster-gust";
	task.msg.width = canvasWidth;
	task.msg.height = canvasHeight;
	task.msg.region = region;
	task.msg.forecastHour = fh;
	task.msg.map = countries;
	task.msg.kiosk = kiosk;
	task.msg.windColorMap = {
	    'steps': windColorMapSteps,
	    'max': windColorMapMax,
	    'map': windColorLookup
	};
	task.finish = renderComplete;
	taskAdd(task);
	updateRenderState();
    }

    // "world-110m.json" is lower-res - faster, but not enough detail to recognize features
    // "countries-10m.json is high-res";
    //const worldMap = await fetchMap("data/lib/world-110m.json");
    const worldMap = await fetchMap("lib/countries-10m.json");
    const countries = topojson.feature(worldMap, worldMap.objects.countries);

    /*
      drawTopo(region, countries);
      drawPOIs(region);
    */

    const slider = document.getElementById("frameSlider");
    slider.value = 0;
    slider.oninput = function() {
	currentFrame = Math.round((this.value * (region.latest.forecasts-1))/100.0);
	updateFrame();
    }
    if (!kiosk) {
	d3.select(".sliderWrapper").classed("slider-show", true);
    }

    updateRenderState();
    for (let fh = 0; fh < region.latest.forecasts; fh++) {
	renderStart(fh);
    }

    if (kiosk) {
	d3.interval(serviceTimer, frameTime);
    } else {
	currentFrame = 0;
	updateFrame();
    }
}

main();
