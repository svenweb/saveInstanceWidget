import { type ImmutableObject } from 'seamless-immutable'

export interface Config {
  savedInstancesToString: string,
}

export type IMConfig = ImmutableObject<Config>
