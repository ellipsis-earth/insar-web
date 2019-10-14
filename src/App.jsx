import React, { Component } from 'react';
import {
    Route
} from 'react-router-dom';
import Modal from 'react-modal';
import { withRouter } from 'react-router';

import { createMuiTheme } from '@material-ui/core/styles';
import { ThemeProvider } from '@material-ui/styles';

import ApiManager from './ApiManager';
import ErrorHandler from './ErrorHandler';

import MainMenu from './Components/MainMenu/MainMenu';
import Viewer from './Components/Viewer/Viewer';
import Login from './Components/Login/Login';
import Account from './Components/Account/Account';


import './App.css';

const localStorageUserItem = 'user';

const theme = createMuiTheme({
  palette: {
    primary: {
      main: '#026464'
    },
    secondary: {
      main: '#f5f5f5'
    }
  },
});

class App extends Component {
  topItemRef = null;
  bottomItemRef = null;

  constructor(props, context) {
    super(props, context)
    document.title = 'Ellipsis Earth Intelligence';

    this.topItemRef = React.createRef();
    this.bottomItemRef = React.createRef();

    this.state = {
      init: false,
      user: null,
    };
  }

  componentDidMount() {
    Modal.setAppElement('body');



        return this.retrieveUser();
    
  }

  closeMenu = () => {
    var x = document.getElementById('main-menu');
    x.className = '';
  }

  retrieveUser = async () => {
    let user = null;
    let userJson = localStorage.getItem(localStorageUserItem);

    if (!userJson) {
      this.setState({ init: true });
      return;
    }

    user = JSON.parse(userJson);

    ApiManager.get(`/account/validateLogin`, null, user)
      .then(() => {
        if (user.username) {
          user.username = user.username.toLowerCase();
        }

        this.setState({ user: user, init: true });
      })
      .catch(() => {
        this.setState({ init: true });
        localStorage.removeItem(localStorageUserItem);
      });
  }





  scrollToBottom = () => {
    this.bottomItemRef.current.scrollIntoView({ behavior: 'smooth' });
  }

  onLogin = (user) => {
    localStorage.setItem(localStorageUserItem, JSON.stringify(user));
    this.setState({ user: user }, () => {
      this.props.history.push('/');
    });
  }

  onLogout = () => {
    localStorage.removeItem(localStorageUserItem);
    this.setState({ user: null });
  }

  onLanguageChange = (language) => {
    if (language !== this.state.language) {
      this.setLanguage(language);
    }
  }

  render() {
    if (!this.state.init) {
      return null;
    }

    let contentClassName = 'content';

    return (
      <div className='App' onClick={this.closeMenu}>
        <ThemeProvider theme={theme}>
            {
                <MainMenu
                  user={this.state.user}
                  onLanguageChange={this.onLanguageChange}
                  scrollToBottom={this.scrollToBottom}
                />

            }
            <div className={contentClassName}>
              <div ref={this.topItemRef}></div>
              <Route exact path='/'
                render={() =>
                  <Viewer
                    user = {this.state.user}
                    scrollToBottom={this.scrollToBottom}
                  />
                }
              />
              <Route
                path='/login'
                render={() =>
                  <Login
                    onLogin={this.onLogin}
                  />
                }
              />
              <Route
                path='/account'
                render={() =>
                  <Account
                    user={this.state.user}
                    onLogout={this.onLogout}
                  />
                }
              />
              <div ref={this.bottomItemRef}></div>
            </div>

        </ThemeProvider>
      </div>
    );

  }

}

export default withRouter(App);
