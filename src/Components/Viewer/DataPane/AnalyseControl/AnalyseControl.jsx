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

const DEFAULT_SELECTED_CLASS = 'default';

class AnalyseControl extends PureComponent {

  constructor(props, context) {
    super(props, context);

    this.state = {
      classesLoading: false,
      measurementsLoading: false,

      availableClasses: null,
      selectedClass: DEFAULT_SELECTED_CLASS,

      classesData: null,
      measurementsData: {},

      classesExpanded: true,
      measurementsExpanded: true,

      maxMask: 1
    };
  }

  componentDidMount() {
    this.setState({ classesLoading: true }, () => {
      this.getAvailableClasses();
      this.getData(ViewerUtility.dataGraphType.classes);
    });
  }

  componentDidUpdate(prevProps) {
    let differentMap = this.props.map !== prevProps.map;
    if (differentMap) {
      this.getAvailableClasses();
    }

    if (!this.props.element) {
      this.setState({ classesData: null, measurementsData: {} });
      return;
    }

    let differentElement = differentMap || DataPaneUtility.isDifferentElement(prevProps.element, this.props.element);

    if (differentElement) {
      this.setState({
          classesData: null,
          measurementsData: {},
          classesLoading: true,
          measurementsLoading: true,
        }, () => {
          this.getData(ViewerUtility.dataGraphType.classes);
          this.getData(ViewerUtility.dataGraphType.measurements, this.state.selectedClass)
      });
    }
  }

  getAvailableClasses = () => {
    let availableClasses = [];

    let map = this.props.map;

    if (!map.perClass) {
      availableClasses.push(ViewerUtility.specialClassName.allClasses);
    }
    else {
      for (let i = 0; i < map.classes.length; i++) {
        let timestampClasses = map.classes[i];

        for (let x = 0; x < timestampClasses.classes.length; x++) {
          let className = timestampClasses.classes[x].name;

          if (className === ViewerUtility.specialClassName.outside_area || className === ViewerUtility.specialClassName.mask) {
            continue;
          }

          if (!availableClasses.includes(className)) {
            availableClasses.push(className);
          }
        }
      }
    }

    // setState with or without callback
    if (availableClasses.length === 1) {
      this.setState({ availableClasses: availableClasses }, this.onSelectClass({target : {value: availableClasses[0]}}));
    }
    else {
      this.setState({ availableClasses: availableClasses });
    }
  }

  getData = async (type, className) => {
    let element = this.props.element;

    let body = {
      mapId: this.props.map.id,
      className: className
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

    if (type === ViewerUtility.dataGraphType.classes) {
      body.dataType = 'class';
    }
    else if (type === ViewerUtility.dataGraphType.measurements && className !== 'default') {
      body.dataType = 'mean_measurement';
    }

    let data = {};

    ApiManager.post(`/data/timestamps`, body, this.props.user)
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

        if (type === ViewerUtility.dataGraphType.classes) {
          this.setState({ classesData: data, classesLoading: false });
        }
        else if (type === ViewerUtility.dataGraphType.measurements) {
          let newMeasurementsData = {
            ...this.state.measurementsData
          };

          newMeasurementsData[className] = data;

          this.setState({ measurementsData: newMeasurementsData, measurementsLoading: false });
        }
      })
      .catch(err => {
        let data = null;
        if (err.status !== 500) {
          data = {
            error: true,
            status: err.status,
            message: err.message
          };
        }        

        if (type === ViewerUtility.dataGraphType.classes) {
          this.setState({ classesData: data, classesLoading: false });
        }
        else if (type === ViewerUtility.dataGraphType.measurements) {
          let newMeasurementsData = {
            ...this.state.measurementsData
          };

          newMeasurementsData[className] = data;

          this.setState({ measurementsData: newMeasurementsData, measurementsLoading: false });
        }
      });
  }

  renderClassOptions = () => {
    let availableClasses = this.state.availableClasses;

    if (!availableClasses) {
      return null;
    }

    let classOptions = [];

    for (let i = 0; i < availableClasses.length; i++) {
      let className = availableClasses[i];

      classOptions.push(
        <MenuItem key={className} value={className}>{className}</MenuItem>
      )
    }

    return classOptions;
  }

  onSelectClass = (e) => {
    let selectedClass = e.target.value;

    if (!this.state.measurementsData[selectedClass]) {
      this.setState({
        selectedClass: selectedClass,
        measurementsLoading: true
        },
        () => this.getData(ViewerUtility.dataGraphType.measurements, selectedClass)
      );
    }
    else {
      this.setState({ selectedClass: selectedClass });
    }
  }

  onMaxMaskChange = (e, value) => {
    this.setState({ maxMask: value });
  }

  onDownloadData = (isMeasurements) => {
    let csvData = null;

    if (!isMeasurements && this.state.classesData) {
      csvData = this.state.classesData.raw;
    }
    else if (this.state.measurementsData[this.state.selectedClass]) {
      csvData = this.state.measurementsData[this.state.selectedClass].raw;
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
        this.state.selectedClass
      );
    }

    let fileName = nameComponents.join('_') + '.csv';

    ViewerUtility.download(fileName, csvData, 'text/csv');
  }


  render() {
    if (this.props.home) {
      return null;
    }

    let classesDataElement = null;
    let classesData = this.state.classesData;
    if (!this.state.classesLoading && classesData) {
      if (!classesData.error) {
        classesDataElement = 
          <LineChart
            map={this.props.map}
            data={classesData}
            type={ViewerUtility.dataGraphType.classes}
            maxMask={this.state.maxMask}
          />
      }
      else {
        classesDataElement = (<div>{classesData.message}</div>);
      }
    }

    let measurementsElement = null;
    let measurementData = this.state.measurementsData[this.state.selectedClass];
    if (!this.state.measurementsLoading && measurementData) {
      if (!measurementData.error) {
        measurementsElement = 
          <LineChart
            map={this.props.map}
            data={measurementData}
            type={ViewerUtility.dataGraphType.measurements}
            maxMask={this.state.maxMask}
          /> 
      }
      else {
        measurementsElement = (<div>{measurementData.message}</div>);        
      }
    }    

    return (
      <div>
        <Card className='data-pane-card'>
          <CardContent>
            <div>{'Maximum allowed cloud cover'}: {Math.round(this.state.maxMask * 100)}%</div>
            <Slider
              step={0.01}
              value={this.state.maxMask}
              min={0}
              max={1}
              onChange={this.onMaxMaskChange}
            />
          </CardContent>
        </Card>

        <Card className='data-pane-card'>
          <CardHeader
            title={
              <Typography variant="h6" component="h2" className='no-text-transform'>
                {'Classes'}
              </Typography>
            }
            action={
              <IconButton
                className={this.state.classesExpanded ? 'expand-icon expanded' : 'expand-icon'}
                onClick={() => this.setState({ classesExpanded: !this.state.classesExpanded })}
                aria-expanded={this.state.classesExpanded}
                aria-label='Show'
              >
                <ExpandMoreIcon />
              </IconButton>
            }
          />
          <Collapse in={this.state.classesExpanded}>
            <CardContent className='data-pane-card-content'>
              {this.state.classesLoading ? <CircularProgress className='loading-spinner'/> : null}
              {classesDataElement}
            </CardContent>
            {
              !this.state.classesLoading && classesData && !classesData.error ?
                <CardActions className='analyse-card-actions'>
                  <IconButton
                    onClick={() => this.onDownloadData(false)}
                    aria-label='Download data'
                  >
                    <SaveAlt />
                  </IconButton>
                </CardActions> : null
            }
          </Collapse>
        </Card>
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
              {
                //Render select if needed
                this.state.availableClasses && this.state.availableClasses.length > 1 ?
                  <Select
                    className='class-selector'
                    value={this.state.selectedClass}
                    onChange={this.onSelectClass}
                    disabled={this.state.measurementsLoading}>
                    <MenuItem value={DEFAULT_SELECTED_CLASS} disabled hidden>{'Select a class'}</MenuItem>
                    {this.renderClassOptions()}
                  </Select> : null
              }
              { this.state.measurementsLoading ? <CircularProgress className='loading-spinner'/> : null }
              {measurementsElement}
            </CardContent>
            {
              !this.state.measurementsLoading && this.state.measurementsData[this.state.selectedClass] ?
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
