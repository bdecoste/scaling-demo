function merge(newData) {
	// Whether or not to redraw the layout
	var update = false;
	
	// Merge new data, ignoring gear and application updates
	// since the updates will overwrite their x & y coordinate
	// and cause the graph to destabilize
	for (var i=0; i < newData.length; i++) {
		var newObj = newData[i];

		if (newObj.type == "hit") {
			root.push(newObj);
			update = true;
		} else if (newObj.type == "gear") {
			if (!(newObj.uuid in gears)) {
				// Merge the gear itself
				root.push(newObj);
	    		gears[newObj.uuid] = newObj;
	    		update = true;
			} else {
				// Merge the hits
				cacheGear = gears[newObj.uuid];
				cacheGear.children = cacheGear.children.concat(newObj.children);
			}
		} else if (newObj.type == "application") {
			if (!(newObj.name in apps)) {
				root.push(newObj);
				apps[newObj.name] = newObj;
			}
		} 
	}
	return update;
}

function update() {
	nodes = root;
	
    var links = d3.layout.tree().links(nodes);

    // Update the links
    link = vis.selectAll("line.link")
    	.data(links);

    //console.log("Link enter results:");
    //console.log(link.enter());
    
    // Enter any new links
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
    	.data(nodes, key)
    	.style("fill", color);
    
    //console.log("Update results:");
    //console.log(node);

    //node.transition()
    //	.attr("r", radius);
    
    
    //console.log("Enter results:");
    //console.log(node.enter());

    // Enter any new nodes
    node.enter().append("svg:circle")
    	.attr("class", style)
    	.attr("cx", function(d) { return d.x; })
    	.attr("cy", function(d) { return d.y; })
    	.attr("r", radius)
    	.style("fill", color)
    	.on("click", click)
    	.call(force.drag);

    //console.log("Exit results:");
    //console.log(node.exit());
    
    // Exit any old nodes
    node.exit().remove();
    
    // Restart the force layout
    force.nodes(nodes).links(links).start();
}

function tick() {
    link.attr("x1", function(d) { return d.source.x; })
    	.attr("y1", function(d) { return d.source.y; })
    	.attr("x2", function(d) { return d.target.x; })
    	.attr("y2", function(d) { return d.target.y; });

    node.attr("cx", function(d) { return d.x; })
    	.attr("cy", function(d) { return d.y; });
}

function key(d) {
	if (d.type == 'application') {
    	return d.name;
    } else if (d.type == 'gear') {
    	return d.uuid;
    } else if (d.type == 'hit'){
    	return d.id;
    }
}

// Color leaf nodes orange, and packages white or blue.
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

function linkDistance(d) {
	if (d.target.type == 'gear') {
		return 150;
	} else if (d.target.type == 'hit') {
		return 50;
	}
}


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

function charge(d) {
    if (d.type == 'application') {
    	return -100;
    } else if (d.type == 'gear') {
    	return -50;
    } else if (d.type == 'hit') {
    	return d.size * -10;
    }
}

function style(d) {
    return d.type;
}

// Toggle children on click.
function click(d) {
    if (d.children) {
    	d._children = d.children;
    	d.children = null;
    } else {
    	d.children = d._children;
    	d._children = null;
    }
    update();
}

// Returns a list of all nodes under the root.
function flatten(data) {
    var nodes = [];
	
    function recurse(node) {
    	//console.log(node);
    	if (node.type == 'gear' || node.type == 'application') {
    		node.size = node.children.reduce(function(p, v) {return p + recurse(v); }, 0);
    	} else if (node.type == 'hit') {
    		node.size = node.count;
    	}
		nodes.push(node);
		return node.size;
	}

    data.size = recurse(data);
    
    //console.log("Flattened data:");
    //console.log(nodes);
    return nodes;
}

function poll() {
    setTimeout(function() {
    	// Store the time before calling
    	newTime = Date.now();
    	
		$.ajax({
		    url : "rest/display/" + time,
		    success : function(data) {
		    	// Add the new data to the root structure
		    	shouldUpdate = merge(flatten(data));
		    	//console.log("Merged data:");
		    	//console.log(root);
		    	
		    	// Update it
		    	if (shouldUpdate) update();
				
				// Set the new time to get delta data
				time = newTime;
	
				// Setup next poll
				poll();
		    },
		    dataType : "json"
		});
    }, 1000);
}

var w = 960, h = 500, node, link, root = [], apps = {}, gears = {}, time = 1369170000000;
var force = d3.layout.force()
			.on("tick", tick)
			.linkDistance(linkDistance)
			.charge(charge)
			.size([ w, h ]);

var vis = d3.select("#chart").append("svg:svg")
	.attr("width", w)
	.attr("height",	h);

// Start polling
poll();