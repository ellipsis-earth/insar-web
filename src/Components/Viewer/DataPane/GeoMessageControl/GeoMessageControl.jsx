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

import ElementGeoMessageControl from './ElementGeoMessageControl';
import FeedGeoMessageControl from './FeedGeoMessageControl';

class GeoMessageControl extends PureComponent {
  constructor(props, context) {
    super(props, context);
  }

  componentDidMount() {
  }

  componentDidUpdate(prevProps) {
  }

  render() {
    if (this.props.isFeed) {
      return (
        <FeedGeoMessageControl
          user={this.props.user}
          map={this.props.map}
          timestampRange={this.props.timestampRange}
          geolocation={this.props.geolocation}
          element={this.props.element}
          home={this.props.home}
          onDataPaneAction={this.props.onDataPaneAction}
          onFlyTo={this.props.onFlyTo}
          onLayersChange={this.props.onLayersChange}
          onFeatureClick={this.props.onFeatureClick}
          onDeselect={this.props.onDeselect}
        />
      );
    }
    else {
      return (
        <ElementGeoMessageControl
          user={this.props.user}
          map={this.props.map}
          timestampRange={this.props.timestampRange}
          geolocation={this.props.geolocation}
          element={this.props.element}
          jumpToMessage={this.props.jumpToMessage}
          home={this.props.home}
          onDataPaneAction={this.props.onDataPaneAction}
          onFlyTo={this.props.onFlyTo}
          onLayersChange={this.props.onLayersChange}
          onFeatureClick={this.props.onFeatureClick}
          onDeselect={this.props.onDeselect}
        />
      );
    }
  }
}



export default GeoMessageControl;
