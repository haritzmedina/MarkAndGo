class URLUtils {
  /**
   * Given a url with format https://domain.org#elem:abc&elem:bcd it returns you the object {elem: 'abc', elem: 'bcd'}
   * @param url
   * @returns {{}}
   */
  static extractHashParamsFromUrl (url, separator) {
    separator = separator || ':'
    let splittedUrl = url.split('#')
    let result = null
    if (splittedUrl.length > 1) {
      let hash = splittedUrl[1]
      result = hash.split('&').reduce((result, item) => {
        let parts = item.split(separator)
        result[parts[0]] = parts[1]
        return result
      }, {})
    }
    return result
  }

  /**
   * Check if both urls are the same without hash params, protocol, and so on
   * @param url1
   * @param url2
   */
  static areSameURI (url1, url2) {
    let cleanUrl1 = url1.replace(/(^\w+:|^)\/\//, '').split('#')[0]
    let cleanUrl2 = url2.replace(/(^\w+:|^)\/\//, '').split('#')[0]
    return cleanUrl1 === cleanUrl2
  }

  /**
   * From a url, it removes hash params or other extra content which is not an unique source reference URL
   */
  static retrieveMainUrl (url) {
    return url.split('#')[0] // Remove the hash
  }

  static retrieveDomainFromURL (url) {
    let hostname
    // Remove the protocol
    if (url.indexOf('://') > -1) {
      hostname = url.split('/')[2]
    } else {
      hostname = url.split('/')[0]
    }
    // Find & remove port number
    hostname = hostname.split(':')[0]
    // Find & remove "?"
    hostname = hostname.split('?')[0]
    return hostname
  }
}

module.exports = URLUtils