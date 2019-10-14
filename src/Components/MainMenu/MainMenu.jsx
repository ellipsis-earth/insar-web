import React, { Component } from 'react';
import {
  Button,
} from '@material-ui/core';
import { ToggleButton } from '@material-ui/lab';
import { NavLink } from 'react-router-dom';

import { Navbar, Nav, NavItem } from 'react-bootstrap';

import './MainMenu.css';

const navKeys = {
  login: 'login'
}

export class MainMenu extends Component {
  constructor(props, context) {
    super(props, context)
    this.state = {
      expanded: false,
      hidden: false,
      navKey: 'home'
    };
  }

  componentDidMount = () => {
    this.checkUrl();
  }

  componentDidUpdate = () => {
    this.checkUrl();
  }

  checkUrl = () => {
    let url = window.location.href;

    try {
      for (let key in navKeys) {
        if (Object.prototype.hasOwnProperty.call(navKeys, key)) {
          let navKey = navKeys[key];

          if (url.includes(`/${navKey}`)) {
            if (this.state.navKey !== navKey) {
              this.setState({ navKey: navKey });
            }
            break;
          }
        }
      }
    }
    catch (err) {
      console.log(`Could not identify navkey from url: ${url}`);
      console.error(err);
    }
  }

  toggleMenu = (event) => {
    var x = document.getElementById('main-menu');
    if (x.className === '') {
      x.className = 'responsive';
    }
    else {
      x.className = '';
    }

    event.stopPropagation();
  }

  changeLanguage = (language) => {
    if (this.props.onLanguageChange) {
      this.props.onLanguageChange(language);
    }
  }

  onToggle = (expanded) => {
    this.setState({ expanded: expanded })
  }

  onNavItemClick = (key) => {
    this.setState({ navKey: key });
    this.onToggle(false);
  }

  render() {
    let displayStyle = {
        display: 'block'
    };

    if (this.state.hidden) {
        displayStyle.display = 'hidden';
    }

    let navItemClass = (navKey) => {
      // return navKey === this.state.navKey ? 'nav-item-active' : '';
      return navKey === this.state.navKey;
    }

    return (
      <div id='main-menu' style={displayStyle}>
        <Navbar
          className={this.state.expanded ? 'main-menu' : 'main-menu main-menu-collapsed'}
          variant='dark'
          expand='md'
          expanded={this.state.expanded}
          onToggle={this.onToggle}
        >
          <Navbar.Brand>
            <NavLink exact to='/' className='main-menu-logo-item noselect' onClick={() => this.onNavItemClick('home')}>
              <img className='main-menu-logo' src='/images/logos/logo_v2_white_sat.svg' alt='Ellipsis Earth Intelligence'/>
            </NavLink>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls='basic-navbar-nav' style={{ height: '45px' }} />
          <Navbar.Collapse id='basic-navbar-nav'>
            <Nav className='mr-auto'>
              <NavItem>
                <NavLink to={this.props.user ? '/account': '/login'} onClick={() => this.onNavItemClick(navKeys.login)}>
                  <ToggleButton selected={navItemClass(navKeys.login)} value={this.props.user ? this.props.user.username : 'Login'}>
                    {this.props.user ? this.props.user.username : 'Login'}
                  </ToggleButton>
                </NavLink>
              </NavItem>
            </Nav>
          </Navbar.Collapse>
        </Navbar>
      </div>
    )
  }
}

export default MainMenu;
