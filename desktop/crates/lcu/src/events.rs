//! The client's event stream.
//!
//! The client pushes every state change over a WebSocket, so the app does not
//! poll. Polling champ select would mean either a visible lag behind a pick or
//! a request every few hundred milliseconds for the whole session.
//!
//! The protocol is WAMP-flavoured: `[5, "OnJsonApiEvent"]` subscribes to every
//! change the client makes, `[5, "OnJsonApiEvent_lol-gameflow_v1_gameflow-phase"]`
//! to one endpoint's (its path, `/` read as `_`). A change then arrives as
//! `[8, <the event subscribed to>, {uri, eventType, data}]`.
//!
//! The app subscribes to the endpoints it follows only (`uri::FOLLOWED`): the
//! whole stream carries chat, friends, presence, the store and the patcher —
//! megabytes the client would otherwise encrypt and the app decrypt and drop,
//! for as long as both run.

use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::Connector;

use crate::credentials::Credentials;
use crate::error::{Error, Result};
use crate::tls;

/// One change the client pushed.
#[derive(Debug, Clone)]
pub struct LcuEvent {
    /// The endpoint that changed, e.g. `/lol-champ-select/v1/session`.
    pub uri: String,
    /// `Create`, `Update` or `Delete`.
    pub event_type: String,
    /// The endpoint's new body. `Null` on `Delete` — champ select ends that way.
    pub data: serde_json::Value,
}

/// The message subscribing to one endpoint's changes.
fn subscription(uri: &str) -> String {
    format!(r#"[5,"OnJsonApiEvent{}"]"#, uri.replace('/', "_"))
}

/// Connect, subscribe to the endpoints the app follows, and forward their events onto a channel.
///
/// Returns once the socket closes, which is the normal end of a client session:
/// the caller reconnects rather than treating it as an error.
pub async fn stream_events(credentials: Credentials, sender: mpsc::Sender<LcuEvent>) -> Result<()> {
    let mut request = format!("wss://127.0.0.1:{}/", credentials.port)
        .into_client_request()
        .map_err(|e| Error::Transport(e.to_string()))?;
    request.headers_mut().insert(
        "Authorization",
        credentials
            .authorization_header()
            .parse()
            .map_err(|_| Error::Transport("malformed authorization header".into()))?,
    );

    let connector = Connector::Rustls(Arc::new(tls::client_config()?));
    let (mut socket, _) =
        tokio_tungstenite::connect_async_tls_with_config(request, None, false, Some(connector))
            .await
            .map_err(|e| Error::Transport(e.to_string()))?;

    for uri in crate::uri::FOLLOWED {
        socket
            .send(Message::Text(subscription(uri)))
            .await
            .map_err(|e| Error::Transport(e.to_string()))?;
    }

    while let Some(message) = socket.next().await {
        let message = match message {
            Ok(message) => message,
            // A dropped socket means the client went away — the caller's
            // reconnect loop handles it, so this is not escalated.
            Err(_) => break,
        };

        let Message::Text(payload) = message else {
            continue;
        };
        // Only the followed endpoints are subscribed to; anything else the
        // client sends is still dropped before it is parsed.
        if !followed(&payload) {
            continue;
        }
        let Some(event) = parse_event(&payload) else {
            continue;
        };

        // The receiver is gone: the app is shutting down.
        if sender.send(event).await.is_err() {
            break;
        }
    }

    Ok(())
}

/// Whether a frame may be about an endpoint the app follows: its path, quoted,
/// appears in it. A cheap look at the text, whatever its spacing; the parse
/// that follows reads the `uri` itself.
fn followed(payload: &str) -> bool {
    crate::uri::FOLLOWED
        .iter()
        .any(|uri| payload.contains(&format!("\"{uri}\"")))
}

/// Pull an event out of a `[8, "OnJsonApiEvent", {...}]` frame.
///
/// Returns `None` for anything else — the client also sends bare
/// acknowledgements, and one unparseable frame must not end the stream.
pub fn parse_event(payload: &str) -> Option<LcuEvent> {
    let mut frame: serde_json::Value = serde_json::from_str(payload).ok()?;
    let array = frame.as_array_mut()?;
    if array.len() < 3 || array[0].as_i64() != Some(8) {
        return None;
    }

    // Taken out of the frame, not copied: a champ select session is large.
    let body = array[2].as_object_mut()?;
    Some(LcuEvent {
        uri: body.get("uri")?.as_str()?.to_string(),
        event_type: body
            .get("eventType")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("Update")
            .to_string(),
        data: body.remove("data").unwrap_or(serde_json::Value::Null),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drops_what_the_app_does_not_follow_before_parsing() {
        assert!(followed(
            r#"[8,"OnJsonApiEvent",{"data":{},"eventType":"Update","uri":"/lol-champ-select/v1/session"}]"#
        ));
        assert!(followed(
            r#"[8,"OnJsonApiEvent",{"uri": "/lol-gameflow/v1/gameflow-phase"}]"#
        ));
        assert!(!followed(
            r#"[8,"OnJsonApiEvent",{"data":{},"eventType":"Update","uri":"/lol-chat/v1/conversations"}]"#
        ));
    }

    #[test]
    fn subscribes_to_each_followed_endpoint_by_its_event_name() {
        assert_eq!(
            subscription("/lol-gameflow/v1/gameflow-phase"),
            r#"[5,"OnJsonApiEvent_lol-gameflow_v1_gameflow-phase"]"#
        );
        assert_eq!(
            subscription("/lol-champ-select/v1/session"),
            r#"[5,"OnJsonApiEvent_lol-champ-select_v1_session"]"#
        );
    }

    #[test]
    fn reads_an_update_sent_under_an_endpoints_own_event() {
        let frame = r#"[8,"OnJsonApiEvent_lol-lobby_v2_lobby",{"data":{},"eventType":"Update","uri":"/lol-lobby/v2/lobby"}]"#;
        assert!(followed(frame));
        assert_eq!(parse_event(frame).unwrap().uri, "/lol-lobby/v2/lobby");
    }

    #[test]
    fn reads_a_champ_select_update() {
        let frame = r#"[8,"OnJsonApiEvent",{"data":{"localPlayerCellId":2},"eventType":"Update","uri":"/lol-champ-select/v1/session"}]"#;
        let event = parse_event(frame).unwrap();
        assert_eq!(event.uri, "/lol-champ-select/v1/session");
        assert_eq!(event.event_type, "Update");
        assert_eq!(event.data["localPlayerCellId"], 2);
    }

    #[test]
    fn reads_the_delete_that_ends_champ_select() {
        let frame = r#"[8,"OnJsonApiEvent",{"data":null,"eventType":"Delete","uri":"/lol-champ-select/v1/session"}]"#;
        let event = parse_event(frame).unwrap();
        assert_eq!(event.event_type, "Delete");
        assert!(event.data.is_null());
    }

    #[test]
    fn ignores_the_subscription_acknowledgement() {
        assert!(parse_event(r#"[5,"OnJsonApiEvent"]"#).is_none());
    }

    #[test]
    fn one_unparseable_frame_does_not_end_the_stream() {
        // `stream_events` skips a `None` and keeps reading; this pins the
        // contract that malformed input yields `None` rather than panicking.
        assert!(parse_event("not json").is_none());
        assert!(parse_event("{}").is_none());
        assert!(parse_event("[8]").is_none());
    }
}
