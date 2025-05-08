import { React, type AllWidgetProps } from 'jimu-core'
import { type IMConfig } from '../config' // Ensure that the '../config' module exists and is correctly named
import { JimuMapView, JimuMapViewComponent } from 'jimu-arcgis'
import { useEffect, useState } from 'react';
import Extent from 'esri/geometry/Extent';
import Graphic from "@arcgis/core/Graphic.js";
import Basemap from "@arcgis/core/Basemap.js";
import { Loading } from 'jimu-ui'
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";



/**
 * @author Sven Jensen
 * @version 1.0.1
 * 
 * The Save Instance widget developed by Sven Jensen, 2025.
 */

const Widget = (props: AllWidgetProps<IMConfig>) => {

    const [jimuMapView, setJimuMapView] = useState(null);
    const [currentInstanceName, setCurrentInstanceName] = useState("");
    
    const [showFunctionLegend, setShowFunctionLegend] = useState(false);
    const [savedInstances, setSavedInstances] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(true);

    const [currentlyLoadingIndex, setCurrentlyLoadingIndex] = useState(-1);

      // Esri color ramps - Blue 19
    // #00497cff,#0062a8ff,#007cd3ff,#00b7ffff
    const blue19Colors = ["#00497cff", "#0062a8ff", "#007cd3ff", "#00b7ffff"];
    const storageKey = "saveInstanceWidgetInstances";



    useEffect(() => {
      loadSavedInstancesFromStorage();
    },[])

     /**
       * Description: Handles the change of the active view.
       * @param {type} jmv - The new active view
       * @return {void}
       */
      const activeViewChangeHandler = (jmv: JimuMapView) => {
        if (jmv) {

                  // Basic example of watching for changes on a boolean property
        reactiveUtils.watch(
          // getValue function
          () => jmv.view.updating,
          // callback
          (updating) => {
            if(updating){
              setIsLoading(true)
            }else{
              setIsLoading(false)
              setCurrentlyLoadingIndex(-1)
            }
          });

          setJimuMapView(jmv);
        }
      }; 


      //Get the name,webmapId,extent,layers,graphics
      //getMapInstanceData()
      /**
       * returns the instance object for the current map
       * @returns {Object} map settings for instance
       */
      const getSettingsForCurrentMap = async () => {        
        // if(isLoading){
        //   const shouldSave = window.confirm("The map is currently updating. Are you sure you want to save the current instance?");
        //   if(!shouldSave){
        //     return null
        //   }
        // }
        if (!jimuMapView) return null;


        if(currentInstanceName === ""){
          alert("Please enter an instance name")
          return null
        }

        //check if there is an instance with the same name as currentInstanceName
        const duplicateInstance = savedInstances.filter(s => s.name === currentInstanceName);
        if(duplicateInstance.length > 0){
          alert(`The instance "${currentInstanceName}" already exists, please choose another name`)
          return null
        }


        const settings = {
          name: currentInstanceName,
          webmapId: jimuMapView.view.map.portalItem.id,
          extent: jimuMapView.view.extent.toJSON(),
          layers: [],
          graphics: jimuMapView.view.graphics.toArray(),
          basemap: jimuMapView.view.map.basemap.toJSON()
        };

        let graphicsLayersGraphics;

        try {
          const layerSettings = await getLayerSettingsForCurrentMap();
          settings.layers = layerSettings[0];
          graphicsLayersGraphics = layerSettings[1];
        } catch (err) {
          console.error("An error occurred while getting the layers from the current map.", err);
        }

        settings.graphics = getGraphicsForCurrentMap(graphicsLayersGraphics);

        
        const updatedSavedInstances = [...savedInstances, settings];
        setSavedInstances(updatedSavedInstances);


        storeInstances(updatedSavedInstances);
        return settings;
      };


      /**
       * Collects all graphics from the current map view and the graphics layers.
       * @param {Array} graphicsLayersGraphics Graphics from the graphics layers.
       * @returns {Array} An array of graphics in JSON format.
       */
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
       * Retrieves a dictionary of all map layers, including sublayers for map-image layers.
       * 
       * @returns {Object} A dictionary where the keys are layer IDs and the values are the corresponding layers.
       *                   For layers of type "map-image", both the layer and its sublayers
       *                   are included in the dictionary.
       */
      function getListOfAllMapLayers(): Record<string, __esri.Layer> {
        const layerObjects = jimuMapView.view.map.allLayers.toArray();
        const layersDict: Record<string, __esri.Layer> = {};

        layerObjects.forEach((layer) => {
          // If the layer is of type "map-image", add it and its sublayers to the dictionary
          if (layer.type === "map-image" && "allSublayers" in layer) {
            layersDict[layer.id] = layer;
            layer.allSublayers.toArray().forEach((sublayer) => {
              layersDict[sublayer.id] = sublayer;
            });
          } else {
            layersDict[layer.id] = layer;
          }
        });

        return layersDict;
      }


      /**
       * Retrieves the settings for all layers in the current map view.
       * @returns {Promise<Array>} A promise that resolves to an array of layer settings.
       */
      const getLayerSettingsForCurrentMap = async () => {
        if (!jimuMapView) return [];

        let graphicsLayersGraphics = [];

        try {
          const layerObjects = getListOfAllMapLayers();
          const settings = Object.values(layerObjects).map((layer, idx) => {

            const layerSettings = getSettingsForLayer(layer);
            
            const layerSettingsObject = layerSettings[0];
            const isGraphicsLayer = layerSettings[1] as Boolean;
            const layerGraphicsJSON = layerSettings[2];
            
            if(isGraphicsLayer === true){ //If it is a graphics layer
              graphicsLayersGraphics.push(...layerGraphicsJSON); //add it's graphics to the list
            }
            layerSettingsObject.order = Number(layerObjects.length) - Number(idx);
            return layerSettingsObject;
          });

          return [settings, graphicsLayersGraphics];
        } catch (err) {
          console.error('SaveInstance error in getLayerSettingsForCurrentMap, error getting layersObjects  = ', err);
          return [];
        }
      };

/**
 * Retrieves settings for a specified layer.
 * @param {Object} layer - The layer object for which settings are to be retrieved.
 * @returns {Array} An array containing the layer settings object, a boolean indicating if the layer is a graphics layer, and an array of graphics in JSON format if applicable.
 */
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
            isGraphicsLayer = true
            layerGraphicsJSON = getGraphicsFromGraphicsLayer(layer)
            break;
          case "UnknownLayerType":
            layerSettings.options = getOptionsForUnknownLayer(layer);
            break;
          default:
            break;
        }

        return [layerSettings, isGraphicsLayer, layerGraphicsJSON ]
      };

      

      /**
       * Determines the type of the layer.
       * @param {Object} layer - the layer whose type is to be determined
       * @returns {string} the type of the layer
       */
      const getLayerType = (layer) => {
        if (layer.type === 'feature') return 'FeatureLayer';
        if (layer.type === 'tile') return 'TileLayer';
        if (layer.type === 'map-image') return 'MapImageLayer';
        if(layer.type === "group") return "GroupLayer";
        if(layer.type === "graphics") return "GraphicsLayer";
        return 'UnknownLayerType';
      };

      
      /**
       * Extracts all graphics from the given GraphicsLayer, and adds the current
       * instance name to the graphics' attributes.
       * @param {Object} layer - the GraphicsLayer from which to extract the graphics
       * @returns {Array} an array of graphics in JSON format
       */
      const getGraphicsFromGraphicsLayer = (layer) => {
        let layerGraphicsList = [];
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

      /**
       * Returns the options for an unknown layer type.
       * @param {Object} layer - the layer for which to generate the options
       * @returns {Object} the options for the layer
       */
      function getOptionsForUnknownLayer(layer) {
        const options = {
          id: layer.id,
          opacity: layer.opacity,
          visibleTimeExtent: layer.visibleTimeExtent,
        };
        return options;
      }

      /**
       * Returns the options for the given dynamic layer.
       * @param {Object} layer - the dynamic layer for which to generate the options
       * @returns {Object} the options for the dynamic layer
       */
      const getOptionsForDynamicLayer = (layer) => {
        const options = {
          opacity: layer.opacity,
          refreshInterval: layer.refreshInterval,
        };
      
        return options;
      };

      /**
       * Returns the options for the given feature layer.
       * @param {Object} layer - the feature layer for which to generate the options
       * @returns {Object} the options for the feature layer
       */
      const getOptionsForFeatureLayer = (layer) => {
        const options = {
          mode: layer.mode || 'on-demand',
          outFields: ["*"],
          opacity: layer.opacity,
          refreshInterval: layer.refreshInterval,
        };

        return options;
      };

      /**
       * Returns the options for the given tiled layer.
       * @param {Object} layer - the tiled layer for which to generate the options
       * @returns {Object} the options for the tiled layer
       */

      const getOptionsForTiledLayer = (layer) => {
        const options = {
          opacity: layer.opacity,
          refreshInterval: layer.refreshInterval,
        };

        return options;
      };

      
      /**
       * Returns the options for the given group layer.
       * @param {Object} layer - the group layer for which to generate the options
       * @returns {Object} the options for the group layer
       *
       * The options for the group layer are gathered from the layer's properties
       * and from the settings of the layers in it, which are gathered by calling
       * getSettingsForLayer() on each of them.
       */
      const getOptionsForGroupLayer = (layer) => {
        const options = {
          opacity: layer.opacity,
          refreshInterval: layer.refreshInterval,
        };
      
        return options;
      };


      

            /**
             * apply settings to layers
             * @param {Array} array of layer settings to apply to map
             */
            function setLayersOnMap(settings) {
              var layerSettings,
                  layer
              
              const allCurrentLayers = getListOfAllMapLayers();

              for(layerSettings in settings) {
                  layer = allCurrentLayers[settings[layerSettings].id];
                  if (!layer) {
                     console.log("unable to find layer", settings[layerSettings].id);
                     continue;
                  }
           
                  layer.visible = settings[layerSettings].isVisible;
                  for (let layerOption in settings[layerSettings].options) {
                    layer.layerOption = settings[layerSettings].options[layerOption];
                  }

                  }
              }


            /**
             * Apply graphics to the map.
             * @param {Array} graphics - An array of graphics in JSON format.
             * @param {string} instanceName - The name of the instance to which the graphics belong.
             * 
             * This function first removes any existing graphics with the same instance name.
             * Then it adds all the graphics in the graphics array.
             */
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
             * Apply the settings from the given instance to the current map
             * @param {Object} sessionToLoad a instance
             */
            function loadInstance(instanceToLoad, index) {
              setCurrentlyLoadingIndex(index)

            //set the current loading instance index to the one that is currently loading


              setIsSaving(true);
              
              // toggle layers
              if (instanceToLoad.layers) {
                setLayersOnMap(instanceToLoad.layers);
            }

              
              setGraphicsOnMap(instanceToLoad.graphics, instanceToLoad.name);

                
              // }
              let extentToLoad;

              //set basemap
              if (instanceToLoad.basemap) {
                let newBaseMap = Basemap.fromJSON(instanceToLoad.basemap);
                jimuMapView.view.map.basemap = newBaseMap;
              }

              //  zoom the map
              if (instanceToLoad.extent) {
                  extentToLoad = Extent.fromJSON(instanceToLoad.extent);
                  jimuMapView.view.goTo(extentToLoad);
              }        
          }
        

/**
 * Checks if the given type of web storage is available and functional.
 * Attempts to set and remove an item to verify storage capabilities.
 *
 * @param {string} type - The type of storage to check, e.g., "localStorage" or "sessionStorage".
 * @returns {boolean} - True if storage is available and can be used, false otherwise.
 */

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
 * Loads saved instances from local storage.
 * If local storage is available, retrieves, decodes, and parses the saved instances JSON string.
 * Updates the current instances with the retrieved saved instances.
 * Logs a message if no saved instances are found.
 * 
 * Requires the 'storageAvailable' function to check local storage availability
 * and the 'setSavedInstances' function to update the current instances.
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

          // replace to current instances
          setSavedInstances(storedInstances);
        } else {
          // Too bad, no localStorage for us
        }
      }

      /**
         * save the current instances to local storage
      */
      function storeInstances(savedInstances) {
        if (storageAvailable("localStorage")) {
          // Yippee! We can use localStorage awesomeness
          const savedInstancesJSON = JSON.stringify(savedInstances);
          const savedInstancesEncoded = btoa(savedInstancesJSON);
          localStorage.setItem(storageKey, savedInstancesEncoded);

        } else {
          // Too bad, no localStorage for us
        }
    }

  /**
   * Edit the name of an instance
   * @param {string} instanceName - the name of the instance to be edited
   */
    function editInstanceName(instanceName){
      //open a prompt window asking what they want to change {instanceName} to, and also have a cancel button
      const newName = window.prompt("Enter a new name for the instance " + instanceName + ":");
      if(newName){
        //check that the new name is not already in use
        const duplicateInstances = savedInstances.filter(s => s.name === newName);
        if(duplicateInstances.length > 0){
          alert(`The instance "${newName}" already exists, please choose another name`)
          return
        }

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

    
  /**
   * Validate the uploaded file. If the uploaded file is valid JSON, it will
   * be parsed and each instance will be added to the saved instances list.
   * If an instance with the same name already exists, the user will be
   * prompted to replace it.
   * @param {string} uploadedString The uploaded file as a string.
   */
    function validateUploadedString(uploadedString:string){
      //validate the uploaded file
      try {
        let decodedJSON = atob(uploadedString);
        const parsed = JSON.parse(decodedJSON);
        
        const savedInstancesMap = new Map(savedInstances.map(inst => [inst.name, inst]));

        parsed.forEach(newInstance => {
          if (savedInstancesMap.has(newInstance.name)) {
            const replace = window.confirm(`The instance "${newInstance.name}" already exists. Do you want to replace it?`);
            if (replace) {
              savedInstancesMap.set(newInstance.name, newInstance);
            } else {
              console.log(`User cancelled replacing "${newInstance.name}"`);
            }
          } else {
            savedInstancesMap.set(newInstance.name, newInstance);
          }
        });
        
       
        const updatedSavedInstances = Array.from(savedInstancesMap.values());
        setSavedInstances(updatedSavedInstances);
        storeInstances(updatedSavedInstances);
        
      } catch (err) {
        console.error("Invalid JSON input");
      }
    }
      

/**
 * Handles the file input change event. If a valid text file is uploaded,
 * it reads the file content and validates it. If the file is not a valid
 * text file, an alert is shown to the user.
 * 
 * @param {Event} event - The file input change event.
 */

    const handleFileChange = (event) => {
      setIsSaving(true);
      const file = event.target.files?.[0];
      if (file && file.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result;
          if (typeof text === 'string') {
            validateUploadedString(text)
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

      if(savedInstances.length === 0){
        alert("There are no saved instances to download.")
        return
      }

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
      //prompt user if they are sure they want to remove the instance
      const shouldRemove = window.confirm(`Are you sure you want to remove the instance "${instanceName}"?`);
      if (!shouldRemove) {
        return
      }

      removeInstanceGraphicsFromMap(instanceName)
      const updatedSavedInstances = savedInstances.filter(instance => instance.name !== instanceName);
      setSavedInstances(updatedSavedInstances)
      storeInstances(updatedSavedInstances)
    }

    


    /**
     * Render the list of saved instances as a table.
     * Each instance is rendered as a table row with buttons to:
     * - load the instance to the map
     * - edit the instance name
     * - download the instance
     * - clear the instance graphics from the map
     * - delete the instance
     *
     * If there are no saved instances, nothing is rendered.
     */
    function renderSavedInstances(){
      if (savedInstances.length > 0) {

        return (
          <div style={{display: 'flex', flexDirection: 'column', width: '90%', marginRight:'4%'}}>
            <table style={{borderCollapse: 'collapse'}}>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'center', backgroundColor: blue19Colors[1], color: 'white',  fontSize: '13px' }}>Name</td>
                  <td colSpan={5} style={{ textAlign: 'center', backgroundColor: blue19Colors[1], color: 'white', fontSize: '13px' }}>Functions <button style={{marginLeft:"3px",color:"white",backgroundColor: 'transparent', cursor: 'pointer', borderRadius: '50%', border: '1px solid white'}} 
                  onClick={() => setShowFunctionLegend(!showFunctionLegend)}>?</button></td>
                </tr>
                {savedInstances.map((instance, index) => (
                  <tr key={index} style={{background: index % 2 === 0 ? '#f2f2f2' : 'white'}}>
                    <td style={{padding: '0px', border: '1px solid #ddd', fontSize: '13px',  textAlign: 'center', color:blue19Colors[0]}}>{instance.name}</td>
                    <td style={{padding: '0px', textAlign: 'center', border: '1px solid #ddd', position: 'relative'}}>
                      <button
                      style={{
                        color: 'black',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-block',
                        backgroundColor: 'transparent',
                        position: 'relative',
                        zIndex: 1
                      }}
                      onClick={() => {
                        loadInstance(instance, index)}}
                      title="Load instance to map"
                      >
                      {index === currentlyLoadingIndex ? <Loading type="PRIMARY" height={15} width={15} style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)'}} /> : <calcite-icon icon="overwrite-features" scale="s"/>}
                      </button>
                    </td>
                    <td style={{ border: '1px solid #ddd',textAlign: 'center'}}>
                      <button
                      style={{
                        color: 'black',
                        cursor: 'pointer',
                        border: 'none',
                        backgroundColor: 'transparent'
                      }}
                      onClick={() => editInstanceName(instance.name)}
                      title="Edit instance name"
                      ><calcite-icon icon="edit-attributes" scale="s"/></button>
                    </td>
                    <td style={{border: '1px solid #ddd',  textAlign: 'center'}}>
                      <button
                      style={{
                        color: 'black',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        backgroundColor: 'transparent'
                      }}
                      onClick={() => handleDownload(instance.name, false)}
                      title="Download instance"
                      ><calcite-icon icon="download" scale="s"/></button>
                    </td>
                    <td style={{ border: '1px solid #ddd',  textAlign: 'center'}}>
                      <button
                      style={{
                        color: 'black',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        backgroundColor: 'transparent'
                      }}
                      onClick={() => removeInstanceGraphicsFromMap(instance.name)}
                      title="Clear instance graphics from map"
                      ><calcite-icon icon="x-circle" scale="s"/></button>
                    </td>
                    <td style={{ border: '1px solid #ddd',  textAlign: 'center'}}>
                      <button
                      style={{
                        color: 'black',
                        cursor: 'pointer',
                        border: 'none',
                        backgroundColor: 'transparent'
                      }}
                      onClick={() => removeInstance(instance.name)}
                      title="Delete instance"
                      ><calcite-icon icon="trash" scale="s"/></button>
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
    <div className="widget-demo jimu-widget m-2 overflow-auto" style={{overflowY: 'scroll', scrollbarWidth: 'none'}}>
              {/* Loading Overlay */}
      {/** isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(128, 128, 128, 0.7)', // Grey overlay
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <Loading />
        </div>
      )*/}
        {props.hasOwnProperty("useMapWidgetIds") &&
                    props.useMapWidgetIds &&
                    props.useMapWidgetIds.length == 1 && (
                      <JimuMapViewComponent
                        useMapWidgetId={props.useMapWidgetIds?.[0]}
                        onActiveViewChange={activeViewChangeHandler}
                      />
                    )}
      <p style={{fontSize: '14px', color:blue19Colors[0]}}> <strong>Save your current map instance:</strong> </p>
      <div style={{display: 'flex', alignItems: 'center', marginBottom: '5px'}}>
        <label htmlFor="" style={{marginRight: '5px', fontSize: '13px', lineHeight: '1.5', color: blue19Colors[0]}} >Instance Name:</label>
        <input type="text" onChange={(e) => setCurrentInstanceName(e.target.value)} style={{alignSelf: 'center', border: '1px solid', padding: '2px', borderColor: blue19Colors[3]}}/>
      </div>
            
      <button style={{marginBottom: '15px', marginTop: '5px', background:(currentInstanceName.length > 0) ? blue19Colors[1]:'grey', color: 'white', padding: '4px 8px', border: 'none',cursor: 'pointer'}}
      onClick={() => {getSettingsForCurrentMap()}}><strong>Save Instance</strong></button>
      
      <hr style={{borderColor: blue19Colors[3], marginRight: '15px'}}/>           

      <p style={{marginTop: '20px', fontSize: '14px', color:blue19Colors[0]}}> <strong>Saved Instances:</strong></p>
      
      <div style={{display: showFunctionLegend ? 'flex' : 'none', justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: '15px'}}>
        <table style={{ backgroundColor: 'lightgrey', padding:"15px"}}>
        <tr>
            <td style={{ textAlign: 'center', backgroundColor: blue19Colors[2], color: 'white',  fontSize: '13px' }}>Symbol</td>
            <td colSpan={5} style={{ textAlign: 'center', backgroundColor: blue19Colors[2], color: 'white', fontSize: '13px' }}>Function Description</td>
            <td style={{textAlign: 'right', paddingRight: '5px', backgroundColor: 'red'}}>
              <button style={{backgroundColor:'transparent',color: 'white', padding: '2px 5px', border: 'none', cursor: 'pointer'}}
              title="Close"
              onClick={() => setShowFunctionLegend(false)}
              >X</button></td>
          </tr>
          <tr>
            <td style={{textAlign: 'center'}}><calcite-icon icon="overwrite-features" scale="l"/></td>
            <td> Load instance to map</td>
          </tr>
          <tr >
            <td style={{textAlign: 'center'}}><calcite-icon icon="edit-attributes" scale="l"/></td>
            <td> Edit instance name</td>
          </tr>
          <tr style={{padding:"5px"}}>
            <td style={{textAlign: 'center'}}><calcite-icon icon="download" scale="l"/></td>
            <td> Download instance</td>
          </tr>
          <tr style={{padding:"5px"}}>
            <td style={{textAlign: 'center'}}><calcite-icon icon="x-circle" scale="l"/></td>
            <td> Clear instance graphics from map</td>
          </tr>
          <tr style={{padding:"5px"}}>
            <td style={{textAlign: 'center'}}> <calcite-icon icon="trash" scale="l"/></td>
            <td> Delete instance</td>
          </tr>
        </table>
      </div>

      <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%'}}>
         {renderSavedInstances()}
      </div> 

      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '10%', marginBottom: '15px', width: '100%'}}>
        <button
          style={{ marginRight: '10%', background:blue19Colors[1], color: 'white', padding: '4px 8px', border: 'none',cursor: 'pointer'}}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.txt';
            input.onchange = handleFileChange;
            input.click();
          }}
        >
          <strong>Upload Instances</strong>
        </button>
        <button 
        style={{marginLeft: '10%', marginRight:"5%",background:(savedInstances.length > 0) ? blue19Colors[1]:'grey', color: 'white', padding: '4px 8px', border: 'none',cursor: 'pointer'}}
        onClick={() => {handleDownload('allInstances', true)}}><strong>Download Instances</strong></button>
      </div>
    </div>
  )
}

export default Widget



