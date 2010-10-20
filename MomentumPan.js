/* Copyright (c) 2006-2008 MetaCarta, Inc., published under the Clear BSD
 * license.  See http://svn.openlayers.org/trunk/openlayers/license.txt for the
 * full text of the license. */

/**
 * @requires OpenLayers/Control.js
 * @requires OpenLayers/Handler/DragPan.js
 */


/**
 * Class: OpenLayers.Control.DragPan
 * The DragPan control pans the map with a drag of the mouse.
 *
 * Inherits from:
 *  - <OpenLayers.Control>
 */

// monkey-patch in this class to make it work automatically when included
OpenLayers.Control.OldDragPan = OpenLayers.Control.DragPan;
OpenLayers.Control.DragPan = OpenLayers.Class(OpenLayers.Control.OldDragPan, {

//OpenLayers.Control.MomentumPan = OpenLayers.Class(OpenLayers.Control.DragPan, {
    
    // don't let handler interval interfere with SCIENCE.
    interval: 0,
    
    friction: 0.05,
    
	
	/**
     * Method: draw
     * Creates a Drag handler
     */    
    draw: function() {
        this.handler = new OpenLayers.Handler.Drag(this, {
				"down": this.stopMap,
                "move": this.panMap,
                "done": this.panMapDone
            }, {
                interval: 0,
                documentDrag: this.documentDrag
            }
        );
    },
	
    /**
    * Method: panMap
    *
    * Parameters:
    * xy - {<OpenLayers.Pixel>} Pixel of the mouse position
    */
    panMap: function(xy) {
        var now = (new Date).getTime();
        this.panned = true;
        this.map.pan(
            this.handler.last.x - xy.x,
            this.handler.last.y - xy.y,
            {dragging: this.handler.dragging, animate: false}
        );
        
        var lastXY = this.handler.last;
        var distX = xy.x - lastXY.x;
        var distY = xy.y - lastXY.y;
        if (distX || distY) {
            var time = now - this.handler.lastNow;
            this.handler.lastVx = distX / time;
            this.handler.lastVy = distY / time;
            this.handler.lastNow = now;
        }
    },
    
    /**
     * Method: panMapDone
     * Finish the panning operation.  Only call setCenter (through <panMap>)
     *     if the map has actually been moved.
     *
     * Parameters:
     * xy - {<OpenLayers.Pixel>} Pixel of the mouse position
     */
    panMapDone: function(xy) {
        if (this.panned) {
            this.panMap(xy);
            this.panned = false;
        }
		
        var animationInterval = 10;
        window.clearInterval(this.intervalID);
        var me = this;
        this.intervalID = window.setInterval(function(geckoInterval) {
			var actualInverval = (geckoInterval / 2) || animationInterval;
            //console.log(me.handler.lastVx, me.handler.lastVy, "px/ms");
            me.map.pan(-me.handler.lastVx * actualInverval,
                       -me.handler.lastVy * actualInverval,
                       {animate: false});
			
			var theta = Math.atan2(me.handler.lastVy, me.handler.lastVx);
			var xA = me.friction * Math.cos(theta);
			var yA = me.friction * Math.sin(theta);
			me.handler.lastVx -= Math.min(Math.abs(me.handler.lastVx), xA);
			me.handler.lastVy -= Math.min(Math.abs(me.handler.lastVy), yA);
			
			if (Math.abs(me.handler.lastVx) <= 0.001 && Math.abs(me.handler.lastVy) <= 0.001) {
				window.clearInterval(me.intervalID);
			}
        }, animationInterval);
    },
	
	stopMap: function(xy) {
		window.clearInterval(this.intervalID);
	},
    
    CLASS_NAME: "OpenLayers.Control.MomentumPan"
});
