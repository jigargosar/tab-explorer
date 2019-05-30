/* eslint-disable no-console */
import { useState, useEffect, useCallback } from 'react'

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

export const useCurrentWindowTabs = () => {
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
