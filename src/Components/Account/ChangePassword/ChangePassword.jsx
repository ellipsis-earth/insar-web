import React, { PureComponent } from 'react';
import { NavLink, Redirect } from 'react-router-dom';

import ApiManager from '../../../ApiManager';
import ErrorHandler from '../../../ErrorHandler';

class ChangePassword extends PureComponent {
  constructor(props, context) {
    super(props, context);

    this.state = {
      success: false
    };
  }

  changePassword = () => {
    let newPassword = this.refs.newPasswordInput.value;
    let newPasswordRepeat = this.refs.newPasswordRepeatInput.value;

    if (newPassword === '' || newPasswordRepeat === '') {
      return;
    }

    if (newPassword !== newPasswordRepeat) {
      alert('Password and the repeat password do not match.');
      return;
    }

    let body = {
      newPassword: newPassword
    };

    ApiManager.post(`/settings/account/changePassword`, body, this.props.user)
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
      this.changePassword();
    }
  }

  render() {
    if (!this.props.user) {
      return (
        <Redirect to='/login'></Redirect>
      )
    }

    return (
      <div className="login-block">
        <h1 className='account-title'>
          {"ChangePassword"}
        </h1>
        {
          this.state.success ?
          <div className='main-content'>
            <h2>{"Success"}</h2>
            <p>
              {"You can now login with your new password."}
            </p>
            <div>
              <NavLink to='/account/management' style={{fontSize: '12pt'}}>
                {"AccountManagement"}
              </NavLink>
            </div>
          </div>
          :
          <form>
            <div className='login-input-label-div'>
              <div>
                {"New password"}
              </div>
              <div>
                <input className='login-input' type='password' tabIndex={0} ref='newPasswordInput'></input>
              </div>
            </div>

            <div className='login-input-label-div'>
              <div>
                {"Repeat your new password"}
              </div>
              <div>
                <input className='login-input' type='password' tabIndex={0} ref='newPasswordRepeatInput'></input>
              </div>
            </div>

            <div className='login-input-label-div' onClick={this.changePassword.bind(this)} onKeyUp={this.onEnter.bind(this)}>
              <div className="button main-block-single-button" tabIndex={0}>
                {"Change Password"}
              </div>
            </div>
          </form>
        }
      </div>
    );
  }
}

export default ChangePassword;
