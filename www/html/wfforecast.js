// Get and display forecasts from WeatherFlow.

let WFForecasts = {};
let WFContainerMap = {};

const WFupdateFrequency = 10 * 60 * 1000; // 10 minutes

function WFForecast(container, stationID, nickname) {
    function startStop(container) {
	const visible = (document.visibilityState === 'visible');
	const c = document.querySelector("#" + container);
	const obj = WFContainerMap[container];

	if (visible) {
	    obj.fetch();
	}
    }
    
    function onchange (evt) {
	let v = "visible", h = "hidden";
	let evtMap = { focus:v, focusin:v, pageshow:v, blur:h, focusout:h, pagehide:h };
	    
	evt = evt || window.event;
	if (evt.type in evtMap) {
	    console.log("WFForecast visibilitychange: " + evtMap[evt.type])
	} else {
	    console.log(`WFForecast visibilitychange: ${(document.hidden) ? "in" : ""}visible`);
	    if (!document.hidden) {
		for (const c in WFContainerMap) {
		    WFContainerMap[c].fetch();
		}
	    }
	}
    }

    function update(obj) {
	//console.log("WFForecast update: " + obj.id)
	obj.fetch();
    }
    
    this.container = container;
    this.stationID = stationID
    this.nickname = nickname;
    this.id = "#" + container;
    this.resp = null;
    this.lastFetch = null;
    WFContainerMap[container] = this;

    // Look for various events to render element and start/stop animation
    document.addEventListener("visibilitychange", onchange);

    new ResizeObserver((entries) => {
	entries.forEach(e => {
	    console.log("WFForecast ResizeObserver event for: " + e.target.id);
	    startStop(e.target.id);
	});
    }).observe(document.getElementById(container));
	
    new IntersectionObserver((entries, observer) => {
	entries.forEach(e => {
	    const visible = e.isIntersecting;
	    console.log(`WFForecast IntersectionObserver: ${e.target.id} is ${(visible) ? "" : "in"}visible (${e.intersectionRatio * 100}%)`);
	    startStop(e.target.id);
	});
    }).observe(document.getElementById(container));

    this.updateId = setInterval(update, 60 * 1000, this);
    this.fetch(); // initial fetch / render
}

//const WxFlowForecastURL="https://swd.weatherflow.com/swd/rest/better_forecast?api_key=&build=44&station_id=&lat=38.03598&lon=-121.49423&units_temp=f&units_wind=kts&units_pressure=mb&units_distance=mi&units_precip=in&units_other=imperial&units_direction=mph&_=";

WFForecast.prototype.fetch = function() {
    const WxFlowForecastURL="https://swd.weatherflow.com/swd/rest/better_forecast?api_key=&build=44&station_id=&units_temp=f&units_wind=kts&units_pressure=mb&units_distance=mi&units_precip=in&units_other=imperial&units_direction=mph&_=";
    const nonce = Date.now()
    const now = new Date();

    if ((this.lastFetch != null) && (now - this.lastFetch < WFupdateFrequency)) {
	//console.log("WFForecast fetch too soon " + this.id + " now " + now.format("longtime") + " last " + this.lastFetch.format("longtime"));
	return;
    }
    console.log("WFForecast fetch " + this.id + " " + now.format("longtime"));
    this.lastFetch = now;
    
    let url = WxFlowForecastURL.replace("station_id=", "station_id=" + this.stationID)
    url = url.replace("api_key=", "api_key=" + weatherFlow_apikey);
    url = url.replace("&_=", "&_=" + nonce)
    let obj = this;
    d3.json(url)
	.then(
	    function(resp) {
		obj.resp = resp;
		obj.render();
	    },
	    function(error) {
		console.log("WFForecast fetch failure url " + url);
	    }
	);
}

WFForecast.prototype.render = function() {
    function iconURL(c) {
	return("https://tempestwx.com/images/Updated/" + c + ".svg");
    }
    
    if (this.resp == null) {
	return;
    }
    
    const d = this.resp;
    const id = this.id;
    const c = d3.select(id);
    c.selectAll("*").remove();
    // generate the page - I'm sure there's a better way.

    console.log("WFForecast render " + this.id);

    const cc = d.current_conditions;
    const forecast = d.forecast;
    const daily = forecast.daily;
    const hourly = forecast.hourly;
    
    const div = c.append("div").classed("wf", true);

    const sunrise = new Date(daily[0].sunrise * 1000);
    const sunset = new Date(daily[0].sunset * 1000);
    const forecasttime = new Date(cc.time*1000)
    
    // current conditions
    const ccdiv = div.append("div").classed("wf-current-conditions", true);
    ccdiv.append("div").classed("wf-cc-station", true).html(d.location_name);
    ccdiv.append("div").classed("wf-cc-time", true).html("As of " + forecasttime.format("short"));
    ccdiv.append("div").classed("wf-cc-sunrise", true).html("Sunrise " + sunrise.format("time"));
    ccdiv.append("div").classed("wf-cc-sunset", true).html("Sunset " + sunset.format("time"));
    ccdiv.append("div").classed("wf-cc-sun", true).html("Solar - " +
							" " + cc.solar_radiation + d.units_display.units_solar_radiation +
							" " + cc.brightness + d.units_display.units_brightness +
						       	" UV " + cc.uv);

    // hourly forecasts - 3 rows for 72 hours
    for (row = 0; row < 3; row++) {
	const h = div.append("div").classed("wf-hourly-forecast", true);

	// Header column
	h.append("div")
	    .classed("wf-hourly-time", true)
	    .classed("wf-hourly-header", true)
	    .style('grid-area', "time / 1 / time / 1")
	    .html("Hour");
	//h.append("div").classed("wf-hourly-conditions", true).html("Sky").style('grid-area', "icon / 1 / icon / 1");
	h.append("div")
	    .classed("wf-hourly-temp", true)
	    .classed("wf-hourly-header", true)
	    .style('grid-area', "temp / 1 / temp / 1")
	    .html("Temp (&#176;F)");
	h.append("div")
	    .classed("wf-hourly-pop", true)
	    .classed("wf-hourly-header", true)
	    .style('grid-area', "pop / 1 / pop / 1")
	    .html("Precip %");
	//h.append("div").classed("wf-hourly-precip_icon", true).html("");
	h.append("div")
	    .classed("wf-hourly-wind-avg", true)
	    .classed("wf-hourly-header", true)
	    .style('grid-area', "wind_avg / 1 / wind_avg / 1")
	    .html("Wind (" + d.units_display.units_wind + ")");
	h.append("div")
	    .classed("wf-hourly-wind-gust", true)
	    .classed("wf-hourly-header", true)
	    .style('grid-area', "wind_gust / 1 / wind_gust / 1")
	    .html("Gusts");
	h.append("div")
	    .classed("wf-hourly-wind-direction", true)
	    .classed("wf-hourly-header", true)
	    .style('grid-area', "wind_direction / 1 / wind_direction / 1")
	    .html("Dir (&#176;T)");
	h.append("div")
	    .classed("wf-hourly-wind-direction-cardinal", true)
	    .classed("wf-hourly-header", true)
	    .style('grid-area', "wind_direction_cardinal / 1 / wind_direction_cardinal / 1")
	    .html("");

	// Data columns - each row has 24 hours
	for (let i = 0; i < 24; i++) {
	    const hour = hourly[(row * 24) + i];
	    const col = i + 2; // there's a header column & columns start at one, not zero

	    if ((i == 0) || (hour.local_hour == 0)) {
		const dd = new Date(hour.time * 1000);
		h.append("div").classed("wf-hourly-day", true)
		    .html(dd.format("day"))
		    .style('grid-area', "day / " + col + " / day / " + col);
		//const dateString = dd.format("month") + "/" + dd.format("date");
		//h.append("div").classed("wf-hourly-date", true).html(dateString).style('grid-area', "date / " + col + " / date / " + col);
	    }
	    
	    h.append("div").classed("wf-hourly-time", true)
		.style('grid-area', "time / " + col + " / time / " + col)
		.html(hour.local_hour);
	    //h.append("div").classed("wf-hourly-conditions", true).html(hour.conditions).style('grid-area', "conditions / " + col + " / conditions / " + col);
	    h.append("div").classed("wf-hourly-icon", true)
		.style('grid-area', "icon / " + col + " / icon / " + col)
		.style('background-image', 'url("' + iconURL(hour.icon) + '")')
		.html("");
	    h.append("div").classed("wf-hourly-temp", true)
		.style('grid-area', "temp / " + col + " / temp / " + col)
	    	.html(hour.air_temperature);
	    if (hour.precip_probability > 0) {
		h.append("div").classed("wf-hourly-pop", true)
		    .style('grid-area', "pop / " + col + " / pop / " + col)
		    .style("background", "rgb(0, 0, 255, 0." + ((hour.precip_probability < 10) ? "0" : "") + hour.precip_probability + ")")
		    .style('color', (parseFloat(hour.precip_probability) < 25) ? "black" : "white")
		    .html(hour.precip_probability);
	    }
	    //h.append("div").classed("wf-hourly-precip_icon", true).html(hour.precip_icon);
	    h.append("div").classed("wf-hourly-wind-avg", true)
		.style('color', (parseFloat(hour.wind_avg) < 19) ? "black" : "white")
		.style('grid-area', "wind_avg / " + col + " / wind_avg / " + col)
		.html(hour.wind_avg).style('background', "#" + hour.wind_avg_color);
	    h.append("div").classed("wf-hourly-wind-gust", true)
		.style('background', "#" + hour.wind_gust_color)
		.style('color', (parseFloat(hour.wind_gust) < 19) ? "black" : "white")
		.style('grid-area', "wind_gust / " + col + " / wind_gust / " + col)
		.html(hour.wind_gust);
	    h.append("div").classed("wf-hourly-wind-direction", true)
		.style('grid-area', "wind_direction / " + col + " / wind_direction / " + col)
		.html(hour.wind_direction);
	    h.append("div").classed("wf-hourly-wind-direction-cardinal", true)
		.style('grid-area', "wind_direction_cardinal / " + col + " / wind_direction_cardinal / " + col)
		.html(hour.wind_direction_cardinal);
	}
    }
    
    // Link to WeatherFlow and the Tempest
    if (!kioskMode) {
	const url = "https://tempestwx.com/station/" + this.stationID;
	footer = div.append("div")
	    .classed("wf-footer", true)
	    .html('<a href="' + url + '" target="_blank">' + d.location_name + "'s Tempest Weather Station</a>");
    }
}

WFForecast.prototype.render1 = function() {
    function iconURL(c) {
	return("https://tempestwx.com/images/Updated/" + c + ".svg");
    }
    
    if (this.resp == null) {
	return;
    }
    const d = this.resp;
    const id = this.id;
    const c = d3.select(id);
    c.selectAll("*").remove();
    // generate the page - I'm sure there's a better way.

    const cc = d.current_conditions;
    const forecast = d.forecast;
    const daily = forecast.daily;
    const hourly = forecast.hourly;
    
    let div = c.append("div").classed("wf", true);

    sunrise = new Date(daily[0].sunrise * 1000);
    sunset = new Date(daily[0].sunset * 1000);
    forecasttime = new Date(cc.time*1000)
    
    // current conditions
    const ccdiv = div.append("div").classed("wf-current-conditions", true);
    ccdiv.append("div").classed("wf-cc-station", true).html(d.location_name);
    ccdiv.append("div").classed("wf-cc-time", true).html("As of " + forecasttime.format("short"));
    ccdiv.append("div").classed("wf-cc-sunrise", true).html("Sunrise " + sunrise.format("time"));
    ccdiv.append("div").classed("wf-cc-sunset", true).html("Sunset " + sunset.format("time"));
    ccdiv.append("div").classed("wf-cc-temp", true).html(cc.air_temperature+"&#176;");
    ccdiv.append("div").classed("wf-cc-icon", true).html("").style('background-image', 'url("' + iconURL(cc.icon.slice(3)) + '")');
    ccdiv.append("div").classed("wf-cc-feels-like", true).html("Feels like "+cc.feels_like+"&#176;");
    ccdiv.append("div").classed("wf-cc-conditions", true).html(cc.conditions);
    ccdiv.append("div").classed("wf-cc-humidity", true).html("Humidity "+cc.relative_humidity+"%");
    ccdiv.append("div").classed("wf-cc-wind", true).html("Wind "+cc.wind_avg+" G "+cc.wind_gust+d.units_display.units_wind+ " " + cc.wind_direction_cardinal + " (" + cc.wind_direction + "&#176;)");
    ccdiv.append("div").classed("wf-cc-pressure", true).html("Pressure "+ cc.station_pressure + d.units_display.units_pressure + " " + cc.pressure_trend);
    ccdiv.append("div").classed("wf-cc-sun", true).html("Solar" +
							" UV " + cc.uv +
							" " + cc.solar_radiation + d.units_display.units_solar_radiation +
							" " + cc.brightness + d.units_display.units_brightness);

    // hourly forecasts
    const hoursdiv = div.append("div").classed("wf-hourly-forecast", true);
    let i;
    //let h = hoursdiv.append("div");
    let h = hoursdiv;
    h.append("div").classed("wf-hourly-time", true).html("Hour").style('grid-area', "time / 1 / time / 1");
    h.append("div").classed("wf-hourly-conditions", true).html("Sky").style('grid-area', "conditions / 1 / conditions / 1");
    //h.append("div").classed("wf-hourly-icon", true).html("").style('grid-area', "icon / 1 / icon / 1").style('background-image', 'url("' + iconURL(cc.icon.slice(3)) + '")');
    h.append("div").classed("wf-hourly-temp", true).html("Temp (&#176;F)").style('grid-area', "temp / 1 / temp / 1");
    h.append("div").classed("wf-hourly-pop", true).html("Precip %").style('grid-area', "pop / 1 / pop / 1");
    //h.append("div").classed("wf-hourly-precip_icon", true).html("");
    h.append("div").classed("wf-hourly-wind-avg", true).html("Wind (" + d.units_display.units_wind + ")").style('grid-area', "wind_avg / 1 / wind_avg / 1");
    h.append("div").classed("wf-hourly-wind-gust", true).html("Gusts").style('grid-area', "wind_gust / 1 / wind_gust / 1");
    h.append("div").classed("wf-hourly-wind-direction", true).html("Dir (&#176;T)").style('grid-area', "wind_direction / 1 / wind_direction / 1");
    h.append("div").classed("wf-hourly-wind-direction-cardinal", true).html("").style('grid-area', "wind_direction_cardinal / 1 / wind_direction_cardinal / 1");
    for (i = 0; i < 12; i++) {
	let hour = hourly[i];
	const col = i + 2; // there's a header column & columns start at one, not zero
	//h = hoursdiv.append("div");
	//h.append("div").classed("wf-hourly-time", true).html(hour.local_hour);
	h.append("div").classed("wf-hourly-time", true).html(hour.local_hour).style('grid-area', "time / " + col + " / time / " + col);
	h.append("div").classed("wf-hourly-conditions", true).html(hour.conditions).style('grid-area', "conditions / " + col + " / conditions / " + col);
	h.append("div").classed("wf-hourly-icon", true).html("&nbsp;").style('grid-area', "icon / " + col + " / icon / " + col).style('background-image', 'url("' + iconURL(hour.icon) + '")');
	//h.append("div").classed("wf-hourly-icon", true).html(hour.icon);
	h.append("div").classed("wf-hourly-temp", true).html(hour.air_temperature).style('grid-area', "temp / " + col + " / temp / " + col);
	h.append("div").classed("wf-hourly-pop", true).html(hour.precip_probability).style('grid-area', "pop / " + col + " / pop / " + col);
	//h.append("div").classed("wf-hourly-precip_icon", true).html(hour.precip_icon);
	h.append("div").classed("wf-hourly-wind-avg", true).html(hour.wind_avg).style('background', "#" + hour.wind_avg_color).style('color', (parseFloat(hour.wind_avg) < 19) ? "black" : "white").style('grid-area', "wind_avg / " + col + " / wind_avg / " + col);
	h.append("div").classed("wf-hourly-wind-gust", true).html(hour.wind_gust).style('background', "#" + hour.wind_gust_color).style('color', (parseFloat(hour.wind_gust) < 19) ? "black" : "white").style('grid-area', "wind_gust / " + col + " / wind_gust / " + col);
	h.append("div").classed("wf-hourly-wind-direction", true).html(hour.wind_direction).style('grid-area', "wind_direction / " + col + " / wind_direction / " + col);
	h.append("div").classed("wf-hourly-wind-direction-cardinal", true).html(hour.wind_direction_cardinal).style('grid-area', "wind_direction_cardinal / " + col + " / wind_direction_cardinal / " + col);
    }
}
