import WS from "ws";
import { createSocket, Socket } from "node:dgram";
import { get_data, send } from "./tools/ws.js";
import { Address, holepunch } from "./packet/udp.js";
import { create_frame_sender } from "./frame/sender.js";
import { strategies } from "./secure/encryption.js";
import { create_stream } from "./frame/ffmpeg.js";

const encryption_mode = "xsalsa20_poly1305_lite";

export function connect_voice(voice: Voice) {
    const gateway = new WS(`wss://${voice.server.endpoint}/?v=4`);

    let udp_sock: Socket = createSocket("udp4"),
        remote: Address, 
        ssrc: number;

    gateway.onopen = () => {
        console.log("[discord/voice] connected, sending identify");
        send(gateway, {
            op: 0,
            d: {
                session_id: voice.state.session_id,
                token: voice.server.token,
                server_id: voice.server.guild_id,
                user_id: voice.state.user_id,
            },
        }, "discord/voice");
    };

    gateway.onclose = (evt) => {
        console.error("[discord/voice]", evt.code, evt.reason, evt.wasClean);
        process.exit(1);
    }

    gateway.onmessage = async ({ data }) => {
        const payload = JSON.parse(get_data(data).toString());
        console.debug("[discord/voice] >>>", JSON.stringify(payload));

        switch (payload.op) {
            case 2:
                ssrc = payload.d.ssrc;
                remote = { ip: payload.d.ip, port: payload.d.port };

                const { ip, port } = await holepunch(udp_sock, payload.d.ssrc, payload.d);
                select_protocol(ip, port);
                heartbeat();

                break;
            case 8:
                setInterval(heartbeat, payload.d.heartbeat_interval);
                break;
            case 6:
                console.log("[discord/voice] received heartbeat ACK");
                break;
            case 4:
                const secret_key = Buffer.from(payload.d.secret_key);
                const sender = create_frame_sender(
                    ssrc,
                    create_stream(process.env.FFMPEG_INPUT!),
                );

                await sender.start({ remote, sock: udp_sock, gateway }, strategies[encryption_mode]?.(secret_key));
                break;
        }
    };

    function heartbeat() {
        send(gateway, { op: 3, d: Date.now() }, "discord/voice")
    }

    function select_protocol(address: string, port: number) {
        console.log("[discord/voice] peformed holepunch: %s:%d", address, port);

        send(gateway, {
            op: 1,
            d: {
                protocol: "udp",
                data: {
                    address, port,
                    mode: encryption_mode,
                },
            },
        }, "discord/voice");
    }
}

export interface Voice {
    state: VoiceState;
    server: VoiceServer;
}

interface VoiceState {
    session_id: string;
    user_id: string;
}

interface VoiceServer {
    endpoint: string;
    token: string;
    guild_id: string;
}

export interface VoiceConnection {
    sock: Socket;
    gateway: WS;
    remote: Address;
}
