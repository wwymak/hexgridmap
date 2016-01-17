/**
 * Created by wwymak on 17/01/2016.
 */
var d3 = require('d3');
var fs = require('fs');
var topojson = require('topojson');

var topojsonData = require(__dirname + '/data/uk_counties.topo.json');

var width = 500,
    height = 500;
var geodata = topojson.feature(data, data.objects.uk_counties)
var projection = resetProjection(geodata);
var path = d3.geo.path().projection(projection);


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
        cy: centroid[1]
    }
})
