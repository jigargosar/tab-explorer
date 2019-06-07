port module TabExplorer exposing (main)

import Browser
import Html exposing (..)
import Html.Attributes exposing (class)
import Html.Events exposing (onClick)
import Json.Decode as JD exposing (Decoder)
import Json.Encode as JE exposing (Value)


port onCurrentWindowTabsChanged : (JE.Value -> msg) -> Sub msg


port createTab : { url : String, active : Bool } -> Cmd msg


port updateTab : ( Int, { active : Bool } ) -> Cmd msg


type alias Tab =
    { id : Int
    , title : String
    , url : String
    , favIconUrl : Maybe String
    }


tabDecoder : Decoder Tab
tabDecoder =
    JD.map4 Tab
        (JD.field "id" JD.int)
        (JD.field "title" JD.string)
        (JD.field "url" JD.string)
        (JD.maybe <| JD.field "favIconUrl" JD.string)


type alias Session =
    { id : String
    , title : String
    , createdAt : Int
    , modifiedAt : Int
    , deleted : Bool
    , tabs : List Tab
    , pinned : Bool
    , collapsed : Bool
    }


optionalField : String -> Decoder a -> a -> Decoder a
optionalField fname fdecoder defVal =
    JD.field fname fdecoder
        |> JD.maybe
        |> JD.map (Maybe.withDefault defVal)


sessionDecoder : Decoder Session
sessionDecoder =
    JD.map8 Session
        (JD.field "id" JD.string)
        (optionalField "title" JD.string "")
        (JD.field "createdAt" JD.int)
        (JD.field "modifiedAt" JD.int)
        (optionalField "deleted" JD.bool False)
        (JD.field "tabs" <| JD.list tabDecoder)
        (optionalField "pinned" JD.bool False)
        (optionalField "collapsed" JD.bool False)


type alias Flags =
    { sessions : Value
    }


type alias Model =
    { openTabs : List Tab
    , sessions : List Session
    }


init : Flags -> ( Model, Cmd Msg )
init flags =
    let
        sessions =
            flags.sessions
                |> JD.decodeValue (JD.list sessionDecoder)
                -- |> Debug.log "encoded sessions"
                |> Result.withDefault []
    in
    ( { openTabs = [], sessions = sessions }, Cmd.none )


type Msg
    = NoOp
    | OnCurrentWindowTabsChanged JE.Value
    | OnOpenTabItemClicked Tab
    | OnSessionTabItemClicked Tab


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch [ onCurrentWindowTabsChanged OnCurrentWindowTabsChanged ]


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        NoOp ->
            ( model, Cmd.none )

        OnCurrentWindowTabsChanged encodedTabs ->
            let
                newModel =
                    encodedTabs
                        |> JD.decodeValue (JD.list tabDecoder)
                        |> Debug.log "encodedTabs"
                        |> Result.map
                            (\tabs -> { model | openTabs = tabs })
                        |> Result.withDefault model
            in
            ( newModel, Cmd.none )

        OnOpenTabItemClicked tab ->
            ( model, updateTab ( tab.id, { active = True } ) )

        OnSessionTabItemClicked tab ->
            ( model, createTab { url = tab.url, active = True } )


view : Model -> Html Msg
view model =
    div [ class "pa3 lh-copy" ]
        [ div [ class "measure-wide center b mb3" ] [ text "TabExplorer" ]
        , viewOpenTabs model.openTabs
        , viewSessions model.sessions
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


main : Program Flags Model Msg
main =
    Browser.element
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        }
