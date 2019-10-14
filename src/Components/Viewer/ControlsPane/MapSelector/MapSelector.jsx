import React, { PureComponent } from 'react';

import ApiManager from '../../../../ApiManager';
import ErrorHandler from '../../../../ErrorHandler';

import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';

import './MapSelector.css';
import ViewerUtility from '../../ViewerUtility';

const ADMIN_ATLAS = 'Development';

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
        maps.sort((a, b) => { return a.name.localeCompare(b.name); });

        let urlSelectedMapName = new URLSearchParams(window.location.search).get('map');

        let urlSelectedMap = maps.find(x => x.name === urlSelectedMapName);

        let selectedAtlas = this.state.selectedAtlas;
        if (urlSelectedMap) {
          if (urlSelectedMap.atlases.length > 0) {
            selectedAtlas = urlSelectedMap.atlases[0];
          }
          else {
            selectedAtlas = ADMIN_ATLAS;
          }
        }

        this.setState({ maps: maps, selectedAtlas: selectedAtlas }, () => {
          if (urlSelectedMap) {
            this.onSelectMap({ target: { value: urlSelectedMap.id } })
          }
        });
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

    this.setState({ selectedAtlas: atlas, selectedMap: { id: 'default' }});
  }

  onSelectMap = (e) => {
    if (!e.target.value) {
      return;
    }

    let map = this.state.maps.find(x => x.id === e.target.value);

    if (!map) {
      return;
    }

    this.setState({ selectedMap: map });

    if (!map.timestamps || !map.layer) {
      this.getMapMetadata(map)
        .then(() => {
          this.props.onSelectMap(map);
        })
        .catch(err => {
          debugger;
          ErrorHandler.alert(err);
        });
    }
  };

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
    let atlasMapCount = {};

    for (let i = 0; i < maps.length; i++) {
      let map = maps[i];

      if (!map.atlases) {
        continue;
      }

      for (let x = 0; x < map.atlases.length; x++) {
        let atlas = map.atlases[x];

        if (!atlases.includes(atlas)) {
          atlases.push(atlas);
        }

        if (!atlasMapCount[atlas]) {
          atlasMapCount[atlas] = 1;
        }
        else {
          atlasMapCount[atlas] += 1;
        }
      }
    }

    atlases.sort((a, b) => {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });

    let user = this.props.user;

    if (user && (user.username === ViewerUtility.admin || user.username === 'demo_user' || user.username === 'minghai')) {
      atlases.push(ADMIN_ATLAS);
      atlasMapCount[ADMIN_ATLAS] = maps.length;
    }

    for (let i = 0; i < atlases.length; i++) {
      options.push(
        <MenuItem value={atlases[i]} key={i}>{`${atlases[i]} (${atlasMapCount[atlases[i]]})`}</MenuItem>
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

  renderMapSelect = () => {
    let maps = this.state.maps;
    let selectedAtlas = this.state.selectedAtlas;

    if (!maps || !selectedAtlas || selectedAtlas === 'default') {
      return null;
    }

    let mapsOfAtlas = maps;
    if (selectedAtlas !== ADMIN_ATLAS) {
      mapsOfAtlas = maps.filter(x => x.atlases.includes(selectedAtlas));
    }

    let options = [];

    for (let i = 0; i < mapsOfAtlas.length; i++) {
      let map = mapsOfAtlas[i];
      options.push(
        <MenuItem value={map.id} key={i}>{map.name}</MenuItem>
      );
    }

    let mapSelect = (
      <Select className='selector' onChange={this.onSelectMap} value={this.state.selectedMap.id}>
        <MenuItem value='default' disabled hidden>{'Select a map'}</MenuItem>
        {options}
      </Select>
    )

    return mapSelect;
  };

  render() {
    return (
      <div>
        {this.renderAtlasSelect()}
        {this.renderMapSelect()}
      </div>
    );
  }
}

export default MapSelector;
