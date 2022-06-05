export function get_nano_time() {
    const hrTime = process.hrtime();
    return hrTime[0] * 1000000000 + hrTime[1];
}

export function create_functional_interval(): FunctionalTimeout {
    let id: NodeJS.Timeout;
    return {
        start: (duration, callback) => id = setInterval(callback, duration),
        stop: () => clearInterval(id),
    };
}

export interface FunctionalTimeout {
    start: (duration: number, callback: () => void) => NodeJS.Timeout;
    stop: () => void;
}
