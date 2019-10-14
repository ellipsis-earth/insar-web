import ViewerUtility from '../ViewerUtility';

const DataPaneUtility = {
  isDifferentElement: (prevElement, curElement) => {
    if (!curElement) {
      return false;
    }

    let differentElement = !prevElement || prevElement.type !== curElement.type;

    if (!differentElement) {
      // Same map, same type. Compare ids.

      let prevFeatureInfo = prevElement.feature.properties;
      let curFeatureInfo = curElement.feature.properties;

      if (curElement.type === ViewerUtility.standardTileLayerType) {
        differentElement = prevFeatureInfo.tileX !== curFeatureInfo.tileX ||
          prevFeatureInfo.tileY !== curFeatureInfo.tileY ||
          prevFeatureInfo.zoom !== curFeatureInfo.zoom;
      }
      else {
        differentElement = prevFeatureInfo.id !== curFeatureInfo.id;
      }
    }

    return differentElement;
  }
}

export default DataPaneUtility;