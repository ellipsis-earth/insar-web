import React, { PureComponent } from 'react';
import { GeoJSON } from 'react-leaflet';

import {
  Card,
  Checkbox,
  CardHeader,
  CardContent,
  Collapse,
  IconButton,
  Typography
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import SaveAlt from '@material-ui/icons/SaveAlt';

import Utility from '../../../../Utility';
import ViewerUtility from '../../ViewerUtility';

import './StandardTileLayersControl.css';

import ApiManager from '../../../../ApiManager';

const STANDARD_TILES_LAYERS_DISPLAY_NAME = 'standard tiles';
const STANDARD_TILES_LAYER = {
  type: STANDARD_TILES_LAYERS_DISPLAY_NAME,
  name: STANDARD_TILES_LAYERS_DISPLAY_NAME
};

const MAX_TILES = 500;

class StandardTileLayersControl extends PureComponent {

  standardTilesGeoJson = null

  constructor(props, context) {
    super(props, context);

    this.state = {
      availableLayers: [],
      selectedLayers: [],

      options: [],

      expanded: true,

      count: null
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

    if (differentMap || differentTimestamp || differentBounds) {

      let availableLayers = this.state.availableLayers;
      let selectedLayers = this.state.selectedLayers;

      if (differentMap) {

        availableLayers = [STANDARD_TILES_LAYER];
        selectedLayers = [];

        this.standardTilesGeoJson = null;
        this.setState({
          availableLayers: availableLayers,
          selectedLayers: selectedLayers,
          count: null
        });
      }

      this.prepareLayers(this.props.map, this.props.timestampRange, selectedLayers)
        .then(leafletLayers => {
          this.props.onLayersChange(leafletLayers);
        });
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
      if (checked && this.state.count !== null) {
        let className = '';
        let downloadButton = null;

        if (this.state.count > MAX_TILES) {
          className = 'geometry-limit-exceeded';
        }
        else {
          downloadButton = (
            <IconButton
              className='download-geometry-button'
              onClick={() => this.onDownload()}
            >
              <SaveAlt className='download-geometry-button-icon'/>
            </IconButton>
          );
        }

        counter = (
          <span className='geometry-counter'>
            <span className={className}>{this.state.count}</span>
            <span>/{MAX_TILES}</span>
            {downloadButton}
          </span>
        )
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
    if (!selectedLayers.includes(STANDARD_TILES_LAYER)) {
      return;
    }

    let bounds = this.props.leafletMapViewport.bounds;

    let body =  {
      mapId: map.id,
      type: ViewerUtility.standardTileLayerType,
      timestamp: map.timestamps[timestampRange.end].timestampNumber,
      xMin: bounds.xMin,
      xMax: bounds.xMax,
      yMin: bounds.yMin,
      yMax: bounds.yMax,
      zoom: map.aggregationZoom,
      limit: MAX_TILES
    };

    let leafletGeojsonLayer = await ApiManager.post('/geometry/ids', body, this.props.user)
      .then(standardTileIds => {
        this.setState({ count: standardTileIds.count });

        if (!standardTileIds || standardTileIds.count === 0 || standardTileIds.count > MAX_TILES) {
          this.standardTilesGeoJson = null;
          return null;
        }

        body = {
          mapId: map.id,
          type: ViewerUtility.standardTileLayerType,
          timestamp: map.timestamps[timestampRange.end].timestampNumber,
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
            style={ViewerUtility.createGeoJsonLayerStyle('cornflowerblue')}
            zIndex={ViewerUtility.standardTileLayerZIndex}
            onEachFeature={(feature, layer) => layer.on({ click: () => this.onFeatureClick(feature) })}
          />
        );
      });

    return leafletGeojsonLayer;
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
      this.prepareLayers(this.props.map, this.props.timestampRange, newSelectedLayers)
        .then(standardTilesLayers => {
          this.props.onLayersChange(standardTilesLayers);
        });
    }
  }

  onExpandClick = () => {
    this.setState({ expanded: !this.state.expanded });
  }

  onFeatureClick = (feature) => {
    this.props.onFeatureClick(feature);
  }

  onDownload = () => {
    if (!this.standardTilesGeoJson) {
      return;
    }

    let bounds = this.standardTilesGeoJson.bounds;

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

    ViewerUtility.download(fileName, JSON.stringify(this.standardTilesGeoJson.geoJson), 'application/json');
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
          </CardContent>
        </Collapse>
      </Card>
    );
  }
}

export default StandardTileLayersControl;
