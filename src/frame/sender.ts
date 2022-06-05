import { performance } from "node:perf_hooks";
import { promisify } from "node:util";
import { create_packet_provider } from "../packet/rtp.js";
import { send } from "../tools/ws.js";
import type { VoiceConnection } from "../voice.js";
import type { EncryptionStrategy } from "../secure/encryption.js";
import { create_functional_interval, get_nano_time } from "../tools/time.js";
import duration from "dayjs/plugin/duration.js";
import dayjs from "dayjs";
import type { Readable } from "node:stream";
import { create_length_tracking_poller, create_streamed_frame_poller } from "./poller.js";

dayjs.extend(duration)

const sleep = promisify(setTimeout);
const silentFrame = [0xF8, 0xFC, 0xFE];

export function create_frame_sender(ssrc: number, readable: Readable): FrameSender {
    const frame_poller = create_length_tracking_poller(create_streamed_frame_poller(readable));

    let started = false;
    readable.on("end", () => {
        started = false;
    })

    return {
        start: async (connection: VoiceConnection, encryption_strategy: EncryptionStrategy) => {
            console.log("[frame/sender] starting...");
            started = true;

            let next = performance.now(), speaking = false, silence = 5;
            function setSpeaking(state: boolean) {
                console.log("[frame/sender] setting speaking state: %s", state);
                if (state) {
                    silence = 5;
                }

                speaking = state;
                send(connection.gateway, {
                    op: 5,
                    d: {
                        speaking: state ? 5 : 0,
                        delay: 0,
                        ssrc,
                    },
                }, "discord/voice");
            }

            const provider = create_packet_provider(ssrc, encryption_strategy)

            let xd = get_nano_time(), frame_times: number[] = [], checkup = create_functional_interval()
            checkup.start(1000, () => {
                const avg_frame_time = frame_times.reduce((a, c) => a + c, 0) / frame_times.length;
                console.log("[frame/sender] checkup, avg frame time:", (avg_frame_time / 1_000).toFixed(2), "µs", "progress:", dayjs
                    .duration(frame_poller.position)
                    .format("mm:ss"));
                frame_times = [];
            })

            while (started) {
                let start = get_nano_time();

                /* poll a frame and handle speaking state. */
                let frame = frame_poller.poll();
                if (frame != null && !speaking) {
                    setSpeaking(true);
                } else if ((frame == null) && speaking && silence == 0) {
                    setSpeaking(false);
                }

                /* if there are more silent frames to be sent make sure the frame is not null. */
                if (frame == null && silence > 0) {
                    frame ??= Buffer.from(silentFrame);
                    silence--
                }

                if (frame != null) {
                    /* create and encrypt an rtp packet with the polled frame. */
                    const rtp = provider.provide(frame);
                    connection.sock.send(rtp, connection.remote.port, connection.remote.ip);
                    frame_times.push(get_nano_time() - start);
                }

                /* wait until the next frame timestamp. */
                next += 20_000_000;
                await sleep(Math.max(0, next - (get_nano_time() - xd)) / 1_000_000);
            }

            console.log("[frame/sender] stopping...");
            checkup.stop();
        },
        stop: () => readable.destroy(),
    };
}

export interface FrameSender {
    stop: () => void;
    start: (connection: VoiceConnection, encryption_strategy: EncryptionStrategy) => Promise<void>;
}