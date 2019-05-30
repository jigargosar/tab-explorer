/* eslint-disable no-console */
import { useState, useEffect, useCallback } from 'react'
import reject from 'ramda/es/reject'
import propSatisfies from 'ramda/es/propSatisfies'
import startsWith from 'ramda/es/startsWith'

const getCurrentPopulatedWindow = () => {
  return new Promise(resolve =>
    chrome.windows.getCurrent({ populate: true }, resolve),
  )
}

export const closeTabs = tabIds => {
  return new Promise(resolve => chrome.tabs.remove(tabIds, resolve))
}

export const createTab = tab => {
  return new Promise(resolve =>
    chrome.tabs.create({ url: tab.url, active: false }, resolve),
  )
}

const useChromeEventListener = (event, listener, deps) => {
  const callback = useCallback(listener, deps)
  useEffect(() => {
    event.addListener(callback)
    return () => event.removeListener(callback)
  }, deps)
}

export function activateTabWithId(id) {
  chrome.tabs.update(id, { active: true }, updatedTab =>
    console.log('tab updated', updatedTab),
  )
}

const useCurrentWindowTabs = () => {
  const [tabs, setTabs] = useState([])

  const updateCurrentTabs = useCallback(async () => {
    const win = await getCurrentPopulatedWindow()
    setTabs(win.tabs)
  }, [setTabs])

  // useEffect(() => console.log('current window tabs changed', tabs), [tabs])

  useEffect(() => void updateCurrentTabs(), [])

  const events = [
    chrome.tabs.onCreated,
    chrome.tabs.onUpdated,
    chrome.tabs.onAttached,
    chrome.tabs.onDetached,
    chrome.tabs.onReplaced,
    chrome.tabs.onRemoved,
  ]

  events.forEach(e =>
    useChromeEventListener(e, updateCurrentTabs, [updateCurrentTabs]),
  )

  return tabs
}

export function useFilteredOpenTabsList() {
  const pageUrl = chrome.runtime.getURL('tab-explorer.html')
  const windowTabs = useCurrentWindowTabs()
  return reject(propSatisfies(startsWith(pageUrl))('url'))(windowTabs)
}
