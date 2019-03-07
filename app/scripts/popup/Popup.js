class Popup {
  constructor () {
    this.activated = false
  }

  deactivate () {
    this.activated = false
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'destroyContentScript'}, () => {
        chrome.pageAction.setIcon({tabId: tabs[0].id, path: 'images/icon-38-bw.png'})
      })
    })
  }

  activate () {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs.length > 0) {
        // Check if current tab is a local file
        if (tabs[0].url.startsWith('file://')) {
          // Check if permission to access file URL is enabled
          chrome.extension.isAllowedFileSchemeAccess((isAllowedAccess) => {
            if (isAllowedAccess === false) {
              chrome.tabs.create({ url: chrome.runtime.getURL('pages/filePermission.html') })
            } else {
              this.activated = true
              this.sendActivateToTab(tabs[0])
            }
          })
        } else {
          this.activated = true
          this.sendActivateToTab(tabs[0])
        }
      }
    })
  }

  sendActivateToTab (tab) {
    chrome.tabs.sendMessage(tab.id, {action: 'initContentScript'}, () => {
      chrome.pageAction.setIcon({tabId: tab.id, path: 'images/icon-38.png'})
    })
  }
}

module.exports = Popup
