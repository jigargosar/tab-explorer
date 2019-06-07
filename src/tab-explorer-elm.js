import 'tachyons'
import './main.css'
import { Elm } from './TabExplorer.elm'

const app = Elm.TabExplorer.init({
  node: document.getElementById('root'),
})
boot(app)

const getCurrentPopulatedWindow = () => {
  return new Promise(resolve =>
    chrome.windows.getCurrent({ populate: true }, resolve),
  )
}

function sendCurrentWindowTabs(app) {
  const tabEvents = [
    chrome.tabs.onCreated,
    chrome.tabs.onUpdated,
    chrome.tabs.onAttached,
    chrome.tabs.onDetached,
    chrome.tabs.onReplaced,
    chrome.tabs.onRemoved,
  ]

  async function listener() {
    const win = await getCurrentPopulatedWindow()
    app.ports.onCurrentWindowTabsChanged.send(win.tabs)
  }

  tabEvents.forEach(event => event.addListener(listener))
}

function boot(app) {
  sendCurrentWindowTabs(app)
}
