

import {
  AllDataSourceTypes,
  DataSourceComponent,
  Immutable,
  React,
  UseDataSource,
} from "jimu-core";
import { IMConfig } from "../config";

import { AllWidgetSettingProps } from "jimu-for-builder";
import { MapWidgetSelector, SettingRow, SettingSection } from "jimu-ui/advanced/setting-components";
import { useState } from "react";
import { DataSourceSelector } from "jimu-ui/advanced/data-source-selector";


function Setting(props: AllWidgetSettingProps<IMConfig>) {
  
const onMapWidgetSelected = (useMapWidgetIds: string[]) => {
  props.onSettingChange({
    id: props.id,
    useMapWidgetIds: useMapWidgetIds,
  });
};

/**
 * Description: Updates the feature layer datasource in the config props
 * @param useDataSources - Datasource for the feature layer
 */
const onDataSourceChange = (useDataSources: UseDataSource[]) => {
  props.onSettingChange({
    id: props.id,
    useDataSources: useDataSources,
  });
};
/**
 * Description: Toggles the use of the datasource in the config props
 * @param useDataSourcesEnabled - boolean that determines if the datasource is enabled
 */
const onToggleUseDataEnabled = (useDataSourcesEnabled: boolean) => {
  props.onSettingChange({
    id: props.id,
    useDataSourcesEnabled,
  });
};

  return (
    <div>
    <SettingSection>
      <label htmlFor="">Select a Map</label>
     
      <SettingRow>
        <MapWidgetSelector
          onSelect={onMapWidgetSelected}
          useMapWidgetIds={props.useMapWidgetIds}
        />
      </SettingRow>
      </SettingSection>
      </div>
  )

}

export default Setting;