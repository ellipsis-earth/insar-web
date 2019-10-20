import React, { PureComponent } from 'react';

import { Map, Marker, GeoJSON } from 'react-leaflet';
import 'leaflet-draw';
import L from 'leaflet';

import ApiManager from '../../ApiManager';

import Utility from '../../Utility';
import ViewerUtility from './ViewerUtility';

import TimestampSelector from './TimestampSelector/TimestampSelector';

import ControlsPane from './ControlsPane/ControlsPane';
import DataPane from './DataPane/DataPane';
import SelectionPane from './SelectionPane/SelectionPane';

import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

import './Viewer.css';

// This block is purely to get the marker icon of Leaflet to work.
// Taken somewhere from the web.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});

const MAP_PANE_NAME = 'map_pane';
const CONTROL_PANE_NAME = 'control_pane';
const DATA_PANE_NAME = 'data_pane';

const DEFAULT_VIEWPORT = {
  center: [40.509865, -0.118092],
  zoom: 2
}

class Viewer extends PureComponent {

  controlsPane = null;
  dataPane = null;
  selectionPane = null;

  leafletMap = null;

  leafletLayers = null;
  selectedElementLayer = null;
  referenceElementLayer = null;
  drawnPolygonLayer = null;

  setNewViewportTimer = null;
  selectTimestampTimer = null;

  drawnPolygonGeoJson = null;

  flyToInfo = null;

  constructor(props, context) {
    super(props, context);

    this.leafletMap = React.createRef();
    this.controlsPane = React.createRef();
    this.dataPane = React.createRef();
    this.selectionPane = React.createRef();

    this.state = {
      leafletMapViewport: DEFAULT_VIEWPORT,
      isSmallWindow: false,

      panes: [CONTROL_PANE_NAME, MAP_PANE_NAME],

      map: null,
      timestampRange: {
        start: 0,
        end: 0
      },

      selectedElement: null,

      geolocation: null,

      overrideLeafletLayers: null
    };
  }

  initializeDrawingControl = () => {
    let map = this.leafletMap.current.leafletElement;

    let drawControl = new L.Control.Draw({
      draw: {
        polygon: {
          allowIntersection: false
        },
        rectangle: false,
        marker: false,
        polyline: false,
        circle: false,
        circlemarker: false
      },
      edit: false
    });

    map.addControl(drawControl);
    map.on(L.Draw.Event.CREATED, this.onShapeDrawnClosure);

  }

  componentDidMount() {
    navigator.geolocation.getCurrentPosition(
      this.setLocation,
      (err) => {
        console.warn(`Error ${err.code}: ${err.message}`);
        this.setLocation(null);
      },
      { enableHighAccuracy: true }
    );

    this.onLeafletMapViewportChanged(DEFAULT_VIEWPORT);

    window.addEventListener('resize', this.onWindowResize);
    this.onWindowResize(null, () => {
      let panes = this.state.panes;
      if (panes.length > 1 && this.state.isSmallWindow) {
        panes = [MAP_PANE_NAME];
      }

      this.setState({ panes: panes }, () => this.leafletMap.current.leafletElement.invalidateSize());
    });

    this.initializeDrawingControl();
  }

  setLocation = (position) => {
    if (position) {
      if (!this.state.geolocation || this.state.geolocation.latitude !== position.coords.latitude ||
        this.state.geolocation.longitude !== position.coords.longitude) {
          let newGeolocation = [position.coords.latitude, position.coords.longitude];
          this.setState({ geolocation: newGeolocation });
      }
    }

    setTimeout(() => {
        navigator.geolocation.getCurrentPosition(
          this.setLocation,
          (err) => {
            console.warn(`Error ${err.code}: ${err.message}`);
            this.setLocation(null);
          },
          { enableHighAccuracy: true }
        );
      },
      1000 * 10
    );
  }

  onWindowResize = (_, cb) => {
    let isSmallWindow = window.innerWidth <= 700;

    if (this.state.isSmallWindow !== isSmallWindow) {
      this.setState({ isSmallWindow: isSmallWindow }, () => {
        this.openPane(MAP_PANE_NAME, isSmallWindow);
        if (cb) {
          cb();
        }
      });
    }
    else if (cb) {
      cb();
    }
  }

  onShapeDrawnClosure = (e) => {
    let layer = e.layer;

    let geoJson = layer.toGeoJSON();
    geoJson.properties.id = Math.random();

    let selectDrawnPolygon = () => {
      if (!this.state.map) {
        return;
      }

      this.selectFeature(ViewerUtility.drawnPolygonLayerType, geoJson, true);
    }

    let drawnPolygonLayer = (
      <GeoJSON
        key={Math.random()}
        data={geoJson}
        zIndex={ViewerUtility.drawnPolygonLayerZIndex}
        onEachFeature={(_, layer) => layer.on({ click: selectDrawnPolygon })}
      />
    );

    this.drawnPolygonGeoJson = geoJson;
    let dataPaneAction = this.state.dataPaneAction;
    if (dataPaneAction !== ViewerUtility.dataPaneAction.createCustomPolygon) {
      dataPaneAction = null;
    }

    this.setState({
      drawnPolygonLayer: drawnPolygonLayer ,
      dataPaneAction: dataPaneAction
    }, () => {
      this.rebuildAllLayers();
      selectDrawnPolygon();
    });
  }

  openPane = (paneName, closePane) => {
    let currentPanes = this.state.panes;

    let changed = false;

    if (!this.state.isSmallWindow) {
      if (!currentPanes.includes(paneName)) {
        currentPanes.push(paneName);
        changed = true;
      }
      else if (paneName !== MAP_PANE_NAME && closePane) {
        currentPanes = Utility.arrayRemove(currentPanes, paneName);
        changed = true;
      }
    }
    else {
      if (!currentPanes.includes(paneName)) {
        currentPanes = [paneName];
        changed = true;
      }
      else if (closePane) {
        currentPanes = [MAP_PANE_NAME];
        changed = true;
      }

    }

    if (changed) {
      currentPanes = [...currentPanes];
      this.setState({ panes: currentPanes }, () => {
        this.leafletMap.current.leafletElement.invalidateSize();
        this.attemptFlyTo();
      });
    }
  }

  onSelectMap = (map) => {
    this.selectedElementLayer = null;
    this.referenceElementLayer = null;
    this.drawnPolygonLayer = null;
    this.drawnPolygonGeoJson = null;

    let dataPaneAction = this.state.dataPaneAction;
    if (dataPaneAction !== ViewerUtility.dataPaneAction.feed) {
      dataPaneAction = null;
    }

    this.setState({
      map: map,
      dataPaneAction: dataPaneAction,
      selectedElement: null,
      timestampRange: {
        start: map.timestamps.length - 1,
        end: map.timestamps.length - 1
      },
      overrideLeafletLayers: null
    }, () => {
      this.onFlyTo({ type: ViewerUtility.flyToType.map, delay: true });
    });
  }

  onLayersChange = (layers, isOverride) => {
    if (!isOverride) {
      this.leafletLayers = layers;
      this.rebuildAllLayers();
    }
    else {
      this.setState({ overrideLeafletLayers: layers }, this.rebuildAllLayers);
    }
  }

  onSelectTimestamp = (timestampRange) => {
    if (this.state.timestampRange.start !== timestampRange.start ||
      this.state.timestampRange.end !== timestampRange.end) {

      if (this.selectTimestampTimer) {
        clearTimeout(this.selectTimestampTimer);
      }

      this.selectTimestampTimer = setTimeout(() => this.setState({ timestampRange: timestampRange }), 100);
    }
  }

  onLeafletMapViewportChanged = (viewport) => {
    if (!this.state.panes.includes(MAP_PANE_NAME)) {
      return;
    }

    if (this.setNewViewportTimer) {
      clearTimeout(this.setNewViewportTimer);
    }

    viewport.bounds = getLeafletMapBounds(this.leafletMap);

    this.setNewViewportTimer = setTimeout(
      () => { this.setState({ leafletMapViewport: viewport }) },
      400
    );
  }

  onAsReference = () => {
    let geoJson = {
      type: 'FeatureCollection',
      count: 1,
      features: [
        this.state.selectedElement.feature
      ]
    };

    let markerPane = this.leafletMap.current.leafletElement.getPane('markerPane');

    let referenceElementLayer = (
      <GeoJSON
        key={Math.random()}
        data={geoJson}
        style={ViewerUtility.createGeoJsonLayerStyle('#ff0000', 4, 0.5)}
        pane={markerPane}
        onEachFeature={(_, layer) => layer.on({ click: () => {
          this.selectFeature(
            ViewerUtility.standardTileLayerType, 
            this.state.referenceElement.feature, 
            false
          );
        }})
        }
      />
    );

    this.referenceElementLayer = referenceElementLayer;

    this.setState(
      { referenceElement: this.state.selectedElement }, 
      () => { this.rebuildAllLayers(); }
    );
  }

  selectFeature = (type, feature, hasAggregatedData, color, cb) => {
    let element = {
      type: type,
      hasAggregatedData: hasAggregatedData,
      feature: feature,
    };

    let geoJson = {
      type: 'FeatureCollection',
      count: 1,
      features: [
        element.feature
      ]
    };

    let markerPane = this.leafletMap.current.leafletElement.getPane('markerPane');

    let map = this.state.map;
    let layerCollection = null;

    if (!color) {
      if (type === ViewerUtility.polygonLayerType) {
        layerCollection = map.layers.polygon[map.layers.polygon.length - 1].layers;
      }

      if (layerCollection) {
        let layerName = feature.properties.layer;
        let layer = layerCollection.find(x => x.name === layerName);

        color = `#${layer.color}`;
      }
    }

    let selectedElementLayer = (
      <GeoJSON
        key={Math.random()}
        data={geoJson}
        style={ViewerUtility.createGeoJsonLayerStyle(color, 4, 0.5)}
        pane={markerPane}
        onEachFeature={(_, layer) => layer.on({ click: () => this.selectionPane.current.open() })}
      />
    );

    this.selectedElementLayer = selectedElementLayer;

    this.setState({ selectedElement: element }, () => {
      this.rebuildAllLayers();
      if (cb) {
        cb();
      }
    });
  }

  deselectCurrentElement = () => {
    this.selectedElementLayer = null;
    let dataPaneAction = this.state.dataPaneAction;
    if (this.state.dataPaneAction !== ViewerUtility.dataPaneAction.feed) {
      dataPaneAction = null;
    }

    let selectedElement = this.state.selectedElement;
    if (selectedElement && selectedElement.type === ViewerUtility.drawnPolygonLayerType) {
      this.removeDrawnPolygon(false)
    }

    this.setState({ selectedElement: null, dataPaneAction: dataPaneAction }, this.rebuildAllLayers);
  }

  removeDrawnPolygon = (deselect) => {
    this.drawnPolygonLayer = null;
    this.drawnPolygonGeoJson = null;

    let selectedElement = this.state.selectedElement;

    if (deselect && selectedElement && selectedElement.type === ViewerUtility.drawnPolygonLayerType) {
      this.deselectCurrentElement();
    }
    else {
      this.rebuildAllLayers();
    }
  }

  rebuildAllLayers = () => {
    let allLayers = [
      this.leafletLayers,
      this.state.overrideLeafletLayers,
      this.referenceElementLayer,
      this.selectedElementLayer,
      this.drawnPolygonLayer,
    ];

    this.setState({ allLayers: allLayers });
  }

  updatePolygons = () => {
    this.controlsPane.current.updatePolygons();
  }

  onDataPaneAction = (action, jumpToMessage) => {
    // console.log(`On data pane action: ${action} ${jumpToMessage.id}`);

    let cb = () => {
      this.openPane(DATA_PANE_NAME);

      if (this.state.dataPaneAction === action) {
        this.dataPane.current.goToAction();
      }
      else {
        this.setState({ dataPaneAction: action, jumpToMessage: jumpToMessage });
      }
    }

    this.setState({ jumpToMessage: jumpToMessage }, cb);
  }

  onFlyTo = (flyToInfo, cb) => {
    this.flyToInfo = flyToInfo;
    let type = flyToInfo.type;

    if (type === ViewerUtility.flyToType.map) {
      let map = this.state.map;
      flyToInfo.target = L.latLngBounds(L.latLng(map.yMin, map.xMin), L.latLng(map.yMax, map.xMax));
    }
    else if (type === ViewerUtility.flyToType.currentLocation) {
      flyToInfo.target = this.state.geolocation;
    }
    else if (type === ViewerUtility.flyToType.currentElement && this.state.selectedElement) {
      let element = this.state.selectedElement;

      let geoJsonLayer = L.geoJSON({
        type: 'FeatureCollection',
        count: 1,
        features: [
          element.feature
        ]
      });

      flyToInfo.target = geoJsonLayer.getBounds();
      flyToInfo.layerType = element.type;

      if (element.type === ViewerUtility.flyToType.standardTile) {
        flyToInfo.layer = ViewerUtility.standardTileLayerType;
      }
      else {
        flyToInfo.layer = element.feature.properties.layer;
      }
    }
    else {
      this.getElementGeoJson()
        .then(geoJson => {
          if (!geoJson || !geoJson.features || geoJson.features.length === 0) {
            this.flyToInfo = null;
            return;
          }

          let geoJsonLayer = L.geoJSON(geoJson);
          let bounds = geoJsonLayer.getBounds();

          flyToInfo.target = bounds;
          flyToInfo.layerType = flyToInfo.type;

          let feature = geoJson.features[0];
          let hasAggregatedData = true;

          if (type === ViewerUtility.flyToType.standardTile) {
            flyToInfo.layer = ViewerUtility.standardTileLayerType;
          }
          else {
            flyToInfo.layer = feature.properties.layer;

            if (flyToInfo.type === ViewerUtility.polygonLayerType) {
              let mapPolygonlayers = this.state.map.layers.polygon;

              for (let i = 0; i < mapPolygonlayers.length; i++) {
                let hasAggregatedData = mapPolygonlayers[i].hasAggregatedData;
                if (hasAggregatedData) {
                  break;
                }
              }
            }
          }

          if (!flyToInfo.delay && this.state.isSmallWindow && !this.state.panes.includes(MAP_PANE_NAME)) {
            this.openPane(MAP_PANE_NAME);

          }
          else {

            this.attemptFlyTo();
          }

          this.selectFeature(flyToInfo.type, feature, hasAggregatedData, null, cb);
        });
    }

    if (!this.flyToInfo.delay && this.state.isSmallWindow && !this.state.panes.includes(MAP_PANE_NAME)) {
      this.openPane(MAP_PANE_NAME);
    }
    else {
      this.attemptFlyTo();
    }
  }

  getElementGeoJson = () => {
    let map = this.state.map;
    let type = this.flyToInfo.type;
    
    let body = {
      mapId: map.id,
      type: type,
      timestamp: map.timestamps[this.state.timestampRange.end].timestampNumber
    };

    if (type === ViewerUtility.flyToType.standardTile) {
      body.elementIds = [{...this.flyToInfo.elementId, zoom: map.aggregationZoom }];
    }
    else if (type === ViewerUtility.flyToType.polygon) {
      body.elementIds = [this.flyToInfo.elementId];
    }

    return ApiManager.post('/geometry/get', body, this.props.user);
  }

  onPolygonChange = (removeDrawnPolygon, updateSelection, newProperties) => {
    if (removeDrawnPolygon) {
      this.removeDrawnPolygon(true);
    }

    if (updateSelection) {
      let selectedElement = this.state.selectedElement;

      let properties = newProperties;

      this.state.selectedElement.feature.properties = properties;

      this.selectionPane.current.refresh();
    }

    this.updatePolygons();
  }

  attemptFlyTo = () => {
    if (!this.flyToInfo || !this.flyToInfo.target) {
      return;
    }

    if (this.state.panes.includes(MAP_PANE_NAME)) {

      if (this.flyToInfo.type === ViewerUtility.flyToType.currentLocation) {
        this.leafletMap.current.leafletElement.flyTo(this.flyToInfo.target);
      }
      else {
        this.leafletMap.current.leafletElement.flyToBounds(this.flyToInfo.target, { maxZoom: this.state.map.aggregationZoom - 1 });
      }

      if (this.flyToInfo.layer) {
        this.controlsPane.current.selectLayer(this.flyToInfo.layerType, this.flyToInfo.layer);
      }

      this.flyToInfo = null;
    }
  }

  render() {
    let mapPaneStyle = {
      display: 'block',
      width: '100vw'
    };

    if (this.state.panes.includes(MAP_PANE_NAME)) {
      if (!this.state.isSmallWindow) {
        if (this.state.panes.length === 2) {
          mapPaneStyle.width = '75vw';
        }
        else if (this.state.panes.length === 3) {
          mapPaneStyle.width = '50vw';
        }
      }
    }
    else {
      mapPaneStyle.display = 'none';
    }

    return (
      <div className='viewer'>
        <div className='viewer-main-container'>
          <ControlsPane
            ref={this.controlsPane}
            user={this.props.user}
            isOpen={this.state.panes.includes(CONTROL_PANE_NAME)}
            leafletMapViewport={this.state.leafletMapViewport}
            timestampRange={this.state.timestampRange}
            referenceElement={this.state.referenceElement}
            geolocation={this.state.geolocation}
            override={this.state.overrideLeafletLayers ? true : false}
            onSelectMap={this.onSelectMap}
            onDataPaneAction={this.onDataPaneAction}
            onLayersChange={this.onLayersChange}
            onFeatureClick={this.selectFeature}
            onFlyTo={this.onFlyTo}
            onDeselect={this.deselectCurrentElement}
          />

          <div className='viewer-pane map-pane' style={mapPaneStyle}>
            <TimestampSelector
              map={this.state.map}
              onSelectTimestamp={this.onSelectTimestamp}
            />
            <SelectionPane
              ref={this.selectionPane}
              user={this.props.user}
              map={this.state.map}
              element={this.state.selectedElement}
              referenceElement={this.state.referenceElement}
              onDataPaneAction={this.onDataPaneAction}
              onFlyTo={this.onFlyTo}
              onDeselect={this.deselectCurrentElement}
              onDeletePolygon={this.updatePolygons}
              onAsReference={this.onAsReference}
            />
            <Map
              center={DEFAULT_VIEWPORT.center}
              zoom={DEFAULT_VIEWPORT.zoom}
              ref={this.leafletMap}
              maxZoom={20}
              onViewportChanged={this.onLeafletMapViewportChanged}
            >
              {this.state.allLayers}
              {this.state.geolocation ? <Marker position={this.state.geolocation}/> : null}
            </Map>
          </div>

          <DataPane
            ref={this.dataPane}
            user={this.props.user}
            isOpen={this.state.panes.includes(DATA_PANE_NAME)}
            map={this.state.map}
            timestampRange={this.state.timestampRange}
            geolocation={this.state.geolocation}
            action={this.state.dataPaneAction}
            element={this.state.selectedElement}
            referenceElement={this.state.referenceElement}
            jumpToMessage={this.state.jumpToMessage}
            onDataPaneAction={this.onDataPaneAction}
            onFlyTo={this.onFlyTo}
            onDeselect={this.deselectCurrentElement}
            onPolygonChange={this.onPolygonChange}
            onLayersChange={this.onLayersChange}
            onFeatureClick={this.selectFeature}
          />
        </div>

        <div className='viewer-menu'>
          <div className='button viewer-menu-button' onClick={() => this.openPane(CONTROL_PANE_NAME, true)}>
            <div className='viewer-menu-button-content'>
              {"Control"}
            </div>
          </div>
          <div className='button viewer-menu-button' onClick={() => this.openPane(MAP_PANE_NAME, true)}>
            <div className='viewer-menu-button-content'>
              {"Map"}
            </div>
          </div>
          <div className='button viewer-menu-button' onClick={() => this.openPane(DATA_PANE_NAME, true)}>
            <div className='viewer-menu-button-content'>
              {"Data"}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

function getLeafletMapBounds(leafletMap) {
  let screenBounds = leafletMap.current.leafletElement.getBounds();
  let bounds =
  {
    xMin: screenBounds.getWest(),
    xMax: screenBounds.getEast(),
    yMin: screenBounds.getSouth(),
    yMax: screenBounds.getNorth()
  }

  return bounds;
}

export default Viewer;
