/** Host-side registration for the update-check feature: no host behavior (the
 * GitHub probe lives in the apiproxy's host.checkUpdate). The visible surface
 * is the browser `./client` plugin; this entry satisfies the host build face. */

/** No-op host plugin body. */
export function apply(): void {
  /* the probe is server-side; nothing to do on the host */
}
