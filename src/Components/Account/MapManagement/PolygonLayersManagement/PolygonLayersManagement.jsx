import React, { PureComponent } from 'react';

import ReactTable from 'react-table';
import 'react-table/react-table.css';
import cloneDeep from 'lodash.clonedeep';

import ApiManager from '../../../../ApiManager';

class PolygonLayersManagement extends PureComponent {
  constructor(props, context) {
    super(props, context);

    this.state = {
      polygonLayers: null,
      polygonLayersData: null
    };
  }

  componentDidMount() {
    this.update();
  }

  update = () => {
    if (!this.props.user) {
      return;
    }

    this.getPolygonLayers();
  }

  componentWillUnmount() {
    this.setState({ polygonLayers: null });
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (prevProps.map !== this.props.map) {
      this.setState({
        polygonLayers: null,
        polygonLayersData: null
      },
      () => { this.update(); }
      );
    }
  }

  getPolygonLayers = (e) => {
    ApiManager.fetch('POST', '/metadata/polygonLayers', { mapId: this.props.map.id }, this.props.user)
      .then(results => {
        for (let i = 0; i < results.length; i++) {
          let polygonLayer = results[i];

          polygonLayer.id = i + 1;
          polygonLayer.properties = polygonLayer.properties.join(',');
        }

        let polygonLayersdata = cloneDeep(results);

        polygonLayersdata.unshift({
          id: 0,
          name: 'new layer',
          color: 'ff0000ff',
          private: false,
          restricted: false,
          hasAggregatedData: false,
          properties: 'property1,property2'
        });

        this.setState({ polygonLayers: results, polygonLayersData: polygonLayersdata });
      })
      .catch(err => {
        this.props.showError(err);
      });
  }

  createPolygonLayer = (cellInfo) => {
    let editedRow = cellInfo.original;

    if (!testHex(editedRow.color)) {
      alert('Invalid color. Must be in rgba hexadecimal (example ff0000ff).');
    }

    let properties = editedRow.properties.split(',');
    properties.forEach(function(part, index, theArray) {
      theArray[index] = part.trim();
    });

    let body = {
      mapId: this.props.map.id,
      layerName: editedRow.name,
      color: editedRow.color,
      properties: properties,
      private: editedRow.private,
      restricted: editedRow.restricted,
      aggregateData: editedRow.hasAggregatedData
    };

    ApiManager.fetch('POST', '/geometry/layers/add', body, this.props.user)
      .then(() => {
        let newLayer = {
          id: this.state.polygonLayers.length + 1,
          name: editedRow.name,
          color: editedRow.color,
          properties: editedRow.properties,
          hasAggregatedData: editedRow.hasAggregatedData
        };

        let newGroupClone = cloneDeep(newLayer);

        this.state.polygonLayers.push(newLayer);
        this.state.polygonLayersData.push(newGroupClone);

        let newLayerData = this.state.polygonLayersData.find(layer => layer.id === 0);
        newLayerData.name = 'new layer';
        newLayerData.color = 'ff0000ff';
        newLayerData.properties = 'property1,property2';
        newLayerData.private = false;
        newLayerData.restricted = false;
        newLayerData.hasAggregatedData = false;

        let polygonLayersData = [...this.state.polygonLayersData];

        this.setState({ polygonLayersData: polygonLayersData });
      })
      .catch(err => {
        this.props.showError(err);
      });
  }

  savePolygonsLayer = (cellInfo) => {
    let editedRow = cellInfo.original;
    let originalRow = this.state.polygonLayers.find(layer => layer.id === editedRow.id);

    if (!originalRow) {
      console.warn('Attempted to save a row that does not exist in the original data.');
      return;
    }

    let promises = [];

    if (originalRow.properties !== editedRow.properties) {
      let oldProperties = originalRow.properties.split(',');
      let newProperties = editedRow.properties.split(',');

      for (let i = 0; i < oldProperties.length; i++) {
        oldProperties[i] = oldProperties[i].trim();
      }

      for (let i = 0; i < newProperties.length; i++) {
        newProperties[i] = newProperties[i].trim();
      }

      for (let i = 0; i < oldProperties.length; i++) {
        let oldProperty = oldProperties[i];

        if (oldProperty === '') {
          continue;
        }

        if (!newProperties.includes(oldProperty)) {
          let body = {
            mapId: this.props.map.id,
            layerName: originalRow.name,
            propertyName: oldProperty
          };

          promises.push(ApiManager.fetch('POST', '/geometry/layers/deleteProperty', body, this.props.user));
        }
      }

      for (let i = 0; i < newProperties.length; i++) {
        let newProperty = newProperties[i];

        if (newProperty === '') {
          continue;
        }

        if (!oldProperties.includes(newProperty)) {
          let body = {
            mapId: this.props.map.id,
            layerName: originalRow.name,
            propertyName: newProperty
          };

          promises.push(ApiManager.fetch('POST', '/geometry/layers/addProperty', body, this.props.user));
        }
      }
    }

    Promise.all(promises)
      .then(() => {
        let body = {
          mapId: this.props.map.id,
          layerName: originalRow.name
        };

        let alter = false

        if (originalRow.name !== editedRow.name) {
          body.newLayerName = editedRow.name;
          alter = true;
        }

        if (originalRow.color !== editedRow.color) {
          editedRow.color = editedRow.color.toLowerCase();

          if (!testHex(editedRow.color)) {
            alert('Invalid color. Must be in rgba hexadecimal (example ff0000ff).');
            return;
          }

          body.color = editedRow.color;
          alter = true;
        }

        if (originalRow.private !== editedRow.private) {
          body.private = editedRow.private;
          alter = true;
        }

        if (originalRow.restricted !== editedRow.restricted) {
          body.restricted = editedRow.restricted;
          alter = true;
        }

        if (alter) {
          return ApiManager.fetch('POST', '/geometry/layers/alter', body, this.props.user);
        }
        else {
          return;
        }
      })
      .then(() => {
        originalRow.name = editedRow.name;
        originalRow.color = editedRow.color;
        originalRow.properties = editedRow.properties;
        originalRow.private = editedRow.private;
        originalRow.restricted = editedRow.restricted;
        originalRow.hasAggregatedData = editedRow.hasAggregatedData;
      })
      .catch(err => {
        this.props.showError(err);
      });
  }

  deleteCustomPolygonsLayer = (cellInfo) => {
    let editedRow = cellInfo.original;
    let originalRow = this.state.polygonLayers.find(layer => layer.id === editedRow.id);

    let confirmDelete = window.confirm(`Are you sure you want to delete the layer: ${originalRow.name}?`);

    if (confirmDelete) {
      let body = {
        mapId: this.props.map.id,
        layerName: originalRow.name
      };

      ApiManager.fetch('POST', '/geometry/layers/delete', body, this.props.user)
        .then(() => {
          let newPolygonLayers = this.state.polygonLayers.filter(layer => {
            return layer.id !== originalRow.id;
          });

          let newPolygonLayersData = this.state.polygonLayersData.filter(layer => {
            return layer.id !== originalRow.id;
          });

          this.setState({ polygonLayers: newPolygonLayers, polygonLayersData: newPolygonLayersData });
        })
        .catch(err => {
          this.props.showError(err);
        });
    }
  }

  renderEditable = (cellInfo) => {
    return (
      <div style={{ backgroundColor: '#fafafa' }}>
        <input
          type='text'
          defaultValue={this.state.polygonLayersData[cellInfo.index][cellInfo.column.id]}
          onBlur={e => {
            this.state.polygonLayersData[cellInfo.index][cellInfo.column.id] = e.target.value;
          }}
        />
      </div>
    );
  }

  renderColorDropdown = (cellInfo) => {
    let element = (
      <div style={{ backgroundColor: '#fafafa' }}>
        <select value = {this.state.polygonLayersData[cellInfo.index][cellInfo.column.id]}
          name='Type'
          onChange = {e => {
            let x = Object.assign({}, this.state.polygonLayersData);
            x[cellInfo.index][cellInfo.column.id] = e.target.value;
            this.setState({x});
          }}>
          <option value='ff0000ff'>{'red'}</option>
          <option value='00ff00ff'>{'green'}</option>
          <option value='0000ffff'>{'blue'}</option>
          <option value='ffff00ff'>{'yellow'}</option>
          <option value='ff8c00ff'>{'orange'}</option>
        </select>
      </div>
    );
    return (element)
  }

  renderCheckbox = (cellInfo, disabled) => {
    return (
      <div style={{ backgroundColor: '#fafafa' }}>
        <input
          type='checkbox'
          defaultChecked={this.state.polygonLayersData[cellInfo.index][cellInfo.column.id]}
          onChange={e => {
            this.state.polygonLayersData[cellInfo.index][cellInfo.column.id] = e.target.checked;
          }}
          disabled={disabled}
        />
      </div>
    );
  }

  renderActionButtons = (cellInfo) => {
    if (cellInfo.index === 0) {
      return (
        <div
          style={{ backgroundColor: '#fafafa' }}
        >
          <button onClick={() => this.createPolygonLayer(cellInfo)}>{'Create'}</button>
        </div>
      );
    }
    else {
      return (
        <div
          style={{ backgroundColor: '#fafafa' }}
        >
          <button onClick={() => this.savePolygonsLayer(cellInfo)}>{'Save'}</button>
          <button onClick={() => this.deleteCustomPolygonsLayer(cellInfo)}>{'Delete'}</button>
        </div>
      );
    }

  }

  render() {
    if (this.state.polygonLayers) {
      return (
        <div>
          <ReactTable
            key={Math.random()}
            data={this.state.polygonLayersData}
            columns={[
              {
                Header: 'Layer name',
                accessor: 'name',
                Cell: this.renderEditable
              },
              {
                Header: 'Color',
                accessor: 'color',
                Cell: this.renderColorDropdown
              },
              {
                Header: 'Properties',
                accessor: 'properties',
                Cell: this.renderEditable
              },
              {
                Header: 'Private',
                accessor: 'private',
                Cell: (cellInfo) => this.renderCheckbox(cellInfo, false)
              },
              {
                Header: 'Restricted',
                accessor: 'restricted',
                Cell: (cellInfo) => this.renderCheckbox(cellInfo, false)
              },
              {
                Header: 'Aggregate data',
                accessor: 'hasAggregatedData',
                Cell: (cellInfo) => this.renderCheckbox(cellInfo, cellInfo.index !== 0)
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
            className='-striped -highlight'
          />
        </div>
      );
    }
    else {
      return (<div></div>)
    }
  }
}

function testHex(hex) {
  let valid = /^([A-Fa-f0-9]{4}){1,2}$/.test(hex);

  return valid;
}

export default PolygonLayersManagement;
