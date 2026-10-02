# Shared chat and terminal session

```mermaid
flowchart LR
  a1["✅ a1 chat-bridge extension"] --> a2["✅ a2 extension test"]
  a1 --> a3["✅ a3 brayness-chat relays socket"]
  a2 --> a4["✅ a4 rebuild template, restart"]
  a3 --> a4
  a4 --> a5["✅ a5 live chat shows in terminal"]
  a5 --> b1["✅ b1 bridge streams every turn"]
  a5 --> b2["✅ b2 bridge sends history"]
  b1 --> b3["✅ b3 vsock watch channel"]
  b2 --> b3
  b3 --> b4["✅ b4 host events route"]
  b4 --> b5["✅ b5 GUI renders live session"]
  b5 --> b6["✅ b6 GUI working indicator"]
  b5 --> b7["✅ b7 GUI-TUI switch"]
  b6 --> b8["✅ b8 rebuild, check both ways"]
  b7 --> b8
  a5 --> c1["c1 measure fresh Pi startup"]
  c1 --> G{{"🚦 GATE 1<br/>startup fix chosen"}}

  classDef gate fill:#3a2f1a,stroke:#c9a227,color:#f5e6c8;
  classDef done fill:none,stroke:#555,stroke-dasharray:3 3,color:#777;
  classDef active fill:#1f2f3a,stroke:#4f8fbf,color:#d6e9f5;
  classDef blocked fill:#3a1f1f,stroke:#bf4f4f,color:#f5d6d6;
  class G gate;
  class a1,a2,a3,a4,a5,b1,b2,b3,b4,b5,b6,b7,b8 done;
```

## Nodes

Struck-through ids are done.

| id        | goal                                                 | effort    |
| --------- | ---------------------------------------------------- | --------- |
| ~~a1~~ ✅ | Extension listens on socket, runs message in Pi      | medium    |
| ~~a2~~ ✅ | Unit test: delta, done, busy, bad input              | cheap     |
| ~~a3~~ ✅ | `brayness-chat` relays vsock to socket; no Pi spawn  | cheap     |
| ~~a4~~ ✅ | Rebuild template, restart `fc-local`                 | expensive |
| ~~a5~~ ✅ | Chat message appears in terminal; reply streams back | medium    |
| ~~b1~~ ✅ | Watchers get every turn, TUI-typed ones too          | medium    |
| ~~b2~~ ✅ | New watcher gets the session's messages first        | cheap     |
| ~~b3~~ ✅ | `brayness-chat` holds a long-lived watch connection  | cheap     |
| ~~b4~~ ✅ | Host streams watch events to the GUI page            | medium    |
| ~~b5~~ ✅ | GUI shows history and live turns from both sides     | medium    |
| ~~b6~~ ✅ | Pi's spinner and "Working" line above the input      | cheap     |
| ~~b7~~ ✅ | One control switches GUI and TUI views               | cheap     |
| ~~b8~~ ✅ | Rebuild; type in TUI, see it in GUI; reverse         | expensive |
| c1        | Find why fresh actors wait 39s, then Pi ~70s         | medium    |

## Notes

For a person using GUI and TUI on one actor.

### Decisions

- Gate 1 (a-series): approved; built directly.
- One Pi per actor: the terminal's, started at boot.
- Never start or restart Pi per chat message.
- Busy terminal Pi rejects chat: "terminal is busy".
- Pi not running: chat errors, no fallback Pi.
- Chat prompt appends only on chat-started turns.
- Guard on shipped chat prompt; seed Pi predates /etc/brayness.
- Free models skip the free token limit.
- Socket: `/run/brayness/pi-chat.sock`, interactive Pi only.
- Names: TUI is the terminal, GUI the chat page.
- GUI spinner copies Pi's frames: braille dots, 80ms.
- Switch: keep split; GUI, Both, TUI buttons; Ctrl+` cycles.
- GUI renders only from the watch; sending just posts.

### Open questions

- Should a closed browser abort the running turn?
- restore-fresh guards on /etc/brayness too; is it inert?
