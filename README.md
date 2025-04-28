# Save Instance Widget for Experience Builder
Inspired by the Save Session Widget for WebAppBuilder, the Save Instance Widget allows ExB users to save and share the extent, layer settings, basemap, graphics and more from their web map instance.

## Installation
Visit the [JensenGIS](https://jensengis.com) website to download the latest compiled Save Instance Widget.

## Setup
After downloading the compiled Save Instance Widget follow the [instructions](https://doc.arcgis.com/en/experience-builder/11.0/configure-widgets/add-custom-widgets.htm) from ESRI.

Once you have the widget registered and in your /widgets folder. You can find the widget in the custom widgets section at the bottom of the Insert Widget tab in Experience Builder.

Then drag the Save Instance widget to your widget toolbar, and then configure the settings of the widget by Selecting a map for the widget to interact with.

That's it.

## Usage

### Saving an Instance
Input a name for the instance and click the **Save Instance** button
![Name and save an Instance](/your-extensions/widgets/saveInstance/images/instanceName.png)

### Loading Instances
After naming and saving an instance, click the **Load Instance** button to load the instance to the map.
![load instance to map](/your-extensions/widgets/saveInstance/images/instanceLoad.png)

### Edit Instance Name
Click the **Edit Instance Name** button and enter the new name for the instance in the prompt.
![Edit instance name](/your-extensions/widgets/saveInstance/images/instanceRename.png)

### Download Instance
Click the **Download Instance** button and a .txt file will be downloaded with that specific instance.
![load instance to map](/your-extensions/widgets/saveInstance/images/instanceDownload.png)
Or download all instances by clicking the **Download Instances** button in the bottom left.

### Clear Instance Graphics
Click the **Clear Instance Graphics** button, if there are any graphics associated with that instance name on the map they will be removed from the jimuMapView.map.view.graphics object.
![load instance to map](/your-extensions/widgets/saveInstance/images/instanceClearGraphics.png)

### Delete Instance
Click the **Delete Instance** button and the instance will be removed.
![load instance to map](/your-extensions/widgets/saveInstance/images/instanceDelete.png)



## Sharing Instances
Once you have downloaded an instance or instances, you can simply send the .txt file to whom you would to share the instances to. They can use the **Upload Instances** button in the bottom left to upload the .txt file.

In the future I would like to implement cloud storage of instances, if there is enough support.





## Contributing

#### Any requests for new features please submit an issue or an comment on the Esri Community

