import React, { PureComponent } from 'react';
import Moment from 'moment';
import { readAndCompressImage } from 'browser-image-resizer';

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
  TextField,
  Checkbox
} from '@material-ui/core';
import ClearIcon from '@material-ui/icons/Clear';
import DeleteIcon from '@material-ui/icons/Delete';

import Utility from '../../../../../Utility';
import ViewerUtility from '../../../ViewerUtility';
import DataPaneUtility from '../../DataPaneUtility';

import './GeoMessageForm.css';
import ApiManager from '../../../../../ApiManager';

const IMAGE_MIME_TYPES = ['image/gif', 'image/jpeg', 'image/png'];
const MAX_IMAGE_DIMENSIONS = {
  width: 1920,
  height: 1080
};
const MAX_IMAGE_SIZE = 10000000;

class GeoMessageForm extends PureComponent {

  uploadedImage = null;

  fileUploadRef = null;

  constructor(props, context) {
    super(props, context);

    // this.messageInputRef = React.createRef();
    this.fileUploadRef = React.createRef();

    this.state = {
      expanded: false,
      loading: false,

      hasPermissions: false,
      messageText: '',
      private: false,

      selectedFormName: 'default',

      formAnswers: []
    };
  }

  componentDidMount() {
  }

  componentDidUpdate(prevProps) {
  }

  renderFormSection = () => {
    let mapForms = this.props.map.forms;

    if (!mapForms || mapForms.length === 0) {
      return null;
    }

    let formOptions = [
    ];

    for (let i = 0; i < mapForms.length; i++) {
      let formName = mapForms[i].formName;

      formOptions.push(
        <MenuItem key={formName} value={formName}>
          {formName}
        </MenuItem>
      );
    }

    let formSelect = (
      <Select key='form-selector' className='selector' onChange={this.onSelectForm} value={this.state.selectedFormName}>
        <MenuItem key='default' value='default'>{'(Optional) Select a form'}</MenuItem>
        {formOptions}
      </Select>
    )

    let formQuestions = [];
    let selectedForm = mapForms.find(x => x.formName === this.state.selectedFormName);

    if (selectedForm) {
      let questions = selectedForm.form.questions;

      for (let i = 0; i < questions.length; i++) {
        let question = questions[i];

        let questionElement = null;

        if (question.type === ViewerUtility.geomessageFormType.text) {
          questionElement = (
            <TextField
              className='data-pane-text-field geomessage-form-question geomessage-text-input-form'
              label={question.question}
              multiline
              value={this.state.formAnswers[i]}
              required={question.obligatory === 'yes'}
              onChange={(e) => this.onFormAnswer(e, i, false)}
            />
          );
        }
        else if (question.type === ViewerUtility.geomessageFormType.numeric) {
          questionElement = (
            <TextField
              className='data-pane-text-field geomessage-form-question geomessage-text-input-form'
              label={question.question}
              type='number'
              value={this.state.formAnswers[i]}
              required={question.obligatory === 'yes'}
              onChange={(e) => this.onFormAnswer(e, i, false)}
            />
          )
        }
        else if (question.type === ViewerUtility.geomessageFormType.boolean) {
          questionElement = (
            <div className='geomessage-form-question geomessage-checkbox-question'>
              {question.question}
              {question.obligatory === 'yes' ? '*' : null}
              <Checkbox
                name={question.question}
                color='primary'
                checked={this.state.formAnswers[i]}
                onChange={(e) => this.onFormAnswer(e, i, true)}
              />
            </div>

          )
        }

        formQuestions.push(questionElement);
      }
    }

    return [formSelect, formQuestions];
  }

  toggleExpand = () => {
    this.setState({ expanded: !this.state.expanded });
  }

  onMessageChange = (e) => {
    this.setState({ messageText: e.target.value });
  }

  onPrivateMessageChange = (e) => {
    this.setState({ private: e.target.checked });
  }

  onImageChange = (e) => {
    e.preventDefault();

    let file = e.target.files[0];

    if (!IMAGE_MIME_TYPES.includes(file.type)) {
      alert('Invalid image type.');
      return;
    }

    this.setState({ loading: true }, () => {
      const imgConfig = {
        quality: 0.8,
        maxWidth: MAX_IMAGE_DIMENSIONS.width,
        maxHeight: MAX_IMAGE_DIMENSIONS.height,
        autoRotate: true
      };

      readAndCompressImage(file, imgConfig)
        .then(image => {

          if (image.size > MAX_IMAGE_SIZE) {
            alert(`Image too large (max ${(MAX_IMAGE_SIZE / 1000).toFixed(2)} MB).`);
            this.setState({ loading: false });
            return;
          }

          return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = function() {
              resolve(reader.result);
            };
            reader.readAsDataURL(image);
          });
        })
        .then(base64 => {
          this.uploadedImage = base64;
          this.setState({ loading: false });
        })
        .catch(err => {
          this.setState({ loading: false });
          alert('Invalid image type.');
        });
    });
  }

  onGeoMessageSubmit = () => {
    let selectedForm = null;

    if (this.state.selectedFormName) {
      selectedForm = this.props.map.forms.find(x => x.formName === this.state.selectedFormName);

      if (selectedForm) {
        for (let i = 0; i < selectedForm.form.questions.length; i++) {
          let question = selectedForm.form.questions[i];
          let answer = this.state.formAnswers[i];

          if (question.obligatory === 'yes' && (answer === undefined || answer === null || answer === '')) {
            alert('Not all mandatory fields are filled.');
            return;
          }
        }
      }
    }

    this.setState({ loading: true }, () => {
      let timestamp = this.props.map.timestamps[this.props.timestampRange.end];
      let element = this.props.element;
      let elementProperties = element.feature.properties;

      let body = {
        mapId: this.props.map.id,
        type: element.type,
        timestamp: timestamp.timestampNumber,
        message: this.state.messageText,
        image: this.uploadedImage,
        private: this.state.private
      };

      if (element.type === ViewerUtility.standardTileLayerType) {
        body.elementId = {
          tileX: elementProperties.tileX,
          tileY: elementProperties.tileY,
          zoom: elementProperties.zoom
        };
      }
      else if (element.type === ViewerUtility.polygonLayerType) {
        body.elementId = elementProperties.id;
      }

      let geolocation = this.props.geolocation;
      if (geolocation) {
        body.location = { x: geolocation[1], y: geolocation[0] };
      }

      if (selectedForm) {
        let formAnswers = [];

        for (let i = 0; i < selectedForm.form.questions.length; i++) {
          let question = selectedForm.form.questions[i];

          let answer = this.state.formAnswers[i];

          let formAnswer = {
            type: question.type,
            question: question.question,
            answer: answer === undefined ? null : answer
          };

          formAnswers.push(formAnswer);
        }

        body.form = {
          formName: selectedForm.formName,
          answers: formAnswers
        };
      }

      ApiManager.post(`/geomessage//add`, body, this.props.user)
        .then(result => {
          let newMessage = {
            id: result.id,
            user: this.props.user.username,
            message: this.state.messageText,
            thumbnail: this.uploadedImage,
            fullImage: this.uploadedImage,
            date: Moment().format(),
            form: body.form,
            isPrivate: this.state.private
          };

          this.props.onNewMessage(newMessage);

          this.fileUploadRef.current.value = '';
          this.uploadedImage = null;
          let formAnswers = this.createEmptyFormAnswers(selectedForm);
          this.setState({
            expanded: false,
            loading: false,
            messageText: '',
            private: false,
            formAnswers: formAnswers
          });
        })
        .catch(err => {
          alert('An error occurred while adding a GeoMessage.');
          this.fileUploadRef.current.value = '';
          this.setState({ loading: false });
        });
    });
  }

  createEmptyFormAnswers = (selectedForm) => {
    if (!selectedForm) {
      return [];
    }

    let formAnswers = [];

    for (let i = 0; i < selectedForm.form.questions.length; i++) {
      if (selectedForm.form.questions[i].type === ViewerUtility.geomessageFormType.boolean) {
        formAnswers[i] = false;
      }
      else {
        formAnswers[i] = '';
      }
    }

    return formAnswers;
  }

  onSelectForm = (e) => {
    let selectedFormName = e.target.value;
    let selectedForm = this.props.map.forms.find(x => x.formName === selectedFormName);

    if (!selectedForm) {
      if (selectedFormName === 'default') {
        this.setState({ selectedFormName: selectedFormName });
      }
      return;
    }

    let formAnswers = this.createEmptyFormAnswers(selectedForm);

    this.setState({ selectedFormName: selectedFormName, formAnswers: formAnswers });
  }

  onFormAnswer = (e, answerIndex, isCheckbox) => {
    let newAnswers = [...this.state.formAnswers];

    if (!isCheckbox) {
      newAnswers[answerIndex] = e.target.value;
    }
    else {
      newAnswers[answerIndex] = e.target.checked;
    }

    this.setState({ formAnswers: newAnswers });
  }

  render() {

    let user = this.props.user;
    let map = this.props.map;

    let hasAddPermission = user && map.accessLevel >= ApiManager.accessLevels.addGeoMessages;
    let hasAddImagePermission = user && map.accessLevel >= ApiManager.accessLevels.addGeoMessageImage;
    let hasPrivateMessagePermission = user && map.accessLevel >= ApiManager.accessLevels.addPrivateGeoMessage;

    let title = 'Add GeoMessage';
    if (!user) {
      title = 'Please login';
    }
    else if (!hasAddPermission) {
      title = 'Insufficient access';
    }

    let cardClassName = 'data-pane-card geomessage-form-card';
    if (this.state.expanded) {
      cardClassName += ' geomessage-form-card-expanded';
    }

    return (
      <Card className={cardClassName}>
        <CardHeader
          className='geomessage-form-card-header'
          title={
            !this.state.expanded ?
              <Button
                className='geomessage-add-expand-button'
                variant='contained'
                color='primary'
                onClick={this.toggleExpand}
                disabled={!hasAddPermission}
              >
                {title}
              </Button> :
              <div className='geomessage-expanded-title'>
                {'Add GeoMessage'}
              </div>
          }
          action={
            this.state.expanded ?
              <IconButton
                className={this.state.expanded ? 'expand-icon' : 'expand-icon expanded'}
                onClick={this.toggleExpand}
                aria-expanded={this.state.expaneded}
                aria-label='Expand'
              >
                <ClearIcon />
              </IconButton> : null
          }
        />
        <Collapse in={this.state.expanded}>
          <CardContent className='data-pane-card-content'>
            <TextField
              className='data-pane-text-field'
              label={'GeoMessage'}
              multiline
              value={this.state.messageText}
              onChange={this.onMessageChange}
            />
            <div className='card-content-item geomessage-form-card-item'>
            {
              hasAddImagePermission ?
                <div>
                  <div className='geomessage-upload-image-label'>
                    {'Upload image'}
                  </div>
                  <input
                    ref={this.fileUploadRef}
                    type='file'
                    accept='image/*'
                    onChange={this.onImageChange}
                  />
                </div> : null
            }
            {
              hasPrivateMessagePermission ?
                <div>
                  {'Private'}:
                  <Checkbox
                    color='primary'
                    checked={this.state.private}
                    onChange={this.onPrivateMessageChange}
                  />
                </div> : null
            }
            </div>
            <div className='geomessage-form-section'>
              {this.renderFormSection()}
            </div>
            <div className='geomessage-form-section'>
              <Button
                className='card-content-item geomessage-form-card-item card-submit-button'
                variant='contained'
                color='primary'
                onClick={this.onGeoMessageSubmit}
                disabled={this.state.loading}
              >
                {'Submit'}
              </Button>
            </div>
            { this.state.loading ? <CircularProgress className='loading-spinner'/> : null}
          </CardContent>
        </Collapse>
      </Card>
    )
  }
}

export default GeoMessageForm;
