/**
 * Merges the updated JSON structure with the root structure
 * @param data the delta JSON updates
 * @returns {Boolean} whether or not a redraw is needed
 */
function merge(data) {
	// Whether or not to redraw the layout
	var redraw = false;
	
	// First, flatten the data structure
	var nodes = flatten(data);
	
	// Merge new data, ignoring gear and application updates
	// since the updates will overwrite their x & y coordinate
	// and cause the graph to destabilize
	for (var i=0; i < nodes.length; i++) {
		var node = nodes[i];
		
		if (node.type == "hit") {
			root.push(node);
			redraw = true;
		} else if (node.type == "gear") {
			if (!(node.uuid in gears)) {
				root.push(node);
				// Cache the gear
	    		gears[node.uuid] = node;
	    		if (application) {
	    			// This might be a new gear that got created
	    			if (application.children.indexOf(node) < 0) {
	    				// The application doesn't have this gear, add it
	    				application.children.push(node);
	    			}
	    		}
	    		redraw = true;
			} else {
				// Merge the hits
				var cacheGear = gears[node.uuid];
				cacheGear.children = cacheGear.children.concat(node.children);
			}
		} else if (node.type == "application") {
			if (!application) {
				root.push(node);
				application = node;
				redraw = true;
			}
		} 
	}
	return redraw;
}

/**
 * Returns a flattened list of all the nodes in the supplied
 * data with the sizes calculated.  Size is based on the total
 * hit count for the hierarchy below each object.
 * 
 * @param data root JSON object to traverse and flatten
 * @returns {Array} the flattened array of nodes
 */
function flatten(data) {
    var nodes = [];
	
    function recurse(node) {
    	if (node.type == 'gear' || node.type == 'application') {
    		node.size = node.children.reduce(function(p, v) {return p + recurse(v); }, 0);
    	} else if (node.type == 'hit') {
    		node.size = node.count;
    	}
		nodes.push(node);
		return node.size;
	}

    data.size = recurse(data);
    
    return nodes;
}

/**
 * Update the d3 force layout based on the root structure.
 */
function update() {
    var links = d3.layout.tree().links(root);

    // Update the links
    link = vis.selectAll("line.link")
    	.data(links, link_key);

    // Enter any new links before the gears
    // This keeps them under the gears
    link.enter().insert("svg:line", ".node")
    	.attr("class", "link")
    	.attr("x1", function(d) { return d.source.x; })
    	.attr("y1", function(d) { return d.source.y; })
    	.attr("x2", function(d) { return d.target.x; })
    	.attr("y2", function(d) { return d.target.y; });

    // Exit any old links
    link.exit().remove();

    // Update the nodes
    node = vis.selectAll("circle")
    	.data(root, key)
    	.style("fill", color);
    
    // Enter any new nodes
    node.enter().append("svg:circle")
    	.attr("class", style)
    	.attr("cx", function(d) { return d.x; })
    	.attr("cy", function(d) { return d.y; })
    	.attr("r", radius)
    	.style("fill", color)
    	.on("click", click)
    	.call(force.drag);
    
    // Update the radius to handle a collapse
    node.transition()
    	.attr("r", radius);

    // Exit any old nodes
    node.exit().remove();
    
    // Restart the force layout
    force.nodes(root).links(links).start();
}

function tick() {
    link.attr("x1", function(d) { return d.source.x; })
    	.attr("y1", function(d) { return d.source.y; })
    	.attr("x2", function(d) { return d.target.x; })
    	.attr("y2", function(d) { return d.target.y; });

    node.attr("cx", function(d) { return d.x; })
    	.attr("cy", function(d) { return d.y; });
}

/**
 * Returns the unique identifier for the given link object.
 * Uses the key for the target with a prefix.
 * @param d the link object
 * @returns the unique identifier
 */
function link_key(d) {
	return "link_" + key(d.target);
}

/**
 * Returns the unique identifier for the given object
 * @param d the object
 * @returns the unique identifier
 */
function key(d) {
	if (d.type == 'application') {
    	return d.name;
    } else if (d.type == 'gear') {
    	return d.uuid;
    } else if (d.type == 'hit'){
    	return d.id;
    }
}

/**
 * Returns the color for the given object
 * @param d the object
 * @returns the color
 */
function color(d) {
	if (d.type == 'hit') {
		return "#fd8d3c";
	} else if (d._children) {
		return "#3182bd";
	} else if (d.type == 'application') {
		return "#acacac";
	} else if (d.type == 'gear') {
		return "#c6dbef";
	}
}

/**
 * Returns the link distance for the given object
 * @param d the object
 * @returns the link distance
 */
function linkDistance(d) {
	if (d.target.type == 'gear') {
		return 150;
	} else if (d.target.type == 'hit') {
		return 50;
	}
}

/**
 * Returns the link strength for the given object.
 * The link strength between the gear and hits is
 * stronger than between the application and gear to
 * allow for the gears to stretch away.
 * @param d the object
 * @returns the link strength
 */
function linkStrength(d) {
	if (d.target.type == 'gear') {
		return 0.75;
	} else if (d.target.type == 'hit') {
		return 1;
	}
}

/**
 * Returns the radius for a given object.  If the
 * object is collapsed, the size is always used.
 * Otherwise, gear and application size are constant
 * but hit sizes vary based on the count.
 * 
 * @param d the object
 * @returns the radius
 */
function radius(d) {
	if (d._children) {
		// If collapsed, show total size
		return d.size;
	} else if (d.type == 'application') {
    	return 25;
    } else if (d.type == 'gear') {
    	return 15;
    } else if (d.type == 'hit'){
    	return d.size;
    }
}

/**
 * Returns the charge or gravitational pull / push
 * for a given object.  Application and gear charge
 * is constant while hit charges vary given their
 * size (based on count).
 * 
 * @param d the object
 * @returns the charge
 */
function charge(d) {
    if (d.type == 'application') {
    	return -1000;
    } else if (d.type == 'gear') {
    	return -10;
    } else if (d.type == 'hit') {
    	return -30;
    }
}

/**
 * Returns the css classes for a given object.
 * 
 * @param d the object
 * @returns the css classes as a string
 */
function style(d) {
	if (d.type == 'application' || d.type == 'gear') {
    	return d.type + " node";
    } else {
    	return d.type;
    }
}

/**
* Handle an object being clicked.
* 
* This method essentially moved the children to a
* new / hidden structure and then redraws the layout.
* The hidden structure flags the object as collapsed
* when redrawn.
* 
* @param d the object
*/
function click(d) {
    if (d.children) {
    	d._children = d.children;
    	d.children = null;
    	
    	// Remove children from root as well
    	for (var i = 0; i < d._children.length; i++) {
    		var child = d._children[i];
    		root.splice(root.indexOf(child), 1);
    	}
    } else {
    	d.children = d._children;
    	d._children = null;
    	
    	// Add children back to root as well
    	for (var i = 0; i < d.children.length; i++) {
    		root.push(d.children[i]);
    	}
    }
    update();
}

/**
* Continuously poll for JSON updates.  Only redraws
* the layout when necessary.
*/
function poll() {
    setTimeout(function() {
    	// Store the time before calling
    	newTime = Date.now();
    	
		$.ajax({
		    url : "rest/display/" + time,
		    success : function(data) {
		    	// Only redraw if necessary
		    	if (merge(data)) update();
				
				// Set the new time to get delta data
				time = newTime;
	
				// Setup next poll
				poll();
		    },
		    error : function(error) {
		    	console.log("JSON Error - " + error);
		    },
		    dataType : "json"
		});
    }, 1000);
}


/**
*---------------------------------------------------------------------
*------------------------- MAIN PROGRAM ------------------------------
*---------------------------------------------------------------------
*/
var w = 960, h = 550, link, root = [], application, gears = {};

// The time from which to start retrieving results
var time = 0;

// Build a force layout
var force = d3.layout.force()
			.on("tick", tick)
			.linkDistance(linkDistance)
			.linkStrength(linkStrength)
			.charge(charge)
			.size([ w, h ]);

// Add the svg object to the chart
var vis = d3.select("#chart").append("svg:svg")
	.attr("width", w)
	.attr("height",	h);

// Start polling for updates
poll();