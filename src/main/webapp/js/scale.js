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

        // Set the parents on the new hits
        for (var j=0; j < node.children.length; j++) {
          node.children[j].parent = cacheGear;
        }
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

    function recurse(parent, node) {
        if (node.type == 'gear' || node.type == 'application') {
          node.size = node.children.reduce(function(p, v) {return p + recurse(node, v); }, 0);
        } else if (node.type == 'hit') {
          node.size = node.count;
        }
      nodes.push(node);
      return node.size;
    }

    data.size = recurse(null, data);

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

    // Enter any new links before the groups
    // This keeps them under the gears / apps
    link.enter().insert("line", "g")
      .attr("class", "link");

    // Exit any old links
    link.exit().remove();

    // Select all the groups
    groups = vis.selectAll("g")
        .data(root, key);

    // Insert the wrapper groups
    group = groups.enter()
      .append("g")
        .on("click", click)
        .call(force.drag);

    // Append circles to the wrapper
    group.append("circle");

    // Set the hit's initial positioning to the gear center
    group.filter(function(d) { return d.type == "hit" })
      .attr("cx", function(d) { return d.parent.x })
      .attr("cy", function(d) { return d.parent.y });

    // Label the gears and applications
    group.filter(function(d) { return d.type != "hit" })
      .append("text")
        .attr("dy", ".3em")
        .style("text-anchor", "middle")
        .text(function(d) { return d.type == "application" ? "App": "Gear" });

    // Exit any old nodes
    groups.exit().remove();

    // Update the circles to handle click events
    // that change color / radius
    vis.selectAll("circle")
      .data(root, key)
      .attr("r", radius)
      .style("fill", color)
      .attr("class", style);

    // Restart the force layout
    force.nodes(root).links(links).start();
}

function tick() {
    // Position the link
    link.attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; });

    // Position the group element
    groups.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
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
    return 400;
  } else if (d.target.type == 'hit') {
    return 20;
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
    return 0.1;
  } else if (d.target.type == 'hit') {
    return 0.5;
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
    return Math.log(d.size) * 10;
  } else if (d.type == 'application') {
      return 40;
    } else if (d.type == 'gear') {
      return 20;
    } else if (d.type == 'hit'){
      var result = Math.log(d.size);
      if (result == 0) result = 1;
      return result;
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
      return -5000;
    } else if (d.type == 'gear') {
      return -400;
    } else if (d.type == 'hit') {
      return -400;
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
    function click_remove(node) {
      if (node.children) {
        node._children = node.children;
        node.children = null;

        // Remove children from root as well
        // and recurse on them
        for (var i = 0; i < node._children.length; i++) {
          var child = node._children[i];
          root.splice(root.indexOf(child), 1);
          click_remove(child);
        }
      }
    }

    function click_add(node) {
      if (node._children) {
        node.children = node._children;
        node._children = null;

        // Add children back to root as well
        // and recurse on them
        for (var i = 0; i < node.children.length; i++) {
          var child = node.children[i];
          root.push(child);
          click_add(child);
        }
      }
    }

    if (d.children) {
      click_remove(d);
    } else {
      click_add(d);
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
          // Setup another poll
          poll();
        },
        dataType : "json"
    });
    }, 1000);
}

function pollLocal(selection) {
    $.getJSON('data' + selection + '.json', function(data) {
          // Only redraw if necessary
          if (merge(data)) update();
    }); 
}

/**
*---------------------------------------------------------------------
*------------------------- MAIN PROGRAM ------------------------------
*---------------------------------------------------------------------
*/
var w = 1500, h = 900, link, root = [], application, gears = {};

// The time from which to start retrieving results
var time = 0;

// Build a force layout
var force = d3.layout.force()
      .on("tick", tick)
      .linkDistance(linkDistance)
      .linkStrength(linkStrength)
      .friction(0.5)
      .gravity(0.8)
      .charge(charge)
      .size([ w, h ]);

// Add the svg object to the chart
var vis = d3.select("#chart").append("svg")
     .attr("width", w)
     .attr("height", h)
   .append("g");

// Start polling for updates
poll();

//pollLocal(0);  // To debug with local data files in Firefox
