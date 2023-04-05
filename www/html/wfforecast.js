// Get and display forecasts from WeatherFlow.

let WFForecasts = {};

function WFForecast(container, stationID, nickname) {
    this.container = container;
    this.stationID = stationID
    this.nickname = nickname;
    this.id = "#" + container;
    this.resp = null;
}

//const WxFlowForecastURL="https://swd.weatherflow.com/swd/rest/better_forecast?api_key=&build=44&station_id=&lat=38.03598&lon=-121.49423&units_temp=f&units_wind=kts&units_pressure=mb&units_distance=mi&units_precip=in&units_other=imperial&units_direction=mph&_=";

WFForecast.prototype.fetch = function() {
      const WxFlowForecastURL="https://swd.weatherflow.com/swd/rest/better_forecast?api_key=&build=44&station_id=&units_temp=f&units_wind=kts&units_pressure=mb&units_distance=mi&units_precip=in&units_other=imperial&units_direction=mph&_=";
    const nonce = Date.now()
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
		console.log("Couldn't fetch WxFlow forcast data from url: " + url);
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
    ccdiv.append("div").classed("wf-cc-sun", true).html("Solar - " +
							" " + cc.solar_radiation + d.units_display.units_solar_radiation +
							" " + cc.brightness + d.units_display.units_brightness +
						       	" UV " + cc.uv);

    // hourly forecasts
    for (row = 0; row < 2; row++) {
	const hoursdiv = div.append("div").classed("wf-hourly-forecast", true);
	let i;
	let h = hoursdiv;

	// Header column
	h.append("div").classed("wf-hourly-time", true).html("Hour").style('grid-area', "time / 1 / time / 1");
	//h.append("div").classed("wf-hourly-conditions", true).html("Sky").style('grid-area', "icon / 1 / icon / 1");
	h.append("div").classed("wf-hourly-temp", true).html("Temp (&#176;F)").style('grid-area', "temp / 1 / temp / 1");
	h.append("div").classed("wf-hourly-pop", true).html("Precip %").style('grid-area', "pop / 1 / pop / 1");
	//h.append("div").classed("wf-hourly-precip_icon", true).html("");
	h.append("div").classed("wf-hourly-wind-avg", true).html("Wind (" + d.units_display.units_wind + ")").style('grid-area', "wind_avg / 1 / wind_avg / 1");
	h.append("div").classed("wf-hourly-wind-gust", true).html("Gusts").style('grid-area', "wind_gust / 1 / wind_gust / 1");
	h.append("div").classed("wf-hourly-wind-direction", true).html("Dir (&#176;T)").style('grid-area', "wind_direction / 1 / wind_direction / 1");
	h.append("div").classed("wf-hourly-wind-direction-cardinal", true).html("").style('grid-area', "wind_direction_cardinal / 1 / wind_direction_cardinal / 1");
	
	for (i = 0; i < 24; i++) {
	    let hour = hourly[(row * 24) + i];
	    const col = i + 2; // there's a header column & columns start at one, not zero

	    if ((i == 0) || (hour.local_hour == 0)) {
		let dd = new Date(hour.time * 1000);
		const dateString = dd.format("month") + "/" + dd.format("date");
		h.append("div").classed("wf-hourly-day", true).html(dd.format("day")).style('grid-area', "day / " + col + " / day / " + col);
		//h.append("div").classed("wf-hourly-date", true).html(dateString).style('grid-area', "date / " + col + " / date / " + col);
	    }
	    
	    h.append("div").classed("wf-hourly-time", true).html(hour.local_hour).style('grid-area', "time / " + col + " / time / " + col);
	    //h.append("div").classed("wf-hourly-conditions", true).html(hour.conditions).style('grid-area', "conditions / " + col + " / conditions / " + col);
	    h.append("div").classed("wf-hourly-icon", true).html("&nbsp;").style('grid-area', "icon / " + col + " / icon / " + col).style('background-image', 'url("' + iconURL(hour.icon) + '")');
	    h.append("div").classed("wf-hourly-temp", true).html(hour.air_temperature).style('grid-area', "temp / " + col + " / temp / " + col);
	    h.append("div").classed("wf-hourly-pop", true).html(hour.precip_probability).style('grid-area', "pop / " + col + " / pop / " + col);
	    //h.append("div").classed("wf-hourly-precip_icon", true).html(hour.precip_icon);
	    h.append("div").classed("wf-hourly-wind-avg", true).html(hour.wind_avg).style('background', "#" + hour.wind_avg_color).style('color', (parseFloat(hour.wind_avg) < 19) ? "black" : "white").style('grid-area', "wind_avg / " + col + " / wind_avg / " + col);
	    h.append("div").classed("wf-hourly-wind-gust", true).html(hour.wind_gust).style('background', "#" + hour.wind_gust_color).style('color', (parseFloat(hour.wind_gust) < 19) ? "black" : "white").style('grid-area', "wind_gust / " + col + " / wind_gust / " + col);
	    h.append("div").classed("wf-hourly-wind-direction", true).html(hour.wind_direction).style('grid-area', "wind_direction / " + col + " / wind_direction / " + col);
	    h.append("div").classed("wf-hourly-wind-direction-cardinal", true).html(hour.wind_direction_cardinal).style('grid-area', "wind_direction_cardinal / " + col + " / wind_direction_cardinal / " + col);
	}
    }
    
    // Link to WeatherFlow and the Tempest
    if (!kioskMode) {
	let url = "https://tempestwx.com/station/" + this.stationID;
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
