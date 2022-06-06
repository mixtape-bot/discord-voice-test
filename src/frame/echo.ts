import type { VoiceConnection } from "../voice.js";
import type { EncryptionStrategy } from "../secure/encryption.js";
import { read_rtp_packet } from "../packet/rtp.js";
import { ReadonlyBufferCursor } from "../tools/readonly_cursor.js";
import type { FramePoller } from "./poller.js";
import type { RemoteInfo } from "dgram";

export function create_echoing_frame_poller(
    connection: VoiceConnection,
    encryption_strategy: EncryptionStrategy
): FramePoller {
    const frames: Uint8Array[] = [];
    function handle_message(data: Buffer, remote: RemoteInfo) {
        if (data.length < 13) {
            return;
        }

        if (remote.address !== connection.remote?.ip) {
            /* ips do not match discord voice server. */
            return;
        }

        const packet = read_rtp_packet(new ReadonlyBufferCursor(data))
        if (connection.speaking_map.get(packet.header.ssrc) !== "396096412116320258") {
            return;
        }

        const decrypted = encryption_strategy.decrypt_rtp(packet.header, data, packet.payload);
        if (decrypted == null) {
            console.log("cannot decrypt")
            return;
        }

        let opus = Buffer.from(decrypted);
        if (packet.header.has_extension && !packet.header.marker) {
            const extension_length = opus.readUint16BE(2);
            const shift = 4 + 4 * extension_length;
            if (opus.length > shift) opus = opus.subarray(shift);
        }

        if (frames.length >= 10) {
            frames.pop();
        }

        frames.push(opus)
    }

    connection.sock.on("message", handle_message);
    return {
        poll: () => frames.shift() ?? null,
        destroy: () => connection.sock.off("message", handle_message)
    }
}
