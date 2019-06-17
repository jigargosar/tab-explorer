port module TabExplorer exposing (main)

import Array
import Browser
import Compare
import Dict exposing (Dict)
import Html exposing (..)
import Html.Attributes exposing (checked, class, disabled, type_)
import Html.Events exposing (onCheck, onClick)
import Json.Decode as JD exposing (Decoder)
import Json.Decode.Pipeline exposing (custom, optional, required)
import Json.Encode as JE exposing (Value)
import Random exposing (Generator, Seed)
import Random.Char
import Task
import Time exposing (Posix)



-- PORTS


port onCurrentWindowTabsChanged : (JE.Value -> msg) -> Sub msg


port createTab : { url : String, active : Bool } -> Cmd msg


port updateTab : ( Int, { active : Bool } ) -> Cmd msg


port onPouchSessionsChanged : (JE.Value -> msg) -> Sub msg


port persistSessionList : Value -> Cmd msg


port onPersistSessionListResponse : (Value -> msg) -> Sub msg



-- TAB MODEL


type alias Tab =
    { id : Int
    , title : String
    , url : String
    , favIconUrl : Maybe String
    }


tabEncoder : Tab -> Value
tabEncoder tab =
    JE.object
        [ ( "id", JE.int tab.id )
        , ( "title", JE.string tab.title )
        , ( "url", JE.string tab.url )
        , ( "favIconUrl"
          , tab.favIconUrl
                |> Maybe.map JE.string
                |> Maybe.withDefault JE.null
          )
        ]


tabDecoder : Decoder Tab
tabDecoder =
    JD.map4 Tab
        (JD.field "id" JD.int)
        (JD.field "title" JD.string)
        (JD.field "url" JD.string)
        (JD.maybe <| JD.field "favIconUrl" JD.string)



-- SESSION MODEL


type alias Session =
    { id : String
    , rev : String
    , title : String
    , createdAt : Int
    , modifiedAt : Int
    , deleted : Bool
    , tabs : List Tab
    , pinned : Bool
    , collapsed : Bool
    }


sessionGenerator : List Tab -> Posix -> Generator Session
sessionGenerator tabs now =
    Random.map (\id -> createNewSession tabs id now)
        idGenerator


createNewSession : List Tab -> String -> Posix -> Session
createNewSession tabs id posix =
    let
        ts =
            Time.posixToMillis posix
    in
    { id = id
    , rev = ""
    , title = ""
    , createdAt = ts
    , modifiedAt = ts
    , deleted = False
    , tabs = tabs
    , pinned = False
    , collapsed = False
    }


idGenerator : Generator String
idGenerator =
    let
        digits =
            "0123456789"

        upperCaseLetters =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

        lowerCaseLetters =
            upperCaseLetters |> String.toLower

        idChars =
            digits
                ++ upperCaseLetters
                ++ lowerCaseLetters
                |> String.toList
                |> Array.fromList

        maxIdx =
            Array.length idChars - 1

        idCharGenerator : Generator Char
        idCharGenerator =
            Random.int 0 maxIdx
                |> Random.map
                    (\idx ->
                        Array.get idx idChars
                            |> Maybe.withDefault '0'
                    )
    in
    Random.list 16 idCharGenerator
        |> Random.map String.fromList


sessionDecoder : Decoder Session
sessionDecoder =
    let
        sessionIdDecoder =
            JD.oneOf
                [ JD.field "_id" JD.string
                , JD.field "id" JD.string
                ]
    in
    JD.succeed Session
        |> custom sessionIdDecoder
        |> optional "_rev" JD.string ""
        |> optional "title" JD.string ""
        |> required "createdAt" JD.int
        |> required "modifiedAt" JD.int
        |> optional "deleted" JD.bool False
        |> required "tabs" (JD.list tabDecoder)
        |> optional "pinned" JD.bool False
        |> optional "collapsed" JD.bool False


sessionEncoder : Session -> Value
sessionEncoder session =
    JE.object
        [ ( "_id", JE.string session.id )
        , ( "_rev", JE.string session.rev )
        , ( "title", JE.string session.title )
        , ( "createdAt", JE.int session.createdAt )
        , ( "modifiedAt", JE.int session.modifiedAt )
        , ( "deleted", JE.bool session.deleted )
        , ( "tabs", JE.list tabEncoder session.tabs )
        , ( "pinned", JE.bool session.pinned )
        , ( "collapsed", JE.bool session.collapsed )
        ]



-- MODEL


type alias Flags =
    { now : Int
    }


type alias Problem =
    { msg : String, details : String }


type alias Model =
    { openTabs : List Tab
    , sessions : List Session
    , showDeleted : Bool
    , problems : List Problem
    , seed : Seed
    }


init : Flags -> ( Model, Cmd Msg )
init flags =
    { openTabs = []
    , sessions = []
    , showDeleted = False
    , problems = []
    , seed = Random.initialSeed flags.now
    }
        |> withNoCmd


appendProblem : Problem -> Model -> Model
appendProblem problem model =
    { model | problems = model.problems ++ [ problem ] }


idDictFromList : List { a | id : comparable } -> Dict comparable { a | id : comparable }
idDictFromList list =
    list
        |> List.map (\record -> ( record.id, record ))
        |> Dict.fromList


upsertNewerSessions : List Session -> Model -> Model
upsertNewerSessions sessions model =
    let
        sessionsById =
            idDictFromList model.sessions

        isNewer s =
            sessionsById
                |> Dict.get s.id
                |> Maybe.map (\existing -> s.modifiedAt > existing.modifiedAt)
                |> Maybe.withDefault True

        newerSessionsById =
            sessions
                |> List.filter isNewer
                |> idDictFromList

        newSessions =
            sessionsById
                |> Dict.union newerSessionsById
                |> Dict.values
    in
    { model | sessions = sessions }


setOpenTabs : List Tab -> Model -> Model
setOpenTabs tabs model =
    { model | openTabs = tabs }



-- MESSAGES


type Msg
    = NoOp
    | OnCurrentWindowTabsChanged JE.Value
    | OnOpenTabItemClicked Tab
    | OnSessionTabItemClicked Tab
    | OnPouchSessionsChanged Value
    | OnSaveSessionClicked
    | SaveSessionWithNow Posix
    | OnPersistSessionListResponse Value
    | OnDeleteSessionClicked String
    | OnDeleteSessionTabClicked String Int
    | DeleteSessionWithNow String Posix
    | OnShouldShowDeletedChecked Bool



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch
        [ onCurrentWindowTabsChanged OnCurrentWindowTabsChanged
        , onPouchSessionsChanged OnPouchSessionsChanged
        , onPersistSessionListResponse OnPersistSessionListResponse
        ]



-- UPDATE


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        NoOp ->
            model |> withNoCmd

        OnShouldShowDeletedChecked isChecked ->
            { model | showDeleted = isChecked } |> withNoCmd

        OnCurrentWindowTabsChanged encodedOpenTabs ->
            model |> decodeAndReplaceOpenTabs encodedOpenTabs

        OnOpenTabItemClicked tab ->
            model |> withCmd (activateTabCmd tab)

        OnSessionTabItemClicked tab ->
            model |> withCmd (createAndActivateTabWithUrl tab.url)

        OnPouchSessionsChanged encodedChanges ->
            decodeAndUpdateSessions encodedChanges model

        OnSaveSessionClicked ->
            model
                |> withCmd (Time.now |> Task.perform SaveSessionWithNow)

        OnDeleteSessionClicked sessionId ->
            model
                |> withCmd (Time.now |> Task.perform (DeleteSessionWithNow sessionId))

        OnDeleteSessionTabClicked sessionId tabIdx ->
            model
                |> withNoCmd

        SaveSessionWithNow now ->
            createAndPersistSession now model

        DeleteSessionWithNow sessionId now ->
            deleteSessionWithNow sessionId now model

        OnPersistSessionListResponse encodedResponse ->
            let
                _ =
                    encodedResponse
                        |> JE.encode 2
                        |> Debug.log "OnPersistSessionListResponse"
            in
            model |> withNoCmd


generateWithModelSeed : Generator a -> Model -> ( a, Model )
generateWithModelSeed gen model =
    Random.step gen model.seed
        |> Tuple.mapSecond (\seed -> { model | seed = seed })


createAndPersistSession : Posix -> Model -> Return Msg Model
createAndPersistSession now model =
    model
        |> generateWithModelSeed (sessionGenerator model.openTabs now)
        |> persistGeneratedSession


persistGeneratedSession : ( Session, Model ) -> Return Msg Model
persistGeneratedSession ( session, model ) =
    model |> withCmd (persistSessionCmd session)


deleteSessionWithNow : String -> Posix -> Model -> Return Msg Model
deleteSessionWithNow sessionId now model =
    updateAndPersistSessionIfChanged sessionId
        (\s -> { s | deleted = s.deleted |> not })
        now
        model


persistSessionCmd : Session -> Cmd msg
persistSessionCmd session =
    [ session ]
        |> JE.list sessionEncoder
        |> persistSessionList


updateAndPersistSessionIfChanged :
    String
    -> (Session -> Session)
    -> Posix
    -> Model
    -> Return Msg Model
updateAndPersistSessionIfChanged sessionId fn now model =
    let
        sessionsById =
            idDictFromList model.sessions

        maybeModifiedSession =
            sessionsById
                |> Dict.get sessionId
                |> Maybe.andThen
                    (\session ->
                        let
                            updatedSession =
                                fn session
                        in
                        if updatedSession /= session then
                            { updatedSession
                                | modifiedAt =
                                    now
                                        |> Time.posixToMillis
                            }
                                |> Just

                        else
                            Nothing
                    )
    in
    maybeModifiedSession
        |> Maybe.map persistSessionCmd
        |> Maybe.map (\cmd -> model |> withCmd cmd)
        |> Maybe.withDefault (model |> withNoCmd)


activateTabCmd : Tab -> Cmd msg
activateTabCmd tab =
    updateTab ( tab.id, { active = True } )


decodeAndUpdateSessions : Value -> Model -> ( Model, Cmd Msg )
decodeAndUpdateSessions encodedSessions model =
    encodedSessions
        |> JD.decodeValue (JD.list sessionDecoder)
        |> Result.mapError (\error -> Problem "Unable to decode session list" (JD.errorToString error))
        |> unpackResult appendProblem upsertNewerSessions
        |> callWith model
        |> withNoCmd


decodeAndReplaceOpenTabs : Value -> Model -> ( Model, Cmd Msg )
decodeAndReplaceOpenTabs encodedOpenTabs model =
    encodedOpenTabs
        |> JD.decodeValue (JD.list tabDecoder)
        |> Result.mapError (\error -> Problem "Unable to parse open tabs" (JD.errorToString error))
        |> unpackResult appendProblem setOpenTabs
        |> callWith model
        |> withNoCmd


createAndActivateTabWithUrl : String -> Cmd Msg
createAndActivateTabWithUrl url =
    createTab { url = url, active = True }



-- VIEW


getDisplaySessions : Bool -> List Session -> List Session
getDisplaySessions shouldShowDeleted sessions =
    let
        comparator =
            Compare.concat [ Compare.by .pinned, Compare.by .createdAt |> Compare.reverse ]

        deletedPred =
            if shouldShowDeleted then
                \_ -> True

            else
                .deleted >> not
    in
    sessions
        |> List.filter deletedPred
        |> List.sortWith (Compare.by .createdAt |> Compare.reverse)


view : Model -> Html Msg
view model =
    div [ class "pa3 lh-copy" ]
        [ div [ class "measure-wide center b mb3" ] [ text "TabExplorer c4" ]
        , viewProblems model.problems
        , viewOpenTabs model.openTabs
        , viewSessions model.showDeleted <| getDisplaySessions model.showDeleted model.sessions
        ]


viewProblems : List Problem -> Html Msg
viewProblems problems =
    if List.isEmpty problems then
        text ""

    else
        div [ class "measure-wide center mv3" ] (List.map viewpProblemItem problems)


viewpProblemItem : Problem -> Html Msg
viewpProblemItem problem =
    div [ class "mv4" ]
        [ div [ class "pa2 bg-red white br3 mb3" ] [ text <| "Error: " ++ problem.msg ]
        , div [ class "ph3 code pre lh-solid f6" ] [ text problem.details ]
        ]


sph : List (Html Msg) -> List (Html Msg)
sph =
    List.intersperse (div [ class "ph1" ] [])


viewOpenTabs : List Tab -> Html Msg
viewOpenTabs tabs =
    div [ class "measure-wide center ba br3" ]
        [ div [ class "pa2 bb flex" ]
            (sph
                [ div [] [ text "Open Tabs" ]
                , button
                    [ class "pv0 ph2 ma0 ttu lh-title f7"
                    , onClick OnSaveSessionClicked
                    ]
                    [ text "save session" ]
                ]
            )
        , div [ class "pv2" ] (List.map viewOpenTabItem tabs)
        ]


viewOpenTabItem : Tab -> Html Msg
viewOpenTabItem tab =
    div [ class "pointer", onClick <| OnOpenTabItemClicked tab ]
        [ div [ class "pv1 ph2" ] [ text tab.title ]
        ]


viewSessions : Bool -> List Session -> Html Msg
viewSessions shouldShowDeleted sessions =
    div [ class "measure-wide center" ]
        [ div [ class "mv3 flex" ]
            (sph
                [ div [ class "b " ] [ text "Saved Sessions" ]
                , label [ class "" ]
                    [ input [ type_ "checkbox", checked shouldShowDeleted, onCheck OnShouldShowDeletedChecked ] []
                    , text "Include Deleted"
                    ]
                ]
            )
        , div [ class "pv2" ] (List.map viewSessionItem sessions)
        ]


viewSessionItem : Session -> Html Msg
viewSessionItem session =
    div [ class "mb3 ba br3" ]
        [ div [ class "pa2 bb flex" ]
            (sph
                [ div [] [ session.createdAt |> String.fromInt |> text ]
                , button
                    [ class "pv0 ph2 ma0 ttu lh-title f7"
                    , onClick (OnDeleteSessionClicked session.id)
                    ]
                    [ text "delete session" ]
                , div []
                    [ (if session.deleted then
                        "deleted"

                       else
                        "not-deleted"
                      )
                        |> text
                    ]
                ]
            )
        , div [ class "pv2" ]
            (List.indexedMap (viewSessionTabItem session.id)
                session.tabs
            )
        ]


viewSessionTabItem : String -> Int -> Tab -> Html Msg
viewSessionTabItem sessionId idx tab =
    div [ class "ph2 flex" ]
        (sph
            [ button
                [ class "pv0 ph2 ma0 ttu lh-title f7"
                , onClick (OnDeleteSessionTabClicked sessionId idx)
                ]
                [ text "X" ]
            , div [ class "pointer", onClick <| OnSessionTabItemClicked tab ]
                [ div [ class "" ] [ text tab.title ]
                ]
            ]
        )



-- MAIN


main : Program Flags Model Msg
main =
    Browser.element
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        }



-- COMMON HELPERS


callWith : a -> (a -> b) -> b
callWith a fn =
    fn a


mergeResult : Result a a -> a
mergeResult result =
    case result of
        Err a ->
            a

        Ok a ->
            a


unpackResult : (err -> b) -> (a -> b) -> Result err a -> b
unpackResult fromErr fromOk result =
    result
        |> Result.mapError fromErr
        |> Result.map fromOk
        |> mergeResult


type alias Return msg model =
    ( model, Cmd msg )


withNoCmd : model -> ( model, Cmd msg )
withNoCmd model =
    ( model, Cmd.none )


withCmd : Cmd msg -> model -> ( model, Cmd msg )
withCmd cmd model =
    ( model, cmd )


andThen : (model -> Return msg model) -> Return msg model -> Return msg model
andThen fn ( m1, c1 ) =
    let
        ( m2, c2 ) =
            fn m1
    in
    ( m2, Cmd.batch [ c1, c2 ] )
