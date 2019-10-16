import React, { PureComponent } from 'react';

import ApiManager from '../../../../ApiManager';
import ErrorHandler from '../../../../ErrorHandler';

import './MapSelector.css';
import ViewerUtility from '../../ViewerUtility';

const INSAR_MAP_ID = 'cee513c0-37dc-4836-af40-51adb06b6c76';

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

      mapselect: null,

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

        this.setState({ maps: maps }, () => {
          this.onSelectMap({ target: { value: INSAR_MAP_ID } });
        });
      })
      .catch(err => {
        ErrorHandler.alert(err);
      });
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

  render() {
    return null;
  }
}

export default MapSelector;
