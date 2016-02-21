/**
 * Created by wwymak on 17/01/2016.
 */
var d3 = require('d3');
var fs = require('fs');
var topojson = require('topojson');

var topojsonData = require(__dirname + '/data/uk_counties.topo.json');

var width = 500,
    height = 500;
var geodata = topojson.feature(topojsonData, topojsonData.objects.uk_counties)
var projection = resetProjection(geodata);
var path = d3.geo.path().projection(projection);

/**
 * this basically rescales the projection params to make the geojson fit on the viewport
 * @param geojson
 * @returns {*} d3 projection
 */
function resetProjection(geojson){
    var center = d3.geo.centroid(geojson)
    var scale  = 150;
    var offset = [width/2, height/2];
    var projection = d3.geo.mercator().scale(scale).center(center)
        .translate(offset);

    // create the path
    var path = d3.geo.path().projection(projection);

    // using the path determine the bounds of the current map and use
    // these to determine better values for the scale and translation
    var bounds  = path.bounds(geojson);
    var hscale  = scale*width  / (bounds[1][0] - bounds[0][0]);
    var vscale  = scale*height / (bounds[1][1] - bounds[0][1]);
    scale   = (hscale < vscale) ? hscale : vscale;
    offset  = [width - (bounds[0][0] + bounds[1][0])/2,
        height - (bounds[0][1] + bounds[1][1])/2];

    // new projection
    projection = d3.geo.mercator().center(center)
        .scale(scale).translate(offset);

    return projection
}

var features = geodata.features;

var hexblocks = features.map(d => {
    var centroid = path.centroid(d);
    return {
        name: d.properties.NAME,
        cx: centroid[0],
        cy: centroid[1],
        clusterX: centroid[0],
        clusterY: centroid[1]
    }
});

//moving nodes towards the cluster center
function gravity(alpha){
    return (d) => {
        d.cy += (d.clusterY - d.cy) * alpha;
        d.cx += (d.clusterX - d.cx) * alpha;
    };
}


function tick(e) {

}

function collide(alpha){
    var quadtree = d3.geom.quadtree(hexblocks)
        .x(function(d){return d.cx;})
        .y(function(d){return d.cy;})

    var r = node.radius + 16,
        nx1 = node.x - r,
        nx2 = node.x + r,
        ny1 = node.y - r,
        ny2 = node.y + r;
    return function(quad, x1, y1, x2, y2) {
        if (quad.point && (quad.point !== node)) {
            var x = node.x - quad.point.x,
                y = node.y - quad.point.y,
                l = Math.sqrt(x * x + y * y),
                r = node.radius + quad.point.radius;
            if (l < r) {
                l = (l - r) / l * .5;
                node.x -= x *= l;
                node.y -= y *= l;
                quad.point.x += x;
                quad.point.y += y;
            }
        }
        return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
    };
}

function onEnd(){

}

var force = d3.layout.force()
    .nodes(hexblocks)
    .size([width, height])
    .gravity(0)
    .charge(0)
    .on('tick', tick)
    .on('end', onEnd);
