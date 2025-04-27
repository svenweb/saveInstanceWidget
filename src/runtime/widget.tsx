import { React, type AllWidgetProps } from 'jimu-core'
import { type IMConfig } from '../config' // Ensure that the '../config' module exists and is correctly named
import { JimuMapView, JimuMapViewComponent } from 'jimu-arcgis'
import { useEffect, useState } from 'react';
import Extent from 'esri/geometry/Extent';
import Graphic from "@arcgis/core/Graphic.js";
import { set } from 'seamless-immutable';
import { update } from 'lodash-es';
import { validate } from 'uuid';

/**
 * 
 * To Do:
 * - Set map from string
 */
const Widget = (props: AllWidgetProps<IMConfig>) => {

    const [jimuMapView, setJimuMapView] = useState(null);
    const [mapSettingsString, setMapSettingsString] = useState<any>({});
    const [graphicsLayersGraphics, setGraphicsLayerGraphics] = useState<any>([]);
    const [currentInstanceName, setCurrentInstanceName] = useState("");
    const storageKey = "saveInstanceWidgetSessions";

    const [fileContent, setFileContent] = useState('');




    const [savedInstances, setSavedInstances] = useState([]);
    let sessions;



    useEffect(() => {
      loadSavedInstancesFromStorage();
    },[])

    useEffect(() => {
      console.log(savedInstances)
    }, [savedInstances])

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
          name: currentInstanceName,
          webmapId: jimuMapView.view.map.portalItem.id,
          extent: jimuMapView.view.extent.toJSON(),
          layers: [],
          graphics: jimuMapView.view.graphics.toArray()
        };

        let graphicsLayersGraphics;

        try {
          const layerSettings = await getLayerSettingsForCurrentMap();
          settings.layers = layerSettings[0];
          graphicsLayersGraphics = layerSettings[1];
          //console.log('SaveInstance :: getSettingsForCurrentMap :: layerSettings completed  = ', layerSettings);
        } catch (err) {
          console.error("An error occurred while getting the layers from the current map.", err);
        }

        settings.graphics = getGraphicsForCurrentMap(graphicsLayersGraphics);

        console.log(settings)
        let settingsJSON = JSON.stringify(settings);
        let settingsBase64 = btoa(settingsJSON);
        
        const updatedSavedInstances = [...savedInstances, settings];
        setSavedInstances(updatedSavedInstances);

        console.log("SETTINGS: ", settingsBase64)

        storeInstances(updatedSavedInstances);
        return settings;
      };


      function getGraphicsForCurrentMap(graphicsLayersGraphics: any[]){
        const graphicsList = [];

        graphicsList.push(...graphicsLayersGraphics);
        
        //Collect graphics from view.graphics
        const viewGraphics = jimuMapView.view.graphics;
        //store each graphic.toJSON() in the gralphicsList
        viewGraphics.forEach(graphic => {
          graphicsList.push(graphic.toJSON());
        });

        return graphicsList
      }




      /**
       * Retrieves the settings for all layers in the current map view.
       * @returns {Promise<Array>} A promise that resolves to an array of layer settings.
       */
      const getLayerSettingsForCurrentMap = async () => {
        console.log("hi")
        if (!jimuMapView) return [];

        let graphicsLayersGraphics = [];

        try {
          const layerObjects = jimuMapView.view.map.allLayers.toArray();
          const settings = layerObjects.map((layer, idx) => {
            const layerSettings = getSettingsForLayer(layer);
            
            const layerSettingsObject = layerSettings[0];
            const isGraphicsLayer = layerSettings[1] as Boolean;
            const layerGraphicsJSON = layerSettings[2];
            
            if(isGraphicsLayer === true){ //If it is a graphics layer
              graphicsLayersGraphics.push(...layerGraphicsJSON); //add it's graphics to the list
            }
            layerSettingsObject.order = layerObjects.length - idx;
            return layerSettingsObject;
          });

          return [settings, graphicsLayersGraphics];
        } catch (err) {
          console.error('SaveInstance :: getLayerSettingsForCurrentMap :: error getting layersObjects  = ', err);
          return [];
        }
      };

      //Different layer types have different settings that are needed to save.
      const getSettingsForLayer = (layer) => {

        let layerGraphicsJSON;
        let isGraphicsLayer = false;

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
            break;
          case "GraphicsLayer":
            console.log("GRAPHICS LAYER", layer)
            isGraphicsLayer = true
            layerGraphicsJSON = getGraphicsFromGraphicsLayer(layer)
            break;
          default:
            //console.log('SaveIntance :: getSettingsForLayer :: no options for layer type = ', layerSettings.type);
            break;
        }

        return [layerSettings, isGraphicsLayer, layerGraphicsJSON ]
      };

      const getLayerType = (layer) => {
        if (layer.type === 'feature') return 'FeatureLayer';
        if (layer.type === 'tile') return 'TileLayer';
        if (layer.type === 'map-image') return 'MapImageLayer';
        if(layer.type === "group") return "GroupLayer";
        if(layer.type === "graphics") return "GraphicsLayer";
        return 'UnknownLayerType';
      };

      const getGraphicsFromGraphicsLayer = (layer) => {
        let layerGraphicsList = [];
        console.log(layer)
        const graphics = layer.graphics.toArray();
        graphics.forEach(graphic => {
          graphic.attributes = {
            ...graphic.attributes,
            "instance": currentInstanceName
          }
          layerGraphicsList.push(graphic.toJSON());
        });
        return layerGraphicsList
      }

      const getOptionsForDynamicLayer = (layer) => {
        const options = {
          id: layer.id,
          imageParameters: layer.imageFormat ? { format: layer.imageFormat, dpi: layer.dpi } : null,
          opacity: layer.opacity,
          refreshInterval: layer.refreshInterval,
          visible: layer.visible
        };

      //  console.log('SaveInstance :: getOptionsForDynamicLayer :: options =  ', options, ' for layer = ', layer.id);
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

       // console.log('SaveInstance :: getOptionsForFeatureLayer :: options =  ', options, ' for layer = ', layer.id);
        return options;
      };

      const getOptionsForTiledLayer = (layer) => {
        const options = {
          id: layer.id,
          opacity: layer.opacity,
          refreshInterval: layer.refreshInterval,
          visible: layer.visible
        };

        //console.log('SaveInstance :: getOptionsForTiledLayer :: options =  ', options, ' for layer = ', layer.id);
        return options;
      };

      const getOptionsForGroupLayer = (layer) => {
        //console.log(layer)
        const subLayerSettings = layer.allLayers.items.map(subLayer => getSettingsForLayer(subLayer));
        const options = {
          id: layer.id,
          opacity: layer.opacity,
          refreshInterval: layer.refreshInterval,
          visible: layer.visible,
          subLayers: subLayerSettings
        };
      
        //console.log('SaveInstance :: getOptionsForGroupLayer :: options =  ', options, ' for layer = ', layer.id);
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
                     // console.log('SaveInstance :: setLayersOnMap :: no layer found with id = ', propName);
                      //layer = addLayerToMap(layerSettings);
                      // exit here? or re-apply settings 
                      return;
                  }

                  // set visible
                  //if (layer.isVisibile) {
                  layer.visible = settings[layerSettings].isVisible;

                  }


              }


              //Need to check that graphics have not already been added to the maps
              function setGraphicsOnMap(graphics, instanceName){
                //find any graphics with the same instance name
                let existingGraphics = jimuMapView.view.graphics.filter(function(graphic){
                  return graphic.attributes.instance === instanceName 
                })
                
                //remove all graphics with same instance name
                if(existingGraphics.length > 0){
                  jimuMapView.view.graphics.removeMany(existingGraphics)
                }
                
                //add all the graphics
                graphics.forEach(function(graphic){
                  let graphicFromJSON = Graphic.fromJSON(graphic);
                  jimuMapView.view.graphics.add(graphicFromJSON);
                })

              }



              /**
             * Apply the settings from the given session to the current map
             * @param {Object} sessionToLoad a session
             */
            function loadSession(sessionToLoad) {
              console.log("LOADING THIS SESSION: ",sessionToLoad)
              // if (sessionToLoad.webmapId && sessionToLoad.webmapId !== jimuMapView.view.map.itemId) {
              //   alert("this is not the map you are looking for");
              //   return
                
              // }
              let extentToLoad;

              //  zoom the map
              if (sessionToLoad.extent) {
                  console.log(sessionToLoad.extent)
                  extentToLoad = Extent.fromJSON(sessionToLoad.extent);
                  jimuMapView.view.goTo(extentToLoad);
              }

              // load the saved graphics
              //use Collection.find() method to try to find out if the graphic is already on the map

             setGraphicsOnMap(sessionToLoad.graphics, sessionToLoad.name);
             console.log(jimuMapView.view.graphics)


              // toggle layers
              if (sessionToLoad.layers) {
                  setLayersOnMap(sessionToLoad.layers);
              }

              console.log('SaveSession :: loadSession :: session  = ', sessionToLoad);
          }

          function storageAvailable(type) {
            let storage;
            try {
              storage = window[type];
              const x = "__storage_test__";
              storage.setItem(x, x);
              storage.removeItem(x);
              return true;
            } catch (e) {
              return (
                e instanceof DOMException &&
                e.name === "QuotaExceededError" &&
                // acknowledge QuotaExceededError only if there's something already stored
                storage &&
                storage.length !== 0
              );
            }
          }


      /**
       * read the saved instances from storage
      */
      function loadSavedInstancesFromStorage() {
        if (storageAvailable("localStorage")) {
          // Yippee! We can use localStorage awesomeness
          var storedString = "",
          storedInstances = null;

          storedString = localStorage.getItem(storageKey);
          if (!storedString) {
              console.log("No saved instances found.");
              return;
          }

          const decodedStoredInstances = atob(storedString);
          storedInstances = JSON.parse(decodedStoredInstances);
          console.log("Loaded saved instances: ", storedInstances);

          // replace to current sessions
          setSavedInstances(storedInstances);
        } else {
          // Too bad, no localStorage for us
        }
      }

      /**
         * save the current sessions to local storage
      */
      function storeInstances(savedInstances) {
        if (storageAvailable("localStorage")) {
          // Yippee! We can use localStorage awesomeness
          const savedInstancesJSON = JSON.stringify(savedInstances);
          const savedInstancesEncoded = btoa(savedInstancesJSON);
          localStorage.setItem(storageKey, savedInstancesEncoded);

          console.log("FORMAT BEING STORED:", savedInstancesJSON);
        } else {
          // Too bad, no localStorage for us
        }
    }

    function editInstanceName(instanceName){
      //open a prompt window asking what they want to change {instanceName} to, and also have a cancel button
      const newName = window.prompt("Enter a new name for the instance " + instanceName + ":");
      if(newName){
        const savedInstancesCopy = [...savedInstances];
        savedInstancesCopy.forEach(instance => {
          if(instance.name === instanceName){
            instance.name = newName;
            instance.graphics.forEach(graphic => {
                graphic.attributes.instance = newName
            })
          }
        })
        setSavedInstances(savedInstancesCopy);
        storeInstances(savedInstancesCopy);
      }
    }

    function validateUploadedString(uploadedString:string){
      //validate the uploaded file
      try {
        let decodedJSON = atob(uploadedString);
        const parsed = JSON.parse(decodedJSON);
        console.log("PARSED", parsed)
        //loop through the parsed object
        //check for duplicate instances
        let nonDuplicateInstances = []; 
        parsed.forEach(instance => {
          console.log("INSTANCE", instance)
          const duplicateInstances = savedInstances.filter(s => s.name === instance.name);
          if(duplicateInstances.length > 0){
            console.log("DUPLICATE INSTANCE", instance)
            const response = window.confirm(`The instance "${instance.name}" already exists, do you want to replace it?`);
            if(!response){
              return;
            }
          }
          nonDuplicateInstances.push(instance);
        });

        const newSavedInstances = [...savedInstances, ...nonDuplicateInstances];  
        setSavedInstances(newSavedInstances);
        storeInstances(newSavedInstances);
        
      } catch (err) {
        console.error("Invalid JSON input");
      }
    }
      

    const handleFileChange = (event) => {
      const file = event.target.files?.[0];
      if (file && file.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result;
          if (typeof text === 'string') {
            console.log(text)
            validateUploadedString(text)
            setFileContent(text);
          }
        };
        reader.readAsText(file);
      } else {
        alert("Please upload a valid .txt file.");
      }
    };

/**
 * Initiates a download of the saved instances as a text file.
 * The file is named using the provided instance name and the current date and time.
 * @param {string} instanceName - The name to prefix the downloaded file with.
 */

    const handleDownload = (instanceName, isAllInstances) => {

      let savedInstancesToDownload;
      if(isAllInstances){
        savedInstancesToDownload = savedInstances;
      } else {
        savedInstancesToDownload = [savedInstances.find(instance => instance.name === instanceName)];
      }
      const savedInstancesJSON = JSON.stringify(savedInstancesToDownload);
      const savedInstancesEncoded = btoa(savedInstancesJSON);
      const date = new Date();
      const formattedDate = `${date.toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}-${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      const filename = `${instanceName}-${formattedDate}.txt`;
  
      const blob = new Blob([savedInstancesEncoded], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
  
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
  
      URL.revokeObjectURL(url); // Clean up after download
    };




    /**
     * Removes all graphics from the map that have the specified instance name.
     * @param {string} instanceName - The name of the instance whose graphics are to be removed.
     */
    function removeInstanceGraphicsFromMap(instanceName){
      let existingGraphics = jimuMapView.view.graphics.filter(function(graphic){
        return graphic.attributes.instance === instanceName
      })
      jimuMapView.view.graphics.removeMany(existingGraphics)
    }

/**
 * Removes an instance and its associated graphics from the map.
 * Updates the saved instances list by filtering out the specified instance
 * and stores the updated list in local storage.
 * 
 * @param {string} instanceName - The name of the instance to be removed.
 */
    function removeInstance(instanceName){
      removeInstanceGraphicsFromMap(instanceName)
      const updatedSavedInstances = savedInstances.filter(instance => instance.name !== instanceName);
      setSavedInstances(updatedSavedInstances)
      storeInstances(updatedSavedInstances)
    }


    function renderSavedInstances(){
      console.log("RENDERING SAVED INSTANCES")
      if (savedInstances.length > 0) {
        console.log("LENGTH GREATER THAN 1",savedInstances)
        //for each instance, check if the webmapId matches the current map
        //Then display a <tr> displaying the name of each instance
        return (
          <div style={{display: 'flex', flexDirection: 'column', marginRight: '15px'}}>
            <table style={{borderCollapse: 'collapse', width: '100%'}}>
              <tbody>
                {savedInstances.map((instance, index) => (
                  <tr key={index} style={{background: index % 2 === 0 ? '#f2f2f2' : 'white'}}>
                    <td style={{padding: '8px', border: '1px solid #ddd', fontSize: '13px'}}>{instance.name}</td>
                    <td style={{padding: '8px', border: '1px solid #ddd'}}>
                      <button
                        style={{
                          background: '#4CAF50',
                          color: 'white',
                          padding: '2px 4px',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          console.log(savedInstances)
                          console.log(instance)
                          loadSession(instance)}}
                      >
                        <calcite-icon icon="overwrite-features" />
                      </button>
                    </td>
                    <td style={{padding: '8px', border: '1px solid #ddd'}}>
                      <button
                      style={{
                        background: 'none',
                        color: 'black',
                        padding: '2px 4px',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                      onClick={() => editInstanceName(instance.name)}
                      ><calcite-icon icon="edit-attributes" /></button>
                    </td>
                    <td style={{padding: '8px', border: '1px solid #ddd'}}>
                      <button
                      style={{
                        background: 'none',
                        color: 'black',
                        padding: '2px 4px',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleDownload(instance.name, false)}
                      ><calcite-icon icon="download" /></button>
                    </td>
                    <td style={{padding: '8px', border: '1px solid #ddd'}}>
                      <button
                      style={{
                        background: '#ADD8E6',
                        color: 'white',
                        padding: '2px 4px',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                      onClick={() => removeInstanceGraphicsFromMap(instance.name)}
                      ><calcite-icon icon="x-circle" /></button>
                    </td>
                    <td style={{padding: '8px', border: '1px solid #ddd'}}>
                      <button
                      style={{
                        background: 'red',
                        color: 'white',
                        padding: '2px 4px',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                      onClick={() => removeInstance(instance.name)}
                      ><calcite-icon icon="trash" /></button>
                    </td>


                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
    }
  }



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
      <p style={{}}> <strong>Save your current map instance</strong> </p>
      <div style={{display: 'flex', alignItems: 'center', marginBottom: '3px'}}>
        <label htmlFor="" style={{marginRight: '5px'}} >Instance Name:</label>
        <input type="text" onChange={(e) => setCurrentInstanceName(e.target.value)}/>
      </div>
            
      <button style={{marginBottom: '15px'}} onClick={() => {getSettingsForCurrentMap()}}>Save Instance</button>
      
      <hr />           

      <p style={{marginTop: '20px'}}> <strong>Saved Instances:</strong></p>

      <div>
         {renderSavedInstances()}
      </div> 

      <div style={{display: 'flex', alignItems: 'center', marginTop: '15px'}}>
        <button
          style={{ marginRight: '5px' }}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.txt';
            input.onchange = handleFileChange;
            input.click();
          }}
        >
          Upload Instances
        </button>
        <button style={{marginLeft: '5px'}} onClick={() => {handleDownload('allInstances', true)}}>Download Instances</button>
      </div>
    </div>
  )
}

export default Widget


