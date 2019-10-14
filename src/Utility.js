const Utility = {
  arrayRemove: function (array, element) {
    let index = array.indexOf(element);

    if (index !== -1) {
      array.splice(index, 1);
    }

    return array;
  }
};

export default Utility;