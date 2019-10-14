import React, { PureComponent } from 'react';

import ReactTable from 'react-table';
import 'react-table/react-table.css';

import ApiManager from '../../../../ApiManager';

class GroupUserManagement extends PureComponent {
  constructor(props, context) {
    super(props, context);

    this.state = {
      groupUsers: null
    };
  }

  componentDidMount() {
    this.update();
  }

  update = () => {
    if (!this.props.user) {
      return;
    }

    this.getGroupUsers();
  }

  componentWillUnmount() {
    this.setState({ groupUsers: null });
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (prevProps.map !== this.props.map) {
      this.setState({
        groupUsers: null
      },
      () => { this.update(); }
      );
    }
  }

  getGroupUsers = (e) => {
    let body = {
      mapId: this.props.map.id,
      groupName: this.props.group.name
    };

    ApiManager.fetch('POST', '/settings/users', body, this.props.user)
      .then(result => {
        let groupUsers = [];
        groupUsers.push({
          id: 0,
          username: "new user"
        });

        for (let i = 1; i < result.length + 1; i++) {
          groupUsers.push({
            id: i,
            username: result[i - 1]
          });
        }

        this.setState({ groupUsers: groupUsers });
      })
      .catch(err => {
        this.props.showError(err);
      });
  }

  addUserToGroup = (cellInfo) => {
    let userRow = cellInfo.original;

    let body = {
      mapId: this.props.map.id,
      groupName: this.props.group.name,
      username: userRow.username
    };

    ApiManager.fetch('POST', '/settings/addUser', body, this.props.user)
      .then(result => {
        let newGroupUser = {
          id: this.state.groupUsers.length + 1,
          username: userRow.username
        };

        this.state.groupUsers.push(newGroupUser);

        let newGroupUsers = this.state.groupUsers.filter(user => user.id !== 0);
        newGroupUsers.unshift({
          id: 0,
          username: 'new user'
        });

        this.setState({ groupUsers: newGroupUsers });
      })
      .catch(err => {
        this.props.showError(err);
      });
  }

  deleteUserFromGroup = (cellInfo) => {
    let userRow = cellInfo.original;

    let confirmDelete = window.confirm(
      `Are you sure you want to delete user ${userRow.username} from the group ${this.props.group.name}?`
    );

    if (confirmDelete) {
      let body = {
        mapId: this.props.map.id,
        groupName: this.props.group.name,
        username: userRow.username
      };

      ApiManager.fetch('POST', '/settings/removeUser', body, this.props.user)
        .then(() => {
          let newGroupUsers = this.state.groupUsers.filter(user => {
            return user.id !== userRow.id;
          });

          this.setState({ groupUsers: newGroupUsers });
        })
        .catch(err => {
          this.props.showError(err);
        });
    }
  }

  renderEditable = (cellInfo) => {
    let disable = cellInfo.original.id !== 0;

    return (
      <div style={{ backgroundColor: "#fafafa" }}>
        <input
          type='text'
          defaultValue={this.state.groupUsers[cellInfo.index][cellInfo.column.id]}
          onBlur={e => {
            this.state.groupUsers[cellInfo.index][cellInfo.column.id] = e.target.value;
          }}
          disabled={disable}
        />
      </div>
    );
  }

  renderActionButtons = (cellInfo) => {
    if (cellInfo.index === 0) {
      return (
        <div
          style={{ backgroundColor: "#fafafa" }}
        >
          <button onClick={() => this.addUserToGroup(cellInfo)}>{"Add"}</button>
        </div>
      );
    }
    else {
      return (
        <div
          style={{ backgroundColor: "#fafafa" }}
        >
          <button onClick={() => this.deleteUserFromGroup(cellInfo)}>{"Delete"}</button>
        </div>
      );
    }
  }

  render() {
    if (this.state.groupUsers) {
      return (
        <div>
        <h2> {"Altering"} {this.props.group["name"]}</h2>
          <ReactTable
            key={Math.random()}
            data={this.state.groupUsers}
            columns={[
              {
                Header: "Username",
                accessor: 'username',
                Cell: this.renderEditable
              },
              {
                Header: "Actions",
                accessor: 'actions',
                Cell: this.renderActionButtons
              }
            ]}
            sortable={false}
            defaultPageSize={1000}
            showPagination={false}
            minRows={0}
            className="-striped -highlight"
          />
        </div>
      );
    }
    else {
      return (<div></div>)
    }
  }
}

export default GroupUserManagement;
