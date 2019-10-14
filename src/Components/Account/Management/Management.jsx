import React, { PureComponent } from 'react';
import { NavLink, Redirect } from 'react-router-dom';

class AccountManagement extends PureComponent {
  constructor(props, context) {
    super(props, context);
  }

  logout = () => {
    this.props.onLogout();
  }

  render() {
    if (!this.props.user) {
      return (
        <Redirect to='/login'></Redirect>
      )
    }

    return (
      <div className="management-block">
        <h1 className='account-title'>
          {'Account Management'}
        </h1>

        <div className='management-input-label-div'>
          <NavLink to='/account/changePassword' className="button-a">
            <div className="button  main-block-single-button">
              {'ChangePassword'}
            </div>
          </NavLink>
        </div>

        <div className='management-input-label-div'>
          <NavLink to='/account/changeEmail' className="button-a">
            <div className="button  main-block-single-button">
              {'Change Email'}
            </div>
          </NavLink>
        </div>

        <div className='management-input-label-div'>
          <NavLink to='/account/mapManagement' className="button-a">
            <div className="button  main-block-single-button">
              {'Map Management'}
            </div>
          </NavLink>
        </div>

        <br/>

        <div className='management-input-label-div'>
          <div className="button-a" onClick={this.logout.bind(this)}>
            <div className="button  main-block-single-button">
              {'Logout'}
            </div>
          </div>
        </div>

      </div>
    );
  }
}

export default AccountManagement;
