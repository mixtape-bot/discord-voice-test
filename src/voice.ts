import WS from "ws";
import { createSocket, Socket } from "node:dgram";
import { get_data, send } from "./tools/ws.js";
import { Address, holepunch } from "./packet/udp.js";
import { create_frame_sender } from "./frame/sender.js";
import { strategies } from "./secure/encryption.js";
// import { create_echoing_frame_poller } from "./frame/echo.js";
import { create_ffmpeg_opus_stream } from "./frame/ffmpeg.js";
import { create_echoing_frame_poller } from "./frame/echo.js";

const encryption_mode = "xsalsa20_poly1305";

export function connect_voice(voice: Voice) {
    const connection: VoiceConnection = {
        gateway: new WS(`wss://${voice.server.endpoint}/?v=4`),
        sock: createSocket("udp4"),
        speaking_map: new Map(),
    }

    let ssrc: number;
    connection.gateway.onopen = () => {
        console.log("[discord/voice] connected, sending identify");
        send(connection.gateway, {
            op: 0,
            d: {
                session_id: voice.state.session_id,
                token: voice.server.token,
                server_id: voice.server.guild_id,
                user_id: voice.state.user_id,
            },
        }, "discord/voice");
    };

    connection.gateway.onclose = (evt) => {
        console.error("[discord/voice]", evt.code, evt.reason, evt.wasClean);
        process.exit(1);
    }

    connection.gateway.onmessage = async ({ data }) => {
        const payload = JSON.parse(get_data(data).toString());
        console.debug("[discord/voice] >>>", JSON.stringify(payload));

        switch (payload.op) {
            case 2:
                ssrc = payload.d.ssrc;
                connection.remote = { ip: payload.d.ip, port: payload.d.port };

                const { ip, port } = await holepunch(connection.sock, payload.d.ssrc, payload.d);
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
                const secret = Buffer.from(payload.d.secret_key)
                switch (process.env.TEST_TYPE) {
                    case "ffmpeg":
                        const ffmpeg = create_ffmpeg_opus_stream(process.env.FFMPEG_INPUT!)
                        ffmpeg.setBitrate(512000)

                        const ffmpeg_sender = create_frame_sender(
                            ssrc,
                            ffmpeg
                        );

                        await ffmpeg_sender.start(connection, strategies[encryption_mode]?.(secret)!);
                        break;
                    case "echo":
                        const encryption_strategy = strategies[encryption_mode]?.(secret)!
                        const echo_sender = create_frame_sender(
                            ssrc,
                            create_echoing_frame_poller(connection, encryption_strategy),
                        );

                        await echo_sender.start(connection, encryption_strategy);
                        break;
                }


                break;
            case 5:
                connection.speaking_map.set(payload.d.ssrc, payload.d.user_id);
                break;
        }
    };

    function heartbeat() {
        send(connection.gateway, { op: 3, d: Date.now() }, "discord/voice")
    }

    function select_protocol(address: string, port: number) {
        console.log("[discord/voice] peformed holepunch: %s:%d", address, port);

        send(connection.gateway, {
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
    remote?: Address;
    speaking_map: Map<number, string>;
}
