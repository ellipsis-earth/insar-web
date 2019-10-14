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

const FILTER_POLYGON_COLOR = '#ff3030'

const REFRESH_MODE = {
  applyToMap: 1,
  full: 3
};

class FeedGeoMessageControl extends PureComponent {

  geomessagesContainerCard = null;

  rawGeoMessages = [];

  feedPage = 1;
  noMoreFeedMessages = false;
  feedScrollLoading = false;

  geometryResults = [];

  constructor(props, context) {
    super(props, context);

    this.geomessagesContainerCard = React.createRef();

    this.state = {
      loading: false,

      rawGeoMessages: [],

      availableGroups: [],

      filtersExpanded: false,
      filterSettings: this.createEmptyFilterSettings(),
      count: 0
    };
  }

  componentDidMount() {
    let newState = {
      loading: true,
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
        rawGeoMessages: [], 
        loading: true
      }, this.getGeoMessages);
    }
  }

  createEmptyFilterSettings = () => {
    return {
      applyToMap: false,
      selectedGroups: [],
      selectedTypes: ['polygon'],
      selectedForms: []
    };
  }

  getGeoMessages = () => {
    let cb = () => {
    }

    this.getFeedMessages(this.setState({ loading: false }))
      .catch(err => {
        console.error(err);
        this.setState({ loading: false });
      });
  }

  getFeedMessages = (cb) => {
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

        let geoMessageIds = result.messages.map(x => x.id);

        body.messageIds = geoMessageIds;

        return ApiManager.post(`/geoMessage/get`, body, this.props.user);
      })    
      .then(result => {
        let newRawGeoMessages = [...this.state.rawGeoMessages, ...result];

        if (result.length === 0) {
          this.noMoreFeedMessages = true;
        }

        this.setState({ rawGeoMessages: newRawGeoMessages}, () => {
          this.getMessageGeometries(cb);
        });
      });
  }

  getMessageGeometries = (cb) => {
    let filteredElements = [];

    let rawGeoMessages = this.state.rawGeoMessages;

    for (let i = 0; i < rawGeoMessages.length; i++) {
      let message = rawGeoMessages[i];

      let deleted = message.deleteDate;

      if (!deleted) {
        let findFunc = (x) => {
          if (x.type !== message.type) {
            return false;
          }

          if (x.type !== ViewerUtility.standardTileLayerType) {
            return x.elementId === message.elementId;
          }
          else {
            return x.elementId.tileX === message.elementId.tileX &&
              x.elementId.tileY === message.elementId.tileY &&
              x.elementId.zoom === message.elementId.zoom;
          }
        };

        if (!filteredElements.find(findFunc)) {
          filteredElements.push({
            elementId: message.elementId,
            type: message.type,
            layer: message.layer
          });
        }
      }
    }

    let getGeometry = (type) => {
      let elementsOfType = filteredElements.filter(x => x.type === type);

      if (elementsOfType.length === 0) {
        return {
          geoJson: null,
          elements: null
        };
      }

      let map = this.props.map;
      let timestampRange = this.props.timestampRange;

      let elementIds = [];
      for (let i = 0; i < elementsOfType.length; i++){
        elementIds.push(elementsOfType[i].elementId);
      }

      let body = {
        mapId: map.id,
        timestamp: map.timestamps[timestampRange.end].timestampNumber
      };

      let url = '';

      if (type === ViewerUtility.standardTileLayerType) {
        url = '/geometry/tiles';
        body.tileIds = elementIds;
      }
      else if (type === ViewerUtility.polygonLayerType) {
        url = '/geometry/polygons';
        body.polygonIds = elementIds;
      }

      return ApiManager.post(url, body, this.props.user)
        .then(geoJson => {
          for (let i = 0; i < geoJson.features.length; i++) {
            geoJson.features[i].properties.type = type;
          }

          return {
            geoJson: geoJson,
            element: (
              <GeoJSON
                key={Math.random()}
                data={geoJson}
                style={ViewerUtility.createGeoJsonLayerStyle(FILTER_POLYGON_COLOR)}
                zIndex={ViewerUtility.customPolygonLayerZIndex}
                onEachFeature={(feature, layer) =>
                  layer.on({ click: () => {
                    let hasAggregatedData = false;

                    if (feature.properties.type === ViewerUtility.polygonLayerType) {
                      let layerName = feature.properties.layer;
                      let layers = map.layers.polygon[map.layers.polygon.length - 1].layers;

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

    let standardTilesPromise = getGeometry(ViewerUtility.standardTileLayerType);
    let polygonPromise = getGeometry(ViewerUtility.polygonLayerType);

    Promise.all([standardTilesPromise, polygonPromise])
      .then(results => {
        let geoJsonElements = [];

        for (let i = 0; i < results.length; i++) {
          let result = results[i];

          if (result) {
            geoJsonElements.push(result.element);
          }
        }

        let count = 0;
        for (let i = 0; i < results.length; i++) {
          if (results[i].geoJson) {
            count += results[i].geoJson.count;
          }
        }

        if (this.state.filterSettings.applyToMap) {
          this.props.onLayersChange(geoJsonElements, true);
        }

        this.geometryResults = results;
        this.setState({ count: count }, () => {
          if (cb) {
            cb();
          }
          setTimeout(this.onGeoMessagesScroll, 1000);
        });
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
          type={message.type}
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
    if (!this.props.isFeed || this.noMoreFeedMessages || this.state.loading
      || this.feedScrollLoading) {
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

    this.getFeedMessages(() => {
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
          let geoJsonElements = [];

          for (let i = 0; i < this.geometryResults.length; i++) {
            let result = this.geometryResults[i];

            if (result) {
              geoJsonElements.push(result.element);
            }
          }

          this.props.onLayersChange(geoJsonElements, true);
        }
        else {
          this.props.onLayersChange(null, true);
        }
        return;
      }
      else if (refreshMode === REFRESH_MODE.full) {
        refreshFunc = (cb) => {
          this.setState({ rawGeoMessages: []}, () => {
            this.feedPage = 1;
            this.noMoreFeedMessages = false;

            this.getFeedMessages(cb)
            .catch(err => {
              console.error(err);
              this.setState({ loading: false });
            });
          })

        };
      }

      let updateGeoMessages = () => {
        this.setState({ loading: true }, () => {
          refreshFunc(() => { this.setState({ loading: false })});
        });
      };

      this.getFeedMessagesTimer = setTimeout(updateGeoMessages, 1000);
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

  renderMessages = () => {
    let rawGeoMessages = this.state.rawGeoMessages;

    if (!rawGeoMessages) {
      return null;
    }

    if (rawGeoMessages.length === 0) {
      return (
        <div>
          No messages.
        </div>
      );
    }

    let geoMessageElements = [];

    for (let i = 0; i < rawGeoMessages.length; i++) {
      let rawGeoMessage = rawGeoMessages[i];

      if (!rawGeoMessage.deleteDate) {
        geoMessageElements.push(this.createGeomessageElement(rawGeoMessage));
      }
    }

    return geoMessageElements;
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
          {
            this.state.loading ?
              <CircularProgress className='loading-spinner'/> : this.renderMessages()
          }
        </Card>
        {
          <GeoMessageForm
            user={this.props.user}
            map={this.props.map}
            timestampRange={this.props.timestampRange}
            geolocation={this.props.geolocation}
            element={this.props.element}
            onNewMessage={this.onNewMessage}
          />
        }
      </div>
    );
  }
}

export default FeedGeoMessageControl;
