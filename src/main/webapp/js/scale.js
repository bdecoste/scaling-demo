function process(gear_callback, hit_callback, app) {
  var updated = false;

  if (!app) app = application;

  for (var i = 0; i < app.children.length; i++) {
    var gear = app.children[i];

    if (gear_callback) {
      updated = gear_callback(gear, i) || updated;
    }

    for (var j = 0; j < gear.children.length; j++) {
      var hit = gear.children[j];

      if (hit_callback) {
       updated = hit_callback(hit, gear, j) || updated;
      }
    }
  }

  return updated;
}

function prune(gear_callback, hit_callback) {
  var updated = false;

  for (var i = 0; i < application.children.length; i++) {
    var gear = application.children[i];

    // Process the hits first in case they influence
    // the gear pruning
    for (var j = 0; j < gear.children.length; j++) {
      var hit = gear.children[j];

      if (hit_callback) {
        if (hit_callback(hit, gear, j)) {
          gear.children.splice(j, 1);
          j--;

          // Remove the hit from the cache
          delete hits[hit.id];

          updated = true;
        }
      }
    }

    // Now prune the gears
    if (gear_callback) {
      if (gear_callback(gear, i)) {
        application.children.splice(i, 1);
        i--;

        // Remove the gear from the cache
        delete gears[gear.uuid];

        updated = true;
      }
    }
  }

  return updated;
}

function processHits(hit_callback) {
  process(null, hit_callback);
}

/**
 * Merges the updated JSON structure with the root structure
 * @param data the delta JSON updates
 * @returns {Boolean} whether or not a redraw is needed
 */
function merge(data) {
  // Whether or not to redraw the layout
  var updated = updateCache(data);

  // Now prune out any old hits
  var pruned = prune(
    function(gear) { 
      return gear.children == 0;
    },
    function(hit) {
      return (Date.now() - 1000*60*pruneTime) > new Date(hit.timestamp).getTime();
    }
  );

  // Re-calculate the object sizes
  calculateSizes();

  // First, flatten the data structure
  root = flatten();

  // Return whether to redraw
  return updated || pruned;
}

function cacheHit(hit, gear) {
  // Cache gear lookup by hit ID
  hits[hit.id] = gears[gear.uuid];
}

function cacheGear(gear) {
  var updated = false;

  // Handle gear caching
  if (!(gear.uuid in gears)) {
    // Cache gear lookup by UUID
    gears[gear.uuid] = gear;

    // This might be a new gear that got created
    if (application.children.indexOf(gear) < 0) {
      // The application doesn't have this gear, add it
      application.children.push(gear);
      updated = true;
    }
  } else {
    if (gear.children.length > 0) {
      // Gear cache already exists, merge the hits
      var cacheGear = gears[gear.uuid];
      cacheGear.children = cacheGear.children.concat(gear.children);
      updated = true;
    }
  }

  return updated;
}

function updateCache(data) {
  var updated = false;

  // Update the application cache
  if (!application) {
    application = data;
    updated = true;
  }

  // Update the gear cache
  return process(cacheGear, cacheHit, data);
}

function calculateSizes() {
  application.size = 0;

  process(
    function(gear) {
      gear.size = 0;
    },
    function(hit, gear) {
      hit.size = hit.count
      gear.size += hit.size;
      application.size += hit.size;
    }
  );
}

// Flatten the structure into an array
function flatten() {
  var nodes = [];

  nodes.push(application);

  process(
    function(gear) { nodes.push(gear); },
    function(hit) { nodes.push(hit); }
  );

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
    link.exit().transition()
      .duration(1000)
      .style("fill-opacity", 0)
      .style("stroke-opacity", 0)
      .remove();

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
      .attr("cx", function(d) { return hits[d.id].x; })
      .attr("cy", function(d) { return hits[d.id].y; });

    // Label the gears and applications
    group.filter(function(d) { return d.type != "hit" })
      .append("text")
        .attr("dy", ".3em")
        .style("text-anchor", "middle")
        .text(function(d) { return d.type == "application" ? "App": "Gear" });

    // Exit any old nodes
    groups.exit().transition()
        .duration(1000)
        .style("fill-opacity", 0)
        .style("stroke-opacity", 0)
      .remove();

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
    return 200;
  } else if (d.target.type == 'hit') {
    return 40;
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
    return 0.9;
  } else if (d.target.type == 'hit') {
    return 0.9;
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
      return -10;
    } else if (d.type == 'gear') {
      return -10;
    } else if (d.type == 'hit') {
      return -100;
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
var w = 1500, h = 900, link, root = [], application, gears = {}, hits = {};

// The time from which to start retrieving results
var time = 0;

// The amount of time before pruning hits
var pruneTime = 2;

// Build a force layout
var force = d3.layout.force()
      .on("tick", tick)
      .linkDistance(linkDistance)
      .linkStrength(linkStrength)
      .friction(0.7)
      .gravity(0.2)
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
