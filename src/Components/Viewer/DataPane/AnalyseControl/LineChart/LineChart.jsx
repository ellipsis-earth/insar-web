import React, { PureComponent} from 'react';
import Moment from 'moment';

import {
  FlexibleXYPlot,
  XAxis,
  YAxis,
  LineMarkSeries,
  DiscreteColorLegend,
  Crosshair,
  Highlight
} from 'react-vis';

import './react-vis-style.css';
import './LineChart.css';
import ViewerUtility from '../../../ViewerUtility';

const NO_DATA_RESULT = 'no data\n';
const DATE_COLUMN_NAME = 'date_to';

const CLOUD_COVER_COLUMN_INFO = {
  name: 'cloud_cover',
  color: 'bababaff'
};

export class LineChart extends PureComponent {
  constructor(props, context) {
    super(props, context);

    this.state = {
      data: null
    }
  };

  componentWillMount = () => {
    let graphElements = this.prepareGraph();
    this.setState({ graphElements: graphElements });
  }

  componentDidUpdate(prevProps) {
    if (this.props.data !== prevProps.data || this.props.type !== prevProps.type) {
      let graphElements = this.prepareGraph();
      this.setState({ graphElements: graphElements });
    }
  }

  prepareGraph = () => {
    let data = this.props.data;
    let referenceData = this.props.referenceData;
    let type = this.props.type;

    if (!data || !type) {
      return null;
    }

    let isMeasurements = type === ViewerUtility.dataGraphType.measurements;
    let parsedData = data.parsed;
    let parsedReferenceData = referenceData ? referenceData.parsed : null;

    if (data.raw === NO_DATA_RESULT || !parsedData || parsedData.data.length === 0) {
      return (
        <div>
          No data
        </div>
      );
    }

    let columnInfo = null;

    if (type === ViewerUtility.dataGraphType.measurements) {
      columnInfo = getUniqueLabels(this.props.map.measurements, 'measurements');
    }
    else {
      return null;
    }

    let adjustedColumnInfo = [];
    for (let i = 0; i < columnInfo.length; i++) {

      let color = columnInfo[i].color;

      if (color === 'ffffffff') {
        color = 'bababaff';
      }

      adjustedColumnInfo.push({
        name: columnInfo[i].name,
        color: color
      });
    }

    let filteredColumnNames = parsedData.meta.fields.filter(x => adjustedColumnInfo.find(y => y.name === x));

    let series = [];
    let seriesData = [];

    for (let i = 0; i < filteredColumnNames.length; i++ ) {

      let columnName = filteredColumnNames[i];

      let singleSeriesData = [];

      for (let x = 0; x < parsedData.data.length; x++) {
        let row = parsedData.data[x];
        let referenceRow = parsedReferenceData ? parsedReferenceData.data[x] : null;

        let value = row[columnName];

        let date = Moment(row[DATE_COLUMN_NAME]).unix() * 1000;

        if (columnName === 'displacement') {
          let referenceValue = referenceRow ? referenceRow[columnName] : 0;
          value -= referenceValue;
        }

        singleSeriesData.push({
          x: date,
          y: value
        });
      }

      let color = `#${adjustedColumnInfo.find(y => y.name === columnName).color}`;

      seriesData.push({
        column: columnName,
        color: color,
        data: singleSeriesData
      });
    }

    for (let i = 0; i < seriesData.length; i++) {
      let singleSeriesData = seriesData[i];

      series.push(
        <LineMarkSeries
          key={singleSeriesData.column}
          name={singleSeriesData.column}
          curve={'curveMonotoneX'}
          data={singleSeriesData.data}
          color={singleSeriesData.color}
          size={3}
        />
      );
    }

    let axisStyle = {
      line: {stroke: '#808080'},
      ticks: {stroke: '#808080'},
      text: {stroke: 'none', fill: '#545454', fontWeight: 200, fontSize: '10px'},
    };

    let xAxis = (
      <XAxis
        key={'x_axis'}
        attr='x'
        attrAxis='y'
        orientation='bottom'
        tickFormat={function tickFormat(d){return Moment(d).format('YY-MM-DD')}}
        tickLabelAngle={-35}
        style={axisStyle}
        left={50}
        tickSizeOuter={3}
        tickTotal={8}
      />
    );

    let yAxis = (
      <YAxis
        key={'y_axis' + this.props.type + this.props.filter}
        attr="y"
        attrAxis="x"
        orientation="left"
        style={axisStyle}
        left={10}
        tickSizeOuter={3}
      />
    );

    let legendItems = [];
    for (let i = 0; i < adjustedColumnInfo.length; i++) {
      legendItems.push({
        title: adjustedColumnInfo[i].name,
        color: `#${adjustedColumnInfo[i].color}`
      });
    }

    let legend = (
      <DiscreteColorLegend
        key={'legend'}
        orientation='horizontal'
        items={legendItems}
      />
    );

    return [xAxis, yAxis, series, legend];
  }

  render() {
    if (!this.state.graphElements) {
      return null;
    }

    let chartDrawArea = this.state.chartDrawArea;

    return (
      <FlexibleXYPlot
        key={'plot'}
        height={200}
        xDomain={
          chartDrawArea && [
            chartDrawArea.left,
            chartDrawArea.right
          ]
        }
        yDomain={
          chartDrawArea && [
            chartDrawArea.bottom,
            chartDrawArea.top
          ]
        }
      >
        {this.state.graphElements}

        <Highlight
          onBrushEnd={ area => this.setState({ chartDrawArea: area }) }
        />
      </FlexibleXYPlot>
    );
  }
}

function getUniqueLabels(timestampLabels, property) {
  let uniqueLabels = [];

  for (let i = 0; i < timestampLabels.length; i++) {
    let timestamp = timestampLabels[i];

    for (let x = 0; x < timestamp[property].length; x++) {
      let label = timestamp[property][x];

      let uniqueLabel = uniqueLabels.find(y => y.name === label.name);

      if (!uniqueLabel) {
        uniqueLabels.push(label);
      }
    }
  }

  return uniqueLabels;
}

export default LineChart;
