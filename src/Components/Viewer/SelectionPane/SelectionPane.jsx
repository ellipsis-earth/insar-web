import React, { PureComponent } from 'react';
import Papa from 'papaparse';

import {
  Card,
  Button,
  CardHeader,
  CardContent,
  CardActions,
  IconButton,
  Typography,
  CircularProgress
} from '@material-ui/core';
import ClearIcon from '@material-ui/icons/Clear';
import SaveAlt from '@material-ui/icons/SaveAlt';

import ViewerUtility from '../ViewerUtility';

import './SelectionPane.css';
import ApiManager from '../../../ApiManager';

const DELETE_CUSTOM_POLYGON_ACTION = 'delete_custom_polygon';
const AS_REFERENCE_ACTION = 'reference';

class SelectionPane extends PureComponent {

  constructor(props, context) {
    super(props, context);

    this.state = {
      isOpen: false,
      loading: false
    };
  }

  componentDidUpdate(prevProps) {
    if (!this.props.map || prevProps.map !== this.props.map || !this.props.element) {
      this.setState({ isOpen: false });
    }
    else if (prevProps.element !== this.props.element) {
      this.setState({ isOpen: true, altitude: null, displacement: null });

      if (this.props.element.type === ViewerUtility.standardTileLayerType) {
        this.getData();
        this.getAltitude();
      }
    }
  }

  getData = () => {
    let element = this.props.element;
    let referenceElement = this.props.referenceElement;

    if (!referenceElement) {
      this.setState({ displacement: 'no reference tile'});
      return;
    }

    let properties = element.feature.properties;
    let referenceProperties = referenceElement.feature.properties;

    let tileId = { tileX: properties.tileX, tileY: properties.tileY, zoom: properties.zoom };
    let referenceTileId = { tileX: referenceProperties.tileX, tileY: referenceProperties.tileY, zoom: referenceProperties.zoom };    

    if (tileId.tileX === referenceTileId.tileX && tileId.tileY === referenceTileId.tileY 
      && tileId.zoom === referenceTileId.zoom) {
      this.setState({ displacement: 0 });
      return;
    }

    let body = {
      mapId: this.props.map.id,
      type: ViewerUtility.standardTileLayerType,
      filters: {
        tileIds: [ tileId, referenceTileId ],
        forms: ['displacement'],
        userGroups: ['scripters']
      }
    };

    let tileMessageId = null;
    let referenceMessageId = null;

    return ApiManager.post(`/geomessage/ids`, body, this.props.user)
      .then((geoMessages) => {

        let messages = geoMessages.messages;

        let tileMessages = messages.filter(x => {
          return x.elementId.tileX === tileId.tileX && 
            x.elementId.tileY === tileId.tileY &&
            x.elementId.zoom === tileId.zoom;
        });

        let referenceTileMessages = messages.filter(x => {
          return x.elementId.tileX === referenceTileId.tileX && 
            x.elementId.tileY === referenceTileId.tileY &&
            x.elementId.zoom === referenceTileId.zoom;
        });

        if (tileMessages.length === 0 || referenceTileMessages.length === 0) {
          this.setState({ displacement: 'no data' });
          return null;
        }

        let lastGeoMessage = tileMessages[tileMessages.length - 1];
        let lastReferenceGeoMessage = referenceTileMessages[referenceTileMessages.length - 1];

        tileMessageId = lastGeoMessage.id;
        referenceMessageId = lastReferenceGeoMessage.id;

        body.messageIds = [tileMessageId, referenceMessageId];

        return ApiManager.post('/geomessage/get', body, this.props.user)
      })
      .then((geoMessages) => {
        if (geoMessages === null) {
          return null;
        }

        let tileGeoMessage = geoMessages.find(x => x.id === tileMessageId);
        let referenceTileGeoMessage = geoMessages.find(x => x.id === referenceMessageId);

        let tileDisplacement = tileGeoMessage.form.answers[0].answer;
        let referenceTileDisplacement = referenceTileGeoMessage.form.answers[0].answer;

        let displacement = tileDisplacement - referenceTileDisplacement;
        
        this.setState({ displacement: displacement });
      });
  }

  getAltitude = () => {
    let element = this.props.element;
    let type = element.type;
    let feature = element.feature;

    let body = {
      mapId: this.props.map.altitudeMap.id,
      type: type,
      element: {
        tileX: feature.properties.tileX,
        tileY: feature.properties.tileY,
        zoom: feature.properties.zoom
      },
      dataType: ViewerUtility.dataType.meanMeasurement,
      className: 'all classes'
    };

    return ApiManager.post(`/data/timestamps`, body, this.props.user)
      .then(result => {
        let parseFunc = async () => {
          let parsedData = Papa.parse(result, {
            dynamicTyping: true,
            skipEmptyLines: true,
            header: true
          });

          return parsedData;
        };

        return parseFunc();
      })
      .then(result => {
        let altitude = result.data[0]['altitude'];
        
        this.setState({ altitude: altitude });
      });

  }

  open = () => {
    this.setState({ isOpen: true });
  }

  refresh = () => {
    this.forceUpdate();
  }

  deleteCustomPolygon = () => {
    this.setState({ loading: true }, () => {
      let body = {
        mapId: this.props.map.id,
        polygonId: this.props.element.feature.properties.id
      };

      ApiManager.post('/geometry/delete', body, this.props.user)
        .then(() => {
          this.props.onDeletePolygon();
          this.props.onDeselect();
          this.setState({ isOpen: false, loading: false });
        })
        .catch(err => {
          console.log(err);
          this.setState({ loading: false });
        });
    });

  }

  onCloseClick = () => {
    this.props.onDeselect();

    this.setState({ isOpen: false });
  }

  onElementActionClick = (action) => {
    if (action === DELETE_CUSTOM_POLYGON_ACTION) {
      this.deleteCustomPolygon();
    }
    else if (action === AS_REFERENCE_ACTION) {
      this.props.onAsReference();
    }
    else {
      this.props.onDataPaneAction(action);
    }
  }

  onDownload = () => {
    let element = this.props.element;

    if (!element) {
      return;
    }

    let type = element.type;
    let feature = element.feature;

    let nameComponents = [this.props.map.name];

    if (type === ViewerUtility.standardTileLayerType) {
      nameComponents.push(
        'tile',
        feature.properties.tileX,
        feature.properties.tileY,
        feature.properties.zoom
      );
    }
    else if (type === ViewerUtility.polygonLayerType) {
      nameComponents.push('polygon', feature.properties.id);
    }
    else if (type === ViewerUtility.drawnPolygonLayerType) {
      nameComponents.push('drawnPolygon');
    }

    let fileName = nameComponents.join('_').replace(' ', '_') + '.geojson';

    let geoJson = {
      type: 'FeatureCollection',
      count: 1,
      features: [feature]
    };

    ViewerUtility.download(fileName, JSON.stringify(geoJson), 'application/json');
  }

  render() {
    if (!this.state.isOpen) {
      return null;
    }

    let map = this.props.map;
    let element = this.props.element;

    if (!map || !element) {
      return null;
    }

    let title = null;

    let user = this.props.user;
    let mapAccessLevel = map.accessLevel;

    let firstRowButtons = [];
    let secondRowButtons = [];

    firstRowButtons.push(
      <Button
        key='analyse'
        variant='outlined'
        size='small'
        className='selection-pane-button'
        onClick={() => this.onElementActionClick(ViewerUtility.dataPaneAction.analyse)}
        disabled={mapAccessLevel < ApiManager.accessLevels.aggregatedData}
      >
        {'ANALYSE'}
      </Button>
    );

    if (element.type !== ViewerUtility.drawnPolygonLayerType) {
      firstRowButtons.push((
        <Button
          key='geoMessage'
          variant='outlined'
          size='small'
          className='selection-pane-button'
          onClick={() => this.onElementActionClick(ViewerUtility.dataPaneAction.geoMessage)}
          disabled={mapAccessLevel < ApiManager.accessLevels.viewGeoMessages}
        >
          {'GeoMessage'}
        </Button>
      ));
    }

    if (element.type === ViewerUtility.standardTileLayerType) {
      title = 'Standard tile';

      secondRowButtons.push((
        <Button
          key='geoMessage'
          variant='outlined'
          size='small'
          className='selection-pane-button selection-pane-button-single'
          onClick={() => this.onElementActionClick(AS_REFERENCE_ACTION)}
          disabled={mapAccessLevel < ApiManager.accessLevels.viewGeoMessages}
        >
          As altitude reference
        </Button>
      ));
    }
    else if (element.type === ViewerUtility.polygonLayerType) {
      title = 'Polygon';

      let canEdit = user &&
        (mapAccessLevel > ApiManager.accessLevels.alterOrDeleteCustomPolygons ||
        element.feature.properties.user === user.username);

      secondRowButtons.push(
        <Button
          key='edit'
          variant='outlined'
          size='small'
          className='selection-pane-button'
          onClick={() => this.onElementActionClick(ViewerUtility.dataPaneAction.editCustomPolygon)}
          disabled={!canEdit}
        >
          {'EDIT'}
        </Button>,
        <Button
          key='delete'
          variant='outlined'
          size='small'
          className='selection-pane-button'
          onClick={() => this.onElementActionClick(DELETE_CUSTOM_POLYGON_ACTION)}
          disabled={!canEdit}
        >
          {'DELETE'}
        </Button>
      );
    }
    else if (element.type === ViewerUtility.drawnPolygonLayerType) {
      title = 'Drawn polygon';

      let nonRestrictedLayer = this.props.map.layers.polygon.find(x => !x.restricted);

      let canAdd = user && 
        mapAccessLevel >= ApiManager.accessLevels.addPolygons &&
        (nonRestrictedLayer || mapAccessLevel >= ApiManager.accessLevels.addRestrictedPolygons);

      firstRowButtons.push(
        <Button
          key='add'
          variant='outlined'
          size='small'
          className='selection-pane-button'
          onClick={() => this.onElementActionClick(ViewerUtility.dataPaneAction.createCustomPolygon)}
          disabled={!canAdd}
        >
          {'ADD'}
        </Button>
      );
    }

    let elementProperties = element.feature.properties;
    let properties = [];

    if (element.type === ViewerUtility.standardTileLayerType) {
      let altitudeText = this.state.altitude !== undefined && this.state.altitude !== null ? 
        this.state.altitude : 'loading...' ;

      properties.push((
        <div key='altitude'>
          {`altitude: ${altitudeText}`}
        </div>
      ));

      let displacementText = this.state.displacement !== undefined && this.state.displacement !== null ? 
        this.state.displacement : 'loading...' ;

      properties.push((
        <div key='displacement'>
          {`displacement: ${displacementText}`}
        </div>
      ));
    }
    
    let selectionPaneClass = 'selection-pane';

    for (let property in elementProperties) {

      let propertyValue = elementProperties[property];

      if (element.type === ViewerUtility.drawnPolygonLayerType && property === 'id') {
        continue;
      }
      if (element.type === ViewerUtility.customPolygonTileLayerType
        && property === ViewerUtility.isPrivateProperty) {
        if (propertyValue === true) {
          selectionPaneClass += ' selection-pane-private';
        }
        continue;
      }

      if (elementProperties.hasOwnProperty(property)) {
        properties.push((
          <div key={property}>
            {`${property}: ${propertyValue}`}
          </div>
        ))
      }
    }

    return (
      <Card className={selectionPaneClass}>
        <CardHeader
          className='material-card-header'
          title={
            <Button
              onClick={() => this.props.onFlyTo({
                type: ViewerUtility.flyToType.currentElement
              })}
            >
              <Typography variant="h6" component="h2" className='no-text-transform'>
                {title}
              </Typography>
            </Button>
          }
          action={
            <div>
              <IconButton
                onClick={this.onDownload}
                aria-label='Download'
              >
                <SaveAlt />
              </IconButton>
              <IconButton
                onClick={this.onCloseClick}
                aria-label='Close'
              >
                <ClearIcon />
              </IconButton>
            </div>
          }
        />
        <CardContent className={'card-content'}>
          {properties}
          { this.state.loading ? <CircularProgress className='loading-spinner'/> : null}
        </CardContent>
        <CardActions className={'selection-pane-card-actions'}>
          <div key='first_row_buttons'>
            {firstRowButtons}
          </div>
          <div key='secont_row_buttons' style={ {marginLeft: '0px' }}>
            {secondRowButtons}
          </div>
        </CardActions>
      </Card>
    );
  }
}

export default SelectionPane;
