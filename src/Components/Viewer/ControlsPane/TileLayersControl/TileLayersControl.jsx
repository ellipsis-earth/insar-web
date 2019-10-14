import React, { PureComponent } from 'react';
import { TileLayer } from 'react-leaflet';
import L from 'leaflet';

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

import Utility from '../../../../Utility';
import ViewerUtility from '../../ViewerUtility';

import './TileLayersControl.css';

import ApiManager from '../../../../ApiManager';

const BASE_SATELLITE_LAYER_NAME = 'base';
const IMAGES_TILE_LAYER_NAME = 'images';
const LABELS_TILE_LAYER_NAME = 'labels';
const IMAGES2_TILE_LAYER_NAME = 'images2';

const BASE_SATELLITE_LAYER_TYPE = {
  name: BASE_SATELLITE_LAYER_NAME,
  defaultSelected: true,
  stacking: false,
  zIndex: ViewerUtility.tileLayerZIndex
}

const BASE_SATELLITE_AVAILABLE_LAYER = {
  type: BASE_SATELLITE_LAYER_NAME,
  name: BASE_SATELLITE_LAYER_NAME
}

const tileLayerTypes = [
  BASE_SATELLITE_LAYER_TYPE,
  {
    name: IMAGES_TILE_LAYER_NAME,
    defaultSelected: true,
    stacking: true,
    zIndex: ViewerUtility.tileLayerZIndex + 1
  },
  {
    name: LABELS_TILE_LAYER_NAME,
    defaultSelected: true,
    stacking: false,
    zIndex: ViewerUtility.tileLayerZIndex + 1 + 300,
  },
  {
    name: IMAGES2_TILE_LAYER_NAME,
    defaultSelected: true,
    stacking: false,
    zIndex: ViewerUtility.tileLayerZIndex + 1 + 400
  }
];


class TileLayersControl extends PureComponent {

  classes = null;

  baseLayer = (
    <TileLayer
      key='base-layer'
      url='https://www.google.com/maps/vt?lyrs=y@189&x={x}&y={y}&z={z}'
      attribution='Base satellite: <a href="https://maps.google.com">Google Maps</a>'
      zIndex={1}
      noWrap={true}
    />)

  constructor(props, context) {
    super(props, context);

    this.state = {
      availableLayers: [],
      selectedLayers: [],

      options: [],

      expanded: true
    };
  }

  componentDidMount() {
    this.props.onLayersChange([this.baseLayer]);
  }

  componentDidUpdate(prevProps) {
    if (!this.props.map || !this.props.timestampRange) {
      this.props.onLayersChange([this.baseLayer]);
      return;
    }

    let differentMap = this.props.map !== prevProps.map;
    let differentTimestamp = !prevProps.timestampRange ||
      this.props.timestampRange.start !== prevProps.timestampRange.start ||
      this.props.timestampRange.end !== prevProps.timestampRange.end

    if (differentMap || differentTimestamp) {

      let availableLayers = this.state.availableLayers;
      let selectedLayers = this.state.selectedLayers;

      if (differentMap) {
        availableLayers = this.getAvailableLayers(this.props.map);
        selectedLayers = this.getDefaultSelectedLayers(availableLayers);
        // let layerCheckboxes = this.createLayerCheckboxes(availableLayers, selectedLayers);

        this.setState({
          availableLayers: availableLayers,
          selectedLayers: selectedLayers
        });
      }

      let newLeafletTileLayers = this.prepareLayers(this.props.map, this.props.timestampRange, selectedLayers);

      this.props.onLayersChange(newLeafletTileLayers);
    }
  }

  getAvailableLayers = (map) => {
    let availableLayersUnsorted = [];

    for (let i = 0; i < map.layers.tile.length; i++) {

      let mapTimestampTileLayers = map.layers.tile[i];

      for (let y = 0; y < mapTimestampTileLayers.layers.length; y++) {
        let layer = mapTimestampTileLayers.layers[y];

        let availableLayer = availableLayersUnsorted.find(x => x.type === layer.type && x.name === layer.name);

        if (!availableLayer) {
          availableLayersUnsorted.push({
            type: layer.type,
            name: layer.name
          });
        }
      }
    }

    let imageLayers = availableLayersUnsorted.filter(x => x.type === IMAGES_TILE_LAYER_NAME);
    let labelLayers = availableLayersUnsorted.filter(x => x.type === LABELS_TILE_LAYER_NAME);
    let images2Layers = availableLayersUnsorted.filter(x => x.type === IMAGES2_TILE_LAYER_NAME);

    let availableLayers = [BASE_SATELLITE_AVAILABLE_LAYER, ...imageLayers, ...labelLayers, ...images2Layers];

    return availableLayers;

  }

  getDefaultSelectedLayers = (availableLayers) => {
    let selectedLayers = [];

    for (let i = 0; i < availableLayers.length; i++) {
      let availableLayer = availableLayers[i];

      let tileLayerType = tileLayerTypes.find(x => x.name === availableLayer.type);

      if (!tileLayerType) {
        continue;
      }

      if (tileLayerType.defaultSelected) {
        selectedLayers.push(availableLayer);
      }
    }

    return selectedLayers;
  }

  createLayerCheckboxes = () => {
    let options = [];

    let availableLayers = this.state.availableLayers;
    let selectedLayers = this.state.selectedLayers;

    for (let i = 0; i < availableLayers.length; i++) {

      let availableLayer = availableLayers[i];
      let checked = selectedLayers.find(x => x === availableLayer) ? true : false;

      let option = (
        <div key={availableLayer.name}>
          <Checkbox
            key={availableLayer.name}
            classes={{ root: 'layers-control-checkbox' }}
            color='primary'
            value={availableLayer.name}
            name={availableLayer.name}
            onChange={this.onLayerChange}
            checked={checked}
          />
          {availableLayer.name}
        </div>
      )

      options.push(option);
    }

    return options;
  }

  prepareLayers = (map, timestampRange, selectedLayers) => {
    let leafletTileLayersGrouped = [];

    // Loop through all types, so they are created in the order they should appear.
    for (let i = 0; i < tileLayerTypes.length; i++) {
      let tileLayerType = tileLayerTypes[i];

      let timestampStart = tileLayerType.stacking ? timestampRange.start : timestampRange.end;
      let timestampEnd = timestampRange.end;

      for (let y = timestampStart; y <= timestampEnd; y++) {

        let mapTimestamp = map.timestamps[y];

        if (!mapTimestamp) {
          continue;
        }

        // Find the layer information of the timestamp.
        let mapTimestampTileLayers = map.layers.tile.find(x => x.timestampNumber === mapTimestamp.timestampNumber);

        if (!mapTimestampTileLayers) {
          continue;
        }

        // Find all layers of the current type.
        let mapTimestampTileLayersOfType = mapTimestampTileLayers.layers.filter(x => x.type === tileLayerType.name);

        for (let p = 0; p < mapTimestampTileLayersOfType.length; p++) {
          let tileLayer = mapTimestampTileLayersOfType[p];

          let isSelected = selectedLayers.find(x => x.name === tileLayer.name);

          if (!isSelected) {
            continue;
          }

          let leafletTileLayersGroup = leafletTileLayersGrouped.find(x => x.type === tileLayer.type && x.name === tileLayer.name);

          if (!leafletTileLayersGroup) {
            leafletTileLayersGroup = {
              type: tileLayer.type,
              name: tileLayer.name,
              zIndexOffset: p * map.timestamps.length,
              leafletTileLayers: []
            };

            leafletTileLayersGrouped.push(leafletTileLayersGroup);
          }

          let key = `${map.id}_${mapTimestamp.timestampNumber}_${tileLayer.type}_${tileLayer.name}`;
          let url = `${ApiManager.apiUrl}/tileService/${map.id}/${mapTimestamp.timestampNumber}/${tileLayer.name}/{z}/{x}/{y}`;
          let zIndex = tileLayerType.zIndex + leafletTileLayersGroup.zIndexOffset + leafletTileLayersGroup.leafletTileLayers.length;

          if (this.props.user) {
            url += `?token=${this.props.user.token}`;
          }

          let leafletTileLayer = (<TileLayer
            key={key}
            url={url}
            tileSize={256}
            noWrap={true}
            maxNativeZoom={map.zoom}
            format={'image/png'}
            zIndex={zIndex}
          />);

          leafletTileLayersGroup.leafletTileLayers.push(leafletTileLayer);
        }
      }
    }

    let leafletTileLayers = [];
    if (selectedLayers.find(x => x.name === BASE_SATELLITE_LAYER_NAME)) {
      leafletTileLayers.push(this.baseLayer);
    }

    for (let i = 0; i < leafletTileLayersGrouped.length; i++) {
      leafletTileLayers.push(leafletTileLayersGrouped[i].leafletTileLayers);
    }

    return leafletTileLayers;
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
      let newLayers = this.prepareLayers(this.props.map, this.props.timestampRange, newSelectedLayers);
      this.props.onLayersChange(newLayers);
    }
  }

  onExpandClick = () => {
    this.setState({ expanded: !this.state.expanded });
  }

  render() {

    if (!this.props.map) {
      return null;
    }

    return (
      <Card className='layers-contol'>
        <CardHeader
          className='material-card-header'
          title={
            <Typography gutterBottom variant="h6" component="h2">
              Layers
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
            {this.createLayerCheckboxes()}
          </CardContent>
        </Collapse>
      </Card>
    );
  }
}

export default TileLayersControl;
