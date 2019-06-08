port module TabExplorer exposing (main)

import Browser
import Compare
import Html exposing (..)
import Html.Attributes exposing (class)
import Html.Events exposing (onClick)
import Json.Decode as JD exposing (Decoder)
import Json.Decode.Pipeline exposing (custom, optional, required)
import Json.Encode as JE exposing (Value)



-- PORTS


port onCurrentWindowTabsChanged : (JE.Value -> msg) -> Sub msg


port createTab : { url : String, active : Bool } -> Cmd msg


port updateTab : ( Int, { active : Bool } ) -> Cmd msg


port onPouchSessionsChanged : (JE.Value -> msg) -> Sub msg


port persistSessionList : Value -> Cmd msg



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
    { sessions : Value
    }


type alias Problem =
    { msg : String, details : String }


type alias Model =
    { openTabs : List Tab
    , sessions : List Session
    , problems : List Problem
    }


init : Flags -> ( Model, Cmd Msg )
init flags =
    { openTabs = []
    , sessions = []
    , problems = []
    }
        |> withNoCmd



-- |> updateEncodedSessions flags.sessions
-- |> andThen updatePersistSessions


appendProblem : Problem -> Model -> Model
appendProblem problem model =
    { model | problems = model.problems ++ [ problem ] }


setSessions : List Session -> Model -> Model
setSessions sessions model =
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



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch
        [ onCurrentWindowTabsChanged OnCurrentWindowTabsChanged
        , onPouchSessionsChanged OnPouchSessionsChanged
        ]



-- UPDATE


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        NoOp ->
            model |> withNoCmd

        OnCurrentWindowTabsChanged encodedOpenTabs ->
            model |> updateEncodedOpenTabs encodedOpenTabs

        OnOpenTabItemClicked tab ->
            model |> withCmd (activateTabCmd tab)

        OnSessionTabItemClicked tab ->
            model |> withCmd (createAndActivateTabWithUrl tab.url)

        OnPouchSessionsChanged encodedChanges ->
            let
                _ =
                    encodedChanges
                        |> JE.encode 2
                        |> Debug.log "encodedChanges"
            in
            updateEncodedSessions encodedChanges model


updatePersistSessions : Model -> Return Msg Model
updatePersistSessions model =
    let
        cmd =
            model.sessions
                |> JE.list sessionEncoder
                |> persistSessionList
    in
    model |> withCmd cmd


activateTabCmd : Tab -> Cmd msg
activateTabCmd tab =
    updateTab ( tab.id, { active = True } )


updateEncodedSessions : Value -> Model -> ( Model, Cmd Msg )
updateEncodedSessions encodedSessions model =
    encodedSessions
        |> JD.decodeValue (JD.list sessionDecoder)
        |> Result.mapError (\error -> Problem "Unable to parse cached sessions" (JD.errorToString error))
        |> unpackResult appendProblem setSessions
        |> callWith model
        |> withNoCmd


updateEncodedOpenTabs : Value -> Model -> ( Model, Cmd Msg )
updateEncodedOpenTabs encodedOpenTabs model =
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


getDisplaySessions : List Session -> List Session
getDisplaySessions sessions =
    let
        comparator =
            Compare.concat [ Compare.by .pinned, Compare.by .createdAt |> Compare.reverse ]
    in
    List.sortWith (Compare.by .createdAt |> Compare.reverse) sessions


view : Model -> Html Msg
view model =
    div [ class "pa3 lh-copy" ]
        [ div [ class "measure-wide center b mb3" ] [ text "TabExplorer" ]
        , viewProblems model.problems
        , viewOpenTabs model.openTabs
        , viewSessions <| getDisplaySessions model.sessions
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


viewOpenTabs : List Tab -> Html Msg
viewOpenTabs tabs =
    div [ class "measure-wide center ba br3" ]
        [ div [ class "pa2 bb" ] [ text "Open Tabs" ]
        , div [ class "pv2" ] (List.map viewOpenTabItem tabs)
        ]


viewOpenTabItem : Tab -> Html Msg
viewOpenTabItem tab =
    div [ class "pointer", onClick <| OnOpenTabItemClicked tab ]
        [ div [ class "pv1 ph2" ] [ text tab.title ]
        ]


viewSessions : List Session -> Html Msg
viewSessions sessions =
    div [ class "measure-wide center" ]
        [ div [ class "b mv3 " ] [ text "Saved Sessions" ]
        , div [ class "pv2" ] (List.map viewSessionItem sessions)
        ]


viewSessionItem : Session -> Html Msg
viewSessionItem session =
    div [ class "mb3 ba br3" ]
        [ div [ class "pa2 bb" ] [ session.createdAt |> String.fromInt |> text ]
        , div [ class "pv2" ] (List.map viewSessionTabItem session.tabs)
        ]


viewSessionTabItem : Tab -> Html Msg
viewSessionTabItem tab =
    div [ class "pointer", onClick <| OnSessionTabItemClicked tab ]
        [ div [ class "pv1 ph2" ] [ text tab.title ]
        ]



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
