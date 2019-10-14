import React, { PureComponent} from 'react';
import Moment from 'moment';
import { Slider } from '@material-ui/core';

import './TimestampSelector.css';

export class TimestampSelector extends PureComponent {
  constructor(props, context) {
    super(props, context)

    this.state = {
      range: false,
      start: 0,
      end: 0,
      dates: [0]
    };
  }

  componentDidUpdate(prevProps) {
    if (this.props.map !== prevProps.map && this.props.map) {
      let lastTimestamp = this.props.map.timestamps.length - 1;
      let timestamps = this.props.map.timestamps;
      let dateFormat = 'YYYY-MM-DD';

      let dates = [];
      for (let i = 0; i < timestamps.length; i++) {
        dates[i] = Moment(timestamps[i].dateTo).format(dateFormat);
      }

      this.setState({
        start: lastTimestamp,
        end: lastTimestamp,
        dates: dates
      });
    }
  }

  onSlide = (e, value) => {
    let timestampRange = {};

    if (!this.state.range) {
      let newIndex = value[0];
      if (this.state.end < value[1]) {
        newIndex = value[1];
      }

      timestampRange = {
        start: newIndex,
        end: newIndex
      };
    }
    else {
      timestampRange = {
        start: value[0],
        end: value[1]
      };
    }

    this.setState({ start: timestampRange.start, end: timestampRange.end });
    this.props.onSelectTimestamp(timestampRange);
  }

  onRangeToggleChange = (e) => {
    let timestampRange = {
      start: this.state.end,
      end: this.state.end
    };

    this.setState({
      start: timestampRange.end,
      end: timestampRange.end,
      range: e.target.checked
    });

    this.props.onSelectTimestamp(timestampRange);
  }

  render() {
    if (!this.props.map) {
      return null;
    }

    let sliderValue = null;
    if (!this.state.range) {
      sliderValue = [this.state.end, this.state.end];
    }
    else {
      sliderValue = [this.state.start, this.state.end]
    }

    let dateText = null;
    if (this.props.map) {
      if (!this.state.range) {
        dateText = this.state.dates[this.state.end];
      }
      else {
        dateText = this.state.dates[this.state.start] + ' - ' + this.state.dates[this.state.end];
      }
    }

    return (
      <div className='timestamp-selector'>
        <div>
          {'Timestamps'} (
          <input type='checkbox' id='timestamp-range' onChange={this.onRangeToggleChange} checked={this.state.range}/>
          {'Range'});
        </div>
        <Slider
          value={sliderValue}
          onChange={this.onSlide}
          marks
          step={1}
          min={0}
          max={this.props.map.timestamps.length - 1}
        />
        <div>{dateText}</div>
      </div>
    );
  }
}

export default TimestampSelector;
