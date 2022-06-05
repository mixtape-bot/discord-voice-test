import WS from "ws";
import { EventEmitter } from "node:events";
import { get_data, send } from "./tools/ws.js";
import type { Voice } from "./voice.js";
import { connect_voice } from "./voice.js";

export function connect_gateway() {
    const start = Date.now();
    const gateway = new WS("wss://gateway.discord.gg/?v=10&encoding=json");
    const events = new EventEmitter()

    let seq = -1, voice: Partial<Voice> = {}, self: User;
    gateway.onopen = () => {
        console.log("[discord/gateway] connected in", Date.now() - start, "ms");

        // send identify packet
        send(gateway, {
            op: 2,
            d: {
                token: process.env.DISCORD_TOKEN,
                properties: {
                    "$os": "linux",
                    "$browser": "mixtape",
                    "$device": "mixtape"
                },
                intents: 1 << 0 | 1 << 7
            }
        }, "discord/gateway");
    }

    gateway.onmessage = ({ data }) => {
        const payload = JSON.parse(get_data(data).toString());

        switch (payload.op) {
            case 0:
                handleDispatch(payload);
                break;
            case 1:
                heartbeat()
                break;
            case 10:
                setInterval(heartbeat, payload.d.heartbeat_interval)
                break;
            case 11:
                console.log("[discord/gateway] received heartbeat ack");
                break;
        }
    }

    function handleDispatch(payload: Record<string, any>) {
        const { t, s, d } = payload;
        console.debug("[discord/gateway] received dispatch:", t)
        seq = s;

        switch (t) {
            case "READY":
                heartbeat()
                self = d.user;
                break;
        }

        events.emit(t.toLowerCase().replaceAll('_', '/'), d)
    }

    events.on("ready", () => {
        console.log("[discord/gateway] ready");

        send(gateway, {
            op: 4,
            d: {
                channel_id: process.env.VOICE_ID,
                guild_id: process.env.GUILD_ID,
                self_mute: false,
                self_deaf: false
            }
        }, "discord/gateway");
    });

    events.on("voice/state/update", d => {
        if (d.user_id !== self.id) {
            return
        }

        voice.state = d;
        checkCanConnectVoice()
    });

    events.on("voice/server/update", d => {
        voice.server = d;
        checkCanConnectVoice()
    });

    function checkCanConnectVoice() {
        if (voice.server && voice.state) {
            connect_voice(voice as Voice)
            voice = {}
        }
    }
    
    function heartbeat() {
        send(gateway, { op: 1, d: seq === -1 ? null : seq }, "discord/gateway");
    }
}

interface User {
    id: string;
}
