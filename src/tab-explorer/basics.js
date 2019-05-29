import mergeLeft from 'ramda/es/mergeLeft'
import { invariant, isString, notNil as isNotNil } from './safe-basics'

export const mergeModel = m => mergeLeft({ [m.id]: m })

// BROWSER TASKS

export const getCache = key => {
  invariant(isString(key))
  return localStorage.getItem(key)
}
export const setCache = key => value => {
  invariant(isString(key))
  invariant(isNotNil(value))

  return localStorage.setItem(key, value)
}
