=====================
OpenLayers multitouch
=====================

We have created a number of related patches to OpenLayers around the overall goal of having it work well in iPhone/iPad's Mobile Safari (only preliminary testing in Android).


Scroll wheel tweaks
-------------------

Some modifications to OpenLayers.Handler.MouseWheel.prototype.wheelZoom to only respond to vertical zoom events. (Not directly related to multitouch, but was bothering me while I tested on the desktop.)

Reverts OpenLayers.Control.Navigation.prototype.wheelChange back to 2.8 so it once again allows fractional zoom (and modified .wheelUp/.wheelDown to pass original fractional delta).


Multitouch controls
-------------------

Provides an OpenLayers.Handler.Multitouch that mimics Handler.Drag to work for OpenLayers.Control.MultitouchNavigation. This latter is a simple subclass of OpenLayers.Control.DragPan to instantiate the correct handler and to handle the zoom events (simply using OpenLayers.Control.Navigation.wheelChange code in its OpenLayers 2.8 form.)

Some previous work on this had been done (http://trac.openlayers.org/ticket/1994), but I wanted to do it in less code in a way that was more compatible with the existing mouse controls/handlers.


New Tile layer
--------------

This is the big one. With multitouch, the layer needs to follow the fingers in real time, which means the map should support fractional zooming. So I have created an OpenLayers.Layer.Tile subclass of OpenLayers.Layer.HTTPRequest that basically replaces OpenLayers.Layer.Grid, but focuses only on powers-of-two style tilesets.

I initially planned to just modify OpenLayers.Layer.Grid to support the fractional zooming, but their were a number of issues with its architecture (esp. with regard to tile callbacks) that would have basically meant adding a third "mode" to that existing class. 
There was some work done to that effect a while back (http://trac.openlayers.org/ticket/442) but it was only for animation tweening.

This new layer is designed to rest at any zoom level whatsoever; it will "overzoom" the best available tiles when necessary. It preserves loaded tiles until its replacements from a new zoom level load, although it does not use Tile.Image backbuffer and does some other semi-kludgy things to deal with the OpenLayers.Tile architecture. The (optional) callback is tile (z, x, y)-based rather than bounds, so that all a user/subclass typically needs to do is to provide a standard base URL or form an appropriate URL string instead of any geometry calculations.
