// Gauge for anemometer

let Gauges = {}; // Used with visibility event to redraw - could store object in DOM instead

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

function Gauge(container, configuration) {
    this.container = container;
    this.id = "#" + container;

    this.config = {
	classRoot: "gauge",
	arcSegments: 0, // # of color segments in dial - defaults to # of ticks
	arcColorFn: d3.interpolateHsl(d3.rgb('#e8e2ca'), d3.rgb('#3e6c0a')),

	// If using multiple pointers all values must be specified when configuring
	pointers: [
	    {
		pointerWidth: 10,
		pointerTailLength: 5,
		pointerHeadLengthPercent: 0.9,
		transitionMs: 750,
		val: 0,
	    }
	],
	      
	minValue: 0,
	maxValue: 10,
	      
	minAngle: -90,
	maxAngle: 90,
	      
	arcMajorTicks: 5,
	arcLabelFormat: d3.format(',g'),
	arcLabelInset: 10,
    };
    
    for (let prop in configuration ) {
	this.config[prop] = configuration[prop];
    }

    this.pcr = {width: 0, height:0};
    
    this.range = this.config.maxAngle - this.config.minAngle;
    this.radius = undefined;
	  
    this.scale = undefined;
    this.pointer = undefined;

    this.RO = new ResizeObserver(elements => {
	for (let e of elements) {
	    const cr = e.contentRect;
	    const id = e.target.id
	    console.log(`Gauge RO ${id} new size ${cr.width} x ${cr.height}`);
	    Gauges[id].render();
	}
    });
    Gauges[container] = this;
    this.RO.observe(document.querySelector('#' + container));

    console.log(`Gauge ${container} initialized`);
}

Gauge.prototype.render = function() {
    function deg2rad(deg) {
	return deg * Math.PI / 180;
    }

    config = this.config;

    if (typeof this.rendering === 'undefined') {
	this.rendering = false;
    }

    if (this.rendering) {
	return;
    }
    this.rendering = true;
	  
    // a linear scale that maps domain values to a percent from 0..1
    const scale = d3.scaleLinear()
	.range([0,1])
	.domain([config.minValue, config.maxValue]);
    this.scale = scale;
	      
    let ticks = this.scale.ticks(config.arcMajorTicks);
    let tickData = d3.range(config.arcMajorTicks).map(function() {return 1/config.arcMajorTicks;});

    const id = '#' + this.container;

    const node = d3.select(id).node();
    const parentNode = node.parentNode;
    const parent2Node = parentNode.parentNode;
    const parent3Node = parent2Node.parentNode;
    const cr = node.getBoundingClientRect();
    const pcr = parentNode.getBoundingClientRect();
    const p3cr = parent3Node.getBoundingClientRect();
    const labelcr = d3.select(id + "-label").node().getBoundingClientRect();
    const plotlabelcr = d3.select(id + "-plot-label").node().getBoundingClientRect();
    //console.log(`gauge cr ${cr.width} x ${cr.height}`);

    if ((cr.width == 0) && (cr.height == 0)) {
	this.rendering = false;
	return;
    }
    
    if ((typeof this.pcr !== 'undefined') &&
	(Math.round(this.pcr.width) == Math.round(pcr.width)) &&
	(Math.round(this.pcr.height) == Math.round(pcr.height))) {
	this.rendering = false;
	return;
    }

    this.pcr = pcr;

    //let width = cr.width;
    //let height = pcr.height - (labelcr.height + plotlabelcr.height);
    let labelHeight = labelcr.bottom - labelcr.top;
    let plotlabelHeight = plotlabelcr.bottom - plotlabelcr.top;
    console.log(`gauge render labelcr     ${labelcr.top} ${labelcr.bottom} ${labelHeight}`);
    console.log(`gauge render pcr         ${pcr.top} ${pcr.bottom} ${pcr.bottom - pcr.top}`);
    console.log(`gauge render plotlabelcr ${plotlabelcr.top} ${plotlabelcr.bottom} ${plotlabelHeight}`);
    console.log(`gauge render p3cr ${p3cr.width} x ${p3cr.height}`);
    
    //let width = (cr.width) ? cr.width : pcr.right - pcr.left;
    //let height = (cr.height) ? cr.height : (pcr.bottom - pcr.top) - (labelHeight + plotlabelcr.height);
    let width = pcr.right - pcr.left;
    let height = (pcr.bottom - pcr.top) - (labelHeight + plotlabelcr.height);
    let ar = 16.0 / 9.0; // Aspect ratio
    console.log(`gauge render parent ${width} x ${height}`);
    if (width / height > ar) {
	width = height * ar;
	console.log(`gauge render adjust width ${width}`);
    } else {
	height = width / ar;
	console.log(`gauge render adjust height ${height}`);
    }

    let margin;
    if (p3cr.height < p3cr.width) {
	// Landscape
	margin = { left: vw(0.00), top: vh(0.00), right: vw(0.00), bottom: vh(0.0) };
    } else {
	// Portrait
	margin = { left: vw(1.50), top: vh(1.50), right: vw(1.50), bottom: vh(0.0) };
    }

    d3.select(id).selectAll("*").remove();
    const svg = d3.select(id)
	  .append('svg')
	  .classed(config.classRoot + "-gauge", true)
	  .attr("width", width).attr("height", height)
	  .attr("viewBox", -margin.left + " " + -margin.top + " " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
    ;

    let radius = width / 2;
    radius = (radius < height) ? radius : height;

    this.radius = radius;
		  
    //console.log(`gauge pcr ${pcr.width} x ${pcr.height}`);
    //console.log(`gauge label ${labelcr.width} x ${labelcr.height}`);
    //console.log(`gauge plotlabel ${plotlabelcr.width} x ${plotlabelcr.height}`);
    //console.log(`gauge aheight ${aheight}`);
    console.log(`gauge render viewBox ${width} x ${height} radius ${radius}`);
	      
    let centerTx = 'translate('+ radius +','+ radius +')';
    const range = this.range;
	      
    let arc = d3.arc()
	.innerRadius(radius/2)
	.outerRadius(radius - plotlabelcr.height)
	.startAngle(function(d, i) {
	    var ratio = d * i;
	    return deg2rad(config.minAngle + (ratio * range));
	})
	.endAngle(function(d, i) {
	    var ratio = d * (i+1);
	    return deg2rad(config.minAngle + (ratio * range));
	});
	      
    // The circular gauge dial
    const arcs = svg.append('g')
	  .classed(config.classRoot + "-arc", true)
	  .attr('transform', centerTx);

    // Dial arc is a gradient with N segments.
    let gradient = tickData; // Default to # of ticks
    if (config.arcSegments != 0) {
	gradient = Array(config.arcSegments);
	for (let i = 0; i < config.arcSegments; i++) {
	    gradient[i] = 1.0 / config.arcSegments;
	}
    }
    arcs.selectAll('path')
	.data(gradient)
	.enter().append('path')
	.attr('fill', function(d, i) {
	    return config.arcColorFn(d * i);
	})
	.attr('d', arc);

    // Arc labels
    var lg = svg.append('g')
	.classed(config.classRoot + "-gauge-label", true)
	.attr('transform', centerTx);
    lg.selectAll('text')
	.data(ticks)
	.enter().append('text')
	.attr('transform', function(d) {
	    var ratio = scale(d);
	    var newAngle = config.minAngle + (ratio * range);
	    return 'rotate(' + newAngle +') translate(0,' + -(radius-vw(2)) +')';
	})
	.text(config.arcLabelFormat);

    // Pointer(s)
    for (let i = 0; i < config.pointers.length; i++) {
	p = config.pointers[i];
	const pointerHeadLength = Math.round(radius * p.pointerHeadLengthPercent);
	const pointerWidth = Math.round(radius * p.pointerWidthPercent);
	const pointerTailLength = Math.round(radius * p.pointerTailPercent);
	const lineData = [ [pointerWidth / 2, 0],
			   [0, -pointerHeadLength],
			   [-(pointerWidth / 2), 0],
			   [0, pointerTailLength],
			   [pointerWidth / 2, 0] ];

	const pointerLine = d3.line().curve(d3.curveMonotoneX);
	const pg = svg.append('g').data([lineData])
	      .classed(config.classRoot + "-pointer-" + i, true)
	      .attr('transform', centerTx);
		  
	const ratio = scale(p.val);
	const newAngle = config.minAngle + (ratio * range);
	//console.log(`gauge render pointer ${i} val ${p.val} angle ${newAngle}`);
	config.pointers[i].pointer = pg.append('path')
	    .attr('d', pointerLine/*function(d) { return pointerLine(d) +'Z';}*/ ) // Don't need to close path w/ Z
	    .attr('transform', 'rotate(' + newAngle +')');

	//console.log(`gauge render pointer ${i} val ${p.val}`);
    }
    this.rendering = false;
}

Gauge.prototype.update = function(pointer, newValue) {
    if (pointer === undefined) { // Called when gauge becomes visible
	for (let i in this.config.pointers) {
	    p = this.config.pointers[i];
	    // console.log("reset pointer " + i + " to " + p.val);
	    const ratio = this.scale(p.val);
	    const newAngle = this.config.minAngle + (ratio * this.range);
	    p.pointer.transition()
		.duration(0)
		.attr('transform', 'rotate(' + newAngle +')');
	    /*
	    p.pointer.transition()
		.duration(p.transitionMs)
		.ease(d3.easeElastic)
		.attr('transform', 'rotate(' + newAngle +')');
	    */
	}
	return;
    }
	      
    this.config.pointers[pointer].val = newValue;
    if (document.hidden) {
	//console.log("anemometer " + pointer + ": " + newValue + " update: document is hidden");
	return;
    }

    // Called before gauge is rendered
    if (typeof this.config.pointers[pointer].pointer === 'undefined') {
	return;
    }
	      
    const ratio = this.scale(newValue);
    const newAngle = this.config.minAngle + (ratio * this.range);
    /*
    this.config.pointers[pointer].pointer.transition()
	.duration(config.pointers[pointer].transitionMs)
	.ease(d3.easeElastic)
	.attr('transform', 'rotate(' + newAngle +')');
    */
    this.config.pointers[pointer].pointer.transition()
	.duration(0)
	.attr('transform', 'rotate(' + newAngle +')');
    //console.log("anemometer rotated to " + newAngle);
}
