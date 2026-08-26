/** Host-side registration for the stats panel: no host behavior (data comes
 * from the apiproxy's stats.describe). Entry satisfies the host build face; the
 * visible surface is the browser `./client` plugin. */

/** No-op host plugin body. */
export function apply(): void {
  /* data is read from the stats domain; nothing to do on the host */
}
