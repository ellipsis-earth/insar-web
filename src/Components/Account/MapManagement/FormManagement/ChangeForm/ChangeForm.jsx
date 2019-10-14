import React, { PureComponent } from 'react';
import { NavLink, Redirect } from 'react-router-dom';

import ReactTable from 'react-table';
import 'react-table/react-table.css';
import cloneDeep from 'lodash.clonedeep';

import ApiManager from '../../../../../ApiManager';

class ChangeForm extends PureComponent {
  constructor(props, context) {
    super(props, context);

    this.state = {
      questions : [{'type': 'numeric', 'obligatory': 'no', 'question': 'your question'}].concat(this.props.form["form"]["questions"])
          };
  }



  moveUp = (cellInfo) => {
    this.state.questions[cellInfo.index- 1] = [this.state.questions[cellInfo.index], this.state.questions[cellInfo.index]=this.state.questions[cellInfo.index- 1]][0];
    this.setState(this.state.questions)
  }

  moveDown = (cellInfo) => {
    this.state.questions[cellInfo.index+ 1] = [this.state.questions[cellInfo.index], this.state.questions[cellInfo.index]=this.state.questions[cellInfo.index+ 1]][0];
    this.setState(this.state.questions)
  }

  add = () => {
    console.log(this.state.questions)
    let x = {"question": '', "type": '', "obligatory": ''}
    x["question"] = this.state.questions[0]["question"]
    x["type"] = this.state.questions[0]["type"]
    x["obligatory"] = this.state.questions[0]["obligatory"] === 'yes';

    this.state.questions.splice(1,0,x)

    let newQuestions = [...this.state.questions];
    this.setState({ questions: newQuestions });
  }

  delete = (cellInfo) => {

    this.state.questions.splice(cellInfo.index ,1)
    this.setState({state: this.state})
  }

  save = () => {
let questions = this.state.questions
questions.shift()
let form = {"questions": questions}
console.log(this.props.form["formName"])
console.log(this.props.map.id)
console.log(form["questions"])

ApiManager.fetch('POST', '/geoMessage/forms/alter', {"mapId": this.props.map.id, "newName":this.props.form["formName"], "oldName":this.props.form["formName"], "form": form}, this.props.user)
  .then(() => {
    //redirect
  })
  .catch(err => {
    console.log(err);
    this.props.showError(err);
  });

    }


  renderEditable = (cellInfo) => {
    return (
      <div style={{ backgroundColor: "#fafafa" }}>
        <input
          type='text'
          defaultValue={this.state.questions[cellInfo.index][cellInfo.column.id]}
          onBlur={e => {
            this.state.questions[cellInfo.index][cellInfo.column.id] = e.target.value;
          }}
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
          <button onClick={() => this.add()}>{"Add"}</button>
        </div>
      );
    }
    else {
      return (
        <div
          style={{ backgroundColor: "#fafafa" }}
        >
          <button onClick={() => this.delete(cellInfo)}>{"Delete"}</button>
        </div>
      );
    }

  }

  renderMoveButtons = (cellInfo) => {
    if(cellInfo.index === 1 && this.state.questions.length > 2) {
      return (
        <div
          style={{ backgroundColor: "#fafafa" }}
        >
        <button onClick={() => this.moveDown(cellInfo)}>Down</button>
        </div>
      );
    }
    else if(cellInfo.index === this.state.questions.length -1 && this.state.questions.length > 2 ) {
      return (
        <div
          style={{ backgroundColor: "#fafafa" }}
        >
        <button onClick={() => this.moveUp(cellInfo)}>Up</button>
        </div>
      );
    }
    else if (cellInfo.index > 1 && cellInfo.index < this.state.questions.length  ) {
      return (
        <div
          style={{ backgroundColor: "#fafafa" }}
        >
        <button onClick={() => this.moveUp(cellInfo)}>Up</button>
        <button onClick={() => this.moveDown(cellInfo)}>Down</button>
        </div>
      );
    }

    else {
      return (
        <div
          style={{ backgroundColor: "#fafafa" }}
        >
        </div>
      );
    }

  }
  renderDropdown = (cellInfo) => {
    let element = <div> </div>
      element = (   <div style={{ backgroundColor: "#fafafa" }}>
          <select value = {this.state.questions[cellInfo.index][cellInfo.column.id]}
           name="Type"
           onChange = {e => {
             let x = Object.assign({}, this.state.questions);
             x[cellInfo.index][cellInfo.column.id] = e.target.value;
             this.setState({x})
            }}>
            <option  value="text">{"Text"}</option>
            <option value="numeric">{"Numeric"}</option>
            <option value="date">{"Date"}</option>
            <option value="boolean">{"Boolean"}</option>
          </select>
          </div>
        );
    return (element)

  }

  renderTickbox = (cellInfo) => {
    let element = <div> </div>
      element = (   <div style={{ backgroundColor: "#fafafa" }}>
          <select value = {this.state.questions[cellInfo.index][cellInfo.column.id]}
           name="Type"
           onChange = {e => {
             let x = Object.assign({}, this.state.questions);
             x[cellInfo.index][cellInfo.column.id] = e.target.value;
             this.setState({x})
            }}>
            <option  value="yes">{"Yes"}</option>
            <option value="no">{"No"}</option>
          </select>
          </div>
        );
    return (element)
  }
  render() {
    let modeElement = (<div></div>);

    modeElement = (
      <div>
      <h2> {"Altering"} {"formName"} </h2>

        <ReactTable
          key={Math.random()}
          data={this.state.questions}
          columns={[
            {
              Header: "Move",
              accessor: 'move',
              Cell: this.renderMoveButtons
            },
            {
              Header: "Question",
              accessor: 'question',
              Cell: this.renderEditable
            },
            {
              Header: "Type",
              accessor: 'type',
              Cell: this.renderDropdown
            },
            {
              Header: "Obligatory",
              accessor: 'obligatory',
              Cell: this.renderTickbox
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
        <button onClick={() => this.save()}>{"save form"}</button>
      </div>
    )
      return (
        modeElement
      );
}
}
export default ChangeForm;
