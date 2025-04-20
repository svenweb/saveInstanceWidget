import { React, type AllWidgetProps } from 'jimu-core'
import { type IMConfig } from '../config' // Ensure that the '../config' module exists and is correctly named
import { JimuMapView, JimuMapViewComponent } from 'jimu-arcgis'
import { useEffect, useState } from 'react';
import Extent from 'esri/geometry/Extent';
/**
 * 
 * To Do:
 * - Set map from string
 */
const Widget = (props: AllWidgetProps<IMConfig>) => {

    const [jimuMapView, setJimuMapView] = useState(null);
    const [mapSettingsString, setMapSettingsString] = useState<any>({});
    const storageKey = "sessions";
    let sessions;

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


      
      //Get the name,webmapId,extent,layers,graphics
      //getMapInstanceData()
      /**
       * returns the session object for the current map
       * @returns {Object} map settings for session
       */
      const getSettingsForCurrentMap = async () => {
        if (!jimuMapView) return null;
        console.log(jimuMapView)

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

        console.log(settings)
        let settingsJSON = JSON.stringify(settings);
        let settingsBase64 = btoa(settingsJSON);
  

        console.log("SETTINGS: ", settingsBase64)
        return settings;
      };

      //Find graphics in the GraphicsLayer and anywhere else it could be.
      // We want the graphics to be able to played with using the draw widget.
      // could be in jmv.view.map.graphics
      // 68 layers without Draw tool graphic
      // 71 layers with Draw tool graphic
      //    need to copy Layers 67,68,69 - these are the ones making up the drawing.
      function getGeometryForCurrentMap(){
        let graphicsLayers = [];
        //Find layer with type "graphics"
            //then find graphics in that layer
            //then JSON stringify the graphic.
        const layerObjects = jimuMapView.view.map.allLayers.toArray();
        layerObjects.forEach(layer => {
          if(layer.type === "graphics"){
            graphicsLayers.push(layer);
          }
        });

        let jmvGraphicsObj = jimuMapView.view.graphics.toArray();
      }




      /**
       * Retrieves the settings for all layers in the current map view.
       * @returns {Promise<Array>} A promise that resolves to an array of layer settings.
       */
      const getLayerSettingsForCurrentMap = async () => {
        console.log("hi")
        if (!jimuMapView) return [];

        try {
          const layerObjects = jimuMapView.view.map.allLayers.toArray();
          console.log("LAYER OBJECTS: ")
          console.log(layerObjects);
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
          case "GraphicsLayer":
            //layerSettings.options = getOptionsForGraphicsLayer(layer);
            console.log("idk what to do yet")
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
        if(layer.type === "graphics") return "GraphicsLayer";
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


      

            /**
             * apply settings to layers
             * @param {Array} array of layer settings to apply to map
             */
            function setLayersOnMap(settings) {
              console.log(settings)
              var propName = "",
                  layerSettings,
                  layer,
                  addGraphicsToLayer,
                  visibleLayers = [],
                  removeItem = [],
                  i = 0;

              for(layerSettings in settings) {
                  console.log(layerSettings)
                  layer = jimuMapView.view.map.findLayerById(settings[layerSettings].id);
                  console.log(layer)
                  if (!layer) {
                      console.log('SaveSession :: setLayersOnMap :: no layer found with id = ', propName);
                      //layer = addLayerToMap(layerSettings);
                      // exit here? or re-apply settings 
                      return;
                  }

                  // set visible
                  //if (layer.isVisibile) {
                  layer.visible = settings[layerSettings].isVisible;
                  console.log('SaveSession :: loadSession :: set visibility = ', settings[layerSettings].isVisible, ' for layer : id=', layer.id);
                  //}

                  // if (layerSettings.visibleLayers && layer.setVisibleLayers) {
                  //     var visibleLayers = JSON.parse(JSON.stringify(layerSettings.visibleLayers)) as any[];
                  //     if (!layerSettings.visibleLayers.length) {
                  //         // for no visible layers use array of -1
                  //         // drackleyad :: note that in order to properly interpret a layer as truly 'off', it requires an array consisting only of three '-1' values
                  //         visibleLayers = [-1, -1, -1];
                  //     } else {
                  //         // has some visible layers
                  //         removeItem = [];
                  //         visibleLayers.map((index, visibleLayer) => {
                  //             if (visibleLayer === -1) {
                  //                 removeItem.push(index);
                  //             }
                  //         });

                  //         for (i = removeItem.length; i-- > 0;) {
                  //             visibleLayers.splice(i, 1);
                  //         }
                  //     }

                  //     layer.setVisibleLayers(visibleLayers);
                  }

                  console.log('SaveSession :: loadSession :: setLayersOnMap completed for layer = ', layer.id);
              }


              /**
             * Apply the settings from the given session to the current map
             * @param {Object} sessionToLoad a session
             */
            function loadSession(sessionToLoad) {

              // if (sessionToLoad.webmapId && sessionToLoad.webmapId !== jimuMapView.view.map.itemId) {
              //   alert("this is not the map you are looking for");
              //   return
                
              // }
              let extentToLoad;
              //var onMapChanged,
              //    extentToLoad;

              // if (sessionToLoad.webmapId && sessionToLoad.webmapId !== this.map.itemId) {
              //     console.log('SaveSession :: loadSession :: changing webmap = ', sessionToLoad.webmapId);


              //     onMapChanged = topic.subscribe("mapChanged", lang.hitch(this, function (newMap) {

              //         console.log('SaveSession :: loadSession :: map changed from  ', this.map.itemId, ' to ', newMap.itemId);

              //         // update map reference here
              //         // since this.map still refers to old map?
              //         // ConfigManager has not recreated widget with new map yet
              //         this.map = newMap;

              //         // do not listen any more
              //         onMapChanged.remove();

              //         // load the rest of the session
              //         this.loadSession(sessionToLoad);
              //     }));


              //     ConfigManager.getInstance()._onMapChanged({
              //         "itemId": sessionToLoad.webmapId
              //     });

              //     // do not continue until webmap is changed
              //     return;
              // }

              //  zoom the map
              if (sessionToLoad.extent) {
                  extentToLoad = new Extent(sessionToLoad.extent);
                  jimuMapView.view.goTo(extentToLoad);
                  // this.map.setExtent(extentToLoad).then(function () {
                  //     console.log('SaveSession :: loadSession :: new extent  = ', extentToLoad);
                  // }, function () {
                  //     // var msg = new Message({
                  //     //     message: string.substitute("An error occurred zooming to the ${name} map.", sessionToLoad),
                  //     //     type: 'error'
                  //     // });
                  // });
              }

              // load the saved graphics
             // this.setGraphicsOnCurrentMap(sessionToLoad.graphics);


              // toggle layers
              if (sessionToLoad.layers) {
                  setLayersOnMap(sessionToLoad.layers);
              }

              // fire custom event
              //topic.publish("SaveSession/SessionLoaded", sessionToLoad);

              console.log('SaveSession :: loadSession :: session  = ', sessionToLoad);
          }

                    /**
             * read the saved sessions from storage
             */
      function loadSavedSessionsFromStorage() {
        var storedString = "",
            storedSessions = null;

        storedString = localStorage.getItem("sessions");
        if (!storedString) {
            console.log("SaveSession :: loadSavedSessionsFromStorage : no stored sessions to load");
            return;
        }

        storedSessions = JSON.parse(storedString);
        console.log("SaveSession :: loadSavedSessionsFromStorage : sessions found ", storedSessions);

        // replace to current sessions
        this.sessions = storedSessions;
        console.log("SaveSession :: loadSavedSessionsFromStorage : end");
      }

      /**
               * save the current sessions to local storage
               */
      function storeSessions() {
        var stringToStore = JSON.stringify(sessions);
        localStorage.setItem(storageKey, stringToStore);
        console.log("SaveSession :: storeSessions :: completed");
    }
        
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      try {
        let decodedJSON = atob(e.target.value);
        console.log(decodedJSON)
        const parsed = JSON.parse(decodedJSON);
        setMapSettingsString(parsed);
      } catch (err) {
        console.error("Invalid JSON input");
      }
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
      
      <input
        type="text"
        id="mapSettingsStringInput"
        onChange={handleInputChange}
        placeholder='Paste JSON here'
      />      
      <button onClick={() => {loadSession(mapSettingsString)}}>Load Map Input Settings</button>
      
    </div>
  )
}

export default Widget


