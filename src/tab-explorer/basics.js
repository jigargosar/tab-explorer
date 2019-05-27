import pipe from 'ramda/es/pipe'
import lensProp from 'ramda/es/lensProp'
import over from 'ramda/es/over'
import mergeLeft from 'ramda/es/mergeLeft'

export const overProp = pipe(
  lensProp,
  over,
)
export const mergeModel = m => mergeLeft({ [m.id]: m })

// BROWSER TASKS

export const getCache = key => localStorage.getItem(key)
export const setCache = key => value => localStorage.setItem(key, value)
