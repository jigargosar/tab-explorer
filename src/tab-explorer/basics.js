import mergeLeft from 'ramda/es/mergeLeft'
import { mapProp } from './safe-basics'

export const overProp = mapProp

export const mergeModel = m => mergeLeft({ [m.id]: m })

// BROWSER TASKS

export const getCache = key => localStorage.getItem(key)
export const setCache = key => value => localStorage.setItem(key, value)
