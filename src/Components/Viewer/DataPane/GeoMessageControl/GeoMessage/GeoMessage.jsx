import React, { PureComponent } from 'react';
import Moment from 'moment';

import {
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Typography,
  CircularProgress,
  Button,
  Select,
  MenuItem,
  Collapse,
  IconButton,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import DeleteIcon from '@material-ui/icons/Delete';
import ClearIcon from '@material-ui/icons/ClearOutlined';
import AssignmentIcon from '@material-ui/icons/Assignment';

import Utility from '../../../../../Utility';
import ViewerUtility from '../../../ViewerUtility';

import './GeoMessage.css';
import ApiManager from '../../../../../ApiManager';

class GeoMessage extends PureComponent {

  constructor(props, context) {
    super(props, context);

    this.state = {
      showImage: false,
      showForm: false,

      loadingImage: false,
      fullImage: null,

      fullImageAsThumbnail: false
    };
  }

  componentDidMount() {
    if (this.props.message.fullImage && !this.state.fullImageAsThumbnail) {
      this.setState({ fullImage: this.props.message.fullImage, fullImageAsThumbnail: true });
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.message !== this.props.message) {
      if (this.props.message.fullImage && !this.state.fullImageAsThumbnail) {
        this.setState({ fullImage: this.props.message.fullImage, fullImageAsThumbnail: true });
      }
      else {
        this.setState({ fullImage: null, fullImageAsThumbnail: false });
      }
    }
  }

  renderFormAnswers = () => {

    let message = this.props.message;

    if (!message.form || message.form.length === 0 || !message.form.answers) {
      return null;
    }

    let answers = [
      <h4 key='form-name'>{message.form.formName}</h4>
    ];

    for (let i = 0; i < message.form.answers.length; i++) {
      let answerObject = message.form.answers[i];
      let answer = answerObject.answer;
      let question = answerObject.question;

      if (answer === undefined || answer === null) {
        answer = '';
      }

      let answerElement = (
        <div key={question}>
          {`${question}: ${answer}`}
        </div>
      );

      answers.push(answerElement);
    }

    return answers;
  }

  showImage = () => {
    if (this.state.loadingImage) {
      return;
    }

    if (!this.state.fullImage) {
      this.setState({ loadingImage: true}, () => {
        this.getImageData()
          .then(fullImageBlob => {
            let reader = new FileReader();
            reader.readAsDataURL(fullImageBlob);
            reader.onloadend = () => {
                let fullImage = reader.result;
                this.setState({
                  showImage: true,
                  loadingImage: false,
                  fullImage: fullImage
                });
            };
          })
          .catch(err => {
            this.setState({ loadingImage: false });
          });
      });
    }
    else {
      this.setState({ showImage: !this.state.showImage });
    }
  }

  showForm = () => {
    this.setState({ showForm: !this.state.showForm });
  }

  getImageData = () => {
    let body = {
      mapId: this.props.map.id,
      geoMessageId: this.props.message.id,
      type: this.props.type
    };

    return ApiManager.post('/geoMessage/image', body, this.props.user);
  }

  onDeleteMessage = () => {
    if (!window.confirm('Are you sure you want to delete this message?')) {
      return;
    }

    let body = {
      mapId: this.props.map.id,
      messageId: this.props.message.id,
      type: this.props.type
    };

    ApiManager.post(`/geomessage/delete`, body, this.props.user)
      .then(() => {
        this.props.onDeleteMessage(this.props.message);
      });
  }

  onFlyTo = (jumpToMessage) => {
    this.props.onFlyTo({
      type: this.props.type,
      elementId: this.props.message.elementId,
      delay: jumpToMessage ? false : true
    });
  }

  onGoToReplyToMessage = (jumpToMessage) => {
    this.props.onDataPaneAction(ViewerUtility.dataPaneAction.geoMessage, jumpToMessage);
  }

  render() {
    let message = this.props.message;

    let user = this.props.user;

    let isOwnCard = user && message.user.toLowerCase() === user.username.toLowerCase();
    let mayDelete = !message.noDelete && (isOwnCard || this.props.map.accessLevel >= ApiManager.accessLevels.deleteGeomessages);

    let cardClass = 'geomessage-card';
    if (isOwnCard) {
      cardClass += ' geomessage-card-own';
    }
    if (message.isPrivate) {
      cardClass += ' geomessage-card-private';
    }
    if (this.props.target === message.id) {
      cardClass += ' geomessage-card-target';
    }

    let imageAttachment = null;
    let formAttachment = null;

    if (message.thumbnail) {
      imageAttachment = (
        <Button
          className='geomessage-attachment-button geomessage-attachment-image-button'
          variant='outlined'
          disableRipple={true}
          onClick={this.showImage}
        >
          <img src={message.thumbnail}/>
          {this.state.loadingImage ? <CircularProgress className='loading-spinner'/> : null}
        </Button>
      )
    }

    if (message.form) {
      formAttachment = (
        <Button
          className='geomessage-attachment-button geomessage-attachment-form-button'
          variant='outlined'
          onClick={this.showForm}
        >
          <AssignmentIcon className='geomessage-open-form-button-icon'/>
        </Button>
      )
    }

    let subheaderElementButton = null;

    if (this.props.isFeed) {
      let elementIdText = null;
      let type = this.props.type;

      if (type === ViewerUtility.standardTileLayerType) {
        elementIdText = `standard tile: ${message.elementId.tileX}, ${message.elementId.tileY}, ${message.elementId.zoom}`;
      }
      else if (type === ViewerUtility.polygonLayerType) {
        elementIdText = `polygon: ${message.elementId}`;
      }

      subheaderElementButton = (
        <Button
          className='geomessage-feed-element-button'
          onClick={this.onFlyTo}
        >
          {elementIdText}
        </Button>
      );
    }

    let replyToElement = null;
    if (message.replyTo) {
      replyToElement = (
        <Button
          className='geomessage-feed-element-button'
          onClick={() => {
            if (this.props.isFeed) {
              this.onFlyTo({ id: message.replyTo, key: Math.random() });
            }
            else {
              this.onGoToReplyToMessage({ id: message.replyTo, key: Math.random() });
            }
          }}
        >
          In reply to another message
        </Button>
      )
    }

    return (
      <div>
        <Card className={cardClass}>
          <CardHeader
            className='geomessage-card-header'
            title={
              <div className='geomessage-card-title'>
                {message.user}
              </div>
            }
            subheader={
              <div className='geomessage-card-subtitle'>
                {subheaderElementButton}
                <div>
                  {Moment(message.date).format('YYYY-MM-DD hh:mm:ss')}
                </div>
                {replyToElement}
              </div>
            }
            action={
              mayDelete ?
                <CardActions className='geomessage-card-actions'>
                  <IconButton
                    className='geomessage-card-action-button'
                    aria-label='Delete'
                    onClick={this.onDeleteMessage}
                  >
                    <DeleteIcon className='geomessage-delete-button'/>
                  </IconButton>
                </CardActions> : null
            }
          />
          <CardContent className='geomessage-card-content'>
            <div>
              {message.message}
            </div>
            {
              imageAttachment || formAttachment ?
                <div className='geomessage-attachments'>
                  {imageAttachment}
                  {formAttachment}
                </div> : null
            }

          </CardContent>
        </Card>
         {
          this.state.fullImage && this.state.showImage ?
            <div className='geomessage-lightbox' onClick={this.showImage}>
              <div className='geomessage-lightbox-close-button'>
                <IconButton
                  onClick={this.showImage}
                  color='secondary'
                  aria-label='Close'
                >
                  <ClearIcon />
                </IconButton>
              </div>
              <img className='geomessage-lightbox-image' src={this.state.fullImage}></img>
            </div> : null
          }
          {
            this.state.showForm ?
              <div className='geomessage-lightbox' onClick={this.showForm}>
                <div className='geomessage-lightbox-close-button'>
                  <IconButton
                    onClick={this.showForm}
                    color='secondary'
                    aria-label='Close'
                  >
                    <ClearIcon />
                  </IconButton>
                </div>
                <div className='geomessage-lightbox-text'>
                  {this.renderFormAnswers()}
                </div>
              </div> : null
          }
      </div>
    )
  }
}

export default GeoMessage;
