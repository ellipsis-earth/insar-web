import React, { PureComponent } from 'react';
import Papa from 'papaparse';
import LineChart from './LineChart/LineChart';

import {
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Typography,
  CircularProgress,
  Slider,
  Select,
  MenuItem,
  Collapse,
  IconButton,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import SaveAlt from '@material-ui/icons/SaveAlt';

import ViewerUtility from '../../ViewerUtility';
import DataPaneUtility from '../DataPaneUtility';

import './AnalyseControl.css';
import ApiManager from '../../../../ApiManager';

class AnalyseControl extends PureComponent {

  constructor(props, context) {
    super(props, context);

    this.state = {
      measurementsLoading: false,
      measurementsData: null,
      measurementsExpanded: true,

      referenceLoading: false,
      referenceData: null
    };
  }

  componentDidMount() {
  }

  componentDidUpdate(prevProps) {
    let element = this.props.element;
    let referenceElement = this.props.referenceElement;

    if (!element) {
      this.setState({ measurementsData: null });
      return;
    }

    if (!referenceElement) {
      this.setState({ referenceData: null });
    }

    let differentElement = DataPaneUtility.isDifferentElement(prevProps.element, element);
    let differentReferenceElement = DataPaneUtility.isDifferentElement(prevProps.referenceElement, referenceElement);

    if ((!this.state.measurementsData && !this.state.measurementsLoading) || differentElement) {
      this.setState({ measurementsData: null, measurementsLoading: true });

      this.getData(this.props.element)
        .then((data) => {
          this.setState({ measurementsData: data, measurementsLoading: false });
        });
    }

    if ((this.props.referenceElement && !this.state.referenceData && !this.state.referenceLoading) || differentReferenceElement) {
      this.setState({ referenceData: null, referenceLoading: true });

      this.getData(this.props.referenceElement)
        .then((data) => {
          console.log('Reference data loaded.');
          this.setState({ referenceData: data, referenceLoading: false });
        });
    }
  }

  getData = async (element) => {
    let body = {
      mapId: this.props.map.id,
      dataType: 'mean_measurement',
      className: ViewerUtility.specialClassName.allClasses,
    };

    if (element.type === ViewerUtility.standardTileLayerType) {
      let properties = element.feature.properties;

      body.type = ViewerUtility.standardTileLayerType;
      body.element = {
        tileX: properties.tileX,
        tileY: properties.tileY,
        zoom: properties.zoom
      };
    }
    else if (element.type === ViewerUtility.polygonLayerType && element.hasAggregatedData) {
      body.type = ViewerUtility.polygonLayerType;
      body.element = element.feature.properties.id;
    }
    else if (element.type === ViewerUtility.customPolygonTileLayerType ||
      element.type === ViewerUtility.drawnPolygonLayerType || !element.hasAggregatedData) {
      body.type = ViewerUtility.customPolygonTileLayerType;
      body.element = element.feature;
    }

    let data = {};

    return ApiManager.post(`/data/timestamps`, body, this.props.user)
      .then(result => {
        data.raw = result;

        let parseFunc = async () => {
          let parsedData = Papa.parse(data.raw, {
            dynamicTyping: true,
            skipEmptyLines: true,
            header: true
          });

          return parsedData;
        };

        return parseFunc();
      })
      .then(result => {
        data.parsed = result;

        return data;        
      });
  }

  onDownloadData = (isMeasurements) => {
    let csvData = null;

    if (this.state.measurementsData) {
      csvData = this.state.measurementsData.raw;
    }

    let nameComponents = [this.props.map.name];

    let element = this.props.element;
    let elementProperties = element.feature.properties;

    if (element.type === ViewerUtility.standardTileLayerType) {
      nameComponents.push(
        'tile',
        elementProperties.tileX,
        elementProperties.tileY,
        elementProperties.zoom
      );
    }
    else if (element.type === ViewerUtility.polygonLayerType) {
      nameComponents.push(
        'polygon',
        elementProperties.id
      );
    }
    else if (element.type === ViewerUtility.customPolygonTileLayerType) {
      nameComponents.push(
        'customPolygon',
        elementProperties.id
      );
    }
    else if (element.type === ViewerUtility.drawnPolygonLayerType) {
      nameComponents.push(
        'drawnPolygon'
      );
    }

    if (!isMeasurements) {
      nameComponents.push('classes');
    }
    else {
      nameComponents.push(
        'measurements',
        ViewerUtility.specialClassName.allClasses
      );
    }

    let fileName = nameComponents.join('_') + '.csv';

    ViewerUtility.download(fileName, csvData, 'text/csv');
  }


  render() {
    if (this.props.home) {
      return null;
    }

    let measurementsElement = null;
    let measurementData = this.state.measurementsData;
    let referenceData = this.state.referenceData;

    if (!this.state.measurementsLoading && measurementData) {
      if (!measurementData.error) {
        measurementsElement = 
          <LineChart
            map={this.props.map}
            data={measurementData}
            referenceData={referenceData}
            type={ViewerUtility.dataGraphType.measurements}
          />
      }
      else {
        measurementsElement = (<div>{measurementData.message}</div>);        
      }
    }

    return (
      <div>
        {
          !this.props.referenceElement ? 
            <Card className='data-pane-card'>
              <CardHeader
                className='data-pane-title-header'
                subheader={'Warning: No reference tile selected.'}
              />
            </Card> : null
        }
        <Card className='data-pane-card'>
          <CardHeader
            title={
              <Typography variant="h6" component="h2" className='no-text-transform'>
                {'Measurements'}
              </Typography>
            }
            action={
              <IconButton
                className={this.state.measurementsExpanded ? 'expand-icon expanded' : 'expand-icon'}
                onClick={() => this.setState({ measurementsExpanded: !this.state.measurementsExpanded })}
                aria-expanded={this.state.measurementsExpanded}
                aria-label='Show'
              >
                <ExpandMoreIcon />
              </IconButton>
            }
          />
          <Collapse in={this.state.measurementsExpanded}>
            <CardContent className='data-pane-card-content analyse-card-content'>
              { this.state.measurementsLoading ? <CircularProgress className='loading-spinner'/> : null }
              {measurementsElement}
            </CardContent>
            {
              !this.state.measurementsLoading && this.state.measurementsData ?
                <CardActions className='analyse-card-actions'>
                  <IconButton
                    onClick={() => this.onDownloadData(true)}
                    aria-label='Download data'
                  >
                    <SaveAlt />
                  </IconButton>
                </CardActions> : null
            }
          </Collapse>
        </Card>
      </div>
    )
  }
}

export default AnalyseControl;
