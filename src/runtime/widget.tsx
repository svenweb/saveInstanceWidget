import { React, type AllWidgetProps } from 'jimu-core'
import { type IMConfig } from '../config' // Ensure that the '../config' module exists and is correctly named
import { JimuMapView, JimuMapViewComponent } from 'jimu-arcgis'
import { useEffect, useState } from 'react';
import Extent from 'esri/geometry/Extent';
import Graphic from "@arcgis/core/Graphic.js";
import Basemap from "@arcgis/core/Basemap.js";


const Widget = (props: AllWidgetProps<IMConfig>) => {

    const [jimuMapView, setJimuMapView] = useState(null);
    const [currentInstanceName, setCurrentInstanceName] = useState("");
    const storageKey = "saveInstanceWidgetSessions";
    
    const [showFunctionLegend, setShowFunctionLegend] = useState(false);

    // Esri color ramps - Blue 19
    // #00497cff,#0062a8ff,#007cd3ff,#00b7ffff
    const blue19Colors = ["#00497cff", "#0062a8ff", "#007cd3ff", "#00b7ffff"];



    const [savedInstances, setSavedInstances] = useState([]);



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

        if(currentInstanceName === ""){
          alert("Please enter an instance name")
          return null
        }

        //check if there is an instance with the same name as currentInstanceName
        const duplicateInstance = savedInstances.filter(s => s.name === currentInstanceName);
        console.log("DUPLICATE INSTANCE", duplicateInstance)
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
              var layerSettings,
                  layer

              for(layerSettings in settings) {
                  layer = jimuMapView.view.map.findLayerById(settings[layerSettings].id);
                  if (!layer) {
                     console.log("unable to find layer", settings[layerSettings].id);
                     continue;
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

              //set basemap
              if (sessionToLoad.basemap) {
                let newBaseMap = Basemap.fromJSON(sessionToLoad.basemap);
                jimuMapView.view.map.basemap = newBaseMap;
              }

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

    function validateUploadedString(uploadedString:string){
      //validate the uploaded file
      try {
        let decodedJSON = atob(uploadedString);
        const parsed = JSON.parse(decodedJSON);
        console.log("PARSED", parsed)
        
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
      

    const handleFileChange = (event) => {
      const file = event.target.files?.[0];
      if (file && file.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result;
          if (typeof text === 'string') {
            console.log(text)
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
          <div style={{display: 'flex', flexDirection: 'column', width: '90%', marginRight:'4%'}}>
            <table style={{borderCollapse: 'collapse'}}>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'center', backgroundColor: blue19Colors[1], color: 'white',  fontSize: '13px' }}>Name</td>
                  <td colSpan={5} style={{ textAlign: 'center', backgroundColor: blue19Colors[1], color: 'white', fontSize: '13px' }}>Functions <button style={{marginLeft:"3px",color:"white",backgroundColor: 'transparent', cursor: 'pointer', borderRadius: '50%', border: '1px solid white'}} onClick={() => setShowFunctionLegend(!showFunctionLegend)}>?</button></td>
                </tr>
                {savedInstances.map((instance, index) => (
                  <tr key={index} style={{background: index % 2 === 0 ? '#f2f2f2' : 'white'}}>
                    <td style={{padding: '0px', border: '1px solid #ddd', fontSize: '13px',  textAlign: 'center', color:blue19Colors[0]}}>{instance.name}</td>
                    <td style={{padding: '0px', textAlign: 'center', border: '1px solid #ddd'}}>
                      <button
                        style={{
                          color: 'black',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'inline-block',
                          backgroundColor: 'transparent'
                        }}
                        onClick={() => {
                          console.log(savedInstances)
                          console.log(instance)
                          loadSession(instance)}}
                        title="Load instance to map"
                        
                      >
                        <calcite-icon icon="overwrite-features" scale="s"/>
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


