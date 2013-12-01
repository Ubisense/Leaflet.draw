L.Draw = {};

L.Draw.Feature = L.Handler.extend({
	includes: L.Mixin.Events,

	initialize: function (map, options) {
		this._map = map;
		this._container = map._container;
		this._overlayPane = map._panes.overlayPane;
		this._popupPane = map._panes.popupPane;

		// Merge default shapeOptions options with custom shapeOptions
		if (options && options.shapeOptions) {
			options.shapeOptions = L.Util.extend({}, this.options.shapeOptions, options.shapeOptions);
		}
		L.Util.extend(this.options, options);
	},

	enable: function () {
		if (this._enabled) { return; }

		L.Handler.prototype.enable.call(this);

		this.fire('enabled', { handler: this.type });

		this._map.fire('draw:drawstart', { layerType: this.type });
	},

	disable: function () {
		if (!this._enabled) { return; }

		L.Handler.prototype.disable.call(this);

		this.fire('disabled', { handler: this.type });

		this._map.fire('draw:drawstop', { layerType: this.type });
	},

	addHooks: function () {
		if (this._map) {
			L.DomUtil.disableTextSelection();

			this._tooltip = new L.Tooltip(this._map);

			L.DomEvent.addListener(this._container, 'keyup', this._cancelDrawing, this);


			// Make a transparent pane that will be used to catch click events. 
			// These click events will create the vertices. We need to do this so we can ensure that
			// we can create vertices over other map layers (markers, vector layers). We
			// also do not want to trigger any click handlers of objects we are clicking on
			// while drawing.
			// A marker that covers the whole map is used to implement the pane. This is because the tooltip
			// might prevent a polygon from getting the events if it was used instead.
			// Click events on the marker will have a latlng of the center of the map so we define a _clickPane
			// object that will fire click events with proper latlng
			var size = this._map.getSize();
			if (!this._clickPaneMarker) {
				this._clickPaneMarker = L.marker(this._map.getCenter(), {
					icon: L.divIcon({
						className: 'leaflet-mouse-marker',
						iconAnchor: [size.x/2, size.y/2],
						iconSize: [size.x, size.y]
					}),
					opacity: 0,
					zIndexOffset: this.options.zIndexOffset
				});
			}
			this._clickPaneMarker
				.on('click', this._onPaneMarkerClick, this)
				.addTo(this._map);

			//add dummy object that will fire the click event with proper latlng
			if (!this._clickPane) this._clickPane = new (L.Class.extend({includes: L.Mixin.Events}))();

			this._map.on('move', this._onMapMove, this);
		}
	},

	removeHooks: function () {
		if (this._map) {
			L.DomUtil.enableTextSelection();

			this._tooltip.dispose();
			this._tooltip = null;

			L.DomEvent.removeListener(this._container, 'keyup', this._cancelDrawing);
			
			this._clickPaneMarker.on('click', this._onPaneMarkerClick, this);

			this._map
				.off('move', this._onMapMove, this)
				.removeLayer(this._clickPaneMarker);
		}
	},

	_onPaneMarkerClick: function (e) {
		// e.latlng will be the center of the map 
		// fire a new event on _clickPane with the latlng of the actual click 
		var map = this._map,
			containerPoint = map.mouseEventToContainerPoint(e.originalEvent),
			layerPoint = map.containerPointToLayerPoint(containerPoint),
			latlng = map.layerPointToLatLng(layerPoint);

		this._clickPane.fire(e.type, {
			latlng: latlng,
			originalEvent: e.originalEvent
		});
	},

	_onMapMove: function () {
		this._clickPaneMarker.setLatLng( this._map.getCenter() );
	},

	setOptions: function (options) {
		L.setOptions(this, options);
	},

	_fireCreatedEvent: function (layer) {
		this._map.fire('draw:created', { layer: layer, layerType: this.type });
	},

	// Cancel drawing when the escape key is pressed
	_cancelDrawing: function (e) {
		if (e.keyCode === 27) {
			this.disable();
		}
	}
});