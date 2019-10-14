import React, { PureComponent } from 'react';
import { GeoJSON } from 'react-leaflet';

import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  CircularProgress,
  Button,
  Select,
  MenuItem,
  Collapse,
  IconButton,
  Input,
  Checkbox,
  ListItemText,
  InputLabel,
  FormControl
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import SaveAlt from '@material-ui/icons/SaveAlt';

import ViewerUtility from '../../ViewerUtility';
import DataPaneUtility from '../DataPaneUtility';

import './GeoMessageControl.css';
import ApiManager from '../../../../ApiManager';

import GeoMessage from './GeoMessage/GeoMessage';
import GeoMessageForm from './GeoMessageForm/GeoMessageForm';

const PAGE_SIZE = 100;
const SCROLL_LOAD_THRESHOLD = 1000;
const NO_GROUP_NAME = 'no group';

const FILTER_POLYGON_COLOR = '#ff3030'

const REFRESH_MODE = {
  applyToMap: 1,
  full: 3
};

class FeedGeoMessageControl extends PureComponent {

  geomessagesContainerCard = null;

  geoMessageIds = [];
  rawGeoMessages = [];
  feedPage = 0;
  filteredGeoJson = {
    [ViewerUtility.standardTileLayerType]: { count: 0, features: [] },
    [ViewerUtility.polygonLayerType]: { count: 0, features: [] }
  };

  feedScrollLoading = false;

  geometryResults = [];

  constructor(props, context) {
    super(props, context);

    this.geomessagesContainerCard = React.createRef();

    this.state = {
      loading: false,

      availableGroups: [],

      geoMessageElements: [],

      filtersExpanded: false,
      filterSettings: this.createEmptyFilterSettings(),
      count: 0
    };
  }

  componentDidMount() {
    let newState = {
      availableGroups: [...this.props.map.groups, NO_GROUP_NAME]
    };

    this.setState(newState, this.getGeoMessages);
  }

  componentDidUpdate(prevProps) {
    let differentMap = this.props.map !== prevProps.map;

    if (differentMap) {
      this.setState({
        availableGroups: [...this.props.map.groups, NO_GROUP_NAME],
        filterSettings: this.createEmptyFilterSettings(),
        rawGeoMessages: []
      }, this.getGeoMessages);
    }
  }

  createEmptyFilterSettings = () => {
    return {
      applyToMap: false,
      selectedGroups: [],
      selectedType: ViewerUtility.standardTileLayerType,
      selectedForms: []
    };
  }

  reset = () => {
    this.setState({ geoMessageElements: [] });

    this.geoMessageIds = [];
    this.rawGeoMessages = [];
    this.feedPage = 0;
    this.filteredGeoJson = {
      [ViewerUtility.standardTileLayerType]: { count: 0, features: [] },
      [ViewerUtility.polygonLayerType]: { count: 0, features: [] }
    };
  
  }

  getGeoMessages = () => {
    this.setState({ loading: true });

    this.reset();

    this.getFeedMessages()
      .then(() => {
        return this.getNextPage();
      })
      .then(() => {
        this.setState({ loading: false });
      })
      .catch(err => {
        console.error(err);
        this.setState({ loading: false });
      });
  }

  getFeedMessages = () => {
    let filters = {
      userGroups: this.state.filterSettings.selectedGroups,
      forms: this.state.filterSettings.selectedForms
    };

    let body = {
      mapId: this.props.map.id,
      type: this.state.filterSettings.selectedType,
      filters: filters
    };

    return ApiManager.post(`/geoMessage/ids`, body, this.props.user)
      .then((result) => {
        if (result.count === 0) {
          return [];
        }

        this.geoMessageIds = result.messages.map(x => x.id);
      });
  }

  getNextPage = () => {
    if (this.feedPage * PAGE_SIZE > this.geoMessageIds.length) {
      return Promise.resolve();
    }

    let pageGeoMessageIds = this.geoMessageIds.splice(this.feedPage * PAGE_SIZE, PAGE_SIZE);

    let body = {
      mapId: this.props.map.id,
      type: this.state.filterSettings.selectedType,
      messageIds: pageGeoMessageIds
    };

    return ApiManager.post(`/geoMessage/get`, body, this.props.user)
      .then((geoMessages) => {
        this.rawGeoMessages = this.rawGeoMessages.concat(geoMessages);

        this.getMessageGeometries(geoMessages);

        let newGeoMessageElements = geoMessages.map(x => this.createGeomessageElement(x));
        let geoMessageElements = [...this.state.geoMessageElements, ...newGeoMessageElements];

        this.feedPage++;

        this.setState({ geoMessageElements: geoMessageElements });
      });
  }

  getMessageGeometries = (geoMessages) => {
    let filteredElements = [];

    let type = this.state.filterSettings.selectedType;
    let findFunc = (message, x) => {
      if (type !== ViewerUtility.standardTileLayerType) {
        return x === message.elementId;
      }
      else {
        return x.tileX === message.elementId.tileX &&
          x.tileY === message.elementId.tileY &&
          x.zoom === message.elementId.zoom;
      }
    };

    let rawGeoMessages = geoMessages;

    for (let i = 0; i < rawGeoMessages.length; i++) {
      let message = rawGeoMessages[i];

      if (!filteredElements.find((x) => findFunc(message, x))) {
        filteredElements.push(message.elementId);
      }
    }

    let getGeometry = async () => {
      if (filteredElements.length === 0) {
        return {
          geoJson: null,
          elements: null
        };
      }

      let map = this.props.map;
      let timestampRange = this.props.timestampRange;

      let body = {
        mapId: map.id,
        type: type,
        timestamp: map.timestamps[timestampRange.end].timestampNumber,
        elementIds: filteredElements,
      };

      return ApiManager.post('/geometry/get', body, this.props.user)
        .then(geoJson => {

          for (let i = 0; i < geoJson.features.length; i++) {
            geoJson.features[i].properties.type = type;
          }

          let savedGeoJson = this.filteredGeoJson[type];

          savedGeoJson.features = savedGeoJson.features.concat(geoJson.features);
          savedGeoJson.count = savedGeoJson.features.length;

          return {
            geoJson: savedGeoJson,
            element: (
              <GeoJSON
                key={Math.random()}
                data={savedGeoJson}
                style={ViewerUtility.createGeoJsonLayerStyle(FILTER_POLYGON_COLOR)}
                zIndex={ViewerUtility.customPolygonLayerZIndex}
                onEachFeature={(feature, layer) =>
                  layer.on({ click: () => {
                    let hasAggregatedData = false;

                    if (feature.properties.type === ViewerUtility.polygonLayerType) {
                      let layerName = feature.properties.layer;
                      let layers = map.layers.polygon;

                      let layer = layers.find(x => x.name === layerName);

                      if (layer) {
                        hasAggregatedData = layer.hasAggregatedData;
                      }
                    }

                    this.props.onFeatureClick(type, feature, hasAggregatedData, FILTER_POLYGON_COLOR) }
                  })
                }
              />)
          };
        });
    }

    getGeometry()
      .then(result => {
        let geoJsonElements = [result.element];

        let count = result.geoJson.count;

        if (this.state.filterSettings.applyToMap) {
          this.props.onLayersChange(geoJsonElements, true);
        }

        this.geoJsonElements = geoJsonElements;

        this.setState({ count: count });
      });
  }

  createGeomessageElement = (message) => {
    return (
      <div
        key={message.id}
      >
        <GeoMessage
          user={this.props.user}
          map={this.props.map}
          message={message}
          type={this.state.filterSettings.selectedType}
          isFeed={true}
          onDataPaneAction={this.props.onDataPaneAction}
          onDeleteMessage={this.onDeleteMessage}
          onFlyTo={this.props.onFlyTo}
        />
      </div>
    );
  }

  onDeleteMessage = (deletedMessage) => {
    let newRawGeoMessages = [...this.state.rawGeoMessages.filter(x => x.id !== deletedMessage.id)];

    this.setState({ rawGeoMessages: newRawGeoMessages}, () => {
      if (this.props.isFeed) {
        this.getMessageGeometries();

        let selectedElement = this.props.element;

        if (selectedElement) {
          let sameElement = selectedElement.type === deletedMessage.type;

          if (sameElement) {
            let properties = selectedElement.feature.properties;
            let elementId = deletedMessage.elementId;

            let hasOtherMessages = false;

            if (selectedElement.type === ViewerUtility.standardTileLayerType) {
              sameElement = properties.tileX === elementId.tileX &&
                properties.tileY === elementId.tileY && properties.zoom === elementId.zoom;

              hasOtherMessages = this.state.rawGeoMessages.find(x => {
                return x.type === selectedElement.type && x.elementId.tileX === properties.tileX &&
                  x.elementId.tileY === properties.tileY && x.elementId.zoom === properties.zoom;
              });
            }
            else {
              sameElement = properties.id === elementId;
              hasOtherMessages = this.state.rawGeoMessages.find(x => {
                return x.type === selectedElement.type && x.id === properties.id
              });
            }

            if (sameElement && !hasOtherMessages) {
              this.props.onDeselect();
            }
          }
        }
      }
    });
  }

  onGeoMessagesScroll = () => {
    if (this.state.loading || this.feedScrollLoading) {
      return;
    }

    let messagesContainer = this.geomessagesContainerCard.current;

    if (!messagesContainer) {
      console.warn('GeoMessageControl.onGeoMessagesScroll: messagesContainer is not defined!');
      return;
    }

    let diff = messagesContainer.scrollHeight - messagesContainer.scrollTop;
    let tooFewMessages = messagesContainer.scrollHeight === messagesContainer.clientHeight;

    if (!(diff < SCROLL_LOAD_THRESHOLD || tooFewMessages)) {
      return;
    }

    this.feedScrollLoading = true;

    this.setState({ loading: true });

    this.getNextPage()
      .then(() => {
        this.setState({ loading: false })
        this.feedScrollLoading = false;
      })
      .catch(err => {
        console.error(err);
        this.setState({ loading: false });
      });
  }

  onFilterChange = (e, property, isCheckbox, refreshMode) => {
    let filterSettings = {
      ...this.state.filterSettings
    };

    if (!isCheckbox) {
      filterSettings[property] = e.target.value;
    }
    else {
      filterSettings[property] = e.target.checked;
    }

    if (this.getFeedMessagesTimer) {
      clearTimeout(this.getFeedMessagesTimer);
    }

    this.setState({ filterSettings: filterSettings }, () => {
      let refreshFunc = null;

      if (refreshMode === REFRESH_MODE.applyToMap) {
        if (this.state.filterSettings.applyToMap) {
          this.props.onLayersChange(this.geoJsonElements, true);
        }
        else {
          this.props.onLayersChange(null, true);
        }
        return;
      }
      else if (refreshMode === REFRESH_MODE.full) {
        refreshFunc = () => {
          this.setState({ rawGeoMessages: []}, () => {
            this.feedPage = 1;

            this.getGeoMessages();
          })

        };
      }

      this.getFeedMessagesTimer = setTimeout(refreshFunc, 1000);
    });
  }

  onExpandClick = () => {
    this.setState({ filtersExpanded: !this.state.filtersExpanded});
  }

  onDownloadClick = () => {
    if (!this.geometryResults || this.geometryResults.length === 0) {
      return;
    }

    let allFeatures = [];
    for (let i = 0; i < this.geometryResults.length; i++) {
      if (this.geometryResults[i].geoJson) {
        allFeatures =  allFeatures.concat(this.geometryResults[i].geoJson.features);
      }
    }

    let geoJson = {
      type: 'FeatureCollection',
      count: this.state.count,
      features: allFeatures
    };

    let nameComponents = [
      this.props.map.name,
      'feed',
    ];

    let fileName = nameComponents.join('_') + '.geojson';

    ViewerUtility.download(fileName, JSON.stringify(geoJson), 'application/json');
  }

  renderFilterSection = () => {
    let downloadGeometries = null;
    if (this.state.filterSettings.applyToMap) {
      downloadGeometries = (
        <span>
          {`${'Apply to map'} (${this.state.count})`}
          <IconButton
            className='feed-download-geometry-button'
            onClick={() => this.onDownloadClick()}
          >
            <SaveAlt className='download-geometry-button-icon'/>
          </IconButton>
        </span>
      );
    }
    else {
      downloadGeometries = (<span>{'Apply to map'}</span>);
    }

    let filtersSectionClass = 'data-pane-card groups-filter-card';
    if (this.state.filtersExpanded) {
      filtersSectionClass += ' groups-filter-card-expanded';
    }

    let filterSection = (
      <Card className={filtersSectionClass}>
        <CardHeader
          className='data-pane-title-header groups-filter-card-header'
          title={
            <Typography variant="h6" component="h2" className='no-text-transform'>
              {'Filters'}
            </Typography>
          }
          action={
            <IconButton
              className={this.state.filtersExpanded ? 'expand-icon expanded' : 'expand-icon'}
              onClick={this.onExpandClick}
              aria-expanded={this.state.filtersExpanded}
              aria-label='Show'
            >
              <ExpandMoreIcon />
            </IconButton>
          }
        />
        <Collapse in={this.state.filtersExpanded}>
          <CardContent className='data-pane-card-content'>
            <Checkbox
              color='primary'
              onChange={(e) => this.onFilterChange(e, 'applyToMap', true, REFRESH_MODE.applyToMap)}
              checked={this.state.filterSettings.applyToMap}
            />
            {downloadGeometries}
            <FormControl className='card-form-control selector-single'>
              <InputLabel htmlFor='select-multiple-checkbox-groups'>{'Groups filter'}</InputLabel>
              <Select
                className='selector'
                multiple
                value={this.state.filterSettings.selectedGroups}
                onChange={(e) => this.onFilterChange(e, 'selectedGroups', false, REFRESH_MODE.full)}
                input={<Input id='select-multiple-checkbox-groups' />}
                renderValue={selected => selected.join(', ')}
              >
                {this.state.availableGroups.map(name => (
                  <MenuItem key={name} value={name}>
                    <Checkbox checked={this.state.filterSettings.selectedGroups.includes(name)} />
                    <ListItemText primary={name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl className='card-form-control selector-single'>
              <InputLabel htmlFor='select-multiple-checkbox-forms'>Type filter</InputLabel>
              <Select
                className='selector'
                value={this.state.filterSettings.selectedType}
                onChange={(e) => this.onFilterChange(e, 'selectedType', false, REFRESH_MODE.full)}
              >
                {[ViewerUtility.polygonLayerType, ViewerUtility.standardTileLayerType].map(type => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl className='card-form-control selector-single'>
              <InputLabel htmlFor='select-multiple-checkbox-forms'>{'Forms filter'}</InputLabel>
              <Select
                className='selector'
                multiple
                value={this.state.filterSettings.selectedForms}
                onChange={(e) => this.onFilterChange(e, 'selectedForms', false, REFRESH_MODE.full)}
                input={<Input id='select-multiple-checkbox-forms' />}
                renderValue={selected => selected.join(', ')}
              >
                {this.props.map.forms.map(form => (
                  <MenuItem key={form.formName} value={form.formName}>
                    <Checkbox checked={this.state.filterSettings.selectedForms.includes(form.formName)} />
                    <ListItemText primary={form.formName} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </CardContent>
        </Collapse>
      </Card>
    );

    return filterSection;
  }

  render() {
    if (this.props.home) {
      return null;
    }

    let className = 'data-pane-card geomessage-messages-card';
    if (this.state.filtersExpanded) {
      className += ' geomessage-messages-card-feed-filters';
    }
    else {
      className += ' geomessage-messages-card-feed';
    }

    return (
      <div className='geomessage-control'>
        {this.renderFilterSection()}
        <Card
          ref={this.geomessagesContainerCard}
          className={className}
          onScroll={this.onGeoMessagesScroll}
        >
          {this.state.geoMessageElements}
          {
            this.state.loading ?
              <CircularProgress className='loading-spinner'/> : null
          }
        </Card>
      </div>
    );
  }
}

export default FeedGeoMessageControl;
