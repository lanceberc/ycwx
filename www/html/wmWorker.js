importScripts(
    "lib/d3.v7.min.js",
    "lib/geotiff.2.0.5.js",
    "lib/proj4.min.js",
    "lib/geotiff-geokeys-to-proj4/main-dist.js",
    "lib/tXml.min.js",
    "lib/date.format.js"
);

/*
  https://d3js.org/d3.v7.min.js
  https://cdn.jsdelivr.net/npm/geotiff
  https://cdn.jsdelivr.net/npm/geotiff@2.0.5
https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.js
https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4-src.js
https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4-src.min.js
https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.min.js
https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js
alternate https://unpkg.com/topojson@3

?? https://cdn.skypack.dev/geotiff-geokeys-to-proj4
 */

// Make barbs 20% longer to account for LCC tilt
const barbLenFudge = 1.20;

/*

Calling the windColorMap for each pixel and translating it to RGB was taking
more than 50% of the render time so it's been reimplemented as a lookup table

const windColorMap = d3.interpolateHslLong("#613CFF", "#FB4B39");
const windColorMapMax = 30; // knots

function windColor(spd) {
    return windColorMap(spd/windColorMapMax);
}
*/

function gribParseMetaData(s) {
    const parser = new txml();
    const xml = parser.parse(s);
    const items = xml[0].children;
    let params = [];
    let param = null;

    for (let i = 0; i < items.length; i++) {
	let obj = items[i];
	if (obj.attributes.name == "GRIB_COMMENT") {
	    if (param != null) {
		params.push(param);
	    }
	    param = new Object();
	    param.slot = obj.attributes.sample;
	}
	param[obj.attributes.name] = obj.children[0];
    }
    if (param != null) {
	params.push(param);
    }
    return params;
}
    
async function fetchGrib(url, displayProjection) {
    console.log(`Fetch ${url}`);
    let tryCount = 0;
    let done = false;
    let tiff;
    let grib;
    let rasters;
    while (!done && (tryCount < 4)) {
	try {
	    tiff = await GeoTIFF.fromUrl(url);
	    grib = await tiff.getImage();
	    rasters = await grib.readRasters();
	    done = true;
	} catch (e) {
	    console.log(`Fetch failed '${e}' for ${url}`);
	    tryCount++;
	}
    }

    if (!done) {
	return(null);
    }

    const geoKeys = grib.getGeoKeys();
    const projObj = geokeysToProj4.toProj4( geoKeys );
    const proj4string = projObj.proj4;

    //console.log(`proj4: '${proj4string}'`);

    const gribParams = gribParseMetaData(grib.fileDirectory.GDAL_METADATA);
    let refTime = parseInt(gribParams[0].GRIB_REF_TIME.slice(0, 10));
    let validTime = parseInt(gribParams[0].GRIB_VALID_TIME.slice(0, 10));

    const bands = new Object();
    for (let i=0; i<gribParams.length; i++) {
	bands[gribParams[i].GRIB_ELEMENT] = gribParams[i].slot;
    }
						
    const g = {
	"width":  grib.getWidth(),
	"height": grib.getHeight(),
	"bbox": grib.getBoundingBox(),
	"projection": proj4(proj4string, 'EPSG:4326'),
	"tiepoints": grib.getTiePoints()[0],
	"scale": grib.getFileDirectory().ModelPixelScale,
	"ref": refTime,
	"valid": validTime,
	"bands": bands,
	"rasters": rasters
    }
    return(g);
}

function drawBarbs(canvas, grib, dp, cm) {
    const bbox = grib.bbox;
    const rasters = grib.rasters;
    const tiepoints = grib.tiepoints;
    const scale = grib.scale;
    const projection = grib.projection;
    const gw = grib.width;
    const gh = grib.height;
    const uIndex = grib.bands.UGRD;
    const vIndex = grib.bands.VGRD;

    // lon/lat of the displayed area
    const ll0 = dp.invert([0,0]);
    const ll1 = dp.invert([canvas.width-1, canvas.height-1]);
    // distance from the origin (Null Island) in meters
    const m0 = projection.inverse(ll0);
    const m1 = projection.inverse(ll1);
    // how many grid points are displayed
    const gridX = (m1[0] - m0[0]) / scale[0];
    const gridY = (m0[1] - m1[1]) / scale[1];
    // barb length is min of (width / gridX) or (height / gridY)
    const lenX = canvas.width / gridX;
    const lenY = canvas.height / gridY;

    // Could determine the fudge by figuring out the tilt of the LCC by
    // using trig on the lon/lats of the corner four samples
    barbSize = Math.round(Math.min(lenX, lenY)) * barbLenFudge;

    let context = canvas.getContext("2d");

    for (let j = 0; j < gh; j++){
	for(let i = 0; i < gw; i++) {
	    let px, py;
	    const lonLat = projection.forward([bbox[0] + (i * scale[0]), bbox[3] - (j * scale[1])]);
	    [px, py] = dp(lonLat); // grib[i, j] projected to display[x,y]
	    px = Math.round(px);
	    py = Math.round(py);
	    
	    if (((px >=0) && (px < canvas.width)) && ((py >=0) && (py < canvas.height))) {
		const u = rasters[uIndex][i + j*gw];
		const v = rasters[vIndex][i + j*gw];
		
		const kts = 1.943844492 * Math.sqrt((u*u) + (v*v));
		var angle = Math.atan2(-v,u);
		  
		var kts5 = Math.round(kts/5);
		var kts10 = Math.floor(kts5/2);
		kts5 = kts5%2;
		var kts50 = Math.floor(kts10/5);
		kts10 = kts10%5;
		context.save();
		context.translate(px, py);
		context.rotate(angle);
		context.beginPath();
		//context.strokeStyle = "#f00";

		const color = (typeof(cm) == 'function') ? cm(kts) : cm;
		context.strokeStyle = color;

		var pos = -barbSize/2;
		var separation = 2.5;

		for(let k=0; k<kts50; k++){
		    context.moveTo(pos, 0);
		    context.lineTo(pos+barbSize/8, barbSize/4);
		    context.lineTo(pos+barbSize/4, 0);
		    pos = pos + barbSize/4 + separation;
		    context.fill();
		}
		for(let k=0; k<kts10; k++){
		    context.moveTo(pos, 0);
		    context.lineTo(pos, barbSize/3);
		    pos = pos + separation
		}
		if(kts5==1){
		    if (pos == -barbSize/2){
			pos = pos + separation
		    }
		    context.moveTo(pos, 0);
		    context.lineTo(pos, barbSize/6);
		}
		if(kts5==0 && kts10== 0 && kts50==0){
		    //context.arc(0, 0, 4, 0, 2 * Math.PI, false);
		    context.arc(0, 0, barbSize/4, 0, 2 * Math.PI, false);
		} else {
		    context.moveTo(-barbSize/2,0);
		    context.lineTo(barbSize/2,0);
		}
		context.stroke();
		context.restore();
	    }
	}
    }
}

function drawWindField(canvas, grib, dp, band, cm) {
    const gw = grib.width;
    const gh = grib.height;
    const bbox = grib.bbox;
    const rasters = grib.rasters;
    const tiepoints = grib.tiepoints;
    const scale = grib.scale;
    const projection = grib.projection;
      
    const w = canvas.width;
    const h = canvas.height;
    
    const geoTransform = [tiepoints.x, scale[0], 0, tiepoints.y, 0, -1*scale[1]];
      
    const context = canvas.getContext("2d");
    const b = grib.bands[band];
    const d = new ImageData(w,h);

    const wind = new Uint8ClampedArray(w*h); // Wind and gust can't get above 255
    const gust = new Uint8ClampedArray(w*h);
    const dir = new Array(w*h); // Dir range [0 - 360], 361 indicates off-grid
    const uIndex = grib.bands.UGRD;
    const vIndex = grib.bands.VGRD;
    const gustIndex = grib.bands['GUST'];
    
    const ul = dp.invert([0, 0]);
    const lr = dp.invert([w, h]);
    //console.log(`top ${ul[1]} bottom ${lr[1]} left ${ul[0]} right ${lr[0]}`);
    for (let y = 0; y < h; y++) {
	for (let x = 0; x < w; x++) {
	    const lonLat = dp.invert([x, y]);
	    const gCoords = projection.inverse(lonLat);
	    i = (gCoords[0] - geoTransform[0]) / geoTransform[1];
	    j = (gCoords[1] - geoTransform[3]) / geoTransform[5];
	    if ((i >= 0) && (i < gw) && (j >= 0) && (j < gh) ){
		// vals[y][x] = rasters[hrrrBands[band]][(Math.round(j)*gw) + Math.round(i)];
		// Fancy weighted interpolation for smooth transitions
		let left = Math.floor(i);
		const pctRight = i - left;
		let right = Math.floor(i+1);
		right = (right < gw) ? right : gw-1;
		let above = Math.floor(j);
		const pctBelow = j - above;
		let below = Math.floor(j+1);
		below = (below < gh) ? below : gh-1;
		const al = (above*gw) + left;
		const ar = (above*gw) + right;
		const bl = (below*gw) + left;
		const br = (below*gw) + right;
		const avg =
		      (rasters[b][al] * (1-pctBelow) * (1-pctRight)) +
		      (rasters[b][ar] * (1-pctBelow) * pctRight) +
		      (rasters[b][bl] * pctBelow * (1-pctRight)) +
		      (rasters[b][br] * pctBelow * pctRight); 
		const kavg = 1.943844492 * avg;

		/*
		Calling the windColorMap for each pixel and translating it to RGB was taking
		more than 50% of the render time so it's been reimplemented as a lookup table
		const color = d3.color(windColor(v));
		d.data[offset + 0] = color.r;
		d.data[offset + 1] = color.g;
		d.data[offset + 2] = color.b;
		*/
		
		let idx = Math.round((kavg*cm.steps)/cm.max);
		if (idx >= cm.steps) {
		    idx = cm.steps - 1; // Clamp to range max
		}
		const offset = 4*((y*w) + x);
		const coff = idx*3;
		d.data[offset + 0] = cm.map[coff + 0];
		d.data[offset + 1] = cm.map[coff + 1];
		d.data[offset + 2] = cm.map[coff + 2];
		d.data[offset + 3] = 255;

		const gi = Math.round(i);
		const gj = Math.round(j);
		const gidx = (gj*gw) + gi;
		const u = rasters[uIndex][gidx];
		const v = rasters[vIndex][gidx];
		const kts = 1.943844492 * Math.sqrt((u*u) + (v*v));
		let angle = (Math.atan2(-v,u) * (180.0/Math.PI)) - 90.0;
		angle += (angle < 0.0) ? 360.0 : 0.0;
		angle = angle;
		const gkts = 1.943844492 * rasters[gustIndex][gidx];
		
		idx = (y*w) + x;
		wind[idx] = kts.toFixed(0);
		gust[idx] = gkts.toFixed(0);
		dir[idx] = angle.toFixed(0);
	    } else {
		wind[(y*w)+x] = 0;
		gust[(y*w)+x] = 0;
		dir[(y*w)+x] = 361;
	    }
	}
    }
    
    context.putImageData(d, 0, 0, 0, 0, w, h);
    return({"wind": wind, "gust": gust, "dir": dir});
}

const textBorder = 4;
function drawText(canvas, xoff, yoff, texts, font, color) {
    let context = canvas.getContext("2d");
    context.font = font;
    for (const text of texts) {
	let m = context.measureText(text);
	context.fillStyle = "rgba(128, 128, 128, 0.5)";
	context.fillRect(xoff,
			 yoff,
			 m.width + 2 * textBorder,
			 m.actualBoundingBoxDescent + m.actualBoundingBoxAscent + 2 * textBorder);
	context.fillStyle = color;
	context.fillText(text, xoff+textBorder, yoff + textBorder + m.actualBoundingBoxAscent);
	yoff += m.actualBoundingBoxDescent + m.actualBoundingBoxAscent + 2*textBorder;
    }
}

function drawPOIs(canvas, grib, dp) {
    w = canvas.width;
    h = canvas.height;
    font = "16pt sans";
    let context = canvas.getContext("2d");
    context.save();
    context.font = font;
    for (const poi of grib.region.POIs) {
	const lonLat = poi[0];
	const text = poi[1];
	const color = (poi.length > 2) ? poi[2] : "#ffffff";
	[dx, dy] = grib.region.dp(lonLat);
	let px = Math.round(dx);
	let py = Math.round(dy);
	if ((px >= 0 && px < w) && (py >= 0) && (py < h)) {
	    // U+2851 U+2825
	    // put a symbol at [px,py]
	    const symbol = "\u2825";
	    const radius = 4;
	    let m = context.measureText(text);
	    context.fillStyle = color;
	    context.strokeStyle = color;
	    context.beginPath();
	    context.arc(px, py, radius, 0, 2 * Math.PI, false);
	    context.fillStyle = color;
	    context.fill();
	    context.lineWidth = 1;
	    context.strokeStyle = color;
	    context.stroke();
	    drawText(canvas, px + (radius/2) + 8, py - ((m.actualBoundingBoxDescent + m.actualBoundingBoxAscent)/2+textBorder), [text], font, "white");
	}
    }
    context.restore();
}

function drawTopo(canvas, topo, displayProjection) {
    const context = canvas.getContext("2d");
    
    const path = d3.geoPath()
	    .projection(displayProjection).context(context);

    context.save();
    context.beginPath();
    context.fillStyle = "#00000000";
    context.strokeStyle = "#fff";
    context.strokeStyle = "#000";
    context.lineWidth = 3;
    path(topo);
    context.stroke();
    context.restore();
}

async function render(canvas, region, forecastHour, topo, colorMap) {
    const context = canvas.getContext("2d");
    const forecast = (forecastHour < 10 ? "0" : "") + `${forecastHour}`;
    const modelRun = (region.latest.modelRun < 10 ? "0" : "") + region.latest.modelRun;
    const pad = (forecast < 100) ? "0" : "";
    const url = `${region.url}/${region.latest.mdate}/t${modelRun}_f${pad}${forecast}.tif`;
    //console.log(`Loading ${url}`);
    const dp = region.dp;
    const grib = await fetchGrib(url, dp);
    
    grib.region = region;
    windData = drawWindField(canvas, grib, dp, 'GUST', colorMap);
    drawTopo(canvas, topo, dp);
    //barbsString = barbsSVG(canvas.width, canvas.height, state, dp, "#000000");
    drawBarbs(canvas, grib, dp, "#000000");
    drawPOIs(canvas, grib, dp);
    return([grib, windData]);
}

async function startWorker(evt) {
    const width = evt.data.width;
    const height = evt.data.height;
    const region = evt.data.region;
    const forecastHour = evt.data.forecastHour;
    const forecast = evt.data.forecast;

    const dpParams = region.dpParams;
    region.dp = d3.geoMercator()
	.rotate(dpParams.rotate)
	.center(dpParams.center)
	.scale(dpParams.scale)
	.translate([width/2, height/2]);

    const canvas = new OffscreenCanvas(width, height);
    const [grib, windData] = await render(canvas, region, forecastHour, evt.data.map, evt.data.windColorMap);

    // Should show up in master e.data
    //console.log(`Worker ${forecastHour} Finished`);
    const context = canvas.getContext("2d");
    const imageData = context.getImageData(0, 0, width, height);
    //const image = canvas.transferToImageBitmap();
    self.postMessage({"forecast": forecast, "forecastHour": forecastHour, 'imageData': imageData, 'ref': grib.ref, 'valid': grib.valid, 'windData': windData});
};

onmessage = (evt) => {
    startWorker(evt);
}
