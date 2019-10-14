import React, { PureComponent } from 'react';
import { NavLink } from 'react-router-dom';

import ApiManager from '../../../ApiManager';
import ErrorHandler from '../../../ErrorHandler';

class ResetPassword extends PureComponent {
  constructor(props, context) {
    super(props, context);

    this.state = {
      success: false
    };
  }

  resetPassword = () => {
    let email = this.refs.emailInput.value;

    if (email === '') {
      return;
    }

    let body = {
      email: email
    };

    ApiManager.post(`/settings/account/resetPassword`, body, this.props.user)
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
      this.resetPassword();
    }
  }

  render() {
    return (
      <div className="login-block">
        <h1 className='account-title'>
          {"Reset your password"}
        </h1>
        {
          this.state.success ?
          <div className='main-content'>
            <h2>{"Success"}</h2>
            <p>
              {"We have sent an email to the given email address."}
            </p>
            <p>
              {"Please follow the procedure in the email to continue."}
            </p>
            <div>
              <NavLink to='/login' style={{fontSize: '12pt'}}>
                {"Login"}
              </NavLink>
            </div>
          </div>
          :
          <form>
            <div className='login-input-label-div'>
              <div>
                {"Email"}
              </div>
              <div>
                <input className='login-input' type='email' tabIndex={0} ref='emailInput'></input>
              </div>
            </div>
            <div className='login-input-label-div' onClick={this.resetPassword.bind(this)} onKeyUp={this.onEnter.bind(this)}>
              <div className="button main-block-single-button" tabIndex={0}>
                {"Reset Password"}
              </div>
            </div>
          </form>
        }

      </div>
    );
  }
}

export default ResetPassword;
