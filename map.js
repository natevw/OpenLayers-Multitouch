var map;

$(document).ready(function () {
	map = setupMap();
});

function setupMap() {
	var mapOptions = {
		projection: new OpenLayers.Projection("EPSG:900913"),
		units: "m",
		displayProjection: new OpenLayers.Projection("EPSG:4326"),
		maxResolution: 156543.0339,
		maxExtent: new OpenLayers.Bounds(-20037508, -20037508, 20037508, 20037508.34),
		fractionalZoom: true,
		numZoomLevels: 25
	};
	var map = new OpenLayers.Map('map', mapOptions);
	
	var osmTiles = new OpenLayers.Layer.Tile("Open Street Map",
											 "http://tile.openstreetmap.org",
											 {serverMinZoom: 0, serverMaxZoom: 18});
	map.addLayer(osmTiles);
	
	var center = new OpenLayers.LonLat(-119.25005735342, 46.227542340702);
	map.setCenter(center.transform(map.displayProjection, map.projection), 13.7);
	
	if (OpenLayers.Control.MultitouchNavigation) {
		var touchControl = new OpenLayers.Control.MultitouchNavigation();
		map.addControl(touchControl);
	}
	
	return map;
}
