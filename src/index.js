class SolidFetch {
  constructor() {
    this.injectables = () => ({})
    this.interceptedReq = null
    this.interceptedRes = null
    this.interceptedError = null
    this.systemFetch = null
  }

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
      const resolvedQuery = Object.keys(query).reduce((acc, queryKey, idx, array) => {
        const isAnpsConcat = idx + 1 < array.length
        let queryValue = `${queryKey}=${query[queryKey]}`
        if (typeof query[queryKey] === 'function') {
          queryValue = `${queryKey}=${query[queryKey](this.getInjectables())}`
        }
        return `${acc}${isAnpsConcat ? '&' : ''}${queryValue}`
      }, path.includes('?') ? '&' : '?')

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
      }

      return this.systemFetch(url, requestOptions)
        .then((res) => {
          if (res.status !== 200) {
            console.log('got an error back')
            throw new Error(JSON.stringify({
              message: 'request resulted in error',
              error: {
                url: res.url,
                status: res.status,
                statusText: res.statusText,
                headers: res.headers,
                counter: res.counter,
              },
              request: {
                url,
                requestOptions,
              },
            }))
          }
          if (this.interceptedRes) {
            const interceptedResValue = this.interceptedRes(res)
            if (interceptedResValue) {
              return interceptedResValue
            }
          }
          return res
        })
        .catch((error) => {
          console.log('caught general error:', error)
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
