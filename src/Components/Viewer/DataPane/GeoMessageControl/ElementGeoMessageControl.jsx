import React, { PureComponent } from 'react';

import {
  Card,
  CircularProgress,
} from '@material-ui/core';

import ViewerUtility from '../../ViewerUtility';

import './GeoMessageControl.css';
import ApiManager from '../../../../ApiManager';

import GeoMessage from './GeoMessage/GeoMessage';
import GeoMessageForm from './GeoMessageForm/GeoMessageForm';

class ElementGeoMessageControl extends PureComponent {

  geomessagesContainerCard = null;
  targetJumpToMessageDiv = null;
  targetJumpToMessage = null;

  rawGeoMessages = [];

  constructor(props, context) {
    super(props, context);

    this.geomessagesContainerCard = React.createRef();
    this.targetJumpToMessageDiv = React.createRef();
    this.targetJumpToMessage = React.createRef();

    this.state = {
      loading: false,

      rawGeoMessages: [],
    };
  }

  componentDidMount() {
    let newState = {
      loading: true
    };

    this.setState(newState, this.getGeoMessages);
  }

  componentDidUpdate(prevProps) {
    let differentMap = this.props.map !== prevProps.map;
    let differentElement = ViewerUtility.isDifferentElement(prevProps.element, this.props.element);

    let update = false;

    if (!this.props.element && this.state.rawGeoMessages.length > 0) {
      this.setState({ rawGeoMessages: [] });
      return;
    }

    let differentAction = prevProps.isFeed !== this.props.isFeed;

    update = differentMap || differentElement || differentAction;

    if (update) {
      this.setState({ loading: true }, this.getGeoMessages);
    }

    if (!this.props.home) {
      if (this.props.jumpToMessage) {
        let diff = !prevProps.jumpToMessage ||
          this.props.jumpToMessage.id !== prevProps.jumpToMessage.id ||
          this.props.jumpToMessage.key !== prevProps.jumpToMessage.key;

        if (diff) {
          this.jumpToMessage();
        }
      }
      else if (differentElement) {
        this.scrollGeoMessagesToBottom();
      }
    }
  }

  getGeoMessages = () => {

    let cb = () => {
      this.setState({ loading: false }, () => {
        if (this.props.jumpToMessage) {
          this.jumpToMessage();
        }
        else {
          this.scrollGeoMessagesToBottom();
        }
      });
    }

    this.getElementMessages(cb)
      .catch(err => {
        console.error(err);
        this.setState({ loading: false });
      });
  }

  getElementMessages = (cb) => {
    let element = this.props.element;
    let elementProperties = element.feature.properties;

    let body = {
      mapId: this.props.map.id,
      type: element.type,
      filters: {}
    };

    if (element.type === ViewerUtility.standardTileLayerType) {
      body.filters.tileIds = [{
        tileX: elementProperties.tileX,
        tileY: elementProperties.tileY,
        zoom: elementProperties.zoom
      }];
    }
    else if (element.type === ViewerUtility.polygonLayerType) {
      body.filters.polygonIds = [elementProperties.id];
    }
    
    return ApiManager.post('/geoMessage/ids', body, this.props.user)
      .then((result) => {
        if (result.count === 0) {
          return [];
        }

        let geoMessageIds = result.messages.map(x => x.id);

        body.messageIds = geoMessageIds;

        return ApiManager.post(`/geoMessage/get`, body, this.props.user);
      })
      .then((result) => {
        let rawGeoMessages = result.reverse();
        let geoMessageElements = [];

        this.setState({ rawGeoMessages: rawGeoMessages, geoMessageElements: geoMessageElements }, cb);
      });
  }

  createGeomessageElement = (message) => {
    let divRef = null;
    let messageRef = null;

    let jumpToMessage = this.props.jumpToMessage;

    if (jumpToMessage && message.id === jumpToMessage.id) {
      divRef = this.targetJumpToMessageDiv;
      messageRef = this.targetJumpToMessage;
    }

    return (
      <div
        key={message.id}
        ref={divRef}
      >
        <GeoMessage
          ref={messageRef}
          user={this.props.user}
          map={this.props.map}
          message={message}
          type={this.props.element.type}
          isFeed={false}
          target={jumpToMessage ? jumpToMessage.id : null}
          onDataPaneAction={this.props.onDataPaneAction}
          onDeleteMessage={this.onDeleteMessage}
          onFlyTo={this.props.onFlyTo}
        />
      </div>
    );
  }

  onNewMessage = (newMessage) => {
    let newRawGeoMessages = [...this.state.rawGeoMessages, newMessage];

    this.setState({ rawGeoMessages: newRawGeoMessages }, this.scrollGeoMessagesToBottom);
  }

  onDeleteMessage = (deletedMessage) => {
    let newRawGeoMessages = [...this.state.rawGeoMessages.filter(x => x.id !== deletedMessage.id)];

    this.setState({ rawGeoMessages: newRawGeoMessages});
  }

  scrollGeoMessagesToBottom = () => {
    setTimeout(() => {
      let card = this.geomessagesContainerCard.current;
      if (card) {
        card.scrollTop = card.scrollHeight;
      }
    }, 10);
  }

  jumpToMessage = () => {
    let target = this.targetJumpToMessageDiv.current;
    let card = this.geomessagesContainerCard.current;

    if (target && card) {
      let scrollPos = target.offsetTop - (target.clientHeight * 2);
      card.scrollTop = scrollPos;
    }
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

  render() {
    if (this.props.home) {
      return null;
    }

    let className = 'data-pane-card geomessage-messages-card';

    return (
      <div className='geomessage-control'>
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
        <GeoMessageForm
          user={this.props.user}
          map={this.props.map}
          timestampRange={this.props.timestampRange}
          geolocation={this.props.geolocation}
          element={this.props.element}
          onNewMessage={this.onNewMessage}
        />
      </div>
    );
  }
}



export default ElementGeoMessageControl;
