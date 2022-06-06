const CAPACITY_UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];


export function format_bytes(n: number): { amount: number; unit: string } {
    const unit = Math.floor(Math.log(n) / Math.log(1024));
    return {
        amount: +(n / Math.pow(1024, unit)).toFixed(2),
        unit: CAPACITY_UNITS[unit],
    }
}