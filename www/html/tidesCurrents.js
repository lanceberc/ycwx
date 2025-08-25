
const noaaTideStation = "9414290";
const minTide = -1.5;
const maxTide = 6.5;
let tideData = null;

let tideRect = { "width": 0, "height": 0};

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

export function fetchTidesAndCurrents() {
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

let tidesRO = new ResizeObserver(elements => {
    plotTides();
});

let currentsRO = new ResizeObserver(elements => {
    plotCurrents();
});

tidesRO.observe(document.querySelector(".tides-graph"));
currentsRO.observe(document.querySelector(".currents-graph"));

