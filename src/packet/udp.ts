import type { Socket } from "node:dgram";
import { BufferCursor } from "../tools/mutable_cursor.js";

export function holepunch(sock: Socket, ssrc: number, dst: Address): Promise<Address> {
    return new Promise((res, rej) => {
        const holepunch_packet = BufferCursor.with_size(74)
            .write_uint16_be(0x1)
            .write_uint16_be(70)
            .write_uint32_be(ssrc)
            .data;

        sock.send(holepunch_packet, dst.port, dst.ip, error => {
            if (error) {
                rej(error);
            }

            sock.once("message", resp => {
                const ip = resp.slice(8, resp.indexOf(0, 8)).toString('utf-8');
                res({
                    ip,
                    port: resp.readUInt16BE(resp.length - 2)
                });
            });
        });
    })
}

export interface Address {
    ip: string;
    port: number;
}
