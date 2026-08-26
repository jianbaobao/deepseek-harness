/** Host-side registration for the plugin center: no host behavior (data comes
 * from GitHub's public search API). Entry satisfies the host build face; the
 * visible surface is the browser `./client` plugin. */

/** No-op host plugin body. */
export function apply(): void {
  /* plugin list is fetched browser-side; nothing to do on the host */
}
