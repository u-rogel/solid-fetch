class SolidFetch {
  constructor() {
    this.injectables = () => ({})
    this.interceptedReq = null
    this.interceptedRes = null
    this.interceptedError = null
    this.systemFetch = null
  }

  #emptySearch = /\?$/

  #searchWithParam = /\?.+$/

  setConfig(config) {
    const newConfigKeys = Object.keys(config)
    newConfigKeys.forEach((key) => {
      this[key] = config[key]
    })
  }

  setInjectables(newInjectables) {
    const currentInjectables = this.injectables()
    this.injectables = () => ({
      ...currentInjectables,
      ...newInjectables,
    })
  }

  getInjectables() {
    const currentInjectables = this.injectables()
    return Object.keys(currentInjectables).reduce((acc, key) => {
      let value = currentInjectables[key]
      if (typeof currentInjectables[key] === 'function') {
        value = currentInjectables[key]()
      }
      return { ...acc, [key]: value }
    }, {})
  }

  resolveDynamic(withDynamicParams) {
    if (Array.isArray(withDynamicParams)) {
      let resolvedParams = []
      if (withDynamicParams && withDynamicParams.length) {
        resolvedParams = withDynamicParams.map((item) => {
          if (typeof item === 'function') {
            return item(this.getInjectables())
          }
          return item
        })
      }
      return resolvedParams
    }
    let resolvedParams = {}
    const dynamicKeys = Object.keys(withDynamicParams)
    if (dynamicKeys.length) {
      resolvedParams = dynamicKeys.map((key) => {
        if (typeof withDynamicParams[key] === 'function') {
          return withDynamicParams[key](this.getInjectables())
        }
        return withDynamicParams[key]
      })
    }

    return resolvedParams
  }

  generateRequest(pathStructure, ...dynamicParams) {
    const resolvedParams = this.resolveDynamic(dynamicParams)
    const url = pathStructure.reduce((acc, val, idx, arr) => {
      let mergedPathWithParams = `${val}`
      if (idx !== arr.length - 1 && resolvedParams[idx]) {
        mergedPathWithParams = `${mergedPathWithParams}${resolvedParams[idx]}`
      }
      return `${acc}${mergedPathWithParams}`
    }, '')

    return url
  }

  request(pathStructure, ...dynamicParams) {
    const path = this.generateRequest(pathStructure, ...dynamicParams)

    return ({
      method = 'GET',
      headers = {},
      body,
      query = {},
    } = {}) => {
      if (!this.systemFetch) {
        throw new Error('Fetch has to be declared before the request-client can work')
      }

      let searchQueryPrepend = ''
      if (this.#emptySearch.test(path)) {
        searchQueryPrepend = ''
      } else if (this.#searchWithParam.test(path)) {
        searchQueryPrepend = '&'
      } else {
        searchQueryPrepend = '?'
      }

      const resolvedQuery = Object.keys(query).reduce((acc, queryKey, idx, array) => {
        const isAnpsConcat = idx + 1 < array.length
        let queryValue = `${queryKey}=${query[queryKey]}`
        if (typeof query[queryKey] === 'function') {
          queryValue = `${queryKey}=${query[queryKey](this.getInjectables())}`
        }
        return `${acc}${queryValue}${isAnpsConcat ? '&' : ''}`
      }, searchQueryPrepend)

      const url = `${path}${resolvedQuery}`

      const setHeaders = Object.keys(headers).reduce((headerAcc, headerKey) => {
        let headerValue = headers[headerKey]
        if (typeof headers[headerKey] === 'function') {
          headerValue = headers[headerKey](this.getInjectables())
        }
        return { ...headerAcc, [headerKey]: headerValue }
      }, {})

      const requestOptions = {
        method,
        headers: {
          ...setHeaders,
        },
        body,
      }

      return this.systemFetch(url, requestOptions)
        .then(async (response) => {
          if (response.status !== 200) {
            throw new Error(JSON.stringify({
              message: 'request resulted in error',
              error: {
                url: response.url,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                counter: response.counter,
              },
              request: {
                url,
                requestOptions,
              },
            }))
          }
          let result
          if (response.headers['content-type'] === 'application/json') {
            result = await response.json()
          } else {
            result = response
          }
          if (this.interceptedRes) {
            const interceptedResValue = this.interceptedRes(result)
            if (interceptedResValue) {
              return interceptedResValue
            }
          }
          return result
        })
        .catch((error) => {
          if (this.interceptedError) {
            const interceptedResValue = this.interceptedError(error)
            if (interceptedResValue) {
              throw new Error(interceptedResValue)
            }
          }
          throw new Error(error)
        })
    }
  }
}

module.exports = new SolidFetch()
