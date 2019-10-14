import React, { PureComponent } from 'react';
import { NavLink, Redirect } from 'react-router-dom';

import ApiManager from '../../../ApiManager';
import ErrorHandler from '../../../ErrorHandler';

class ChangeEmail extends PureComponent {
  constructor(props, context) {
    super(props, context);

    this.state = {
      success: false
    };
  }

  changeEmail = () => {
    let newEmail = this.refs.newEmailInput.value;

    if (newEmail === '') {
      return;
    }

    let body = {
      newEmail: newEmail
    };

    ApiManager.post(`/settings/account/changeEmail`, body, this.props.user)
      .then(() => {
        this.setState({ success: true });
      })
      .catch(err => {
        ErrorHandler.alert(err);
      });
  }

  onEnter = (event) => {
    if (event.keyCode === 13) {
      event.preventDefault();
      this.changeEmail();
    }
  }

  render() {
    if (!this.props.user) {
      return (
        <Redirect to='/login'></Redirect>
      )
    }

    return (
      <div className='login-block'>
        <h1 className='account-title'>
          {'Change Email'}
        </h1>
        {
          this.state.success ?
          <div className='main-content'>
            <h2>{"Success"}</h2>
            <p>
              {"We have sent you an email to validate your email address. Please follow the procedures in the mail."}
            </p>
            <div>
              <NavLink to='/account/management' style={{fontSize: '12pt'}}>
                {'Account Management'}
              </NavLink>
            </div>
          </div>
          :
          <form>
            <div className='login-input-label-div'>
              <div>
                {'New Email'}
              </div>
              <div>
                <input className='login-input' type='email' tabIndex={0} ref='newEmailInput'></input>
              </div>
            </div>

            <div className='login-input-label-div' onClick={this.changeEmail.bind(this)} onKeyUp={this.onEnter.bind(this)}>
              <div className='button main-block-single-button' tabIndex={0}>
                {'Change Email'}
              </div>
            </div>
          </form>
        }
      </div>
    );
  }
}

export default ChangeEmail;
