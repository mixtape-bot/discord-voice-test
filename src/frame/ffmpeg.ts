import prism from "prism-media";
import type { Duplex } from "node:stream";
import { FramePoller, create_streamed_frame_poller } from "./poller.js";

export function create_stream(input: string): Duplex {
    const args = [
        "-i", input,
        "-analyzeduration", "0",
        "-loglevel", "0",
        "-f", "s16le",
        "-ar", "48000",
        "-ac", "2",
    ];

    if (/^https?:\//.test(input)) {
        /* we want to reconnect if something went wrong */
        args.unshift(
            "-reconnect", "1",
            "-reconnect_streamed", "1",
            "-reconnect_on_network_error", "1",
            "-reconnect_on_http_error", "4xx,5xx",
            "-reconnect_delay_max", "30",
        )
    }

    return new prism.FFmpeg({ args })
        .pipe(new prism.opus.Encoder({ frameSize: 960, channels: 2, rate: 48000 }));
}

export function create_ffmpeg_frame_poller(input: string): FramePoller {
    const readable = create_stream(input);
    console.log("voice - created ffmpeg stream");

    return create_streamed_frame_poller(readable);
}
