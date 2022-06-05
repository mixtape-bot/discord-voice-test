import type { Readable } from "node:stream";

export function create_streamed_frame_poller(readable: Readable): FramePoller {
    let reading = false;
    readable.on("close", () => {
        reading = false;
    });

    return {
        poll: () => {
            if (!reading) {
                reading = true;
            }

            if (!readable.readable || readable.readableLength === 0) {
                return null;
            }

            return readable.read();
        },
        destroy: () => readable.destroy(),
    };
}

export function create_length_tracking_poller(poller: FramePoller): FramePoller & { position: number } {
    return {
        position: 0,
        poll() {
            const frame = poller.poll();
            if (frame != null) {
                this.position += 20;
            }
            return frame;
        },
        destroy: () => poller.destroy()
    };
}

export type Frame = Uint8Array;

export interface FramePoller {
    destroy(): void;
    poll(): Frame | null;
}