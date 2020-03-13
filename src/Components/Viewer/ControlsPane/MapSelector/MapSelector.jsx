import React, { PureComponent } from 'react';

import ApiManager from '../../../../ApiManager';
import ErrorHandler from '../../../../ErrorHandler';

import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';

import './MapSelector.css';
import ViewerUtility from '../../ViewerUtility';

const INSAR_ATLAS = 'InSAR';

const ALTITUDE_TYPE = 'altitude';
const INSAR_TYPE = 'insar';

const METADATA_TYPES = [
  { key: 'timestamps', function: (map, result) => { map.timestamps = result; } },
  { key: 'classes', function: (map, result) => { map.classes = result; } },
  { key: 'measurements', function: (map, result) => { map.measurements = result; } },
  { key: 'tileLayers', function: (map, result) => { map.layers.tile = result; } },
  { key: 'polygonLayers', function: (map, result) => { map.layers.polygon = result; } },
  { key: 'bands', function: (map, result) => { map.bands = result; } },
  { key: 'forms', function: (map, result) => { map.forms = result; } }
];

export class MapSelector extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      maps: [],

      atlasSelect: null,
      mapselect: null,

      selectedAtlas: 'default',
      selectedMap: { id: 'default' },
    };
  }

  componentDidUpdate(prevProps) {
    if (this.props.user !== prevProps.user) {
      this.getMaps();
    }
  }

  componentDidMount = () => {
    this.getMaps();
  }

  getMaps = async () => {
    ApiManager.get('/account/myMaps', null, this.props.user)
      .then(maps => {
        maps = maps.filter(x => x.atlases.includes(INSAR_ATLAS));
        maps.sort((a, b) => { return a.name.localeCompare(b.name); });

        this.setState({ maps: maps });
      })
      .catch(err => {
        ErrorHandler.alert(err);
      });
  }

  onSelectAtlas = (e) => {
    let atlas = e.target.value;

    if (this.state.selectedAtlas === atlas) {
      return;
    }

    let maps = this.state.maps;

    let map = maps.find(x => x.info.subatlas === atlas && x.info.type === INSAR_TYPE);
    let altitudeMap = maps.find(x => x.info.subatlas === atlas && x.info.type === ALTITUDE_TYPE);

    map.altitudeMap = altitudeMap;

    this.setState({ selectedAtlas: atlas, selectedMap: map });    

    if (!map.timestamps || !map.layer) {
      this.getMapMetadata(map)
        .then(() => {
          this.props.onSelectMap(map);
        })
        .catch(err => {
          ErrorHandler.alert(err);
        });
    }
  }

  getMapMetadata = (map) => {
    if (map.metadataLoaded) {
      return Promise.resolve();
    }

    return ApiManager.post('/metadata', { mapId: map.id }, this.props.user)
      .then(result => {        
        map.timestamps = result.timestamps;
        map.classes = result.classes;
        map.measurements = result.measurements;
        map.layers = {
          tile: result.mapLayers,
          polygon: result.polygonLayers
        };
        map.bands = result.bands;
        map.forms = result.forms;
        map.model = result.model

        map.metadataLoaded = true;
      });
  }

  renderAtlasSelect = () => {
    let maps = this.state.maps;

    if (!maps || maps.length === 0) {
      return null;
    }

    let options = [];

    let atlases = [];

    for (let i = 0; i < maps.length; i++) {
      let map = maps[i];

      if (!map.info) {
        continue;
      }

      let atlas = map.info.subatlas;

      if (!atlases.includes(atlas)) {
        atlases.push(atlas);
      }      
    }

    atlases.sort((a, b) => {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });

    for (let i = 0; i < atlases.length; i++) {
      options.push(
        <MenuItem value={atlases[i]} key={i}>{`${atlases[i]}`}</MenuItem>
      );
    }

    let atlasSelect = (
      <Select className='selector map-selector-select' onChange={this.onSelectAtlas} value={this.state.selectedAtlas}>
        <MenuItem value='default' disabled hidden>{'Select an Atlas'}</MenuItem>
        {options}
      </Select>
    );

    return atlasSelect;
  }

  render() {
    return (
      <div>
        {this.renderAtlasSelect()}
      </div>
    );
  }
}

export default MapSelector;
