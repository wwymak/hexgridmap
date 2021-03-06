/**
 * Code for the hexgrid
 */
var width = 960,
    height = 1160,
    padding = 6, // separation between nodes
    maxRadius = 20;

var svg = d3.select("#mapContainer").append("svg")
    .attr("width", width)
    .attr("height", height);

//*****hexagon grid stuff*************************//

var hexRadius = Math.sqrt(3) * maxRadius,
    hexWidth = Math.sqrt(3) * hexRadius,
    hexHeight = 2 * hexRadius;
//no of rows and cols in the hex grid
var nrows = Math.ceil((height - 0.5 * hexRadius)/ (1.5 * hexRadius)),
    ncols = Math.ceil((width - 0.5 * Math.sqrt(3) * hexRadius)/ (Math.sqrt(3) * hexRadius));

drawHexGrid(nrows, ncols, hexRadius, svg);

//finding the centroids of the hexcells
function hexCentroids(nrows, ncols, hexRadius) {
  var centroidMatrix = []; //array of arrays
  for (var i = 0; i< nrows; i++){
    var rowArr = [];
    var yCoord = hexRadius + 1.5 * hexRadius * i;
    var initX;
    if(i % 2 === 0) { //odd rows
      initX = 0.5 * Math.sqrt(3) * hexRadius;
    }else { //even rows
      initX = Math.sqrt(3) * hexRadius;
    }
    for (var j = 0; j < ncols; j++) {
      rowArr.push([(initX + j * Math.sqrt(3) * hexRadius), yCoord])
    }

    centroidMatrix.push(rowArr)
  }

  return centroidMatrix;

}

/***
 * find the closest hexcell centroid to a point with coordinates of xcoord and ycoord
 * @param xcoord
 * @param ycoord
 * @returns {*[]} array of size 2, with arr[0] corresponding to the colnumber of the hexgrid
 * and arr[1] the rownumber of the hexgrid
 */
function getClosestCentroidIndex(xcoord, ycoord){
  var yIndex = Math.round((ycoord - hexRadius) /(1.5 * hexRadius));
  var initX;
  if(yIndex % 2 === 0) { //odd rows
    initX = 0.5 * Math.sqrt(3) * hexRadius;
  }else { //even rows
    initX = Math.sqrt(3) * hexRadius;
  }
  var xIndex = Math.round((xcoord - initX)/(Math.sqrt(3) * hexRadius));

  return [xIndex, yIndex]
}

function hexagon(radius) {
  var x0 = 0, y0 = 0;
  var d3_hexbinAngles = d3.range(0, 2 * Math.PI, Math.PI / 3);
  return d3_hexbinAngles.map(function(angle) {
    var x1 = Math.sin(angle) * radius,
        y1 = -Math.cos(angle) * radius,
        dx = x1 - x0,
        dy = y1 - y0;
    x0 = x1;
    y0 = y1;
    return [dx, dy];
  });
}

function hexagonPath(radius) {
  return "m" + hexagon(radius).join("l") + "z";
}

function drawHexGrid(nrows, ncols, hexRadius, svg) {
  var centroid = hexCentroids(nrows, ncols, hexRadius);
  var hexrows = svg.selectAll('g.hexrow').data(centroid)
      .enter().append('g').attr('class', 'hexrow');

  hexrows.selectAll('path.hexagon').data(function(d){return d})
      .enter().append('path')
      .attr('class', 'hexagon')
      .attr("d", function (d) { return "M" + d[0]+ "," + d[1] + hexagonPath(hexRadius); })
      .attr('fill', 'rgba(255,255,255,0)').attr('stroke', 'black')



}

//***************************************************************//
/**
 * rest the projection params so the map fills as much of the svg as possible
 * @param json geojson
 * @returns {{projection: *, path: *}}
 */
function resetProjection(json){
  //find the geo center of the current geojson data
  var center = d3.geo.centroid(json);
  //arbitrary scale, to be tweaked
  var scale  = 150;
  //move to center for now
  var offset = [width/2, height/2];
  // set the projection
  var projection = d3.geo.mercator().scale(scale).center(center)
      .translate(offset);

  // create the path
  var path = d3.geo.path().projection(projection);

  // using the path determine the bounds of the current map and use
  // these to determine better values for the scale and translation
  //bounds = [[left, top], [right, bottom]]

  var bounds  = path.bounds(json);
  //how many times the width of the current path in pixels fit
  //within the scaling *B height
  var hscale  = scale * width  / (bounds[1][0] - bounds[0][0]);
  //similar for vertical
  var vscale  = scale * height / (bounds[1][1] - bounds[0][1]);
  if(hscale < vscale) {
    scale = hscale;
  } else {
    scale = vscale;
  }
  //shift to new center
  offset  = [width - (bounds[0][0] + bounds[1][0])/2,
    height - (bounds[0][1] + bounds[1][1])/2];

  // new projection
  projection = d3.geo.mercator().center(center)
      .scale(scale).translate(offset);
  path = path.projection(projection);

  return {
    projection: projection,
    path: path
  }
}
var geodata;
var projection = d3.geo.mercator().scale(1000);
d3.json("../data/uk_counties.topo.json", function(err, data){
  geodata = topojson.feature(data, data.objects.uk_counties)

  var center = d3.geo.centroid(geodata);
  projection.center(center);

  projection = resetProjection(geodata).projection;
  var path = d3.geo.path().projection(projection);

  var mapG = svg.append('g').attr('class', 'mapG');
  var nodeG = svg.append('g').attr('class', 'nodeG');

  mapG.selectAll("path")
      .data(geodata.features)
      .enter().append("path")
      .attr("d", d3.geo.path().projection(projection))
      .attr("stroke", "black").style("fill", "none");

  var features = geodata.features;

  var hexblocks = features.map(function(d){
    var centroid = path.centroid(d);
    return {
      name: d.properties.NAME,
      cx: centroid[0],
      cy: centroid[1],
      x: centroid[0],
      y: centroid[1],
      radius: maxRadius,
    }
  });

  //set to true when curating the hexagon layouts
  var isHexBlockmoving = false;
  var hexBlockMovingID = null;
  //force layout with the centroids as the nodes,
  //the size and width of the svg
  var force = d3.layout.force()
      .nodes(hexblocks)
      .size([width, height])
      .gravity(0)
      .charge(0) //instead of the default 30
      .on('tick', tick)
      .start();

  force.on('end', function() {
    var hexG = d3.selectAll('g.hexrow');
    hexblocks.forEach(function(hex) {
      var closest = getClosestCentroidIndex(hex.x, hex.y);
      hex.newX = closest[0];
      hex.newY = closest[1];
      hexG.filter(function(d, i){
        return i === closest[1]
      }).selectAll('path').filter(function(d, i){
        return i === closest[0]
      }).attr('fill', 'blue').attr('id', hex.name)
//                .on('mouseover', function(d, i){
//                    console.log(d3.select(this).attr('id'))
//                })

//                console.log(hexG[closest[1]])
//                hexG[closest[1]].selectAll('path')[closest[0]].attr('fill', 'blue');
    });
    d3.selectAll('.hexagon').on('click', moveHexBlock)
//            nodeG.selectAll('circle').attr('opacity', 0.1)
    d3.selectAll('.nodeG').remove()
  });

  // Move nodes toward cluster focus.
  //basically the force layout changes cy as it tries to move the
  //circles apart, but you are pulling them back towards their centroids with th
  //+= (d.clusterY - d.cy)  * alpha
  //the higher the alpah, the more strongly pulled it is
  // Move nodes toward cluster focus.
  function gravity(alpha) {
    return function(d) {
      d.y += (d.cy - d.y) * alpha;
      d.x += (d.cx - d.x) * alpha;
    };
  }

  function tick(e) {

    node.each(gravity(.2 * e.alpha))
        .each(collide(e.alpha))
        .attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; });
  }

  // Resolve collisions between nodes.
  function collide(alpha) {
    var quadtree = d3.geom.quadtree(hexblocks);
    return function(d) {
      var r = 2 * maxRadius + padding,
          nx1 = d.x - r,
          nx2 = d.x + r,
          ny1 = d.y - r,
          ny2 = d.y + r;
      quadtree.visit(function(quad, x1, y1, x2, y2) {
        if (quad.point && (quad.point !== d)) {
          var x = d.x - quad.point.x,
              y = d.y - quad.point.y,
              l = Math.sqrt(x * x + y * y),
              r = maxRadius + quad.point.radius + padding;
          if (l < r) {
            l = (l - r) / l * alpha;
            d.x -= x *= l;
            d.y -= y *= l;
            quad.point.x += x;
            quad.point.y += y;
          }
        }
        return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
      });
    };
  }

  function moveHexBlock(d, i) {
    console.log('move this block!', d3.select(this).attr('id'))
    var hexID = d3.select(this).attr('id');
    if(hexID && hexID != null && isHexBlockmoving == false) {
      //so step 1
      isHexBlockmoving = true;
      hexBlockMovingID = hexID;

      d3.select(this).attr('id', 'moving') //set the current element id to be 'moving'
          .attr('fill', 'rgba(0,0,255,0.5)'); // and set the moving fill to be
    }

    if((hexID == null ||!hexID) && isHexBlockmoving === true) {
      d3.select(this).attr('id', hexBlockMovingID)
          .attr('fill', 'blue')

      isHexBlockmoving = false;
      d3.select('#moving').attr('id', null).attr('fill', 'rgba(255,255,255,0)');
      var hexBlockEl = hexblocks.filter(function(item) {
        return item.name === hexBlockMovingID;
      });

      hexBlockEl.newX = d[0];
      hexBlockEl.newY = d[1];
    }
  }

  var node = nodeG.selectAll('.node')
      .data(hexblocks)
      .enter().append('circle')
      .attr('class', 'node');
  node.attr('r', maxRadius).attr('fill', 'grey')

  d3.select('#exportDataBtn').on('click', function() {
    var data = JSON.stringify(hexblocks);
    console.log(data)
  })

})