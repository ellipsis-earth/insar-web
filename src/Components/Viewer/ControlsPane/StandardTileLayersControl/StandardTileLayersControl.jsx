import React, { PureComponent } from 'react';
import { GeoJSON } from 'react-leaflet';
import Papa from 'papaparse';

import {
  Card,
  Checkbox,
  CardHeader,
  CardContent,
  Collapse,
  IconButton,
  Slider,
  Typography,
  CircularProgress
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import SaveAlt from '@material-ui/icons/SaveAlt';

import Utility from '../../../../Utility';
import ViewerUtility from '../../ViewerUtility';

import './StandardTileLayersControl.css';

import ApiManager from '../../../../ApiManager';
import Viewer from '../../Viewer';

const STANDARD_TILES_LAYERS_DISPLAY_NAME = 'standard tiles';
const ALTITUDE_CHANGE = 'altitude change';

const STANDARD_TILES_LAYER = {
  type: STANDARD_TILES_LAYERS_DISPLAY_NAME,
  name: STANDARD_TILES_LAYERS_DISPLAY_NAME
};
const ALTITUDE_CHANGE_LAYER = {
  type: ALTITUDE_CHANGE,
  name: ALTITUDE_CHANGE
};

const MAX_TILES = 1000;

class StandardTileLayersControl extends PureComponent {

  standardTilesGeoJson = null
  altitudeTilesGeoJson = null

  onDownloadTimer = null

  constructor(props, context) {
    super(props, context);

    this.state = {
      availableLayers: [],
      selectedLayers: [],

      options: [],

      expanded: true,

      count: {},

      altitudeThreshold: 0
    };
  }

  componentDidMount() {
    this.props.onLayersChange([]);
  }

  componentDidUpdate(prevProps) {
    if (!this.props.map || !this.props.timestampRange) {
      this.props.onLayersChange([]);
      return;
    }

    let differentMap = this.props.map !== prevProps.map;

    let differentTimestamp = !prevProps.timestampRange ||
      this.props.timestampRange.start !== prevProps.timestampRange.start ||
      this.props.timestampRange.end !== prevProps.timestampRange.end;

    let differentBounds = !prevProps.leafletMapViewport ||
      this.props.leafletMapViewport.bounds.xMin !== prevProps.leafletMapViewport.bounds.xMin ||
      this.props.leafletMapViewport.bounds.xMax !== prevProps.leafletMapViewport.bounds.xMax ||
      this.props.leafletMapViewport.bounds.yMin !== prevProps.leafletMapViewport.bounds.yMin ||
      this.props.leafletMapViewport.bounds.yMax !== prevProps.leafletMapViewport.bounds.yMax;

    let referenceElement = this.props.referenceElement;
    if (!referenceElement && !this.state.referenceError) {
      this.setState({ referenceError: 'Select a refence tile for change comparison' });
    }

    let differentReferenceElement = ViewerUtility.isDifferentElement(prevProps.referenceElement, referenceElement);

    if ((this.props.referenceElement && this.state.referenceData === undefined && !this.state.referenceLoading) || differentReferenceElement) { 
      this.setState({ referenceData: null });

      this.getData(this.props.referenceElement)
        .then((data) => {
          if (data === null) {
            this.setState({ referenceData: 0, referenceError: 'Reference tile has no displacement geomessage'});
          }
          else {
            this.setState({ referenceData: data, referenceError: null }, () => {
              this.prepareLayers(this.props.map, this.props.timestampRange, this.state.selectedLayers);
            });
          }
        });
    }
    else if (differentMap || differentTimestamp || differentBounds) {
      let availableLayers = this.state.availableLayers;
      let selectedLayers = this.state.selectedLayers;

      if (differentMap) {

        availableLayers = [STANDARD_TILES_LAYER, ALTITUDE_CHANGE_LAYER];
        selectedLayers = [];

        this.standardTilesGeoJson = null;
        this.setState({
          availableLayers: availableLayers,
          selectedLayers: selectedLayers,
          count: {}
        });
      }

      this.prepareLayers(this.props.map, this.props.timestampRange, selectedLayers);
    }
  }

  selectLayer = (layer) => {
    if (layer === ViewerUtility.standardTileLayerType &&
      !this.state.selectedLayers.includes[STANDARD_TILES_LAYER]
      ) {
      this.setState({ selectedLayers: [STANDARD_TILES_LAYER] });
    }
  }

  createLayerCheckboxes = () => {
    let options = [];

    let availableLayers = this.state.availableLayers;
    let selectedLayers = this.state.selectedLayers;

    for (let i = 0; i < availableLayers.length; i++) {
      let availableLayer = availableLayers[i];
      let checked = selectedLayers.find(x => x === availableLayer) ? true : false;

      let counter = null;
      let count = this.state.count[availableLayer.name];

      if (checked && count !== undefined) {
        let className = '';
        let downloadButton = null;

        if (typeof count === 'string' || count instanceof String || count > MAX_TILES) {
          className = 'geometry-limit-exceeded';
        }
        else {
          downloadButton = (
            <IconButton
              className='download-geometry-button'
              onClick={() => this.onDownload(availableLayer.name)}
            >
              <SaveAlt className='download-geometry-button-icon'/>
            </IconButton>
          );
        }
        
        counter = (
          <span className='geometry-counter'>
            <CircularProgress className='loading-spinner'/>
          </span>
        );

        if (availableLayer.name === ALTITUDE_CHANGE_LAYER.name && this.state.altitudeChangeLoading) {
          counter = (
            <span className='geometry-counter'>
              <CircularProgress 
                className='loading-spinner' 
                style={{ width: '20px', height: '20px', marginTop: '10px'}}
              />
            </span>
          );
        }
        else {
          counter = (
            <span className='geometry-counter'>
              <span className={className}>{count}</span>
              {
                !(typeof count === 'string' || count instanceof String) ?
                  <span>/{MAX_TILES}</span> : null
              }
              {downloadButton}
            </span>
          );
        }        
      }

      let option = (
        <div key={availableLayer.name} className='layer-checkboxes'>
          <Checkbox
            key={availableLayer.name}
            classes={{ root: 'layers-control-checkbox' }}
            color='primary'
            value={availableLayer.name}
            name={availableLayer.name}
            onChange={this.onLayerChange}
            checked={checked}
          />
          <span>
            {availableLayer.name}
          </span>
          {counter}
        </div>
      )

      options.push(option);
    }

    return options;
  }

  prepareLayers = async (map, timestampRange, selectedLayers) => {
    let promises = [];

    if (selectedLayers.includes(STANDARD_TILES_LAYER)) {
      promises.push(this.prepareStandardTileLayer(map, timestampRange));
    }   

    if (selectedLayers.includes(ALTITUDE_CHANGE_LAYER)) {
      this.setState({ altitudeChangeLoading: true })
      promises.push(this.prepareAltitudeChange(map, timestampRange));
    }

    return Promise.all(promises)
      .then(standardTilesLayers => {
        this.setState({ altitudeChangeLoading: false });
        this.props.onLayersChange(standardTilesLayers);
      });;
  }

  prepareStandardTileLayer = async (map, timestampRange) => {
    let bounds = this.props.leafletMapViewport.bounds;

    let body =  {
      mapId: map.id,
      type: ViewerUtility.standardTileLayerType,
      timestamp: map.timestamps[timestampRange.end].timestamp,
      xMin: bounds.xMin,
      xMax: bounds.xMax,
      yMin: bounds.yMin,
      yMax: bounds.yMax,
      zoom: map.aggregationZoom,
      limit: MAX_TILES
    };

    let leafletGeojsonLayer = await ApiManager.post('/geometry/ids', body, this.props.user)
      .then(standardTileIds => {
        let count = {...this.state.count};
        count[STANDARD_TILES_LAYER.name] = standardTileIds.count
        this.setState({ count: count });

        if (!standardTileIds || standardTileIds.count === 0 || standardTileIds.count > MAX_TILES) {
          this.standardTilesGeoJson = null;
          return null;
        }

        body = {
          mapId: map.id,
          type: ViewerUtility.standardTileLayerType,
          timestamp: map.timestamps[timestampRange.end].timestamp,
          elementIds: standardTileIds.ids
        };

        return ApiManager.post('/geometry/get', body, this.props.user);
      })
      .then(standardTilesGeoJson => {
        if (!standardTilesGeoJson) {
          this.standardTilesGeoJson = null;
          return null;
        }

        this.standardTilesGeoJson = {
          geoJson: standardTilesGeoJson,
          bounds: bounds
        };

        return (
          <GeoJSON
            key={Math.random()}
            data={standardTilesGeoJson}
            style={ViewerUtility.createGeoJsonLayerStyle('cornflowerblue', 1, 0.35)}
            zIndex={ViewerUtility.standardTileLayerZIndex}
            onEachFeature={(feature, layer) => layer.on({ click: () => this.onFeatureClick(feature) })}
          />
        );
      });

    return leafletGeojsonLayer;
  }

  prepareAltitudeChange = async (map, timestampRange) => {
    let bounds = this.props.leafletMapViewport.bounds;

    let body =  {
      mapId: map.id,
      type: ViewerUtility.standardTileLayerType,
      timestamp: map.timestamps[timestampRange.end].timestamp,
      xMin: bounds.xMin,
      xMax: bounds.xMax,
      yMin: bounds.yMin,
      yMax: bounds.yMax,
      zoom: map.aggregationZoom
    };

    body = {
      mapId: map.id,
      type: ViewerUtility.standardTileLayerType,
      filters: {
        forms: ['displacement'],
        bounds: bounds,
        userGroups: ['scripters']
      }
    };

    let threshold = this.state.altitudeThreshold;

    let leafletGeojsonLayer = ApiManager.post('/geoMessage/ids', body, this.props.user)
      .then((geoMessages) => {
        if (!geoMessages || geoMessages.messages.length === 0) {
          let count = {...count};
          count[ALTITUDE_CHANGE_LAYER.name] = geoMessages.messages.length;
          this.setState({ count: count });  
          return null;
        }

        if (geoMessages.messages.length > MAX_TILES) {
          let count = {...count};
          count[ALTITUDE_CHANGE_LAYER.name] = 'zoom in further';
          this.setState({ count: count });
          return null;
        }

        let filteredGeoMessages = [];
        for (let i = geoMessages.messages.length - 1; i >= 0; i--) {
          let geoMessageInfo = geoMessages.messages[i];

          let existingInfo = filteredGeoMessages.find(x => {
            return x.elementId.tileX === geoMessageInfo.elementId.tileX &&
              x.elementId.tileY === geoMessageInfo.elementId.tileY &&
              x.elementId.zoom === geoMessageInfo.elementId.zoom
          });

          if (!existingInfo) {
            filteredGeoMessages.push(geoMessageInfo);
          }
        }

        let getPromises = [];
        while (filteredGeoMessages.length > 0) {
          body = {
            mapId: map.id,
            type: ViewerUtility.standardTileLayerType,
            messageIds: filteredGeoMessages.splice(0, 500).map(x => x.id)
          };

          getPromises.push(ApiManager.post('/geoMessage/get', body, this.props.user));
        }

        return Promise.all(getPromises)
          .then((results) => {
            let geoMessages = [];
            results.forEach(x => geoMessages = geoMessages.concat(x));

            return geoMessages;
          });  
      })
      .then((geoMessages) => {
        if (!geoMessages) {
          return null;
        }

        let referenceAltitude = this.state.referenceData;

        let uniqueTiles = [];
        for (let i = 0; i < geoMessages.length; i++) {
          let geoMessage = geoMessages[i];

          if (!this.state.referenceError) {
            let altitude = geoMessage.form.answers[0].answer;

            let diff = altitude - referenceAltitude;
  
            if (diff > threshold) {
              continue;
            }
          }         

          let tileId = geoMessage.elementId;

          if (!uniqueTiles.find(x => x.tileX === tileId.tileX && x.tileY === tileId.tileY && x.zoom === tileId.zoom)) {
            uniqueTiles.push(tileId);
          }
        }

        let count = {...this.state.count};
        count[ALTITUDE_CHANGE_LAYER.name] = uniqueTiles.length;
        this.setState({ count: count });

        if (uniqueTiles.length > 0 && uniqueTiles.length < MAX_TILES) {  
          body = {
            mapId: map.id,
            type: ViewerUtility.standardTileLayerType,
            elementIds: uniqueTiles
          };
  
          return ApiManager.post('/geometry/get', body, this.props.user);
        }
        else {
          return null;
        }
      })
      .then(altitudeTilesGeoJson => {
        if (!altitudeTilesGeoJson) {
          this.altitudeTilesGeoJson = null;
          return null;
        }

        this.altitudeTilesGeoJson = {
          geoJson: altitudeTilesGeoJson,
          bounds: bounds
        };

        return (
          <GeoJSON
            key={Math.random()}
            data={altitudeTilesGeoJson}
            style={ViewerUtility.createGeoJsonLayerStyle('cornflowerblue', 1, 0.35)}
            zIndex={ViewerUtility.standardTileLayerZIndex + 1}
            onEachFeature={(feature, layer) => layer.on({ click: () => this.onFeatureClick(feature) })}
          />
        );
      });

    return leafletGeojsonLayer;
  }

  getData = async (element) => {
    let properties = element.feature.properties;

    let body = {
      mapId: this.props.map.id,
      type: ViewerUtility.standardTileLayerType,
      filters: {
        tileIds: [{ tileX: properties.tileX, tileY: properties.tileY, zoom: properties.zoom }],
        forms: ['displacement'],
        userGroups: ['scripters']
      }
    };

    return ApiManager.post(`/geomessage/ids`, body, this.props.user)
      .then((geoMessages) => {

        if (geoMessages.messages.length === 0) {
          return null;
        }

        let lastGeoMessage = geoMessages.messages[geoMessages.messages.length - 1];

        body.messageIds = [lastGeoMessage.id];

        return ApiManager.post('/geomessage/get', body, this.props.user)
      })
      .then((geoMessages) => {
        if (geoMessages === null) {
          return null;
        }

        let lastGeoMessage = geoMessages[geoMessages.length - 1];

        let altitude = lastGeoMessage.form.answers[0].answer;

        return altitude;
      });
  }

  onLayerChange = (e) => {
    let layerName = e.target.value;
    let checked = e.target.checked;

    let isSelected = this.state.selectedLayers.find(x => x.name === layerName);

    let newSelectedLayers = null;
    let changed = false;

    if (checked && !isSelected) {
      let availableLayer = this.state.availableLayers.find(x => x.name === layerName);

      newSelectedLayers = [...this.state.selectedLayers, availableLayer];

      changed = true;
    }
    else if (!checked && isSelected) {
      newSelectedLayers = Utility.arrayRemove(this.state.selectedLayers, isSelected);

      newSelectedLayers = [...newSelectedLayers];

      changed = true;
    }

    if (changed) {
      this.setState({ selectedLayers: newSelectedLayers });
      this.prepareLayers(this.props.map, this.props.timestampRange, newSelectedLayers);
    }
  }

  onExpandClick = () => {
    this.setState({ expanded: !this.state.expanded });
  }

  onFeatureClick = (feature) => {
    this.props.onFeatureClick(feature);
  }

  onDownload = (layerName) => {
    let geoJson = null;

    if (layerName === STANDARD_TILES_LAYER.name) {
      geoJson = this.standardTilesGeoJson;
    }
    else if (layerName === ALTITUDE_CHANGE_LAYER.name) {
      geoJson = this.altitudeTilesGeoJson;
    }

    if (!geoJson) {
      return;
    }

    let bounds = geoJson.bounds;

    let decimals = 4;

    let nameComponents = [
      this.props.map.name,
      'tiles',
      bounds.xMin.toFixed(decimals),
      bounds.xMax.toFixed(decimals),
      bounds.yMin.toFixed(decimals),
      bounds.yMax.toFixed(decimals)
    ];

    let fileName = nameComponents.join('_') + '.geojson';

    ViewerUtility.download(fileName, JSON.stringify(geoJson.geoJson), 'application/json');
  }

  onSlide = (_, v) => {
    this.setState({ altitudeThreshold: v}, () => {
      clearTimeout(this.onDownloadTimer);

      this.onDownloadTimer = setTimeout(() => {
        this.prepareLayers(this.props.map, this.props.timestampRange, this.state.selectedLayers);
      }, 1000);
    });
  }

  render() {
    if (!this.props.map || this.state.availableLayers.length === 0) {
      return null;
    }

    return (
      <Card className='layers-contol'>
        <CardHeader
          className='material-card-header'
          title={
            <Typography gutterBottom variant="h6" component="h2">
              {'Standard tiles'}
            </Typography>
          }
          action={
            <IconButton
              className={this.state.expanded ? 'expand-icon expanded' : 'expand-icon'}
              onClick={this.onExpandClick}
              aria-expanded={this.state.expanded}
              aria-label='Show'
            >
              <ExpandMoreIcon />
            </IconButton>
          }
        />
        <Collapse in={this.state.expanded}>
          <CardContent
            className={'card-content'}
          >
            {
              !this.props.override ?
                this.createLayerCheckboxes() :
                <div className='controls-pane-background-text'>Controlled by feed</div>
            }
            <div style={{ textAlign: 'center' }}>
              {
                !this.state.referenceError ? 
                <div>
                  <Slider
                    min={-50}
                    max={50}
                    step={0.1}
                    value={this.state.altitudeThreshold}
                    onChange={this.onSlide}
                  >
                  </Slider>
                  Change threshold: {this.state.altitudeThreshold}
                </div> : this.state.referenceError
              }
            </div>   
          </CardContent>
        </Collapse>
      </Card>
    );
  }
}

export default StandardTileLayersControl;
