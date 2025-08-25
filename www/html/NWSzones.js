// Couldn't just scrape the data from the NWS page because of CORS

const zoneForecasts = {
    url: "https://tgftp.nws.noaa.gov/data/raw/fz/fzus56.kmtr.cwf.mtr.txt",
    zones: {},
}

let nwsZones = [];
let nwsAFDs = [];

const nwsZoneText = {};
const nwsAFDText = {};

export function nwsZoneFetch() {
    console.log("NWSzones fetch text forecasts");
    for (let z of nwsZones) {
	let url = "data/nwsZones/" + z + ".html"
	//console.log("NWSzones Fetch zone " + z + " url: " + url);
	
	// Load the zone forecasts, caching each zone in nwsZoneText[zone]
	// Data may come back in any order - redraw the html each time a
	// piece updates
	d3.text(url).then(data => {
	    nwsZoneText[z] = data;
	    
	    const scrollDiv = document.createElement("div");
	    scrollDiv.classList.add('nws-zone-inner');

	    let html = "";
	    for (let t of nwsZones) {
		if (t in nwsZoneText) {
		    if (html != "") {
			html += "<p></p>"
		    }
		    html += nwsZoneText[t];
		}
	    }
	    
	    if (mode == "Carousel") {
		html += "<p></p>"; // space before clone
		html += html;
		html += "<p></p>"; // So both top and bottom are same height
	    }
	    scrollDiv.innerHTML = html;

	    d3.selectAll(".nws-zone-container").html(scrollDiv.outerHTML);
	});
    }
	  
    for (let z of nwsAFDs) {
	let url = "data/nwsZones/" + z + ".html"
	//console.log("NWSzones fetch AFD " + z + " url: " + url);
	
	// Load the text (should be html) into this node - clone it to make scrolling look continuous
	d3.text(url).then(data => {
	    nwsAFDText[z] = data;
	    
	    const scrollDiv = document.createElement("div");
	    scrollDiv.classList.add('nws-afd-inner');

	    let html = "";
	    for (let t of nwsAFDs) {
		if (t in nwsAFDText) {
		    if (html != "") {
			html += "<p></p>"
		    }
		    html += nwsAFDText[t];
		}
	    }
	    
	    if (mode == "Carousel") {
		html += "<p></p>"; // space for clone
		html += html;
	    }
	    scrollDiv.innerHTML = html;

	    d3.selectAll(".nws-afd-container").html(scrollDiv.outerHTML);
	});
    }

    for (let e of document.querySelectorAll(".nws-scroll-container")) {
	nwsZoneScroll(e);
    }
    
};

function nwsZoneScroll(target) {
    const id = "#" + target.id;
    const parent = target.parentElement;
    const parentId = "#" + parent.getAttribute("id");
    const outerHeight = parent.getBoundingClientRect().height;
    const innerHeight = target.scrollHeight;
    console.debug(`NWSzones RO: parent ${parentId} ${outerHeight} child ${id} ${innerHeight}`);

    target.classList.remove([".nws-zone-scroll", ".nws-afd-scroll"]);
    const hiddenPixels = innerHeight - outerHeight;
    if (outerHeight == 0 || hiddenPixels < 0) {
	console.log(`NWSzones RO: stop scrolling ${id}`);
    } else {
	const scrollHeight = innerHeight / 2;
	const scrollTime = innerHeight / 40;
	
	if (target.classList.contains('nws-zone-container')) {
	    document.documentElement.style.setProperty('--nws-zone-scroll-height', scrollHeight + 'px');
	    document.documentElement.style.setProperty('--nws-zone-scroll-time', scrollTime + 's');
	    target.classList.add('nws-zone-scroll');
	    console.debug(`NWSzones: zone scrolling ${scrollHeight}px ${scrollTime}s`);
	}
	if (target.classList.contains('nws-afd-container')) {
	    document.documentElement.style.setProperty('--nws-afd-scroll-height', scrollHeight + 'px');
	    document.documentElement.style.setProperty('--nws-afd-scroll-time', scrollTime + 's');
	    target.classList.add('nws-afd-scroll');
	    console.debug(`NWSzones: afd scrolling ${scrollHeight}px ${scrollTime}s`);
	}
    }
}

let nwsRO = new ResizeObserver(elements => {
    if (mode == "Interactive") {
	return;
    }
    for (let el of elements) {
	const target = document.getElementById(el.target.id);
	nwsZoneScroll(target);
    }
});

export function nwsZoneInitialize(zones, afds) {
    nwsZones = zones;
    nwsAFDs = afds;

    console.debug("initialize NWS text");
    nwsZoneFetch();
    for (let e of document.querySelectorAll(".nws-scroll-container")) {
	nwsRO.observe(e);
    }
}
