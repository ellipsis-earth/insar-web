import React, { PureComponent } from 'react';

import ReactTable from 'react-table';
import 'react-table/react-table.css';
import cloneDeep from 'lodash.clonedeep';

import ApiManager from '../../../../ApiManager';

import './AccessManagement.css';

class AccessManagement extends PureComponent {

  publicAccessLevelInput = null
  maxCreditsMinInput = null
  maxPublicCreditsMinInput = null

  constructor(props, context) {
    super(props, context);

    this.publicAccessLevelInput = React.createRef();
    this.maxCreditsMinInput = React.createRef();
    this.maxPublicCreditsMinInput = React.createRef();

    this.state = {
      mapAccess: null,
      groupsData: null
    };
  }

  componentDidMount() {
    this.update();
  }

  update = () => {
    if (!this.props.user) {
      return;
    }

    this.getMapAccess();
  }

  componentWillUnmount() {
    this.setState({ mapAccess: null, groupsData: null });
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (prevProps.map !== this.props.map) {
      this.setState({
        mapAccess: null,
        groupsData: null
      },
      () => { this.update(); }
      );
    }
  }

  getMapAccess = (e) => {
    ApiManager.fetch('POST', '/settings/mapAccess', { mapId: this.props.map.id }, this.props.user)
      .then(result => {
        for (let i = 1; i < result.groups.length + 1; i++) {
          result.groups[i - 1].id = i;
        }

        let groupsData = cloneDeep(result.groups);

        if (this.props.map.accessLevel >= 1000) {
          groupsData.unshift({
            id: 0,
            name: 'new group',
            accessLevel: 500
          });
        }

        this.setState({ mapAccess: result, groupsData: groupsData });
      })
      .catch(err => {
        this.props.showError(err);
      });
  }

  updateMap = (newPublicAccessLevel, newMaxCreditsMin, newMaxPublicCreditsMin) => {
    let newPublicAccessLevelDefined = (newPublicAccessLevel || newPublicAccessLevel === 0) &&
      newPublicAccessLevel !== this.state.mapAccess.publicAccessLevel;
    let newMaxCreditsMinDefined = (newMaxCreditsMin || newMaxCreditsMin === 0) &&
      newMaxCreditsMin !== this.state.mapAccess.newMaxCreditsMin;
    let newMaxPublicCreditsMinDefined = (newMaxPublicCreditsMin || newMaxPublicCreditsMin === 0) &&
      newMaxPublicCreditsMin !== this.state.mapAccess.maxPublicCreditsMin;

    if (!newPublicAccessLevelDefined && !newMaxCreditsMinDefined && !newMaxPublicCreditsMinDefined) {
      return;
    }

    if (newPublicAccessLevelDefined && (!checkValidAccessLevel(newPublicAccessLevel) || newPublicAccessLevel > 500)) {
      alert('Public access level for a map must be a whole number between 0 and 500');
      this.publicAccessLevelInput.current.value = this.state.mapAccess.publicAccessLevel;
      return;
    }

    let body = {
      mapId: this.props.map.id
    };

    if (newPublicAccessLevelDefined) {
      body.newPublicAccessLevel = newPublicAccessLevel;
    };

    if (newMaxCreditsMinDefined) {
      body.newMaxCreditsMin = newMaxCreditsMin;
    };

    if (newMaxPublicCreditsMinDefined) {
      body.newMaxPublicCreditsMin = newMaxPublicCreditsMin;
    }

    ApiManager.fetch('POST', '/settings/updateMap', body, this.props.user)
      .then(() => {
        let mapAccess = {
          ...this.state.mapAccess
        };

        if (newPublicAccessLevelDefined) {
          mapAccess.publicAccessLevel = newPublicAccessLevel;
        }
        if (newMaxPublicCreditsMinDefined) {
          mapAccess.maxPublicCreditsMin = newMaxPublicCreditsMin;
        }

        this.setState({ mapAccess: mapAccess });
      })
      .catch(err => {
        this.publicAccessLevelInput.current.value = this.state.mapAccess.publicAccessLevel;
        this.maxCreditsMinInput.current.value = this.state.mapAccess.maxCreditsMin;
        this.maxPublicCreditsMinInput.current.value = this.state.mapAccess.maxPublicCreditsMin;
        this.props.showError(err);
      });
  }

  createGroup = (row) => {
    let editedRow = row.original;

    if (editedRow.name.length < 4) {
      alert('Group name must be at least 4 characters long');
      return;
    }

    if (!checkValidAccessLevel(editedRow.accessLevel)) {
      alert('Access level must be a whole number between 0 and 1000');
      return;
    }

    let body = {
      mapId: this.props.map.id,
      groupName: editedRow.name,
      accessLevel: parseInt(editedRow.accessLevel),
      maxCreditsMin: editedRow.maxCreditsMin ? parseInt(editedRow.maxCreditsMin) : 0
    };

    ApiManager.fetch('POST', '/settings/createGroup', body, this.props.user)
      .then(() => {
        let newGroup = {
          id: this.state.groupsData.length + 1,
          name: editedRow.name,
          accessLevel: editedRow.accessLevel,
          maxCreditsMin: editedRow.maxCreditsMin
        };

        let newGroupClone = cloneDeep(newGroup);

        this.state.mapAccess.groups.push(newGroup);
        this.state.groupsData.push(newGroupClone);

        if (this.props.map.accessLevel >= 1000) {
          let newGroupData = this.state.groupsData.find(group => group.id === 0);
          newGroupData.name = 'new group';
          newGroupData.accessLevel = 500;
        }

        let groupsData = [...this.state.groupsData];

        this.setState({ groupsData: groupsData });
      })
      .catch(err => {
        this.props.showError(err);
      });
  }

  saveGroup = (cellInfo) => {
    let editedRow = cellInfo.original;
    let originalRow = this.state.mapAccess.groups.find(group => group.id === editedRow.id);

    if (!originalRow) {
      console.warn('Attempted to save a group that does not exist in the original data.');
      return;
    }


    let body = {
      mapId: this.props.map.id,
      groupName: originalRow.name
    };

    let anyChanged = false;

    if (originalRow.name !== editedRow.name) {
      body.newGroupName = editedRow.name
      anyChanged = true;
    }

    if (originalRow.accessLevel !== editedRow.accessLevel) {
      if (!checkValidAccessLevel(editedRow.accessLevel)) {
        alert('Access level must be a whole number between 0 and 1000');
        return;
      }

      body.newAccessLevel = parseInt(editedRow.accessLevel);
      anyChanged = true;
    }

    if (originalRow.maxCreditsMin !== editedRow.maxCreditsMin) {
      body.newMaxCreditsMin = parseInt(editedRow.maxCreditsMin);
      anyChanged = true;
    }

    if (!anyChanged) {
      return;
    }

    ApiManager.fetch('POST', '/settings/updateGroup', body, this.props.user)
      .then(() => {
        originalRow.name = editedRow.name;
        originalRow.accessLevel = editedRow.accessLevel;
        originalRow.maxCreditsMin = editedRow.maxCreditsMin;
      })
      .catch(err => {
        this.props.showError(err);
      });

  }

  onGroupEditUsers = (cellInfo) => {
    let editedRow = cellInfo.original;
    let originalRow = this.state.mapAccess.groups.find(group => group.id === editedRow.id);

    if (!originalRow) {
      console.warn('Attempted to edit users of a group that does not exist in the original data.');
      return;
    }

    this.props.onGroupUserManagement(originalRow);
  }

  deleteGroup = (cellInfo) => {
    let editedRow = cellInfo.original;
    let originalRow = this.state.mapAccess.groups.find(group => group.id === editedRow.id);

    if (!originalRow) {
      console.warn('Attempted to delete a group that does not exist in the original data.');
      return;
    }

    let confirmDelete = window.confirm(`Are you sure you want to delete the group: ${originalRow.name}?`);

    if (confirmDelete) {
      let body = {
        mapId: this.props.map.id,
        groupName: originalRow.name
      };

      ApiManager.fetch('POST', '/settings/deleteGroup', body, this.props.user)
        .then(() => {
          this.state.mapAccess.groups = this.state.mapAccess.groups.filter(group => {
            return group.id !== originalRow.id;
          });

          let newGroupsData = this.state.groupsData.filter(group => {
            return group.id !== originalRow.id;
          });

          this.setState({ groupsData: newGroupsData });
        })
        .catch(err => {
          this.props.showError(err);
        });
    }
  }

  renderEditable = (cellInfo) => {
    let isOwner = this.props.map.accessLevel >= 1000;

    return (
      <div style={{ backgroundColor: '#fafafa' }}>
        <input
          className='management-table-input-field'
          type='text'
          defaultValue={this.state.groupsData[cellInfo.index][cellInfo.column.id]}
          onBlur={e => {
            this.state.groupsData[cellInfo.index][cellInfo.column.id] = e.target.value;
          }}
          disabled={!isOwner}
        />
      </div>
    );
  }

  renderActionButtons = (cellInfo) => {
    let isOwner = this.props.map.accessLevel >= 1000;
    let isUserManager = this.props.map.accessLevel >= 900;

    if (cellInfo.original.id === 0) {
      return (
        <div
          style={{ backgroundColor: '#fafafa' }}
        >
          <button onClick={() => this.createGroup(cellInfo)}>{'Create'}</button>
        </div>
      );
    }
    else {
      return (
        <div
          style={{ backgroundColor: '#fafafa' }}
        >
          <button onClick={() => this.saveGroup(cellInfo)} disabled={!isOwner}>{'Save'}</button>
          <button onClick={() => this.onGroupEditUsers(cellInfo)} disabled={!isUserManager}>{'Edit users'}</button>
          <button onClick={() => this.deleteGroup(cellInfo)} disabled={!isOwner}>{'Delete'}</button>
        </div>
      );
    }

  }

  render() {
    if (!this.state.mapAccess) {
      return null;
    }

    let disable = this.props.map.accessLevel < 1000;

    return (
      <div>
        <div className='management-input-label-div'>
          {'Public access level'}
        </div>
        <input
          className='management-input'
          ref={this.publicAccessLevelInput}
          type='text'
          style={{ marginBottom: '20px' }}
          defaultValue={this.state.mapAccess.publicAccessLevel}
          onBlur={(e) => this.updateMap(parseInt(e.target.value), null, null)}
          disabled={disable}
        >
        </input>
        <div className='management-input-label-div'>
          Credits/minute
        </div>
        <input
          className='management-input'
          ref={this.maxCreditsMinInput}
          type='text'
          style={{ marginBottom: '20px' }}
          defaultValue={this.state.mapAccess.maxCreditsMin}
          onBlur={(e) => this.updateMap(null, parseInt(e.target.value), null)}
          disabled={!this.props.user || this.props.user.username !== ApiManager.adminUserName}
        >
        </input>
        <div className='management-input-label-div'>
          Public credits/minute
        </div>
        <input
          className='management-input'
          ref={this.maxPublicCreditsMinInput}
          type='text'
          style={{ marginBottom: '20px' }}
          defaultValue={this.state.mapAccess.maxPublicCreditsMin}
          onBlur={(e) => this.updateMap(null, null, parseInt(e.target.value))}
          disabled={disable}
        >
        </input>
        <ReactTable
          key={Math.random()}
          className='access-management-table'
          data={this.state.groupsData}
          columns={[
            {
              Header: 'Group name',
              accessor: 'name',
              Cell: this.renderEditable
            },
            {
              Header: 'Access level',
              accessor: 'accessLevel',
              Cell: this.renderEditable
            },
            {
              Header: 'Credits/minute',
              accessor: 'maxCreditsMin',
              Cell: this.renderEditable
            },
            {
              Header: 'Actions',
              accessor: 'actions',
              Cell: this.renderActionButtons
            }
          ]}
          sortable={false}
          defaultPageSize={1000}
          showPagination={false}
          minRows={0}
        />
      </div>
    );
  }
}

function checkValidAccessLevel(accessLevel) {
  return !(isNaN(accessLevel) || !Number.isInteger(parseFloat(accessLevel)) ||
    accessLevel < 0 || accessLevel > 1000)
}

export default AccessManagement;
