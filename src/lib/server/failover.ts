// Which side of the AWS failover this deployment runs on. Server-only: the browser learns
// about it through the 503 responses, never by reading the variable.
//
// `aws` means the backup server, which has no route to the home LAN. Everything under Domotics
// (printers, lights, uptime) depends on it, so those routes answer 503 with a stable code that
// the clients can recognise. Unset or `home` changes nothing.

export const FAILOVER_CODE = 'unavailable_on_failover';
export const FAILOVER_MESSAGE =
	'Not available while running on the backup server. Back when home is restored.';

const FAILOVER_ROUTES = ['/domotics', '/printers'];

export function onFailover(): boolean {
	return process.env.FAILOVER_SIDE?.trim().toLowerCase() === 'aws';
}

/** True for paths that need the home LAN and so are off while on the backup server. */
export function isFailoverBlocked(pathname: string): boolean {
	return (
		onFailover() &&
		FAILOVER_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
	);
}
