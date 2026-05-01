export const SETTINGS_FOCUS_EVENT = 'pulselocal:focus-settings-section'
export const LIBRARY_SOURCES_SECTION = 'library-sources'

function dispatchSettingsFocus(section: string) {
  window.dispatchEvent(
    new CustomEvent(SETTINGS_FOCUS_EVENT, {
      detail: {
        section
      }
    })
  )
}

export function navigateToLibrarySourceSettings() {
  window.location.hash = `#/settings?focus=${LIBRARY_SOURCES_SECTION}`
  window.setTimeout(() => {
    dispatchSettingsFocus(LIBRARY_SOURCES_SECTION)
  }, 0)
}
