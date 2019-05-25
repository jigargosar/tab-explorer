/* eslint-disable no-console */
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  createContext,
  useContext,
} from 'react'
import { render } from 'react-dom'
import 'tachyons'
import './main.css'
import mergeLeft from 'ramda/es/mergeLeft'
import compose from 'ramda/es/compose'
import pipe from 'ramda/es/pipe'
import map from 'ramda/es/map'
import over from 'ramda/es/over'
import lensProp from 'ramda/es/lensProp'
import nanoid from 'nanoid'
import prop from 'ramda/es/prop'
import reject from 'ramda/es/reject'
import startsWith from 'ramda/es/startsWith'
import propSatisfies from 'ramda/es/propSatisfies'
import values from 'ramda/es/values'
import sortWith from 'ramda/es/sortWith'
import descend from 'ramda/es/descend'
import mergeDeepRight from 'ramda/es/mergeDeepRight'
import defaultTo from 'ramda/es/defaultTo'
import omit from 'ramda/es/omit'

console.log('tab-explorer.js loaded')

// BASICS

const overProp = pipe(
  lensProp,
  over,
)
const mergeModel = m => mergeLeft({ [m.id]: m })

// BROWSER TASKS

const getCache = key => localStorage.getItem(key)
const setCache = key => value => localStorage.setItem(key, value)

// CHROME API

const pageUrl = chrome.runtime.getURL('tab-explorer.html')
console.log('pageUrl', pageUrl)

const defaultFavIconUrl =
  //#region
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAARklEQVR4Xu3M0QkAIAzE0M7pNN1cBwhFDkUFL/l/8VatF6cAiASBEs0VIEFoQAQIFQChAiBUAIQC8JMA+wUwYMDA/O3A/QbXNAnXAnMZWQAAAABJRU5ErkJggg=='
//#endregion

const getPopulatedWindow = () => {
  return new Promise(resolve =>
    chrome.windows.getCurrent({ populate: true }, resolve),
  )
}

// const getCurrentTab = () =>
//   new Promise(resolve => chrome.tabs.getCurrent(resolve))

const closeTabs = tabIds => {
  return new Promise(resolve => chrome.tabs.remove(tabIds, resolve))
}

const openTab = tab => {
  chrome.tabs.create({ url: tab.url, active: false })
}

const openTabs = tabs => {
  tabs.forEach(openTab)
}

// HOOKS & MODEL

const useListener = (event, listener, deps) => {
  const callback = useCallback(listener, deps)
  useEffect(() => {
    event.addListener(callback)
    return () => event.removeListener(callback)
  }, deps)
}

const useCurrentWindowTabs = () => {
  const [tabs, setTabs] = useState([])

  const updateCurrentTabs = useCallback(async () => {
    const win = await getPopulatedWindow()
    setTabs(win.tabs)
  }, [setTabs])

  useEffect(() => console.log('current window tabs changed', tabs), [tabs])

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
    useListener(e, updateCurrentTabs, [updateCurrentTabs]),
  )

  return tabs
}

const loadCachedState = () => {
  const defaultState = { sessions: {} }
  const decodeCached = pipe(
    getCache,
    defaultTo('{}'),
    JSON.parse,
    mergeDeepRight(defaultState),
  )

  return decodeCached('te-app-state')
}

const useCacheStateEffect = state => {
  return useEffect(
    () => setCache('te-app-state')(JSON.stringify(state, null, 2)),
    [state],
  )
}

function useOpenTabsList() {
  const windowTabs = useCurrentWindowTabs()
  return reject(propSatisfies(startsWith(pageUrl))('url'))(windowTabs)
}

function sessionFromTabs(tabs) {
  const session = {
    id: 'S_' + nanoid(),
    createdAt: Date.now(),
    tabs: tabs,
  }
  console.log('session :', session)
  return session
}

function createAndAddSessionFromTabs(otherTabs, setState) {
  const session = sessionFromTabs(otherTabs)
  setState(overProp('sessions')(mergeModel(session)))
}

function useActions(setState) {
  const overStateProp = prop => fn => setState(overProp(prop)(fn))
  const overSessions = overStateProp('sessions')

  return useMemo(
    () => ({
      saveSession: otherTabs => {
        createAndAddSessionFromTabs(otherTabs, setState)
      },
      saveSessionAndCloseTabs: async otherTabs => {
        createAndAddSessionFromTabs(otherTabs, setState)
        await closeTabs(otherTabs.map(prop('id')))
      },
      onOpenTabsListItemClicked: tab => {
        chrome.tabs.update(tab.id, { active: true }, updatedTab =>
          console.log('tab updated', updatedTab),
        )
      },
      onSessionTabsListItemClicked: tab => {
        openTab(tab)
      },
      deleteSessionWithId: id => {
        overSessions(omit([id]))
      },
      addNewSessionFromTabs: tabs => {
        const session = sessionFromTabs(tabs)
        overSessions(mergeModel(session))
      },
    }),
    [setState],
  )
}

const AC = createContext()

function useAppActions() {
  return useContext(AC)
}

function useAppState() {
  const [state, setState] = useState(loadCachedState)
  useCacheStateEffect(state)
  useEffect(() => console.log('state changed', state), [state])
  const actions = useActions(setState)
  return [state, actions]
}

// VIEW

const App = () => {
  const [state, actions] = useAppState()

  const displaySessions = compose(
    sortWith([descend(prop('createdAt'))]),
    values,
  )(state.sessions)

  const renderSessionItem = session => {
    return <SessionItem key={session.id} {...{ session }} />
  }

  return (
    <AC.Provider value={actions}>
      <div className="pa3">
        <div className="lh-copy f3">Tab Explorer</div>
        <div className="pv1" />
        <OpenTabs />
        <div className="pv2" />
        <div className="pv1 ttu tracked b">Collections</div>
        <div className="pv1" />
        <div>{map(renderSessionItem)(displaySessions)}</div>
      </div>
    </AC.Provider>
  )
}

function OpenTabs() {
  const actions = useAppActions()
  const tabs = useOpenTabsList()

  const viewBtn = (label, onClick) => (
    <button className="" onClick={onClick}>
      {label}
    </button>
  )
  const viewToolbar = (
    <div className="pv1 flex items-center">
      <div className="ph2">Open Tabs</div>
      <div className="ph1" />
      {viewBtn('Save Session', () => actions.saveSession(tabs))}
      <div className="ph1" />
      {viewBtn('Save And Close Session', () =>
        actions.saveSessionAndCloseTabs(tabs),
      )}
    </div>
  )

  function TabListItem({ tab }) {
    return (
      <div
        className="pv1 pointer flex items-center "
        onClick={() => actions.onOpenTabsListItemClicked(tab)}
      >
        <div className="ph1" />
        <img
          className=""
          src={tab.favIconUrl || defaultFavIconUrl}
          width={24}
          height={24}
        />
        <div className="ph1" />
        <div>{tab.title}</div>
      </div>
    )
  }

  const viewTabItem = tab => <TabListItem key={tab.id} tab={tab} />
  const viewTabList = <div className="pv1">{map(viewTabItem)(tabs)}</div>
  return (
    <div className="">
      {viewToolbar}
      {viewTabList}
    </div>
  )
}

function SessionItem({ session }) {
  const actions = useAppActions()
  const renderTabItem = tab => <SessionTabItem key={tab.id} tab={tab} />
  return (
    <div className="pv2">
      <div className="pv1 flex items-center">
        <div className="pv1 b">TS: {session.createdAt}</div>
        <div className="ph1" />
        <button
          className="ttu f7"
          onClick={() => actions.deleteSessionWithId(session.id)}
        >
          Delete
        </button>
        <div className="ph1" />
        <button
          className="ttu f7"
          disabled={session.tabs.length === 0}
          onClick={() => openTabs(session.tabs)}
        >
          Open {session.tabs.length} tabs
        </button>
        <div className="ph1" />
      </div>
      {map(renderTabItem)(session.tabs)}
    </div>
  )
}

function SessionTabItem({ tab }) {
  return (
    <div className="lh-copy flex ">
      <div className="pa1 flex items-center">
        <img
          src={tab.favIconUrl || defaultFavIconUrl}
          width={24}
          height={24}
        />
      </div>
      <div className=" ph1 flex-auto flex items-center">{tab.title}</div>
    </div>
  )
}

// MAIN

//#region ALT IMP

// const Cmd = {
//   batch: (...l) => l,
//   none: [],
// }

// function useStateRef(init) {
//   const [state, setState] = useState(init)

//   const stateRef = useRef(state)

//   const setStateRef = useCallback(
//     stateOrFn => {
//       stateRef.current = is(Function)(stateOrFn)
//         ? stateOrFn(stateRef.current)
//         : stateOrFn

//       setState(stateRef.current)
//     },
//     [setState, stateRef],
//   )

//   return [stateRef, setStateRef]
// }

// function App({ flags, init, update, view }) {
//   const [initialModel, initialCmd] = useMemo(() => init(flags), [])

//   function runCmd(cmd) {
//     console.log('cmd', cmd)
//   }

//   useEffect(() => {
//     console.log('initialModel', initialModel)
//     runCmd(initialCmd)
//   }, [initialModel, initialCmd])

//   const [modelRef, setModel] = useStateRef(initialModel)

//   function send(kind, args) {
//     const msg = { kind, args }
//     const [model, cmd] = update(msg, modelRef.current)
//     setModel(model)
//     runCmd(cmd)
//   }

//   return view(modelRef.current, send)
// }

// function init(/* flags */) {
//   return [{ type: 'LOADING' }, Cmd.none]
// }

// function update(msg, model) {
//   if (msg.kind === 'CycleState') {
//     const nextTypeMap = {
//       LOADING: 'SUCCESS',
//       SUCCESS: 'REFRESHING',
//       REFRESHING: 'LOADING',
//     }
//     return [assoc('type')(nextTypeMap[model.type])(model), Cmd.none]
//   } else {
//     return [model, Cmd.none]
//   }
// }

// function view(model, send) {
//   return (
//     <div>
//       <div>HW</div>
//       <div onClick={() => send('CycleState')}>
//         {JSON.stringify(model.type)}
//       </div>
//     </div>
//   )
// }

// render(
//   <App flags={{}} init={init} update={update} view={view} />,
//   document.getElementById('root'),
// )

//#endregion

render(<App />, document.getElementById('root1'))
