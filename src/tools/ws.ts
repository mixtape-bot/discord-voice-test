import type WebSocket from "ws";

export function send(sock: WebSocket, payload: any, name: string = sock.url) {
    const json = JSON.stringify(payload)
    console.debug(name ? `[${name}] <<<` : "<<<", json)

    sock.send(json);
}

export function get_data(data: WebSocket.Data) {
    if (data instanceof ArrayBuffer) {
        return Buffer.from(data);
    } else if (typeof data === "string") {
        return Buffer.from(data, "utf8")
    } else if (Array.isArray(data)) {
        return Buffer.concat(data);
    }

    return data;
}
