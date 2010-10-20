/*jslint browser: true, undef: true, nomen: true, eqeqeq: true, regexp: true, newcap: true, immed: true */
/*global $ OpenLayers */

/* Written 2010 April 20 by Nathan Vander Wilt. */

// creates a new, empty object
OpenLayers.Util.emptyObject = function() {
	var obj = {};
	// in case someone has mucked up Object.prototype...
	for (var key in obj) {
		delete obj[key];
	}
	return obj;
};

OpenLayers.Layer.Tile = OpenLayers.Class(OpenLayers.Layer.HTTPRequest, {
	// if flipped, tile points start at bottom left instead of top left.
	flipped: true,
	
	// set these if server has less tiles than we show by "overzoom"
	serverMinZoom: null,
	serverMaxZoom: null,
	
  type: "png",
  
  isBaseLayer: true,
  
  // may override
  getTileURL: function(z, x, y, bounds) {
		var ext = this.type ? "." + this.type : "";
		return this.url + "/" + z + "/" + x + "/" + y + ext;
  },
  
	initialize: function(name, url, options) {
		OpenLayers.Layer.HTTPRequest.prototype.initialize.apply(this, 
																[name, url, null, options]);
		// initialize empty containers used internally
		this.tiles = OpenLayers.Util.emptyObject();
		this.prevTiles = [];
	},
	
	destroy: function() {
		// ...
		OpenLayers.Layer.HTTPRequest.prototype.destroy.apply(this, arguments); 
	},
	
	clone: function (obj) {
		if (!obj) {
			obj = new OpenLayers.Layer.Tile(this.name,
											this.url,
											this.params,
											this.options);
		}
		
		//get all additions from superclasses
		obj = OpenLayers.Layer.HTTPRequest.prototype.clone.apply(this, [obj]);
		
		// copy/set any non-init, non-simple values here
		if (this.tileSize) {
            obj.tileSize = this.tileSize.clone();
        }
		
		return obj;
	},
  
	setMap: function(map) {
    OpenLayers.Layer.HTTPRequest.prototype.setMap.apply(this, arguments);
    
    if (!this.serverExtent) {
      var squareMercator = 20037508.34;
      this.serverExtent = new OpenLayers.Bounds(-squareMercator, -squareMercator,
                                                squareMercator, squareMercator);
    }
  },
  
	createTile: function(tileKey, extent) {
		var nullObj = { clone : function(){ return nullObj; } };
		var tile = new OpenLayers.Tile.Image(this, nullObj, extent, null, nullObj);
		tile.referenceCount = 1;
		tile.referencedTiles = OpenLayers.Util.emptyObject();
		this.tiles[tileKey] = tile;
	},
	
	retainTile: function(tileKey) {
		var tile = this.tiles[tileKey];
		tile.referenceCount += 1;
	},
	
	releaseTile: function(tileKey) {
		var tile = this.tiles[tileKey];
		tile.referenceCount -= 1;
		if (!tile.referenceCount) {
			// release referenced "children"
			for (var childTileKey in tile.referencedTiles) {
				var childRefCount = tile.referencedTiles[childTileKey];
				while (childRefCount) {
					this.releaseTile(childTileKey);
					--childRefCount;
				}
			}
			tile.destroy();
			delete this.tiles[tileKey];
		}
	},
	
	addTileReference: function(tile, referencedTileKey) {
		this.retainTile(referencedTileKey);
		if (!tile.referencedTiles[referencedTileKey]) {
			tile.referencedTiles[referencedTileKey] = 1;
		}
		else {
			tile.referencedTiles[referencedTileKey] += 1;
		}
	},
	
	removeTileReference: function(tile, referencedTileKey) {
		this.releaseTile(referencedTileKey);
		tile.referencedTiles[referencedTileKey] -= 1;
	},
	
	retainWhileLoading: function(tileKey, loadingTile) {
		// TODO: set proper z-indexes somewhere
		var tile = this.tiles[tileKey];
		if (!tile || tile.isLoading) {
			return false;
		}
		
		this.addTileReference(loadingTile, tileKey);
		loadingTile.events.register("loadend", this, function() {
			this.removeTileReference(loadingTile, tileKey);
		});
		return true;
	},
	
	avoidBlankWhileLoading: function(tileKey) {
		var tile = this.tiles[tileKey];
		var keyParts = tileKey.split(",");
		var z = parseInt(keyParts[0], 10);
		var x = parseInt(keyParts[1], 10);
		var y = parseInt(keyParts[2], 10);
		
		// TODO: base minZ/maxZ off of actual somethingorother
		var minZ = 0;
		for (var zDiff = 1; zDiff <= (z - minZ); ++zDiff) {
			var searchZ = z - zDiff;
			var searchX = x >> zDiff;
			var searchY = y >> zDiff;
			var searchKey = [searchZ, searchX, searchY].join();
			if (this.retainWhileLoading(searchKey, tile)) {
				return;
			}
		}
		
		var maxZ = 18;
		for (var zDiff = 1; zDiff <= (maxZ - z); ++zDiff) {
			var searchZ = z + zDiff;
			var searchX = x << zDiff;
			var searchY = y << zDiff;
			
			var searchKeys = [];
			searchKeys.push([searchZ, searchX, searchY].join());
			searchKeys.push([searchZ, searchX, searchY + 1].join());
			searchKeys.push([searchZ, searchX + 1, searchY + 1].join());
			searchKeys.push([searchZ, searchX + 1, searchY].join());
			
			var numFound = 0;
			for (var searchIdx = 0; searchIdx < searchKeys.length; ++searchIdx) {
				var found = this.retainWhileLoading(searchKeys[searchIdx], tile);
				if (found) {
					++numFound;
				}
			}
			if (numFound) {
				return;
			}
		}
	},
	
	activeTiles: function(center) {
		var tiles = [];
		for (var tileKey in this.tiles) {
			tiles.push(this.tiles[tileKey]);
		}
		if (center) {
			tiles.sort(function(tileA, tileB) {
				var centerA = tileA.bounds.getCenterLonLat();
				var centerB = tileB.bounds.getCenterLonLat();
				/* NOTE: "LonLat" is typically a projected (cartesian) coordinate,
					so the following 'distance' calculations are less wrong than they look. */
				var distA = Math.pow(centerA.lon - center.lon, 2) + Math.pow(centerA.lat - center.lat, 2);
				var distB = Math.pow(centerB.lon - center.lon, 2) + Math.pow(centerB.lat - center.lat, 2);
				return (distA < distB) ? -1 : ((distA > distB) ? 1 : 0);
			});
		}
		return tiles;
	},
	
	moveTo: function(bounds, zoomChanged, dragging) {
		OpenLayers.Layer.HTTPRequest.prototype.moveTo.apply(this, arguments);
		
		var tileZoom = this.tileZoomLevel(this.map.getZoom());
		var transform = new OpenLayers.Layer.Tile.Transform(this.serverExtent,
                                                        tileZoom, this.flipped);
		
		this.getURL = function(tileExtent) {
			var tileBounds = transform.boundsToTile(tileExtent);
			// float bounds may be slightly ± intended integer value
			var x = Math.round(tileBounds.left);
			var y = Math.round(tileBounds.top);
			var z = tileZoom;
			return this.getTileURL(z, x, y, tileExtent);
		};
		
		// update/create primary (i.e. those ideal for covering viewport) tiles
		var primaryTiles = [];
		var visibleTileBounds = transform.boundsToTile(bounds);
		var intBounds = this.integralTileBounds(visibleTileBounds);
		// avoid loading thousands of tiles when map/layer config allows extreme underzoom
		var numTiles = (intBounds.right - intBounds.left) * (intBounds.bottom - intBounds.top);
		var sideLimit = 8;
		if (numTiles > sideLimit * sideLimit) {
			var center = intBounds.getCenterPixel();
			center.x = Math.round(center.x);
			center.y = Math.round(center.y);
			var halfLimit = parseInt(sideLimit / 2);
			intBounds.left = center.x - halfLimit;
			intBounds.right = center.x + halfLimit;
			intBounds.top = center.y - halfLimit;
			intBounds.bottom = center.y + halfLimit;
		}
		for (var x = intBounds.left; x < intBounds.right; ++x) {
			for (var y = intBounds.top; y < intBounds.bottom; ++y) {
				var tileKey = [tileZoom, x, y].join();
				if (!this.tiles[tileKey]) {
					var tileBounds = new OpenLayers.Bounds(x, y+1, x+1, y);
					var tileExtent = transform.boundsToMap(tileBounds);
					this.createTile(tileKey, tileExtent);
					this.avoidBlankWhileLoading(tileKey);
				}
				else {
					this.retainTile(tileKey);
				}
				primaryTiles.push(tileKey);
			}
		}
		
		// release all previous tiles (still-needed ones retained above)
		for (var tileIdx = 0; tileIdx < this.prevTiles.length; ++tileIdx) {
			var tileKey = this.prevTiles[tileIdx];
			this.releaseTile(tileKey);
		}
		
		// position / redraw all remaining tiles
		var activeTiles = this.activeTiles(this.map.getCenter());
		for (var i = 0, len = activeTiles.length; i < len; ++i) {
			var tile = activeTiles[i];
			var tileExtent = tile.bounds;
			var corner = (this.flipped) ?
				new OpenLayers.LonLat(tileExtent.left, tileExtent.top) :
				new OpenLayers.LonLat(tileExtent.left, tileExtent.bottom);
			var tilePos = this.map.getLayerPxFromLonLat(corner);
			
			// calculate tileSize based on integer corner positions to avoid pixel cracks
			var otherCorner = (this.flipped) ?
				new OpenLayers.LonLat(tileExtent.right, tileExtent.bottom) :
				new OpenLayers.LonLat(tileExtent.right, tileExtent.top);
			var otherPos = this.map.getLayerPxFromLonLat(otherCorner);
			var tileSize = new OpenLayers.Size(Math.round(otherPos.x - tilePos.x),
											   Math.round(otherPos.y - tilePos.y));
			
			// HACK: changed before each tile is positioned so its img size matches its div size
			this.getImageSize = function() {
				return tileSize;
			};
			tile.position = tilePos;
			tile.size = tileSize;
			
			if (!tile.imgDiv) {
				tile.draw();
				// HACK: workaround to display tile even if map viewport changes during load
				if (tile.imgDiv) {
					tile.imgDiv.viewRequestID  = null;
				}
			}
			else {
				// HACK: this is an "internal" method, but .draw() makes the tile flash
				// TODO: this still re-sets the url on the image. is this a problem in some browsers?
				tile.positionImage();
			}
		}
		
		this.prevTiles = primaryTiles;
	},
	
	tileZoomLevel: function(mapZoomLevel) {
		var tileZoom = Math.round(mapZoomLevel);
		if (this.serverMinZoom != null) {
			tileZoom = Math.max(this.serverMinZoom, tileZoom);
		}
		if (this.serverMaxZoom != null) {
			tileZoom = Math.min(tileZoom, this.serverMaxZoom);
		}
		return tileZoom;
	},
	
	// this is needed roundaboutly by map.getLayerPxFromLonLat() when base layer...
	getResolutionForZoom: function(mapZoomLevel) {
		var numVirtualTiles = Math.pow(2, mapZoomLevel);
		return this.serverExtent.getWidth() / (numVirtualTiles * this.tileSize.w);
	},
	
	// ...and the reverse is used occasionally when finding suitable map extents
	getZoomForResolution: function(resolution) {
		var numVirtualTiles = this.serverExtent.getWidth() / (resolution * this.tileSize.w);
		return Math.log(numVirtualTiles) / Math.LN2;
	},
	
	integralTileBounds: function(tileBounds) {
		var intBounds = new OpenLayers.Bounds();
		intBounds.left = Math.floor(tileBounds.left);
		intBounds.bottom = (this.flipped) ?
			Math.ceil(tileBounds.bottom) :
			Math.ceil(tileBounds.top);
		intBounds.right = Math.ceil(tileBounds.right);
		intBounds.top = (this.flipped) ?
			Math.floor(tileBounds.top) :
			Math.floor(tileBounds.bottom);
		return intBounds;
	},
	
	CLASS_NAME: "OpenLayers.Layer.Tile"
});

OpenLayers.Layer.Tile.Transform = OpenLayers.Class({
	// function (OpenLayers.LonLat) returning OpenLayers.Pixel
	pointToTile: null,
	
	// function (OpenLayers.Pixel) returning OpenLayers.LonLat
	pointToMap: null,
	
	initialize: function(baseBounds, zoomLevel, flipped) {
		if (baseBounds == null || zoomLevel == null) {
			return;
		}
		
		var numTiles = 1 << zoomLevel;
		var scaleX = numTiles / baseBounds.getWidth();
		var scaleY = numTiles / baseBounds.getHeight();
		var originX = baseBounds.left;
		if (flipped) {
			var originY = baseBounds.top;
			this.pointToTile = function(mapPoint) {
				var tileX = (mapPoint.lon - originX) * scaleX;
				var tileY = (originY - mapPoint.lat) * scaleY;
				return new OpenLayers.Pixel(tileX, tileY);
			};
			this.pointToMap = function(tilePoint) {
				var mapX = (tilePoint.x / scaleX) + originX;
				var mapY = originY - (tilePoint.y / scaleY);
				return new OpenLayers.LonLat(mapX, mapY);
			};
		} else {
			var originY = baseBounds.bottom;
			this.pointToTile = function(mapPoint) {
				var tileX = (mapPoint.lon - originX) * scaleX;
				var tileY = (mapPoint.lat - originY) * scaleY;
				return new OpenLayers.Pixel(tileX, tileY);
			};
			this.pointToMap = function(tilePoint) {
				var mapX = (tilePoint.x / scaleX) + originX;
				var mapY = (tilePoint.y / scaleY) + originY;
				return new OpenLayers.LonLat(mapX, mapY);
			};
		}
	},
	
	sizeToTile: function(mapSize) {
		var mapBounds = new OpenLayers.Bounds(0, mapSize.h, mapSize.w, 0);
		var tileBounds = this.boundsToTile(mapBounds);
		return new OpenLayers.size(tileBounds.getWidth(), tileBounds.getHeight());
	},
	
	sizeToMap: function(tileSize) {
		var tileBounds = new OpenLayers.Bounds(0, tileSize.h, tileSize.w, 0);
		var mapBounds = this.boundsToTile(mapBounds);
		return new OpenLayers.size(mapBounds.getWidth(), mapBounds.getHeight());
	},
	
	boundsToTile: function(mapBounds) {
		var mapPtA = new OpenLayers.LonLat(mapBounds.left, mapBounds.bottom);
		var mapPtB = new OpenLayers.LonLat(mapBounds.right, mapBounds.top);
		var tilePtA = this.pointToTile(mapPtA);
		var tilePtB = this.pointToTile(mapPtB);
		return new OpenLayers.Bounds(tilePtA.x, tilePtA.y,
									 tilePtB.x, tilePtB.y);
	},
	
	boundsToMap: function(tileBounds) {
		var tilePtA = new OpenLayers.Pixel(tileBounds.left, tileBounds.bottom);
		var tilePtB = new OpenLayers.Pixel(tileBounds.right, tileBounds.top);
		var mapPtA = this.pointToMap(tilePtA);
		var mapPtB = this.pointToMap(tilePtB);
		return new OpenLayers.Bounds(mapPtA.lon, mapPtA.lat,
									 mapPtB.lon, mapPtB.lat);
	},
	
	CLASS_NAME: "OpenLayers.Layer.Tile.Transform"
});
