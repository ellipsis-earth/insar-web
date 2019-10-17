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

    let map = this.state.maps.find(x => x.info.subatlas === atlas && x.info.type === INSAR_TYPE);
    let altitudeMap = this.state.maps.find(x => x.info.subatlas === atlas && x.info.type === ALTITUDE_TYPE);

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

    let promises = [];
    
    for (let i = 0; i < METADATA_TYPES.length; i++) {
      let metadataType = METADATA_TYPES[i];

      promises.push(
        ApiManager.post('/metadata', { mapId: map.id, type: metadataType.key }, this.props.user)
      );
    }

    return Promise.all(promises)
      .then(results => {
        map.layers = {};

        for (let i = 0; i < results.length; i++) {
          let result = results[i];
          let metadataType = METADATA_TYPES[i];

          metadataType.function(map, result);
        }

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
