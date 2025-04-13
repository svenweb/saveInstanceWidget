import { React, type AllWidgetProps } from 'jimu-core'
import { type IMConfig } from '../config' // Ensure that the '../config' module exists and is correctly named
import { JimuMapView, JimuMapViewComponent } from 'jimu-arcgis'
import { useEffect, useState } from 'react';

const Widget = (props: AllWidgetProps<IMConfig>) => {

    const [jimuMapView, setJimuMapView] = useState(null);

     /**
       * Description: Handles the change of the active view.
       * @param {type} jmv - The new active view
       * @return {void}
       */
      const activeViewChangeHandler = (jmv: JimuMapView) => {
        if (jmv) {
          setJimuMapView(jmv);
          console.log(jmv)
        }
      }; 


      useEffect(() => {
        console.log("savedInstancesToString updated: ", props.config.savedInstancesToString);
      }, [props.config.savedInstancesToString])

      
      
      //Get the name,webmapId,extent,layers,graphics
      //getMapInstanceData()
      /**
       * returns the session object for the current map
       * @returns {Object} map settings for session
       */
      const getSettingsForCurrentMap = async () => {
        if (!jimuMapView) return null;

        const settings = {
          name: "",
          webmapId: jimuMapView.view.map.portalItem.id,
          extent: jimuMapView.view.extent,
          layers: [],
          graphics: jimuMapView.view.graphics.toArray()
        };

        try {
          const layerSettings = await getLayerSettingsForCurrentMap();
          settings.layers = layerSettings;
          console.log('SaveSession :: getSettingsForCurrentMap :: layerSettings completed  = ', layerSettings);
        } catch (err) {
          console.error("An error occurred while getting the layers from the current map.", err);
        }

        let settingsJSON = JSON.stringify(settings);
        let settingsBase64 = btoa(settingsJSON);
        props.config.set("savedInstancesToString", settingsBase64.toString());
        //props.config.set("savedInstancesToString",settingsJSON)
  

        console.log("SETTINGS: ", settingsBase64)
        return settings;
      };

      /**
       * Retrieves the settings for all layers in the current map view.
       * @returns {Promise<Array>} A promise that resolves to an array of layer settings.
       */
      const getLayerSettingsForCurrentMap = async () => {
        console.log("hi")
        if (!jimuMapView) return [];

        try {
          const layerObjects = jimuMapView.view.map.layers.toArray();
          console.log(layerObjects)
          const settings = layerObjects.map((layer, idx) => {
            const layerSettings = getSettingsForLayer(layer);
            layerSettings.order = layerObjects.length - idx;
            return layerSettings;
          });

          console.log('SaveSession :: getLayerSettingsForCurrentMap :: layerSettings completed  = ', settings);
          return settings;
        } catch (err) {
          console.error('SaveSession :: getLayerSettingsForCurrentMap :: error getting layersObjects  = ', err);
          return [];
        }
      };

      //Different layer types have different settings that are needed to save.
      const getSettingsForLayer = (layer) => {
        const layerSettings = {
          id: layer.id,
          name: layer.title,
          type: getLayerType(layer),
          isVisible: layer.visible,
          visibleLayers: layer.visibleLayers || null,
          url: layer.url,
          options: null
        };

        switch (layerSettings.type) {
          case "MapImageLayer": //used to be ArcGISDynamicMapServiceLayer
            layerSettings.options = getOptionsForDynamicLayer(layer);
            break;
          case "FeatureLayer":
            layerSettings.options = getOptionsForFeatureLayer(layer);
            break;
          case "TileLayer":
            layerSettings.options = getOptionsForTiledLayer(layer);
            break;
          case "GroupLayer":
            layerSettings.options = getOptionsForGroupLayer(layer)
          default:
            console.log('SaveSession :: getSettingsForLayer :: no options for layer type = ', layerSettings.type);
            break;
        }

        //console.log('SaveSession :: getSettingsForLayer :: settings ', layerSettings, ' added for layer = ', layer.id);
        return layerSettings;
      };

      const getLayerType = (layer) => {
        if (layer.type === 'feature') return 'FeatureLayer';
        if (layer.type === 'tile') return 'TileLayer';
        if (layer.type === 'map-image') return 'MapImageLayer';
        if(layer.type === "group") return "GroupLayer";
        return 'UnknownLayerType';
      };

      const getOptionsForDynamicLayer = (layer) => {
        const options = {
          id: layer.id,
          imageParameters: layer.imageFormat ? { format: layer.imageFormat, dpi: layer.dpi } : null,
          opacity: layer.opacity,
          refreshInterval: layer.refreshInterval,
          visible: layer.visible
        };

        console.log('SaveSession :: getOptionsForDynamicLayer :: options =  ', options, ' for layer = ', layer.id);
        return options;
      };

      const getOptionsForFeatureLayer = (layer) => {
        const options = {
          id: layer.id,
          mode: layer.mode || 'on-demand',
          outFields: ["*"],
          opacity: layer.opacity,
          refreshInterval: layer.refreshInterval,
          visible: layer.visible
        };

        console.log('SaveSession :: getOptionsForFeatureLayer :: options =  ', options, ' for layer = ', layer.id);
        return options;
      };

      const getOptionsForTiledLayer = (layer) => {
        const options = {
          id: layer.id,
          opacity: layer.opacity,
          refreshInterval: layer.refreshInterval,
          visible: layer.visible
        };

        console.log('SaveSession :: getOptionsForTiledLayer :: options =  ', options, ' for layer = ', layer.id);
        return options;
      };

      const getOptionsForGroupLayer = (layer) => {
        const subLayerSettings = layer.layers.map(subLayer => getSettingsForLayer(subLayer));
        const options = {
          id: layer.id,
          opacity: layer.opacity,
          refreshInterval: layer.refreshInterval,
          visible: layer.visible,
          subLayers: subLayerSettings
        };
      
        console.log('SaveSession :: getOptionsForGroupLayer :: options =  ', options, ' for layer = ', layer.id);
        return options;
      };


  return (
    <div className="widget-demo jimu-widget m-2">
        {props.hasOwnProperty("useMapWidgetIds") &&
                    props.useMapWidgetIds &&
                    props.useMapWidgetIds.length == 1 && (
                      <JimuMapViewComponent
                        useMapWidgetId={props.useMapWidgetIds?.[0]}
                        onActiveViewChange={activeViewChangeHandler}
                      />
                    )}
      <p>Save Instance</p>
      <button onClick={() => {getSettingsForCurrentMap()}}>Save Layers</button>
      <p>{props.config.savedInstancesToString}</p>
      
    </div>
  )
}

export default Widget
